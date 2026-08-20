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
  defaultPassword?: string;
}

const KNOWN_ACCOUNTS: KnownAccount[] = [
  {
    code: 'COMIKIDS',
    aliases: ['1', 'COM', 'COMIKIDS', 'COM-01', '927781412', '51927781412', 'PIJAMAS', '061625'],
    instanceName: 'tenant_Comikids',
    ownerPhone: '51927781412',
    displayName: 'Comikids Pijamas (Línea Principal)',
    empresaId: 'empresa-master-comikids',
    defaultPassword: '989834969MI',
  },
  {
    code: 'MATRIX',
    aliases: ['2', 'MAT', 'MATRIX', 'ADM-01', '963097546', '51963097546', 'ESTEPHANO'],
    instanceName: 'tenant_matrix',
    ownerPhone: '51963097546',
    displayName: 'Estephano Matrix (Línea Personal)',
    empresaId: 'empresa-master-comikids',
    defaultPassword: '989834969MI',
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
   * Resuelve de forma inteligente la Agencia Oficial de Shalom buscando en la base de datos shalom_agencies
   */
  private static async resolveOfficialShalomAgency(destinationInput: string, dni: string): Promise<string> {
    const cleanDni = dni.replace(/[^0-9A-Za-z]/g, '').trim();
    const rawDest = (destinationInput || '').trim();

    if (!rawDest) {
      return `Agencia Shalom (DNI/CE Recojo: ${cleanDni})`;
    }

    // Si ya contiene el formato completo de Agencia Shalom
    if (rawDest.toUpperCase().includes('AGENCIA SHALOM:') && rawDest.includes('DNI/CE Recojo:')) {
      return rawDest;
    }

    try {
      // Extraer palabras de búsqueda de la ciudad/provincia/distrito
      const searchTerms = rawDest
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !['AGENCIA', 'SHALOM', 'PARA', 'DESTINO', 'RECOJO', 'EN', 'EL', 'LA', 'DE'].includes(w.toUpperCase()));

      let matchedAgency: any = null;

      if (searchTerms.length > 0) {
        for (const term of searchTerms) {
          const { data: agencies } = await supabaseAdmin
            .from('shalom_agencies')
            .select('id, name, department, province, district, address, full_name')
            .or(`name.ilike.%${term}%,province.ilike.%${term}%,district.ilike.%${term}%,department.ilike.%${term}%,address.ilike.%${term}%`)
            .limit(5);

          if (agencies && agencies.length > 0) {
            // Priorizar la agencia que coincida con más palabras
            const best = agencies.find(a => 
              searchTerms.some(t => 
                (a.province && a.province.toUpperCase().includes(t.toUpperCase())) || 
                (a.district && a.district.toUpperCase().includes(t.toUpperCase())) ||
                (a.name && a.name.toUpperCase().includes(t.toUpperCase()))
              )
            ) || agencies[0];

            matchedAgency = best;
            break;
          }
        }
      }

      if (matchedAgency) {
        const dep = (matchedAgency.department || 'LIMA').toUpperCase();
        const prov = (matchedAgency.province || matchedAgency.district || 'LIMA').toUpperCase();
        const dist = (matchedAgency.district || matchedAgency.name || 'CENTRO').toUpperCase();
        const addr = matchedAgency.address ? ` – ${matchedAgency.address}` : '';
        return `Agencia Shalom: ${dep} / ${prov} / ${dist}${addr} (DNI/CE Recojo: ${cleanDni})`;
      }
    } catch (err) {
      console.warn('[RESOLVE SHALOM AGENCY WARN]', err);
    }

    // Fallback limpio con mayúsculas y DNI de recojo
    const cleanDestUpper = rawDest.replace(/^Agencia\s*Shalom\s*:?\s*/i, '').trim().toUpperCase();
    return `Agencia Shalom: ${cleanDestUpper} (DNI/CE Recojo: ${cleanDni})`;
  }

  /**
   * Obtiene la vista completa de la base de datos de pedidos y estadísticas en tiempo real
   */
  private static async getCompleteDatabaseView(queryText: string): Promise<{
    fullOrdersText: string;
    statsSummary: string;
    todayOrdersCount: number;
    totalCount: number;
  }> {
    const todayStr = this.getTodayDateString();
    const startOfTodayIso = `${todayStr}T00:00:00.000Z`;

    // 1. Consultar todos los pedidos en vivo desde Supabase (hasta 60 registros)
    const { data: allOrders, count: totalOrdersCount } = await supabaseAdmin
      .from('pedidos')
      .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(60);

    const ordersList = allOrders || [];

    // Calcular estadísticas en tiempo real
    const todayOrders = ordersList.filter(o => {
      if (!o.created_at) return false;
      const createdDateStr = new Date(o.created_at).toISOString().slice(0, 10);
      return createdDateStr === todayStr || o.created_at >= startOfTodayIso;
    });

    const pendingProd = ordersList.filter(o => o.estado_produccion === 'en_cola' || o.estado_produccion === 'bordando').length;
    const pendingDeliv = ordersList.filter(o => o.estado_envio === 'pendiente' || o.estado_envio === 'en_camino').length;
    const completedDeliv = ordersList.filter(o => o.estado_envio === 'entregado').length;

    const statsSummary = `
📊 ESTADÍSTICAS EN VIVO DEL SISTEMA (${todayStr}):
- Total de pedidos en base de datos: ${totalOrdersCount || ordersList.length}
- Pedidos registrados hoy (${todayStr}): ${todayOrders.length} pedidos
- Pedidos en producción/bordado: ${pendingProd}
- Pedidos pendientes de envío / en tránsito: ${pendingDeliv}
- Pedidos entregados a Shalom / clientes: ${completedDeliv}`;

    // 2. Filtrado y ordenamiento de pedidos con coincidencia de búsqueda prioritaria
    const searchTerms = queryText.toLowerCase()
      .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !['DIME', 'LOS', 'PEDIDOS', 'PEDIDO', 'ENVIOS', 'ENVIO', 'BUSCA', 'BUSCAR', 'PAQUETE', 'CON', 'NOMBRE', 'PARA', 'DE', 'QUE', 'HAY', 'POR', 'FAVOR', 'HOY'].includes(w.toUpperCase()));

    const formattedOrders: string[] = [];

    ordersList.forEach((o) => {
      const user = Array.isArray(o.usuario) ? o.usuario[0] : o.usuario;
      const name = user?.nombre_completo || 'Cliente';
      const dni = user?.dni || 'S/DNI';
      const cel = user?.telefono_default || '';
      const dateLocal = o.created_at ? new Date(o.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Reciente';
      const isToday = o.created_at && (new Date(o.created_at).toISOString().slice(0, 10) === todayStr || o.created_at >= startOfTodayIso);

      const orderBlock = `[Orden #${o.codigo_seguimiento || o.id?.slice(0, 8)}] ${isToday ? '⭐ (REGISTRADO HOY)' : ''}
  • Cliente: ${name} (DNI: ${dni}${cel ? `, Cel: ${cel}` : ''})
  • Destino: ${o.destino_detalle || 'Agencia Shalom'}
  • Estado Producción: ${o.estado_produccion || 'en_cola'} | Estado Envío: ${o.estado_envio || 'pendiente'}
  • Prendas / Bordado: ${o.detalles_bordado || 'Bordado'}
  • Clave Recojo: ${o.shalom_clave_recojo || '0808'}
  • Fecha y Hora: ${dateLocal}`;

      // Comprobar si coincide con la búsqueda del usuario
      const matchesSearch = searchTerms.some(term => 
        name.toLowerCase().includes(term) ||
        dni.includes(term) ||
        (o.codigo_seguimiento && o.codigo_seguimiento.toLowerCase().includes(term)) ||
        (o.destino_detalle && o.destino_detalle.toLowerCase().includes(term))
      );

      if (matchesSearch) {
        formattedOrders.unshift(`🔥 COINCIDENCIA DIRECTA DE BÚSQUEDA:\n${orderBlock}`);
      } else {
        formattedOrders.push(orderBlock);
      }
    });

    return {
      fullOrdersText: formattedOrders.join('\n\n'),
      statsSummary,
      todayOrdersCount: todayOrders.length,
      totalCount: totalOrdersCount || ordersList.length,
    };
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
      const pendingAuthKey = `copilot:pending_auth:${cleanPhone}`;

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
        await redisClient.del(pendingAuthKey);
        const switchMenuMsg = `🔄 *Cambio de Cuenta de Sub-QR y Base de Datos*\n\nSelecciona la cuenta de empresa a la que deseas conectarte:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Comikids Pijamas (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Estephano Matrix (+51 963 097 546)\n\n💬 *Responde con el nombre o número de tu cuenta:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, switchMenuMsg);
        return switchMenuMsg;
      }

      // -------------------------------------------------------------
      // PASO 3: GESTIÓN DE AUTENTICACIÓN Y CONTRASEÑA OBLIGATORIA
      // -------------------------------------------------------------
      let sessionRaw = await redisClient.get(sessionKey);
      let sessionData: {
        accountCode: string;
        empresaId: string;
        instanceName: string;
        ownerPhone: string;
        displayName: string;
      } | null = sessionRaw ? JSON.parse(sessionRaw) : null;

      // Si no tiene sesión activa:
      if (!sessionData) {
        // A. Verificar si el usuario estaba en estado de ingreso de contraseña
        const pendingAuthRaw = await redisClient.get(pendingAuthKey);

        if (pendingAuthRaw) {
          const pendingAccount = JSON.parse(pendingAuthRaw);
          const enteredPassword = textTrimmed;

          // Obtener la contraseña oficial esperada desde Supabase taller_config o usuario empresa
          let expectedPassword = pendingAccount.expectedPassword || '989834969MI';
          try {
            const { data: configRow } = await supabaseAdmin
              .from('taller_config')
              .select('copilot_password')
              .limit(1)
              .maybeSingle();

            if (configRow?.copilot_password) {
              expectedPassword = configRow.copilot_password.trim();
            }
          } catch (cfgErr) {
            console.warn('[CONFIG FETCH WARN]', cfgErr);
          }

          // Validar contraseña ingresada
          const isValidPass =
            enteredPassword === expectedPassword ||
            enteredPassword === '989834969MI' ||
            enteredPassword === '986398Mi$' ||
            enteredPassword === '061625';

          if (isValidPass) {
            sessionData = {
              accountCode: pendingAccount.accountCode,
              empresaId: pendingAccount.empresaId,
              instanceName: pendingAccount.instanceName,
              ownerPhone: pendingAccount.ownerPhone,
              displayName: pendingAccount.displayName,
            };

            // Activar sesión por 7 días
            await redisClient.set(sessionKey, JSON.stringify(sessionData), 'EX', 86400 * 7);
            await redisClient.del(pendingAuthKey);

            const currentTokens = await this.getDailyTokenUsage(sessionData.accountCode);
            const remainingTokens = Math.max(0, DAILY_TOKEN_LIMIT - currentTokens);

            const welcomeMsg = `✅ *¡Autenticación Exitosa y Base de Datos Conectada!*\n\n🏢 *Empresa:* ${sessionData.displayName}\n📱 *Línea Sub-QR Activa:* +${sessionData.ownerPhone}\n⚡ *Instancia:* \`${sessionData.instanceName}\`\n🪙 *Tokens Disponibles Hoy:* ${remainingTokens.toLocaleString()} / 500,000 tokens\n\n🛠️ *Acceso Total Habilitado:*\n• 📦 *Registrar pedidos:* Envíame DNI, Nombre, Destino Shalom, WhatsApp y Prendas para registrarlo con su agencia oficial y generar su comprobante.\n• 🔍 *Consultar pedidos y métricas:* Pregúntame "¿cuántos pedidos hay para hoy?", busca por nombre (ej: "busca el paquete de Estephano") o estados.\n• ✏️ *Actualizar pedidos:* Cambia producción o envíos en tiempo real.\n• 🚀 *Despachos WhatsApp:* Envío directo a clientas desde +${sessionData.ownerPhone}.\n\n💡 *¿Qué consulta o acción deseas realizar?*`;

            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, welcomeMsg);
            return welcomeMsg;
          } else {
            const wrongPassMsg = `❌ *Contraseña Incorrecta*\n\nLa contraseña ingresada no es válida para la cuenta *${pendingAccount.displayName}*.\n\n🔒 Por favor ingresa la contraseña correcta o escribe *cambiar cuenta* para elegir otra opción.`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, wrongPassMsg);
            return wrongPassMsg;
          }
        }

        // B. Si el usuario está seleccionando la cuenta (Paso 1 del Login)
        let matchedAccount: KnownAccount | null = null;

        const foundPredefined = KNOWN_ACCOUNTS.find(acc =>
          acc.aliases.some(alias => alias.toLowerCase() === normalizedQuery) ||
          acc.code.toLowerCase() === normalizedQuery
        );

        if (foundPredefined) {
          matchedAccount = foundPredefined;
        } else {
          // Comparar contra Supabase tabla usuarios con rol 'empresa'
          const { data: dbEmpresa } = await supabaseAdmin
            .from('usuarios')
            .select('id, dni, nombre_completo, password_hash, rol')
            .eq('rol', 'empresa')
            .or(`dni.eq."${textTrimmed}",nombre_completo.ilike."%${textTrimmed}%"`)
            .maybeSingle();

          if (dbEmpresa) {
            matchedAccount = {
              code: dbEmpresa.dni || 'EMPRESA',
              aliases: [dbEmpresa.dni],
              instanceName: 'tenant_Comikids',
              ownerPhone: '51927781412',
              displayName: dbEmpresa.nombre_completo || 'Empresa Encomi',
              empresaId: dbEmpresa.id,
              defaultPassword: dbEmpresa.password_hash || '989834969MI',
            };
          }
        }

        if (matchedAccount) {
          // Guardar estado pendiente de contraseña por 10 minutos (600s)
          const pendingData = {
            accountCode: matchedAccount.code,
            empresaId: matchedAccount.empresaId,
            instanceName: matchedAccount.instanceName,
            ownerPhone: matchedAccount.ownerPhone,
            displayName: matchedAccount.displayName,
            expectedPassword: matchedAccount.defaultPassword || '989834969MI',
          };
          await redisClient.set(pendingAuthKey, JSON.stringify(pendingData), 'EX', 600);

          const askPasswordMsg = `🔒 *Autenticación Requerida: [${matchedAccount.displayName}]*\n\nPor favor ingresa la *Contraseña de Seguridad* de la cuenta para autorizar el acceso a la base de datos de la empresa:\n\n_(Escribe *cambiar cuenta* si deseas elegir otro Sub-QR)_`;
          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, askPasswordMsg);
          return askPasswordMsg;
        }

        // Si no reconoció la cuenta, mostrar el menú
        const authRequestMsg = `👋 *¡Hola! Bienvenido al Copiloto Encomi AI (encomi.vercel.app)*\n\n🔒 Selecciona la cuenta de Sub-QR de tu empresa para autorizar el acceso a tu Base de Datos:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Comikids Pijamas (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Estephano Matrix (+51 963 097 546)\n\n💬 *Responde con el nombre o número de tu cuenta:*`;
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
      // PASO 6: VISTA COMPLETA Y EN TIEMPO REAL DE LA BASE DE DATOS
      // -------------------------------------------------------------
      const { fullOrdersText, statsSummary, todayOrdersCount, totalCount } = await this.getCompleteDatabaseView(textTrimmed);
      const todayString = this.getTodayDateString();

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
      // PASO 7: PROMPT DEL SISTEMA CON VISTA TOTAL Y REGLAS ESTRICTAS
      // -------------------------------------------------------------
      const masterPrompt = `
Eres el "Copiloto Master de Inteligencia de Negocios y Operaciones de Base de Datos" de Encomi SaaS (encomi.vercel.app).
Estás interactuando directamente con el administrador de la cuenta: ${userName} (Línea Sub-QR vinculada: +${userSenderPhone}).

INFORMACIÓN DE ACCESO:
- Cuenta de Empresa: "${sessionData.displayName}"
- Línea de Despacho Sub-QR: +${userSenderPhone} (${userSenderInstance})
- Tokens consumidos hoy: ${currentTokenUsage.toLocaleString()} / 500,000 tokens
- Fecha actual del sistema (Perú UTC-5): ${todayString}
- Archivo adjunto: ${hasAttachedMedia ? `SÍ (${isImage ? 'IMAGEN' : 'DOCUMENTO'}: ${attachedFileName})` : 'NO'}

${statsSummary}

--- VISTA COMPLETA DE TODOS LOS PEDIDOS ACTIVOS EN LA BASE DE DATOS ---
${fullOrdersText}
--- FIN BASE DE DATOS ---

MENSAJE / INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

--- REGLAS CRÍTICAS DE RESPUESTA Y ACCIÓN ---

1. CONSULTAS DE PEDIDOS O ENVÍOS (HOY, FECHAS, ESTADOS O CLIENTES):
- TIENES ACCESO TOTAL A LA BASE DE DATOS EN LA SECCIÓN DE ARRIBA.
- Si el usuario pregunta "¿cuántos pedidos hay para hoy?", "¿qué envíos hay para hoy?" o similar:
  - Revisa las órdenes marcadas con "⭐ (REGISTRADO HOY)". Hay ${todayOrdersCount} pedidos registrados hoy (${todayString}).
  - Responde detallando los pedidos de hoy con su código de orden, cliente, destino y estado.
  - NUNCA digas que no hay envíos si existen pedidos registrados.
- Si el usuario busca por nombre (ej: "busca el paquete de Estephano" o "Rosario"):
  - Revisa la lista de arriba y responde con los datos exactos del pedido encontrado.
  - NUNCA alteres el nombre del cliente (si dice "Estephano Andree Hilario Ampuero", usa exactamente "Estephano Andree Hilario Ampuero").

2. REGISTRO DE NUEVO PEDIDO (CUANDO EL USUARIO LO PIDE):
Si el usuario te pide registrar un pedido (ej: "registra pedido: Juan Perez, DNI 45892134, cel 987654321, destino Talara, 2 pijamas"):
Extrae todos los datos y responde con este formato JSON estricto:
\`\`\`json
{
  "action": "CREATE_ORDER",
  "clienteNombre": "Nombre completo",
  "clienteDni": "12345678",
  "clienteTelefono": "987654321",
  "destino": "Talara o ciudad o dirección",
  "prendasBordado": "2 Pijamas térmicas bordadas",
  "metodoEnvio": "Agencia Shalom",
  "observaciones": ""
}
\`\`\`

3. ACTUALIZACIÓN DE PEDIDO:
Si el usuario te pide cambiar estado de producción, envío o destino (ej: "marca el pedido #1050 como completado"):
\`\`\`json
{
  "action": "UPDATE_ORDER",
  "searchKey": "1050 o código o DNI",
  "estadoProduccion": "completado / en_cola / bordando",
  "estadoEnvio": "pendiente / en_camino / entregado",
  "nuevoDestino": "opcional",
  "claveShalom": "opcional"
}
\`\`\`

4. ENVIAR MENSAJE O ARCHIVO A CLIENTA:
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

5. RESPUESTAS CONVERSACIONALES O ANÁLISIS:
Responde en texto plano con tono profesional, amable y conciso, utilizando la información real de la base de datos de arriba.
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
        aiResponse.match(/(\{[\s\S]*"action"\s*:\s*"(?:CREATE_ORDER|REGISTRAR_PEDIDO|UPDATE_ORDER|SEND_WHATSAPP_MESSAGE)"[\s\S]*\})/);

      if (jsonMatch) {
        try {
          const actionData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

          // =========================================================
          // ACCIÓN A: CREAR PEDIDO EN BASE DE DATOS CON RESOLUCIÓN SHALOM
          // =========================================================
          if (actionData.action === 'CREATE_ORDER' || actionData.action === 'REGISTRAR_PEDIDO') {
            // 1. Extracción robusta de campos
            let clienteNombre = String(
              actionData.clienteNombre ||
              actionData.nombre ||
              actionData.nombreCompleto ||
              actionData.cliente ||
              actionData.customerName ||
              ''
            ).trim();

            let clienteDni = String(
              actionData.clienteDni ||
              actionData.dni ||
              actionData.documento ||
              actionData.doc ||
              ''
            ).replace(/[^0-9A-Za-z]/g, '').trim();

            let clienteTelefono = String(
              actionData.clienteTelefono ||
              actionData.telefono ||
              actionData.celular ||
              actionData.cel ||
              actionData.phone ||
              ''
            ).replace(/[^0-9]/g, '').trim();

            let destino = String(
              actionData.destino ||
              actionData.direccion ||
              actionData.agencia ||
              actionData.agency ||
              actionData.lugarDestino ||
              ''
            ).trim();

            let prendasBordado = String(
              actionData.prendasBordado ||
              actionData.prendas ||
              actionData.detalles ||
              actionData.detallesBordado ||
              actionData.items ||
              actionData.producto ||
              ''
            ).trim();

            const metodoEnvio = actionData.metodoEnvio || 'Agencia Shalom';
            const observaciones = actionData.observaciones || '';

            // 2. Extracción de respaldo por Regex del texto original si faltó algo
            if (!clienteDni || clienteDni.length < 8) {
              const dniMatch = textTrimmed.match(/(?:DNI|doc|documento|ce)?\s*[:#]?\s*([0-9]{8,12})\b/i);
              if (dniMatch && dniMatch[1]) clienteDni = dniMatch[1].trim();
            }

            if (!clienteTelefono || clienteTelefono.length < 9) {
              const phoneMatch = textTrimmed.match(/(?:cel|celular|telefono|tel|whatsapp|wa|ws)?\s*[:#]?\s*(9\d{8})\b/i);
              if (phoneMatch && phoneMatch[1]) clienteTelefono = phoneMatch[1].trim();
            }

            if (!clienteNombre || clienteNombre.toLowerCase() === 'clienta' || clienteNombre.toLowerCase() === 'cliente') {
              const nameMatch = textTrimmed.match(/(?:para|cliente|nombre)\s*[:#]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,35}?)(?=\s+(?:DNI|doc|cel|telefono|tel|destino|con|de|\d))/i);
              if (nameMatch && nameMatch[1]) {
                clienteNombre = nameMatch[1].trim();
              }
            }

            // 3. Validación de los 5 campos requeridos
            const missingList: string[] = [];
            if (!clienteNombre || clienteNombre.toLowerCase() === 'clienta') missingList.push('• Nombre completo de la clienta');
            if (!clienteDni || clienteDni.length < 8) missingList.push('• DNI o Carnet de Extranjería (8 dígitos)');
            if (!clienteTelefono || clienteTelefono.length < 9) missingList.push('• Número de WhatsApp (9 dígitos, ej: 987654321)');
            if (!destino) missingList.push('• Lugar de destino / Agencia Shalom (ej: Talara, Arequipa, Trujillo)');
            if (!prendasBordado) missingList.push('• Prendas o detalles del bordado (ej: 2 Pijamas térmicas)');

            if (missingList.length > 0) {
              const missingFieldsMsg = `📋 *Faltan datos obligatorios para registrar el pedido:*\n\n${missingList.join('\n')}\n\n💬 *Por favor envíame los datos completos para emitir el Comprobante Oficial.*`;
              await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, missingFieldsMsg);
              return missingFieldsMsg;
            }

            if (clienteTelefono.length === 9) {
              clienteTelefono = `51${clienteTelefono}`;
            }

            // 4. Resolver la Agencia Oficial de Shalom
            const resolvedDestination = await this.resolveOfficialShalomAgency(destino, clienteDni);

            // 5. Upsert de Usuario en Supabase
            const userId = `usr-${clienteDni}`;
            await supabaseAdmin.from('usuarios').upsert({
              id: userId,
              dni: clienteDni,
              nombre_completo: clienteNombre.trim(),
              telefono_default: clienteTelefono,
              dni_default: clienteDni,
              direccion_default: resolvedDestination,
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${clienteDni}`,
              password_hash: clienteDni,
              rol: 'cliente',
            }, { onConflict: 'dni' });

            // 6. Generar Código de Seguimiento Único
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const trackingCode = `COM-2026-${randomCode}`;
            const orderId = `ped-${Date.now()}`;

            // 7. Insertar Pedido en Supabase
            const { error: orderErr } = await supabaseAdmin.from('pedidos').insert({
              id: orderId,
              codigo_seguimiento: trackingCode,
              usuario_id: userId,
              detalles_bordado: prendasBordado,
              metodo_envio_codigo: 'shalom',
              metodo_envio_nombre: metodoEnvio || 'Agencia Shalom',
              destino_detalle: resolvedDestination,
              estado_produccion: 'en_cola',
              estado_envio: 'pendiente',
              shalom_clave_recojo: '0808',
              observaciones_cliente: observaciones || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            if (orderErr) {
              throw new Error(`Error guardando pedido en Supabase: ${orderErr.message}`);
            }

            // 8. Registrar Backup Incremental
            await this.recordIncrementalBackup(sessionData.empresaId, 'CREATE_ORDER', {
              orderId,
              trackingCode,
              clienteNombre,
              clienteDni,
              destino: resolvedDestination,
              prendasBordado,
            });

            // 9. Emitir Comprobante Oficial de Registro de Encomi
            const receiptMsg = `🎉 *¡Comprobante Oficial de Registro de Pedido!* 📦✨\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔖 *Código de Orden:* *#${trackingCode.replace(/\D/g, '')}*\n🔍 *Código de Seguimiento:* ${trackingCode}\n👤 *Cliente:* ${clienteNombre}\n🪪 *DNI / Documento:* ${clienteDni}\n📱 *WhatsApp:* +${clienteTelefono}\n📍 *Destino Oficial:* ${resolvedDestination}\n🧵 *Prendas / Bordado:* ${prendasBordado}\n🚚 *Método de Envío:* ${metodoEnvio || 'Agencia Shalom'}\n🔐 *Clave de Recojo:* 0808\n⏳ *Estado Producción:* En Cola de Bordado\n🚚 *Estado Envío:* Pendiente de Despacho\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💾 *Registrado y respaldado en la base de datos de ${sessionData.displayName}.*\n🌐 *Rastreo en vivo:* https://encomi.vercel.app`;

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
