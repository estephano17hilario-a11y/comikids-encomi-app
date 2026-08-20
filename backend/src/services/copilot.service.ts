import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { queryCopilotWithUsage } from './ai.service.js';
import { EvolutionService } from './evolution.service.js';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';
import { EvolutionMessageData } from '../types/evolution.types.js';

interface SubInstanceMeta {
  instanceName: string;
  ownerPhone: string;
  profileName: string;
  status: string;
  accountCode: string;
}

// 1. LISTA DE NÚMEROS ADMINISTRATIVOS PERMITIDOS (WHITELIST)
const ALLOWED_ADMIN_PHONES = new Set([
  '51963097546', // Estephano (Admin)
  '51927781412', // Comikids Pijamas
  '51901985319', // Master Bot
  '963097546',
  '927781412',
  '901985319',
]);

// 2. CUENTAS / SUB-QRS PREDEFINIDOS CON SUS CÓDIGOS DE ACCESO
interface KnownAccount {
  code: string;
  aliases: string[];
  instanceName: string;
  ownerPhone: string;
  displayName: string;
  empresaId: string;
}

const KNOWN_ACCOUNTS: KnownAccount[] = [
  {
    code: 'COMIKIDS',
    aliases: ['1', 'COM', 'COMIKIDS', 'COM-01', '927781412', '51927781412', 'PIJAMAS', '061625', '989834969MI'],
    instanceName: 'tenant_Comikids',
    ownerPhone: '51927781412',
    displayName: 'Comikids Pijamas (Línea Principal)',
    empresaId: 'empresa-master-comikids',
  },
  {
    code: 'MATRIX',
    aliases: ['2', 'MAT', 'MATRIX', 'ADM-01', '963097546', '51963097546', 'ESTEPHANO'],
    instanceName: 'tenant_matrix',
    ownerPhone: '51963097546',
    displayName: 'Estephano Matrix (Línea Personal)',
    empresaId: 'empresa-master-comikids',
  },
];

// Límite diario de tokens por cuenta de Sub-QR (500,000 tokens)
const DAILY_TOKEN_LIMIT = 500_000;

export class CopilotService {
  /**
   * Obtiene la metadata de una sub-instancia por nombre o número
   */
  private static async getSubInstanceByName(targetInstanceName: string): Promise<SubInstanceMeta | null> {
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 10000,
      });

      const instances = Array.isArray(response.data) ? response.data : [];
      const sub = instances.find((i: any) => i.name === targetInstanceName);

      if (sub) {
        const ownerClean = sub.ownerJid?.replace(/[^0-9]/g, '') || '';
        return {
          instanceName: sub.name,
          ownerPhone: ownerClean,
          profileName: sub.profileName || sub.name,
          status: sub.connectionStatus || 'open',
          accountCode: sub.name.replace(/^tenant_/, '').toUpperCase(),
        };
      }
      return null;
    } catch (e) {
      console.warn('[COPILOT SUB-INSTANCE WARN] Error buscando sub-instancia:', e);
      return null;
    }
  }

  /**
   * Obtiene la fecha en zona horaria Perú (UTC-5) para control de cuota diaria
   */
  private static getTodayDateString(): string {
    const now = new Date();
    const peruOffset = -5 * 60; // minutos
    const peruTime = new Date(now.getTime() + (peruOffset + now.getTimezoneOffset()) * 60000);
    return peruTime.toISOString().slice(0, 10);
  }

  /**
   * Obtiene el consumo actual de tokens del día para una cuenta Sub-QR
   */
  private static async getDailyTokenUsage(accountCode: string): Promise<number> {
    try {
      const today = this.getTodayDateString();
      const key = `copilot:tokens:${accountCode.toUpperCase()}:${today}`;
      const val = await redisClient.get(key);
      return Number(val) || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Incrementa el consumo de tokens en Redis
   */
  private static async incrementTokenUsage(accountCode: string, tokensUsed: number): Promise<number> {
    try {
      const today = this.getTodayDateString();
      const key = `copilot:tokens:${accountCode.toUpperCase()}:${today}`;
      const newTotal = await redisClient.incrby(key, tokensUsed);
      await redisClient.expire(key, 86400 * 2); // 48 horas de retención
      return newTotal;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Respaldo incremental y snapshot en memoria/Redis para máxima velocidad y reducción de tokens
   */
  private static async recordIncrementalBackup(empresaId: string, action: string, data: any): Promise<void> {
    try {
      const backupEntry = {
        timestamp: new Date().toISOString(),
        action,
        data,
      };
      const logKey = `copilot:backup_log:${empresaId}`;
      await redisClient.lpush(logKey, JSON.stringify(backupEntry));
      await redisClient.ltrim(logKey, 0, 49); // Guardar los últimos 50 backups
      await redisClient.del(`copilot:cache:orders:${empresaId}`); // Invalidar caché para refresh
    } catch (err) {
      console.warn('[BACKUP WARN]', err);
    }
  }

  /**
   * Obtiene snapshot de datos de negocio con caché inteligente en Redis
   */
  private static async getBusinessSnapshot(empresaId: string): Promise<{
    ordersSummary: string;
    paymentsSummary: string;
    metrics: { totalOrders: number; pendingProduction: number; pendingDelivery: number };
  }> {
    const cacheKey = `copilot:cache:orders:${empresaId}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Ignorar error de caché y consultar DB
    }

    // Consulta en vivo a Supabase
    const { data: recentOrders, count: totalOrdersCount } = await supabaseAdmin
      .from('pedidos')
      .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(15);

    const { data: recentPayments } = await supabaseAdmin
      .from('comprobantes_pago')
      .select('created_at, banco_emisor, monto, moneda, numero_operacion, titular_origen, es_valido, estado_verificacion, whatsapp_sender')
      .not('banco_emisor', 'eq', 'Desconocido')
      .order('created_at', { ascending: false })
      .limit(10);

    const ordersList = recentOrders || [];
    const pendingProd = ordersList.filter(o => o.estado_produccion === 'en_cola' || o.estado_produccion === 'bordando').length;
    const pendingDel = ordersList.filter(o => o.estado_envio === 'pendiente' || o.estado_envio === 'en_camino').length;

    const ordersSummary = ordersList.length > 0
      ? ordersList.map(o => {
          const user = Array.isArray(o.usuario) ? o.usuario[0] : o.usuario;
          const name = user?.nombre_completo || 'Cliente';
          const dni = user?.dni || 'S/DNI';
          const cel = user?.telefono_default || '';
          return `• #${o.codigo_seguimiento || o.id?.slice(0, 8)} | ${name} (DNI: ${dni}${cel ? `, Cel: ${cel}` : ''}) | Destino: ${o.destino_detalle || 'Agencia'} | Prod: ${o.estado_produccion || 'en_cola'} | Envío: ${o.estado_envio || 'pendiente'} | Prendas: ${o.detalles_bordado || 'Bordado'}${o.shalom_clave_recojo ? ` | Clave: ${o.shalom_clave_recojo}` : ''}`;
        }).join('\n')
      : 'No hay pedidos activos actualmente en el sistema.';

    const paymentsSummary = recentPayments && recentPayments.length > 0
      ? recentPayments.map(p => `• [${new Date(p.created_at).toLocaleTimeString('es-PE')}] ${p.banco_emisor} ${p.moneda} ${p.monto} (Op: ${p.numero_operacion || 'S/N'}, De: ${p.titular_origen || p.whatsapp_sender})`).join('\n')
      : 'No hay comprobantes de pago registrados recientemente.';

    const snapshot = {
      ordersSummary,
      paymentsSummary,
      metrics: {
        totalOrders: totalOrdersCount || ordersList.length,
        pendingProduction: pendingProd,
        pendingDelivery: pendingDel,
      },
    };

    try {
      await redisClient.set(cacheKey, JSON.stringify(snapshot), 'EX', 180); // Caché 3 minutos
    } catch (e) {
      // Ignorar error al escribir caché
    }

    return snapshot;
  }

  /**
   * Resuelve la consulta o ejecuta la acción solicitada por el administrador del negocio
   * con acceso completo a la base de datos de su cuenta según el Sub-QR autenticado.
   */
  public static async answerCopilotQuery(
    userPhone: string,
    remoteJid: string,
    queryText: string,
    messageData?: EvolutionMessageData
  ): Promise<string> {
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const masterInstance = env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';
    const textTrimmed = (queryText || '').trim();

    try {
      console.log(`[COPILOT SERVICE] 🧠 Procesando mensaje de ${cleanPhone}: "${textTrimmed}"`);

      // -------------------------------------------------------------
      // PASO 1: VERIFICAR LISTA DE NÚMEROS PERMITIDOS (WHITELIST)
      // -------------------------------------------------------------
      const isAllowed = ALLOWED_ADMIN_PHONES.has(cleanPhone) || ALLOWED_ADMIN_PHONES.has(cleanPhone.slice(-9));
      if (!isAllowed) {
        console.warn(`[COPILOT AUTH] Número no autorizado intentó acceder: ${cleanPhone}`);
        const accessDeniedMsg = '⛔ *Acceso Restringido*\n\nEste canal es privado para el personal administrativo y operativo autorizado de Encomi / Comikids.';
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, accessDeniedMsg);
        return accessDeniedMsg;
      }

      // -------------------------------------------------------------
      // PASO 2: COMANDO PARA CAMBIAR DE CUENTA / LOGOUT
      // -------------------------------------------------------------
      const normalizedQuery = textTrimmed.toLowerCase();
      const sessionKey = `copilot:session:${cleanPhone}`;

      const isSwitchAccountIntent =
        normalizedQuery.includes('cambiar cuenta') ||
        normalizedQuery.includes('cambiar de cuenta') ||
        normalizedQuery.includes('cambiar mi cuenta') ||
        normalizedQuery.includes('cambiar sub qr') ||
        normalizedQuery.includes('cambiar el sub qr') ||
        normalizedQuery.includes('cambiar de sub qr') ||
        normalizedQuery.includes('cambiar qr') ||
        normalizedQuery.includes('me equivoque') ||
        normalizedQuery.includes('me equivoqué') ||
        normalizedQuery.includes('otra cuenta') ||
        normalizedQuery.includes('usar otra cuenta') ||
        normalizedQuery.includes('codigo unico') ||
        normalizedQuery.includes('código único') ||
        normalizedQuery === '/cambiar' ||
        normalizedQuery === '/cambiar_cuenta' ||
        normalizedQuery === 'cambiar' ||
        normalizedQuery === '/logout' ||
        normalizedQuery === 'cerrar sesion' ||
        normalizedQuery === 'salir';

      if (isSwitchAccountIntent) {
        await redisClient.del(sessionKey);
        const switchMenuMsg = `🔄 *Cambio de Cuenta de Sub-QR y Base de Datos*\n\nIngresa el *CÓDIGO O CONTRASEÑA* de la cuenta de empresa a la que deseas conectarte:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Comikids Pijamas (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Estephano Matrix (+51 963 097 546)\n\n💬 *Responde con tu contraseña o código para activar la cuenta:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, switchMenuMsg);
        return switchMenuMsg;
      }

      // -------------------------------------------------------------
      // PASO 3: GESTIÓN DE SESIÓN Y VINCULACIÓN DE CÓDIGO/CONTRASEÑA
      // -------------------------------------------------------------
      let sessionRaw = await redisClient.get(sessionKey);
      let sessionData: {
        accountCode: string;
        empresaId: string;
        instanceName: string;
        ownerPhone: string;
        displayName: string;
      } | null = sessionRaw ? JSON.parse(sessionRaw) : null;

      // Si aún no tiene cuenta vinculada en su sesión
      if (!sessionData) {
        // Verificar si el mensaje actual es un intento de ingresar el código o contraseña
        let matchedAccount: KnownAccount | null = null;

        // A. Comparar contra cuentas predefinidas
        const foundPredefined = KNOWN_ACCOUNTS.find(acc =>
          acc.aliases.some(alias => alias.toLowerCase() === normalizedQuery) ||
          acc.code.toLowerCase() === normalizedQuery
        );

        if (foundPredefined) {
          matchedAccount = foundPredefined;
        } else {
          // B. Comparar contra Supabase tabla usuarios con rol 'empresa'
          const { data: dbEmpresa } = await supabaseAdmin
            .from('usuarios')
            .select('id, dni, nombre_completo, password_hash, rol')
            .eq('rol', 'empresa')
            .or(`dni.eq."${textTrimmed}",password_hash.eq."${textTrimmed}",nombre_completo.ilike."%${textTrimmed}%"`)
            .maybeSingle();

          if (dbEmpresa) {
            matchedAccount = {
              code: dbEmpresa.dni || 'EMPRESA',
              aliases: [dbEmpresa.dni, dbEmpresa.password_hash],
              instanceName: 'tenant_Comikids',
              ownerPhone: '51927781412',
              displayName: dbEmpresa.nombre_completo || 'Empresa Encomi',
              empresaId: dbEmpresa.id,
            };
          }
        }

        if (matchedAccount) {
          sessionData = {
            accountCode: matchedAccount.code,
            empresaId: matchedAccount.empresaId,
            instanceName: matchedAccount.instanceName,
            ownerPhone: matchedAccount.ownerPhone,
            displayName: matchedAccount.displayName,
          };

          // Guardar sesión vinculada por 7 días
          await redisClient.set(sessionKey, JSON.stringify(sessionData), 'EX', 86400 * 7);

          const currentTokens = await this.getDailyTokenUsage(matchedAccount.code);
          const remainingTokens = Math.max(0, DAILY_TOKEN_LIMIT - currentTokens);

          const welcomeMsg = `✅ *¡Cuenta y Base de Datos Vinculada con Éxito!*\n\n🏢 *Empresa:* ${matchedAccount.displayName}\n📱 *Línea Sub-QR Activa:* +${matchedAccount.ownerPhone}\n⚡ *Instancia:* \`${matchedAccount.instanceName}\`\n🪙 *Límite de Tokens Diario:* ${remainingTokens.toLocaleString()} / 500,000 tokens disponibles hoy\n\n🛠️ *Capacidades habilitadas en tu Base de Datos:*\n• 📦 *Registrar pedidos:* Envíame los datos completos (DNI, nombre, destino Shalom, WhatsApp y prendas) y registraré el pedido emitiendo su comprobante oficial.\n• 🔍 *Consultar pedidos y métricas:* Pregúntame por cualquier pedido, estado de bordado, envíos pendientes o resumen financiero.\n• ✏️ *Actualizar estados:* Cambia estados de producción, envío o datos de destino.\n• 🚀 *Despachos WhatsApp:* Envío directo de mensajes y archivos a clientas desde tu línea +${matchedAccount.ownerPhone}.\n\n💡 *¿En qué te puedo ayudar hoy?*\n_(Escribe *cambiar cuenta* en cualquier momento para alternar a otro Sub-QR)_`;

          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, welcomeMsg);
          return welcomeMsg;
        }

        // Si no coincidió con ningún código o contraseña, pedirle autenticación
        const authRequestMsg = `👋 *¡Hola! Bienvenido al Copiloto Encomi AI (encomi.vercel.app)*\n\n🔒 Para conectarte y darte acceso total a la base de datos de tu empresa, ingresa tu *Código de Cuenta o Contraseña de Empresa*:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Comikids Pijamas (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Estephano Matrix (+51 963 097 546)\n\n💬 *Por favor escribe tu contraseña o código para continuar:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, authRequestMsg);
        return authRequestMsg;
      }

      // -------------------------------------------------------------
      // PASO 4: CONTROL DE LÍMITE DIARIO DE 500,000 TOKENS POR SUB-QR
      // -------------------------------------------------------------
      const currentTokenUsage = await this.getDailyTokenUsage(sessionData.accountCode);
      if (currentTokenUsage >= DAILY_TOKEN_LIMIT) {
        console.warn(`[COPILOT TOKENS LIMIT] Cuenta ${sessionData.accountCode} superó el límite diario (${currentTokenUsage} >= ${DAILY_TOKEN_LIMIT})`);
        const limitMsg = `⚠️ *Límite Diario de IA Alcanzado (${currentTokenUsage.toLocaleString()} / 500,000 tokens)*\n\nTu cuenta *${sessionData.displayName}* ha llegado al consumo máximo diario permitido de 500k tokens para el Copiloto Encomi AI.\n\n🔄 Tu cuota se reiniciará automáticamente a la medianoche (00:00 hora Perú). Puedes continuar gestionando tus pedidos en el panel web: https://encomi.vercel.app`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, limitMsg);
        return limitMsg;
      }

      // -------------------------------------------------------------
      // PASO 5: SESIÓN AUTORIZADA — RESOLVER SUB-INSTANCIA VINCULADA
      // -------------------------------------------------------------
      let linkedSub = await this.getSubInstanceByName(sessionData.instanceName);
      if (!linkedSub) {
        linkedSub = await this.getSubInstanceByName('tenant_Comikids');
      }

      const userSenderInstance = linkedSub?.instanceName || sessionData.instanceName || 'tenant_Comikids';
      const userSenderPhone = linkedSub?.ownerPhone || sessionData.ownerPhone || '51927781412';
      const userName = sessionData.displayName || 'Comikids';

      // -------------------------------------------------------------
      // PASO 6: OBTENER SNAPSHOT DE BASE DE DATOS Y ESTADÍSTICAS
      // -------------------------------------------------------------
      const snapshot = await this.getBusinessSnapshot(sessionData.empresaId);

      const isImage = Boolean(messageData?.message?.imageMessage);
      const isDoc = Boolean(messageData?.message?.documentMessage);
      const hasAttachedMedia = isImage || isDoc;
      const attachedFileName =
        messageData?.message?.documentMessage?.fileName ||
        messageData?.message?.documentMessage?.title ||
        (isImage ? 'imagen_adjunta.jpg' : 'documento.pdf');
      const attachedMimeType =
        messageData?.message?.documentMessage?.mimetype ||
        messageData?.message?.imageMessage?.mimetype ||
        (isImage ? 'image/jpeg' : 'application/pdf');

      // -------------------------------------------------------------
      // PASO 7: PROMPT DEL SISTEMA OPTIMIZADO PARA AHORRO DE TOKENS
      // -------------------------------------------------------------
      const masterPrompt = `
Eres el "Copiloto Master de Inteligencia de Negocios y Operaciones de Base de Datos" de Encomi SaaS (encomi.vercel.app).
Estás interactuando directamente con el administrador de la cuenta: ${userName} (Línea Sub-QR vinculada: +${userSenderPhone}).

INFORMACIÓN DE ACCESO:
- Cuenta de Empresa: "${sessionData.displayName}"
- Línea de Despacho Sub-QR: +${userSenderPhone} (${userSenderInstance})
- Tokens consumidos hoy: ${currentTokenUsage.toLocaleString()} / 500,000 tokens
- Archivo adjunto: ${hasAttachedMedia ? `SÍ (${isImage ? 'IMAGEN' : 'DOCUMENTO'}: ${attachedFileName})` : 'NO'}

ESTADO ACTUAL DE BASE DE DATOS:
- Total pedidos en sistema: ${snapshot.metrics.totalOrders}
- Pendientes de bordado: ${snapshot.metrics.pendingProduction}
- Pendientes de envío: ${snapshot.metrics.pendingDelivery}

--- ÚLTIMOS PEDIDOS REGISTRADOS ---
${snapshot.ordersSummary}

--- ÚLTIMOS COMPROBANTES DE PAGO ---
${snapshot.paymentsSummary}
--- FIN DATOS ---

MENSAJE / INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

--- PROTOCOLOS Y ACCIONES PERMITIDAS (RESPONDE EN FORMATO JSON ESTRICTO CUANDO CORRESPONDA) ---

1. REGISTRO DE NUEVO PEDIDO:
Si el usuario te pide registrar un pedido (ej: "registra este pedido: María Gómez, DNI 45892134, destino Shalom Trujillo, cel 987123456, 2 pijamas"):
Debes evaluar si están TODOS los 5 datos obligatorios:
  1. Nombre completo de la clienta (nombre)
  2. DNI o Carnet de Extranjería (dni)
  3. Número de WhatsApp de la clienta (telefono - 9 dígitos)
  4. Lugar de destino / Agencia Shalom (destino)
  5. Prendas o detalles de bordado (detalles)

- SI FALTA ALGÚN DATO OBLIGATORIO:
Responde cordialmente en texto plano indicando exactamente qué datos faltan para proceder al registro.

- SI ESTÁN TODOS LOS 5 DATOS PRESENTES:
Responde ÚNICAMENTE con este JSON:
\`\`\`json
{
  "action": "CREATE_ORDER",
  "clienteNombre": "Nombre de la clienta",
  "clienteDni": "12345678",
  "clienteTelefono": "987654321",
  "destino": "Agencia Shalom Trujillo",
  "prendasBordado": "2 Pijamas térmicas bordadas",
  "metodoEnvio": "Agencia Shalom",
  "observaciones": ""
}
\`\`\`

2. ACTUALIZACIÓN DE PEDIDO EXISTENTE:
Si el usuario te pide actualizar el estado de producción, envío o destino de un pedido (ej: "marca el pedido #1045 como completado", "actualiza el destino de #COM-2026 a Cusco"):
Responde ÚNICAMENTE con este JSON:
\`\`\`json
{
  "action": "UPDATE_ORDER",
  "searchKey": "1045 o código o DNI",
  "estadoProduccion": "completado / en_cola / bordando",
  "estadoEnvio": "pendiente / en_camino / entregado",
  "nuevoDestino": "opcional",
  "claveShalom": "opcional"
}
\`\`\`

3. ORDEN DE ENVIAR MENSAJE O ARCHIVO POR WHATSAPP A CLIENTA:
Si el usuario te pide enviar un mensaje o archivo a un número de cliente desde su Sub-QR:
Responde ÚNICAMENTE con este JSON:
\`\`\`json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "targetPhone": "987654321",
  "text": "Texto a enviar",
  "mediaUrl": null,
  "sendAttachedDoc": ${hasAttachedMedia},
  "mediaType": "${isImage ? 'image' : (isDoc ? 'document' : 'image')}",
  "fileName": "${attachedFileName}"
}
\`\`\`

4. CONSULTAS DE NEGOCIO, ANÁLISIS O RESPUESTAS CONVERSACIONALES:
Responde en texto plano con tono profesional, amable y conciso, utilizando los datos reales de la base de datos.
`;

      const aiResult = await queryCopilotWithUsage(masterPrompt, textTrimmed);
      const aiResponse = aiResult.content;
      const tokensUsed = aiResult.tokensUsed;

      // Registrar consumo de tokens de esta consulta
      await this.incrementTokenUsage(sessionData.accountCode, tokensUsed);

      // -------------------------------------------------------------
      // PASO 8: EJECUCIÓN DE ACCIONES EN BASE DE DATOS O WHATSAPP
      // -------------------------------------------------------------
      const jsonMatch =
        aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
        aiResponse.match(/(\{[\s\S]*"action"\s*:\s*"(?:CREATE_ORDER|UPDATE_ORDER|SEND_WHATSAPP_MESSAGE)"[\s\S]*\})/);

      if (jsonMatch) {
        try {
          const actionData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

          // =========================================================
          // ACCIÓN A: CREAR PEDIDO EN BASE DE DATOS
          // =========================================================
          if (actionData.action === 'CREATE_ORDER') {
            const { clienteNombre, clienteDni, clienteTelefono, destino, prendasBordado, metodoEnvio, observaciones } = actionData;

            // Validación estricta final
            if (!clienteNombre || !clienteDni || !clienteTelefono || !destino || !prendasBordado) {
              const missingFieldsMsg = `📋 *Faltan datos para registrar el pedido:*\nPor favor proporciona todos los datos obligatorios: Nombre, DNI, WhatsApp (9 dígitos), Destino y Prendas/Bordado.`;
              await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, missingFieldsMsg);
              return missingFieldsMsg;
            }

            const cleanDni = String(clienteDni).replace(/[^0-9A-Za-z]/g, '').trim();
            let cleanTel = String(clienteTelefono).replace(/[^0-9]/g, '');
            if (cleanTel.length === 9) cleanTel = `51${cleanTel}`;

            // 1. Upsert Usuario en Supabase
            const userId = `usr-${cleanDni}`;
            await supabaseAdmin.from('usuarios').upsert({
              id: userId,
              dni: cleanDni,
              nombre_completo: clienteNombre.trim(),
              telefono_default: cleanTel,
              dni_default: cleanDni,
              direccion_default: destino,
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanDni}`,
              password_hash: cleanDni,
              rol: 'cliente',
            }, { onConflict: 'dni' });

            // 2. Generar Código de Seguimiento Único
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const trackingCode = `COM-2026-${randomCode}`;
            const orderId = `ped-${Date.now()}`;

            // 3. Insertar Pedido en Supabase
            const { data: newOrder, error: orderErr } = await supabaseAdmin.from('pedidos').insert({
              id: orderId,
              codigo_seguimiento: trackingCode,
              usuario_id: userId,
              detalles_bordado: prendasBordado,
              metodo_envio_codigo: 'shalom',
              metodo_envio_nombre: metodoEnvio || 'Agencia Shalom',
              destino_detalle: destino,
              estado_produccion: 'en_cola',
              estado_envio: 'pendiente',
              observaciones_cliente: observaciones || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select().single();

            if (orderErr) {
              throw new Error(`Error guardando pedido: ${orderErr.message}`);
            }

            // 4. Registrar Backup Incremental
            await this.recordIncrementalBackup(sessionData.empresaId, 'CREATE_ORDER', {
              orderId,
              trackingCode,
              clienteNombre,
              clienteDni,
              destino,
              prendasBordado,
            });

            // 5. Emitir Comprobante de Registro Oficial
            const receiptMsg = `🎉 *¡Pedido Registrado con Éxito en el Sistema!* 📦✨\n\n━━━━━━━━━━━━━━━━━━━━\n🆔 *Código de Orden:* *#${trackingCode.replace(/\D/g, '') || trackingCode}*\n🔍 *Seguimiento:* ${trackingCode}\n👤 *Cliente:* ${clienteNombre}\n🪪 *DNI:* ${cleanDni}\n📱 *WhatsApp:* +${cleanTel}\n📍 *Destino:* ${destino}\n🧵 *Prendas / Bordado:* ${prendasBordado}\n🚚 *Método:* ${metodoEnvio || 'Agencia Shalom'}\n⏳ *Estado:* En Cola de Bordado (Pendiente de Envío)\n━━━━━━━━━━━━━━━━━━━━\n\n💾 *Sincronizado y respaldado en la base de datos de ${sessionData.displayName}.*\n🌐 *Rastreo en vivo:* https://encomi.vercel.app`;

            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, receiptMsg);
            return receiptMsg;
          }

          // =========================================================
          // ACCIÓN B: ACTUALIZAR PEDIDO EXISTENTE EN BASE DE DATOS
          // =========================================================
          else if (actionData.action === 'UPDATE_ORDER') {
            const { searchKey, estadoProduccion, estadoEnvio, nuevoDestino, claveShalom } = actionData;
            const cleanKey = String(searchKey || '').replace(/[^a-zA-Z0-9-]/g, '').trim();

            const updatePayload: any = { updated_at: new Date().toISOString() };
            if (estadoProduccion) updatePayload.estado_produccion = estadoProduccion;
            if (estadoEnvio) updatePayload.estado_envio = estadoEnvio;
            if (nuevoDestino) updatePayload.destino_detalle = nuevoDestino;
            if (claveShalom) updatePayload.shalom_clave_recojo = claveShalom;

            const { data: updatedOrders, error: updErr } = await supabaseAdmin
              .from('pedidos')
              .update(updatePayload)
              .or(`id.ilike.%${cleanKey}%,codigo_seguimiento.ilike.%${cleanKey}%`)
              .select('id, codigo_seguimiento, estado_produccion, estado_envio, destino_detalle');

            if (updErr || !updatedOrders || updatedOrders.length === 0) {
              const notFoundMsg = `⚠️ No se encontró ningún pedido con el identificador "${searchKey}". Verifica el número de orden o código de seguimiento.`;
              await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, notFoundMsg);
              return notFoundMsg;
            }

            const targetOrder = updatedOrders[0];
            await this.recordIncrementalBackup(sessionData.empresaId, 'UPDATE_ORDER', {
              orderId: targetOrder.id,
              changes: updatePayload,
            });

            const updateConfirmMsg = `✅ *Pedido Actualizado con Éxito en Base de Datos*\n\n🔖 *Pedido:* #${targetOrder.codigo_seguimiento}\n🧵 *Producción:* ${targetOrder.estado_produccion}\n🚚 *Envío:* ${targetOrder.estado_envio}\n📍 *Destino:* ${targetOrder.destino_detalle}\n\n💾 *Cambios respaldados en tiempo real.*`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, updateConfirmMsg);
            return updateConfirmMsg;
          }

          // =========================================================
          // ACCIÓN C: ENVIAR MENSAJE DESDE LA LÍNEA DEL SUB-QR
          // =========================================================
          else if (actionData.action === 'SEND_WHATSAPP_MESSAGE' && actionData.targetPhone) {
            let target = String(actionData.targetPhone).replace(/[^0-9]/g, '');
            if (target.length === 9) target = `51${target}`;

            const messageText = actionData.text || '';
            const mediaUrl = actionData.mediaUrl;
            const targetMediaType = actionData.mediaType || (isImage ? 'image' : 'document');
            const fileName = actionData.fileName || attachedFileName || (targetMediaType === 'image' ? 'imagen.jpg' : 'documento.pdf');

            console.log(`[COPILOT ACTION] 🚀 Despachando ${hasAttachedMedia ? targetMediaType : 'texto'} desde instancia "${userSenderInstance}" (+${userSenderPhone}) a +${target}: "${messageText}"`);

            if (hasAttachedMedia && messageData) {
              try {
                const media = await EvolutionService.getMediaBuffer(messageData, masterInstance);
                const rawBase64 = media.buffer.toString('base64');
                const actualMime = media.mimeType || attachedMimeType;
                const finalMediaType = actualMime.startsWith('image/') ? 'image' : (actualMime.startsWith('audio/') ? 'audio' : 'document');

                await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, rawBase64, {
                  caption: messageText,
                  fileName: fileName,
                  mediaType: finalMediaType,
                  mimeType: actualMime,
                });
              } catch (mediaErr: any) {
                console.error('[COPILOT MEDIA ERROR]', mediaErr?.message || mediaErr);
                await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText || 'Te comparto el documento adjunto.');
              }
            } else if (mediaUrl && mediaUrl.startsWith('http')) {
              await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, mediaUrl, {
                caption: messageText,
                fileName: fileName,
                mediaType: targetMediaType,
              });
            } else {
              await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText);
            }

            const confirmMsg = `✅ *Mensaje despachado exitosamente desde tu cuenta (+${userSenderPhone})*\n\n📱 *Destinatario:* +${target}\n💬 *Mensaje:* "${messageText}"${hasAttachedMedia || mediaUrl ? `\n📎 *Archivo enviado:* ${fileName}` : ''}\n⚡ *Línea Emisora:* +${userSenderPhone} (${userSenderInstance})`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, confirmMsg);
            return confirmMsg;
          }
        } catch (parseErr) {
          console.warn('[COPILOT ACTION PARSE WARN]', parseErr);
        }
      }

      // Respuesta conversacional o análisis de negocio al administrador
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, aiResponse);
      return aiResponse;
    } catch (error: any) {
      console.error('[COPILOT ERROR]', error);
      const fallbackReply = '⚠️ Hubo una incidencia procesando tu solicitud. Por favor intenta nuevamente.';
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, fallbackReply);
      return fallbackReply;
    }
  }
}
