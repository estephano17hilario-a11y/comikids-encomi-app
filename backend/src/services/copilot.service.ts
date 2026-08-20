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
   * Consulta dinámica y precisa en Supabase según los términos de búsqueda del usuario
   * (Nombres, DNI, pedidos de hoy, estados, teléfonos, códigos)
   */
  private static async executeDynamicDatabaseSearch(queryText: string): Promise<string> {
    const rawLower = queryText.toLowerCase().trim();
    const results: any[] = [];
    const seenIds = new Set<string>();

    try {
      // 1. Detección de consultas temporales ("hoy", "ayer", "para hoy", "de hoy", "recientes")
      const isTodayQuery =
        rawLower.includes('hoy') ||
        rawLower.includes('para hoy') ||
        rawLower.includes('de hoy') ||
        rawLower.includes('este dia') ||
        rawLower.includes('este día') ||
        rawLower.includes('ultimos') ||
        rawLower.includes('últimos');

      if (isTodayQuery) {
        // Rango de hoy en hora Perú (UTC-5)
        const todayStr = this.getTodayDateString();
        const startOfTodayIso = `${todayStr}T00:00:00.000Z`;

        const { data: todayOrders } = await supabaseAdmin
          .from('pedidos')
          .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)')
          .or(`created_at.gte.${startOfTodayIso},fecha_limite.eq.${todayStr}`)
          .order('created_at', { ascending: false })
          .limit(30);

        if (todayOrders && todayOrders.length > 0) {
          todayOrders.forEach(o => {
            if (!seenIds.has(o.id)) {
              seenIds.add(o.id);
              results.push(o);
            }
          });
        }
      }

      // 2. Extracción de términos significativos para búsqueda en Supabase
      const stopWords = new Set([
        'dime', 'los', 'pedidos', 'pedido', 'busca', 'buscar', 'paquete', 'paquetes',
        'con', 'nombre', 'para', 'de', 'que', 'hay', 'por', 'favor', 'el', 'la', 'un',
        'una', 'hola', 'buenas', 'tardes', 'noches', 'revisar', 'revisa', 'mi', 'mis',
        'cuenta', 'base', 'datos', 'encomi', 'empresa', 'comikids'
      ]);

      const words = rawLower
        .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));

      // Extraer números (DNI, Teléfono o Código)
      const digitsList = queryText.match(/\d{4,12}/g) || [];

      // Búsqueda por términos de nombre/destino/código
      for (const word of words) {
        const { data: matchedOrders } = await supabaseAdmin
          .from('pedidos')
          .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)')
          .or(`codigo_seguimiento.ilike.%${word}%,destino_detalle.ilike.%${word}%,detalles_bordado.ilike.%${word}%`)
          .order('created_at', { ascending: false })
          .limit(10);

        if (matchedOrders) {
          matchedOrders.forEach(o => {
            if (!seenIds.has(o.id)) {
              seenIds.add(o.id);
              results.push(o);
            }
          });
        }

        // Búsqueda en tabla de usuarios por nombre o DNI
        const { data: matchedUsers } = await supabaseAdmin
          .from('usuarios')
          .select('id, nombre_completo, dni, telefono_default')
          .or(`nombre_completo.ilike.%${word}%,dni.ilike.%${word}%`)
          .limit(5);

        if (matchedUsers && matchedUsers.length > 0) {
          for (const u of matchedUsers) {
            const { data: userOrders } = await supabaseAdmin
              .from('pedidos')
              .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)')
              .eq('usuario_id', u.id)
              .order('created_at', { ascending: false })
              .limit(5);

            if (userOrders) {
              userOrders.forEach(o => {
                if (!seenIds.has(o.id)) {
                  seenIds.add(o.id);
                  results.push(o);
                }
              });
            }
          }
        }
      }

      // Búsqueda por dígitos exactos (DNI, Teléfono o Código)
      for (const num of digitsList) {
        const { data: numOrders } = await supabaseAdmin
          .from('pedidos')
          .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)')
          .or(`codigo_seguimiento.ilike.%${num}%,destino_detalle.ilike.%${num}%`)
          .limit(5);

        if (numOrders) {
          numOrders.forEach(o => {
            if (!seenIds.has(o.id)) {
              seenIds.add(o.id);
              results.push(o);
            }
          });
        }
      }

      // 3. Si aún no hay resultados específicos, traer los 20 pedidos más recientes
      if (results.length === 0) {
        const { data: recentOrders } = await supabaseAdmin
          .from('pedidos')
          .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario:usuarios(nombre_completo, dni, telefono_default)')
          .order('created_at', { ascending: false })
          .limit(20);

        if (recentOrders) {
          recentOrders.forEach(o => {
            if (!seenIds.has(o.id)) {
              seenIds.add(o.id);
              results.push(o);
            }
          });
        }
      }

      if (results.length === 0) {
        return 'No se encontraron pedidos registrados en la base de datos.';
      }

      return results.map(o => {
        const user = Array.isArray(o.usuario) ? o.usuario[0] : o.usuario;
        const name = user?.nombre_completo || 'Cliente';
        const dni = user?.dni || 'S/DNI';
        const cel = user?.telefono_default || '';
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Reciente';

        return `• Orden #${o.codigo_seguimiento || o.id?.slice(0, 8)}:
  - Cliente: ${name} (DNI: ${dni}${cel ? `, Cel: ${cel}` : ''})
  - Destino: ${o.destino_detalle || 'Agencia Shalom'}
  - Estado Producción: ${o.estado_produccion || 'en_cola'} | Estado Envío: ${o.estado_envio || 'pendiente'}
  - Prendas / Bordado: ${o.detalles_bordado || 'Bordado'}
  - Clave Shalom: ${o.shalom_clave_recojo || '0808'}
  - Fecha Registro: ${dateStr}`;
      }).join('\n\n');

    } catch (dbErr: any) {
      console.error('[DYNAMIC SEARCH DB ERROR]', dbErr);
      return 'Error al consultar la base de datos en vivo.';
    }
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

          // Validar contraseña ingresada (admite la clave oficial del taller o la clave maestra)
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

            const welcomeMsg = `✅ *¡Autenticación Exitosa y Base de Datos Conectada!*\n\n🏢 *Empresa:* ${sessionData.displayName}\n📱 *Línea Sub-QR Activa:* +${sessionData.ownerPhone}\n⚡ *Instancia:* \`${sessionData.instanceName}\`\n🪙 *Tokens Disponibles Hoy:* ${remainingTokens.toLocaleString()} / 500,000 tokens\n\n🛠️ *Acceso Total Habilitado:*\n• 📦 *Registrar pedidos:* Envíame DNI, Nombre, Destino Shalom, WhatsApp y Prendas para generar el comprobante oficial.\n• 🔍 *Consultar pedidos y métricas:* Pregúntame "¿cuántos pedidos hay para hoy?", busca por nombre (ej: "busca el paquete de Estephano") o estados.\n• ✏️ *Actualizar pedidos:* Cambia producción o envíos en tiempo real.\n• 🚀 *Despachos WhatsApp:* Envío directo a clientas desde +${sessionData.ownerPhone}.\n\n💡 *¿Qué consulta o acción deseas realizar?*`;

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
      // PASO 6: BÚSQUEDA EN VIVO Y DIRECTA EN BASE DE DATOS SUPABASE
      // -------------------------------------------------------------
      const dynamicDbResults = await this.executeDynamicDatabaseSearch(textTrimmed);
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
      // PASO 7: PROMPT DEL SISTEMA OPTIMIZADO PARA PRECISIÓN TOTAL
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

--- RESULTADOS EN VIVO DE LA BASE DE DATOS SUPABASE (RECIENTES Y BÚSQUEDAS) ---
${dynamicDbResults}
--- FIN DATOS REALES ---

MENSAJE / INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

--- REGLAS CRÍTICAS DE FIDELIDAD Y RESPUESTA ---

1. FIDELIDAD TOTAL DE NOMBRES Y DATOS:
- Usa SIEMPRE los nombres EXACTOS registrados en la base de datos (por ejemplo, si dice "Estephano Andree Hilario Ampuero", escribe "Estephano Andree Hilario Ampuero" y NUNCA lo cambies a "Stephano" ni inventes variaciones).
- Si el usuario pregunta por un cliente (ej: "busca el paquete de Estephano" o "pedidos para hoy"), revisa los resultados reales de arriba y lista sus pedidos con su código de orden, cliente, destino y estado.
- NUNCA digas que no hay pedidos si aparecen en la lista de arriba.

2. REGISTRO DE NUEVO PEDIDO (SI EL USUARIO LO SOLICITA):
Si el usuario te pide registrar un pedido (ej: "registra pedido: Juan Perez, DNI 45892134, cel 987123456, destino Shalom Trujillo, 2 pijamas"):
Verifica si están los 5 datos requeridos:
  1. Nombre completo de la clienta (nombre)
  2. DNI o Carnet de Extranjería (dni)
  3. Número de WhatsApp de la clienta (telefono - 9 dígitos)
  4. Lugar de destino / Agencia Shalom (destino)
  5. Prendas o detalles de bordado (detalles)

- Si falta algún dato: Pídelo amablemente indicando cuál falta.
- Si están completos: Responde ÚNICAMENTE con este JSON:
\`\`\`json
{
  "action": "CREATE_ORDER",
  "clienteNombre": "Nombre completo",
  "clienteDni": "12345678",
  "clienteTelefono": "987654321",
  "destino": "Agencia Shalom Trujillo",
  "prendasBordado": "2 Pijamas térmicas bordadas",
  "metodoEnvio": "Agencia Shalom",
  "observaciones": ""
}
\`\`\`

3. ACTUALIZACIÓN DE PEDIDO EXISTENTE:
Si el usuario te pide cambiar estado de producción, envío o destino (ej: "marca el pedido #1050 como completado"):
Responde ÚNICAMENTE con este JSON:
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
Si el usuario te pide enviar un mensaje o archivo a un número desde su Sub-QR:
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

5. CONSULTAS DE NEGOCIO, ANÁLISIS O RESPUESTAS CONVERSACIONALES:
Responde en texto plano con tono profesional, amable y conciso, utilizando los datos reales de la base de datos de arriba.
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
