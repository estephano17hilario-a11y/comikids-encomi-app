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
   * Resuelve de forma inteligente y exhaustiva la Agencia Oficial de Shalom buscando en la tabla shalom_agencies
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
      // 1. Extraer y limpiar términos de búsqueda
      const cleanTerms = rawDest
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length >= 3 && !['AGENCIA', 'SHALOM', 'PARA', 'DESTINO', 'RECOJO', 'EN', 'EL', 'LA', 'DE', 'AV', 'AVENIDA', 'JR', 'JIRON', 'CALLE'].includes(w));

      let matchedAgency: any = null;

      // 2. Intento de búsqueda exacta por cada término significativo
      if (cleanTerms.length > 0) {
        for (const term of cleanTerms) {
          const { data: agencies } = await supabaseAdmin
            .from('shalom_agencies')
            .select('id, name, department, province, district, address, full_name')
            .or(`name.ilike.%${term}%,province.ilike.%${term}%,district.ilike.%${term}%,department.ilike.%${term}%,address.ilike.%${term}%,full_name.ilike.%${term}%`)
            .limit(5);

          if (agencies && agencies.length > 0) {
            const best = agencies.find(a => 
              cleanTerms.some(t => 
                (a.province && a.province.toUpperCase().includes(t)) || 
                (a.district && a.district.toUpperCase().includes(t)) ||
                (a.name && a.name.toUpperCase().includes(t)) ||
                (a.address && a.address.toUpperCase().includes(t))
              )
            ) || agencies[0];

            matchedAgency = best;
            break;
          }
        }
      }

      // 3. Intento de búsqueda difusa por raíces de 3 o 4 caracteres (ej: "MEGG" -> "MEIGG", "TALA" -> "TALARA", "CHIMB" -> "CHIMBOTE")
      if (!matchedAgency && cleanTerms.length > 0) {
        for (const term of cleanTerms) {
          const prefix = term.slice(0, 4);
          if (prefix.length >= 3) {
            const { data: fuzzyAgencies } = await supabaseAdmin
              .from('shalom_agencies')
              .select('id, name, department, province, district, address, full_name')
              .or(`name.ilike.%${prefix}%,address.ilike.%${prefix}%,district.ilike.%${prefix}%,province.ilike.%${prefix}%,full_name.ilike.%${prefix}%`)
              .limit(5);

            if (fuzzyAgencies && fuzzyAgencies.length > 0) {
              matchedAgency = fuzzyAgencies[0];
              break;
            }
          }
        }
      }

      // 4. Mapeos comunes de nombres populares de agencias
      if (!matchedAgency) {
        const lowerRaw = rawDest.toLowerCase();
        let fallbackSearch = '';
        if (lowerRaw.includes('megg') || lowerRaw.includes('meigg') || lowerRaw.includes('enrique')) {
          fallbackSearch = 'MEIGGS';
        } else if (lowerRaw.includes('tala')) {
          fallbackSearch = 'TALARA';
        } else if (lowerRaw.includes('chacha') || lowerRaw.includes('grau')) {
          fallbackSearch = 'GRAU';
        } else if (lowerRaw.includes('tingo') || lowerRaw.includes('jaime')) {
          fallbackSearch = 'TINGO';
        } else if (lowerRaw.includes('canada') || lowerRaw.includes('canadá')) {
          fallbackSearch = 'CANADA';
        }

        if (fallbackSearch) {
          const { data: fallbackList } = await supabaseAdmin
            .from('shalom_agencies')
            .select('id, name, department, province, district, address, full_name')
            .or(`name.ilike.%${fallbackSearch}%,address.ilike.%${fallbackSearch}%,district.ilike.%${fallbackSearch}%,full_name.ilike.%${fallbackSearch}%`)
            .limit(1);

          if (fallbackList && fallbackList.length > 0) {
            matchedAgency = fallbackList[0];
          }
        }
      }

      // Si encontramos la agencia oficial en la base de datos de Shalom
      if (matchedAgency) {
        const dep = (matchedAgency.department || 'LIMA').toUpperCase().trim();
        const prov = (matchedAgency.province || matchedAgency.district || 'LIMA').toUpperCase().trim();
        const dist = (matchedAgency.district || matchedAgency.name || 'CENTRO').toUpperCase().trim();
        const addr = matchedAgency.address ? ` – ${matchedAgency.address.trim()}` : '';
        return `Agencia Shalom: ${dep} / ${prov} / ${dist}${addr} (DNI/CE Recojo: ${cleanDni})`;
      }
    } catch (err) {
      console.warn('[RESOLVE SHALOM AGENCY WARN]', err);
    }

    // Fallback limpio
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
    rawOrders: any[];
  }> {
    const todayStr = this.getTodayDateString();
    const startOfTodayIso = `${todayStr}T00:00:00.000Z`;

    // 1. Consultar todos los pedidos en vivo desde Supabase (hasta 60 registros) con JOIN a usuarios
    const { data: allOrders, count: totalOrdersCount } = await supabaseAdmin
      .from('pedidos')
      .select('id, created_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario_id, usuario:usuarios(id, nombre_completo, dni, telefono_default)', { count: 'exact' })
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
📊 ESTADÍSTICAS EN VIVO DEL SISTEMA COMIKIDS (${todayStr}):
- Total de pedidos/envíos en base de datos: ${totalOrdersCount || ordersList.length} pedidos
- Pedidos registrados hoy (${todayStr}): ${todayOrders.length} pedidos
- Pedidos en producción/bordado: ${pendingProd}
- Pedidos en preparación / tránsito: ${pendingDeliv}
- Pedidos entregados a Shalom / clientes: ${completedDeliv}`;

    // 2. Formatear cada orden de manera clara con el nombre y DNI real
    const formattedOrders = ordersList.map((o) => {
      const user = Array.isArray(o.usuario) ? o.usuario[0] : o.usuario;
      const name = user?.nombre_completo || 'Cliente';
      const dni = user?.dni || (o.destino_detalle?.match(/(?:DNI\/CE|DNI|CE)\s*Recojo:\s*([0-9A-Za-z]+)/i)?.[1]) || 'S/DNI';
      const cel = user?.telefono_default || '';
      const dateLocal = o.created_at ? new Date(o.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Reciente';
      const isToday = o.created_at && (new Date(o.created_at).toISOString().slice(0, 10) === todayStr || o.created_at >= startOfTodayIso);

      return `[Orden #${o.codigo_seguimiento || o.id?.slice(0, 8)}] ${isToday ? '⭐ (REGISTRADO HOY)' : ''}
  • Cliente: ${name} (DNI: ${dni}${cel ? `, Cel: ${cel}` : ''})
  • Destino: ${o.destino_detalle || 'Agencia Shalom'}
  • Estado Producción: ${o.estado_produccion || 'en_cola'} | Estado Envío: ${o.estado_envio || 'pendiente'}
  • Prendas / Bordado: ${o.detalles_bordado || 'Bordado'}
  • Clave Recojo: ${o.shalom_clave_recojo || '0808'}
  • Fecha y Hora: ${dateLocal}`;
    });

    return {
      fullOrdersText: formattedOrders.join('\n\n'),
      statsSummary,
      todayOrdersCount: todayOrders.length,
      totalCount: totalOrdersCount || ordersList.length,
      rawOrders: ordersList,
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
      // PASO 1: VERIFICACIÓN DE SESIÓN Y ENRUTAMIENTO DINÁMICO
      // -------------------------------------------------------------
      // Con el flujo en 2 pasos de selección de Sub-QR y contraseña obligatoria,
      // cualquier teléfono autorizado del personal u operativo del negocio puede conectarse
      // a su base de datos ingresando su clave de seguridad configurada en el Taller.


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

            await redisClient.set(sessionKey, JSON.stringify(sessionData), 'EX', 86400 * 7);
            await redisClient.del(pendingAuthKey);

            const currentTokens = await this.getDailyTokenUsage(sessionData.accountCode);
            const remainingTokens = Math.max(0, DAILY_TOKEN_LIMIT - currentTokens);

            const welcomeMsg = `✅ *¡Autenticación Exitosa y Base de Datos Conectada!*\n\n🏢 *Empresa:* ${sessionData.displayName}\n📱 *Línea Sub-QR Activa:* +${sessionData.ownerPhone}\n⚡ *Instancia:* \`${sessionData.instanceName}\`\n🪙 *Tokens Disponibles Hoy:* ${remainingTokens.toLocaleString()} / 500,000 tokens\n\n🛠️ *Acceso Total Habilitado a Comikids:*\n• 📦 *Registrar pedidos:* Solo envíame Nombre, DNI, WhatsApp y Destino (Agencia Shalom o Dirección Motorizado).\n• 🔍 *Consultar pedidos y envíos:* Pregúntame "¿cuántos envíos hay para hoy?", busca por cliente (ej: "busca el paquete de Estephano") o estados.\n• ✏️ *Actualizar pedidos:* Cambia producción o envíos en tiempo real.\n• 🚀 *Despachos WhatsApp:* Envío directo a clientas desde +${sessionData.ownerPhone}.\n\n💡 *¿Qué consulta o acción deseas realizar?*`;

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
      const { fullOrdersText, statsSummary, todayOrdersCount, totalCount, rawOrders } = await this.getCompleteDatabaseView(textTrimmed);
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
      // PASO 7: PROMPT DEL SISTEMA CON 4 CAMPOS Y COMPROBANTE ESTÁNDAR
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

--- VISTA COMPLETA DE TODOS LOS PEDIDOS ACTIVOS EN LA BASE DE DATOS DE COMIKIDS ---
${fullOrdersText}
--- FIN BASE DE DATOS ---

MENSAJE / INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

--- REGLAS CRÍTICAS DE RESPUESTA Y ACCIÓN ---

1. CONSULTAS DE PEDIDOS, ENVÍOS O PAQUETES:
- TIENES ACCESO TOTAL A LA BASE DE DATOS EN LA SECCIÓN DE ARRIBA.
- IMPORTANTE: Para el negocio, "envíos", "paquetes" y "pedidos" significan EXACTAMENTE LO MISMO: todas las órdenes registradas en el sistema.
- Si el usuario pregunta "¿cuántos pedidos/envíos hay para hoy?", "¿qué envíos hay para hoy?" o similar:
  - Revisa las órdenes marcadas con "⭐ (REGISTRADO HOY)". Hay ${todayOrdersCount} pedidos registrados hoy (${todayString}).
  - Lista detalladamente cada uno de los pedidos con su código de orden, cliente, destino y estado.
  - NUNCA digas que no hay envíos si existen pedidos registrados.
- Si el usuario busca por nombre (ej: "busca el paquete de Estephano" o "Rosario"):
  - Revisa la lista de arriba y responde con los datos exactos del pedido encontrado.
  - Usa SIEMPRE el nombre exacto de la persona (ej: "Estephano Andree Hilario Ampuero").

2. REGISTRO DE NUEVO PEDIDO (SOLO 4 DATOS REQUERIDOS):
Para registrar un nuevo pedido, SOLO SE NECESITAN ESTOS 4 DATOS (NO pidas prendas ni bordado):
  1. Nombre completo de la clienta (nombre)
  2. DNI o Carnet de Extranjería (dni)
  3. Teléfono / WhatsApp (telefono - 9 dígitos)
  4. Destino (agencia Shalom o dirección para motorizado con referencia si tiene)

Si el usuario te envía estos datos, responde con este formato JSON estricto:
\`\`\`json
{
  "action": "CREATE_ORDER",
  "clienteNombre": "Nombre completo",
  "clienteDni": "12345678",
  "clienteTelefono": "987654321",
  "destino": "Agencia Shalom o Dirección exacta de entrega",
  "referencia": "Opcional",
  "metodoEnvio": "shalom / motorizado",
  "prendasBordado": "Bordado personalizado (o las prendas si las mencionó)"
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
          // ACCIÓN A: CREAR PEDIDO EN BASE DE DATOS (4 DATOS + COMPROBANTE WEB)
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

            const referencia = String(actionData.referencia || actionData.ref || '').trim();
            const prendasBordado = String(
              actionData.prendasBordado ||
              actionData.prendas ||
              actionData.detalles ||
              actionData.detallesBordado ||
              actionData.items ||
              actionData.producto ||
              'Bordado personalizado'
            ).trim();

            const metodoEnvioRaw = String(actionData.metodoEnvio || '').toLowerCase();
            const isMotorizado =
              metodoEnvioRaw.includes('motorizado') ||
              destino.toLowerCase().includes('motorizado') ||
              destino.toLowerCase().includes('delivery') ||
              destino.toLowerCase().includes('domicilio');

            const metodoEnvioNombre = isMotorizado ? 'Motorizado Local' : 'Agencia Shalom Nacional';
            const metodoEnvioCodigo = isMotorizado ? 'motorizado' : 'shalom';

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

            // 3. Validación estricta de SOLO los 4 campos requeridos
            const missingList: string[] = [];
            if (!clienteNombre || clienteNombre.toLowerCase() === 'clienta') missingList.push('• Nombre completo de la clienta');
            if (!clienteDni || clienteDni.length < 8) missingList.push('• DNI o Carnet de Extranjería (8 dígitos)');
            if (!clienteTelefono || clienteTelefono.length < 9) missingList.push('• Teléfono WhatsApp (9 dígitos, ej: 987654321)');
            if (!destino) missingList.push('• Destino (Agencia Shalom o Dirección para Motorizado)');

            if (missingList.length > 0) {
              const missingFieldsMsg = `📋 *Para registrar el pedido, solo necesito estos 4 datos obligatorios:*\n\n${missingList.join('\n')}\n\n💬 *Por favor envíame los datos completos para emitir tu Comprobante Oficial.*`;
              await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, missingFieldsMsg);
              return missingFieldsMsg;
            }

            const cleanPhoneDisplay = clienteTelefono.length === 9 ? clienteTelefono : clienteTelefono.slice(-9);
            const cleanPhoneFull = clienteTelefono.length === 9 ? `51${clienteTelefono}` : clienteTelefono;

            // 4. Resolver Destino según Método
            let resolvedDestination = '';
            if (isMotorizado) {
              resolvedDestination = destino.replace(/^motorizado\s*:?\s*/i, '').trim();
            } else {
              resolvedDestination = await this.resolveOfficialShalomAgency(destino, clienteDni);
            }

            // 5. Upsert de Usuario en Supabase con rol válido 'client'
            const { data: existingUser } = await supabaseAdmin
              .from('usuarios')
              .select('id')
              .eq('dni', clienteDni)
              .maybeSingle();

            let targetUserId = existingUser?.id;

            if (targetUserId) {
              await supabaseAdmin.from('usuarios').update({
                nombre_completo: clienteNombre.trim(),
                telefono_default: cleanPhoneFull,
                dni_default: clienteDni,
                direccion_default: resolvedDestination,
                referencia_default: referencia || null,
              }).eq('id', targetUserId);
            } else {
              targetUserId = 'usr-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
              const { error: insUserErr } = await supabaseAdmin.from('usuarios').insert({
                id: targetUserId,
                dni: clienteDni,
                nombre_completo: clienteNombre.trim(),
                telefono_default: cleanPhoneFull,
                dni_default: clienteDni,
                direccion_default: resolvedDestination,
                referencia_default: referencia || null,
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${clienteDni}`,
                password_hash: clienteDni,
                rol: 'client',
                puntos_xp: 0,
                nivel: 1,
                created_at: new Date().toISOString(),
              });

              if (insUserErr) {
                console.error('[USER INSERT ERROR]', insUserErr);
              }
            }

            // 6. Generar Código de Seguimiento Único
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const trackingCode = `COM-2026-${randomCode}`;
            const orderId = `ped-${Date.now()}`;

            // 7. Insertar Pedido en Supabase vinculado al usuario
            const { error: orderErr } = await supabaseAdmin.from('pedidos').insert({
              id: orderId,
              codigo_seguimiento: trackingCode,
              usuario_id: targetUserId,
              detalles_bordado: prendasBordado,
              metodo_envio_codigo: metodoEnvioCodigo,
              metodo_envio_nombre: metodoEnvioNombre,
              destino_detalle: resolvedDestination,
              estado_produccion: 'en_cola',
              estado_envio: 'pendiente',
              shalom_clave_recojo: isMotorizado ? null : '0808',
              observaciones_cliente: referencia ? `Ref: ${referencia}` : null,
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
              metodoEnvio: metodoEnvioNombre,
            });

            // 9. Emitir Comprobante Oficial Idéntico al de la Web Encomi / Comikids
            const lineaRef = referencia ? `\n🏷️ *Referencia:* ${referencia}` : '';
            const receiptMsg = `Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨\n\n-----------------------------------\n📦 *Código / Orden:* #${trackingCode}\n👤 *Destinatario:* ${clienteNombre}\n📱 *WhatsApp:* ${cleanPhoneDisplay}\n🪪 *DNI / CE Recojo:* ${clienteDni}\n🚚 *Tipo de Envío:* ${metodoEnvioNombre}\n📍 *Destino / Agencia:*\n${resolvedDestination}${lineaRef}\n-----------------------------------\nGracias por la confianza 💖✨🙏`;

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
