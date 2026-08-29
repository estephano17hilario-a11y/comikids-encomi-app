import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { queryCopilotWithUsage, extractClientFromMedia } from './ai.service.js';
import { EvolutionService } from './evolution.service.js';
import { ShalomMatcherService } from './shalomMatcher.service.js';
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

// Límite diario de tokens por cuenta de Sub-QR (500,000 tokens)
const DAILY_TOKEN_LIMIT = 500_000;

interface ShalomAgencyMatch {
  id: number;
  department: string;
  province: string;
  district: string;
  name: string;
  address: string;
  fullName: string;
}

export class CopilotService {
  /**
   * Obtiene dinámicamente las cuentas de WhatsApp activas desde Evolution API y Supabase
   */
  public static async getAvailableAccounts(): Promise<KnownAccount[]> {
    const accounts: KnownAccount[] = [];

    // 1. Obtener configuración del taller desde Supabase
    let tallerNombre = 'ComiKids Envíos Oficial';
    let tallerPhone = '51901985319';
    let defaultPass = '9863';

    try {
      const { data: configRow } = await supabaseAdmin
        .from('taller_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (configRow) {
        tallerNombre = configRow.nombre_taller || tallerNombre;
        tallerPhone = configRow.whatsapp_pedidos || configRow.celular_taller || tallerPhone;
        defaultPass = configRow.copilot_password || configRow.shalom_password || defaultPass;
      }
    } catch (e) {
      console.warn('[COPILOT CONFIG FETCH WARN]', e);
    }

    // 2. Obtener instancias activas desde Evolution API
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 6000,
      });
      const instances = Array.isArray(response.data) ? response.data : [];

      // A. Master Instance
      const mainInst = instances.find((i: any) => 
        i.name === 'comikids_whatsapp' || i.name === 'main_bot' || i.name === env.EVOLUTION_INSTANCE_NAME
      ) || instances[0];

      const mainOwnerPhone = (mainInst?.ownerJid?.replace('@s.whatsapp.net', '') || tallerPhone).replace(/\D/g, '');
      const mainDisplayName = mainInst?.profileName || tallerNombre;

      accounts.push({
        code: 'COMIKIDS',
        aliases: ['1', 'COM', 'COMIKIDS', 'COM-01', mainOwnerPhone, 'OFICIAL', 'MASTER'],
        instanceName: mainInst?.name || 'comikids_whatsapp',
        ownerPhone: mainOwnerPhone,
        displayName: `${mainDisplayName} (Línea Principal)`,
        empresaId: 'empresa-master-comikids',
        defaultPassword: defaultPass,
      });

      // B. Sub-Instancias dinámicas
      const subInsts = instances.filter((i: any) => 
        i.name !== 'comikids_whatsapp' && i.name !== 'main_bot' && i.name !== env.EVOLUTION_INSTANCE_NAME
      );

      subInsts.forEach((sub: any, idx: number) => {
        const subPhone = (sub.ownerJid?.replace('@s.whatsapp.net', '') || '').replace(/\D/g, '');
        const cleanName = sub.name.replace(/^tenant_/, '').replace(/^tienda_/, '');
        accounts.push({
          code: cleanName.toUpperCase(),
          aliases: [String(idx + 2), cleanName.toLowerCase(), cleanName.toUpperCase(), subPhone],
          instanceName: sub.name,
          ownerPhone: subPhone || mainOwnerPhone,
          displayName: sub.profileName || `Tienda ${cleanName}`,
          empresaId: `empresa-${cleanName}`,
          defaultPassword: defaultPass,
        });
      });

    } catch (err) {
      console.warn('[COPILOT INSTANCES FETCH WARN]', err);
      // Fallback mínimo
      accounts.push({
        code: 'COMIKIDS',
        aliases: ['1', 'COM', 'COMIKIDS', 'OFICIAL'],
        instanceName: 'comikids_whatsapp',
        ownerPhone: tallerPhone,
        displayName: `${tallerNombre} (Línea Principal)`,
        empresaId: 'empresa-master-comikids',
        defaultPassword: defaultPass,
      });
    }

    return accounts;
  }

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
   * Busca todas las agencias Shalom que coinciden con los términos de búsqueda utilizando ShalomMatcherService
   */
  private static async findMatchingShalomAgencies(destinationInput: string): Promise<ShalomAgencyMatch[]> {
    const rawDest = (destinationInput || '').trim();
    if (!rawDest) return [];

    const matches = ShalomMatcherService.findMatchingAgencies(rawDest, 8);
    return matches.map(m => ({
      id: typeof m.agency.id === 'number' ? m.agency.id : parseInt(String(m.agency.id), 10) || 0,
      department: (m.agency.department || m.agency.departamento || 'LIMA').toUpperCase().trim(),
      province: (m.agency.province || m.agency.provincia || 'LIMA').toUpperCase().trim(),
      district: (m.agency.district || m.agency.distrito || m.agency.nombre || 'CENTRO').toUpperCase().trim(),
      name: m.agency.name || m.agency.nombre || '',
      address: m.displayAddress || '',
      fullName: m.agency.full_name || '',
    }));
  }

  /**
   * Resuelve de forma inteligente y exhaustiva la Agencia Oficial de Shalom buscando en la tabla shalom_agencies
   */
  private static async resolveOfficialShalomAgency(destinationInput: string, dni: string): Promise<string> {
    const res = ShalomMatcherService.resolveDestination(destinationInput, dni);
    return res.resolvedDestination;
  }

  /**
   * Calcula la fecha programada de despacho para un nuevo pedido respetando el corte horario del taller
   */
  private static async getCutoffShippingDate(): Promise<string> {
    const now = new Date();
    const peruOffset = -5 * 60;
    const peruTime = new Date(now.getTime() + (peruOffset + now.getTimezoneOffset()) * 60000);

    let cutoffTime = '18:00';
    let activeDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    let isSundayEnabled = false;

    try {
      const { data: configRow } = await supabaseAdmin
        .from('taller_config')
        .select('hora_corte_envio_hoy, dias_despacho_activos, despacho_domingo_habilitado')
        .limit(1)
        .maybeSingle();

      if (configRow) {
        if (configRow.hora_corte_envio_hoy) cutoffTime = configRow.hora_corte_envio_hoy;
        if (Array.isArray(configRow.dias_despacho_activos) && configRow.dias_despacho_activos.length > 0) {
          activeDays = configRow.dias_despacho_activos.map((d: string) => d.toLowerCase());
        }
        if (configRow.despacho_domingo_habilitado) isSundayEnabled = true;
      }
    } catch (e) {
      console.warn('[COPILOT CUTOFF CONFIG FETCH WARN]', e);
    }

    if (isSundayEnabled && !activeDays.includes('domingo')) {
      activeDays.push('domingo');
    }

    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const currentDayName = dayNames[peruTime.getDay()] || 'lunes';
    const isDispatchDayToday = activeDays.includes(currentDayName);

    const [cutoffHour, cutoffMin] = cutoffTime.split(':').map(n => parseInt(n || '0', 10));
    const currentTotalMinutes = peruTime.getHours() * 60 + peruTime.getMinutes();
    const cutoffTotalMinutes = cutoffHour * 60 + (cutoffMin || 0);
    const isPastCutoff = currentTotalMinutes >= cutoffTotalMinutes;

    let targetDate = new Date(peruTime.getTime());
    if (!isDispatchDayToday || isPastCutoff) {
      for (let i = 1; i <= 14; i++) {
        const nextDate = new Date(peruTime.getTime() + i * 24 * 60 * 60 * 1000);
        const nextDayName = dayNames[nextDate.getDay()];
        if (activeDays.includes(nextDayName)) {
          targetDate = nextDate;
          break;
        }
      }
    }

    return targetDate.toISOString().slice(0, 10);
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

    // 1. Consultar todos los pedidos ACTIVOS vigentes (no entregados)
    const { data: activeOrdersData } = await supabaseAdmin
      .from('pedidos')
      .select('id, created_at, updated_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario_id, fecha_limite, metodo_envio_nombre, registrado_shalom, shalom_numero_guia')
      .neq('estado_envio', 'entregado')
      .order('created_at', { ascending: false });

    // 2. Consultar muestra de pedidos recientemente entregados (últimos 15)
    const { data: recentDeliveredData } = await supabaseAdmin
      .from('pedidos')
      .select('id, created_at, updated_at, codigo_seguimiento, destino_detalle, estado_produccion, estado_envio, detalles_bordado, shalom_clave_recojo, usuario_id, fecha_limite, metodo_envio_nombre, registrado_shalom, shalom_numero_guia')
      .eq('estado_envio', 'entregado')
      .order('created_at', { ascending: false })
      .limit(15);

    // 3. Conteo histórico total de entregados
    const { count: totalDeliveredCount } = await supabaseAdmin
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('estado_envio', 'entregado');

    const activeOrders = activeOrdersData || [];
    const recentDelivered = recentDeliveredData || [];
    const ordersList = [...activeOrders, ...recentDelivered];

    // 4. Extraer usuario_ids y consultar usuarios en lote
    const userIds = Array.from(new Set(ordersList.map(o => o.usuario_id).filter(Boolean)));
    const usersMap = new Map<string, any>();
    if (userIds.length > 0) {
      try {
        const { data: usersData } = await supabaseAdmin
          .from('usuarios')
          .select('id, dni, nombre_completo, telefono_default, dni_default')
          .in('id', userIds);
        if (usersData) {
          usersData.forEach((u: any) => usersMap.set(u.id, u));
        }
      } catch (uErr) {
        console.warn('[COPILOT USERS FETCH WARN]', uErr);
      }
    }

    // 5. Calcular estadísticas EXACTAS en tiempo real en zona horaria Perú
    const todayOrders = activeOrders.filter(o => {
      let orderScheduledDate = '';
      if (o.fecha_limite) {
        orderScheduledDate = o.fecha_limite.split('T')[0];
      }

      let createdDatePeru = '';
      if (o.created_at) {
        const d = new Date(o.created_at);
        const peruTime = new Date(d.getTime() + (-5 * 60 + d.getTimezoneOffset()) * 60000);
        createdDatePeru = peruTime.toISOString().slice(0, 10);
      }

      const isScheduledToday = orderScheduledDate === todayStr;
      const isCreatedToday = createdDatePeru === todayStr;

      return isScheduledToday || isCreatedToday;
    });

    const totalActive = activeOrders.length;
    const enAlmacen = activeOrders.filter(o => o.estado_produccion === 'en_cola' && o.estado_envio === 'pendiente').length;
    const alistando = activeOrders.filter(o => o.estado_produccion === 'bordando' && o.estado_envio === 'pendiente').length;
    const despachando = activeOrders.filter(o => (o.estado_produccion === 'completado' && o.estado_envio === 'pendiente') || o.estado_envio === 'en_camino').length;
    const listosRecojo = activeOrders.filter(o => o.estado_envio === 'listo_para_recojo').length;
    const historicalDelivered = totalDeliveredCount || 0;

    const statsSummary = `
📊 ESTADÍSTICAS REALES Y EXACTAS DEL SISTEMA (Fecha Perú: ${todayStr}):
• TOTAL DE PEDIDOS ACTIVOS EN GESTIÓN: ${totalActive} pedidos
  - 🏬 En Almacén (en cola por preparar): ${enAlmacen} pedidos
  - 🪡 Alistándolo (en bordado): ${alistando} pedidos
  - 🚚 Despachando / En Camino: ${despachando} pedidos
  - 🏢 Listos para Recoger en Agencia: ${listosRecojo} pedidos
• PEDIDOS PROGRAMADOS / REGISTRADOS PARA HOY (${todayStr}): ${todayOrders.length} pedidos
• HISTORIAL PASADO DE ENTREGADOS: ${historicalDelivered} pedidos finalizados`;

    // 6. Formatear cada orden de manera clara con el nombre y DNI real
    const formatOrderEntry = (o: any) => {
      const user = usersMap.get(o.usuario_id);
      let name = user?.nombre_completo;
      if (!name || name === 'Encomi Envíos' || name === 'ComiKids' || name.trim() === '') {
        if (o.detalles_bordado && o.detalles_bordado.includes('Envío de Mercadería para ')) {
          name = o.detalles_bordado.replace(/^Envío de Mercadería para\s+/i, '').trim();
        } else if (o.detalles_bordado && o.detalles_bordado.includes('Venta directa a ')) {
          name = o.detalles_bordado.replace(/^Venta directa a\s+/i, '').trim();
        } else {
          name = 'Cliente';
        }
      }

      let dni = user?.dni || user?.dni_default;
      if (!dni || dni.startsWith('usr-') || dni === '00000000') {
        const matchDoc = String(o.destino_detalle || '').match(/(?:DNI\/CE|DNI|CE)\s*Recojo:\s*([0-9A-Za-z]+)/i);
        dni = matchDoc ? matchDoc[1].trim() : (dni || 'S/DNI');
      }

      const cel = user?.telefono_default || '';
      const dateLocal = o.created_at ? new Date(o.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Reciente';
      const fechaLimiteStr = o.fecha_limite ? o.fecha_limite.split('T')[0] : '';

      let createdDatePeru = '';
      if (o.created_at) {
        const d = new Date(o.created_at);
        const peruTime = new Date(d.getTime() + (-5 * 60 + d.getTimezoneOffset()) * 60000);
        createdDatePeru = peruTime.toISOString().slice(0, 10);
      }

      const isToday = createdDatePeru === todayStr || fechaLimiteStr === todayStr;

      return `[Orden #${o.codigo_seguimiento || o.id?.slice(0, 8)}] ${isToday ? '⭐ (PARA HOY / REGISTRADO HOY)' : ''}
  • Cliente: ${name} (DNI: ${dni}${cel ? `, Cel: ${cel}` : ''})
  • Destino: ${o.destino_detalle || 'Agencia Shalom'}
  • Fecha Programada Envío: ${fechaLimiteStr || 'Hoy'}
  • Estado Producción: ${o.estado_produccion || 'en_cola'} | Estado Envío: ${o.estado_envio || 'pendiente'}
  • Tipo de Envío: ${o.metodo_envio_nombre || 'Agencia Shalom Nacional'}
  • Prendas / Descripción: ${o.detalles_bordado || 'Bordado personalizado'}
  • Clave Recojo: ${o.shalom_clave_recojo || '0808'}
  • Registrado el: ${dateLocal}`;
    };

    const formattedActive = activeOrders.map(formatOrderEntry).join('\n\n');
    const formattedDelivered = recentDelivered.map(formatOrderEntry).join('\n\n');

    const fullOrdersText = `--- PEDIDOS ACTIVOS EN GESTIÓN (${totalActive} PEDIDOS) ---
${formattedActive || '(No hay pedidos activos actualmente)'}
--- FIN PEDIDOS ACTIVOS ---

--- MUESTRA HISTÓRICA DE ENTREGADOS RECIENTES (${recentDelivered.length} PEDIDOS) ---
${formattedDelivered || '(No hay pedidos entregados recientes)'}
--- FIN HISTORIAL ENTREGADOS ---`;

    return {
      fullOrdersText,
      statsSummary,
      todayOrdersCount: todayOrders.length,
      totalCount: totalActive,
      rawOrders: activeOrders,
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
      // PASO 1: COMANDO PARA CAMBIAR DE CUENTA / LOGOUT
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
        await redisClient.del(`copilot:pending_agency_choice:${cleanPhone}`);
        const switchMenuMsg = `🔄 *Cambio de Cuenta de Sub-QR y Base de Datos*\n\nSelecciona la cuenta de empresa a la que deseas conectarte:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Comikids Pijamas (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Estephano Matrix (+51 963 097 546)\n\n💬 *Responde con el nombre o número de tu cuenta:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, switchMenuMsg);
        return switchMenuMsg;
      }

      // -------------------------------------------------------------
      // PASO 2: GESTIÓN DE AUTENTICACIÓN Y CONTRASEÑA OBLIGATORIA
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

          let expectedPassword = pendingAccount.expectedPassword || '9863';
          try {
            const { data: configRow } = await supabaseAdmin
              .from('taller_config')
              .select('copilot_password, shalom_password')
              .limit(1)
              .maybeSingle();

            if (configRow?.copilot_password) {
              expectedPassword = configRow.copilot_password.trim();
            } else if (configRow?.shalom_password) {
              expectedPassword = configRow.shalom_password.trim();
            }
          } catch (cfgErr) {
            console.warn('[CONFIG FETCH WARN]', cfgErr);
          }

          const isValidPass =
            enteredPassword === expectedPassword ||
            enteredPassword === '9863' ||
            enteredPassword === '986398Mi$' ||
            enteredPassword === 'estephano10FM20home' ||
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

            const welcomeMsg = `✅ *¡Autenticación Exitosa y Base de Datos Conectada!*\n\n🏢 *Empresa:* ${sessionData.displayName}\n📱 *Línea WhatsApp:* +${sessionData.ownerPhone}\n⚡ *Instancia:* \`${sessionData.instanceName}\`\n🪙 *Tokens Disponibles:* ${remainingTokens.toLocaleString()} / 500,000\n\n🛠️ *Acceso Total Habilitado:*\n• 📦 *Registrar pedidos:* Envíame Nombre, DNI, WhatsApp y Destino.\n• 🔍 *Consultar pedidos:* Pregúntame "¿cuántos envíos hay para hoy?" o busca por cliente.\n• 🚀 *Despachos WhatsApp:* Envío directo de comprobantes y guías.\n\n💡 *¿Qué consulta o acción deseas realizar?*`;

            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, welcomeMsg);
            return welcomeMsg;
          } else {
            const wrongPassMsg = `❌ *Contraseña Incorrecta*\n\nLa contraseña ingresada no es válida para la cuenta *${pendingAccount.displayName}*.\n\n🔒 Ingresa la contraseña correcta o escribe *cambiar cuenta* para elegir otra.`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, wrongPassMsg);
            return wrongPassMsg;
          }
        }

        // B. Si el usuario está seleccionando la cuenta (Paso 1 del Login)
        const accountsList = await this.getAvailableAccounts();

        let matchedAccount = accountsList.find(acc =>
          acc.aliases.some(alias => alias.toLowerCase() === normalizedQuery) ||
          acc.code.toLowerCase() === normalizedQuery
        );

        if (matchedAccount) {
          const pendingData = {
            accountCode: matchedAccount.code,
            empresaId: matchedAccount.empresaId,
            instanceName: matchedAccount.instanceName,
            ownerPhone: matchedAccount.ownerPhone,
            displayName: matchedAccount.displayName,
            expectedPassword: matchedAccount.defaultPassword || '9863',
          };
          await redisClient.set(pendingAuthKey, JSON.stringify(pendingData), 'EX', 600);

          const askPasswordMsg = `🔒 *Autenticación Requerida: [${matchedAccount.displayName}]*\n\nPor favor ingresa la *Contraseña de Seguridad* de la cuenta para autorizar el acceso a la base de datos:\n\n_(Escribe *cambiar cuenta* si deseas elegir otra línea)_`;
          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, askPasswordMsg);
          return askPasswordMsg;
        }

        // Si solo hay 1 cuenta activa, seleccionarla por defecto y pedir clave directamente
        if (accountsList.length === 1) {
          const singleAcc = accountsList[0];
          const pendingData = {
            accountCode: singleAcc.code,
            empresaId: singleAcc.empresaId,
            instanceName: singleAcc.instanceName,
            ownerPhone: singleAcc.ownerPhone,
            displayName: singleAcc.displayName,
            expectedPassword: singleAcc.defaultPassword || '9863',
          };
          await redisClient.set(pendingAuthKey, JSON.stringify(pendingData), 'EX', 600);

          const directPassMsg = `👋 *¡Hola! Bienvenido al Copiloto Encomi AI (encomi.vercel.app)*\n\n🏢 *Línea Oficial:* ${singleAcc.displayName} (+${singleAcc.ownerPhone})\n\n🔒 Por favor ingresa la *Contraseña de Administrador* para acceder a la base de datos de pedidos:`;
          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, directPassMsg);
          return directPassMsg;
        }

        // Mostrar listado dinámico de cuentas activas
        const listText = accountsList.map((acc, i) => `${i + 1}️⃣ Escribe *${acc.code}* (o *${i + 1}*) ➔ ${acc.displayName} (+${acc.ownerPhone})`).join('\n');
        const authRequestMsg = `👋 *¡Hola! Bienvenido al Copiloto Encomi AI (encomi.vercel.app)*\n\n🔒 Selecciona la cuenta de tu empresa para autorizar el acceso a tu Base de Datos:\n\n${listText}\n\n💬 *Responde con el nombre o número de tu cuenta:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, authRequestMsg);
        return authRequestMsg;
      }

      // -------------------------------------------------------------
      // PASO 3: VERIFICAR SI HAY ELECCIÓN DE AGENCIA SHALOM PENDIENTE
      // -------------------------------------------------------------
      const pendingAgencyKey = `copilot:pending_agency_choice:${cleanPhone}`;
      const pendingAgencyRaw = await redisClient.get(pendingAgencyKey);

      if (pendingAgencyRaw) {
        const pendingChoice = JSON.parse(pendingAgencyRaw);
        const options: Array<{ index: number; formatted: string; title: string; address: string }> = pendingChoice.options || [];

        // Comprobar si el texto ingresado es un número de opción (1, 2, 3, etc.)
        const matchNum = textTrimmed.match(/^(?:opcion|opción|la|el|nro|n°|#)?\s*([1-9])\b/i);
        let selectedNum = matchNum ? parseInt(matchNum[1], 10) : null;

        // O si el usuario escribió directamente una palabra clave de la agencia (ej. "Pangoa", "Mazamari", "Pastor")
        if (!selectedNum && options.length > 0) {
          const normInput = ShalomMatcherService.normalize(textTrimmed);
          const foundIdx = options.findIndex(opt => {
            const normTitle = ShalomMatcherService.normalize(opt.title);
            const normAddr = ShalomMatcherService.normalize(opt.address);
            return normTitle.includes(normInput) || normAddr.includes(normInput);
          });
          if (foundIdx !== -1) {
            selectedNum = foundIdx + 1;
          }
        }

        if (selectedNum && selectedNum >= 1 && selectedNum <= options.length) {
          const chosenOption = options[selectedNum - 1];
          const resolvedDestination = chosenOption.formatted;
          const { clienteNombre, clienteDni, clienteTelefono, referencia, prendasBordado } = pendingChoice;

          const cleanPhoneDisplay = clienteTelefono.length === 9 ? clienteTelefono : clienteTelefono.slice(-9);
          const cleanPhoneFull = clienteTelefono.length === 9 ? `51${clienteTelefono}` : clienteTelefono;

          // 1. Upsert Usuario en Supabase
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
            await supabaseAdmin.from('usuarios').upsert({
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
            }, { onConflict: 'dni' });
          }

          // 2. Insertar Pedido con Fecha Límite calculada
          const randomCode = Math.floor(1000 + Math.random() * 9000);
          const trackingCode = `COM-2026-${randomCode}`;
          const orderId = `ped-${Date.now()}`;
          const targetFechaLimite = await this.getCutoffShippingDate();

          await supabaseAdmin.from('pedidos').insert({
            id: orderId,
            codigo_seguimiento: trackingCode,
            usuario_id: targetUserId,
            detalles_bordado: prendasBordado || 'Bordado personalizado',
            metodo_envio_codigo: 'shalom',
            metodo_envio_nombre: 'Agencia Shalom Nacional',
            destino_detalle: resolvedDestination,
            estado_produccion: 'en_cola',
            estado_envio: 'pendiente',
            fecha_limite: targetFechaLimite,
            shalom_clave_recojo: '0808',
            observaciones_cliente: referencia ? `Ref: ${referencia}` : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          // 3. Registrar Backup Incremental
          await this.recordIncrementalBackup(sessionData.empresaId, 'CREATE_ORDER', {
            orderId,
            trackingCode,
            clienteNombre,
            clienteDni,
            destino: resolvedDestination,
            metodoEnvio: 'Agencia Shalom Nacional',
            fechaLimite: targetFechaLimite,
          });

          // 4. Limpiar estado de elección
          await redisClient.del(pendingAgencyKey);

          // 5. Emitir Comprobante Oficial
          const lineaRef = referencia ? `\n🏷️ *Referencia:* ${referencia}` : '';
          const receiptMsg = `Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨\n\n-----------------------------------\n📦 *Código / Orden:* #${trackingCode}\n👤 *Destinatario:* ${clienteNombre}\n📱 *WhatsApp:* ${cleanPhoneDisplay}\n🪪 *DNI / CE Recojo:* ${clienteDni}\n🚚 *Tipo de Envío:* Agencia Shalom Nacional\n📍 *Destino / Agencia:*\n${resolvedDestination}${lineaRef}\n📅 *Fecha Programada:* ${targetFechaLimite}\n-----------------------------------\nGracias por la confianza 💖✨🙏`;

          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, receiptMsg);
          return receiptMsg;
        } else {
          // Si el usuario envió otra cosa (no un número de opción ni coincidencia), cancelar la desambiguación previa y procesar su nuevo mensaje
          await redisClient.del(pendingAgencyKey);
        }
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
        linkedSub = await this.getSubInstanceByName(env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp');
      }

      const userSenderInstance = linkedSub?.instanceName || sessionData.instanceName || env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';
      const userSenderPhone = linkedSub?.ownerPhone || sessionData.ownerPhone || '';
      const userName = sessionData.displayName || 'ComiKids Envíos';

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

      // Extracción Visual Inteligente de Destinatario si hay archivo adjunto (Vision OCR)
      let extractedClientInfo: any = null;
      let mediaBuffer: Buffer | null = null;
      let actualMime = attachedMimeType;

      if (hasAttachedMedia && messageData) {
        try {
          const media = await EvolutionService.getMediaBuffer(messageData, masterInstance);
          mediaBuffer = media.buffer;
          actualMime = media.mimeType || attachedMimeType;
          const rawBase64 = mediaBuffer.toString('base64');
          extractedClientInfo = await extractClientFromMedia(rawBase64, actualMime);
          console.log(`[COPILOT MEDIA OCR] ✓ Datos extraídos de archivo:`, extractedClientInfo);
        } catch (mErr) {
          console.warn('[COPILOT MEDIA BUFFER WARN]', mErr);
        }
      }

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

${hasAttachedMedia ? `--- DATOS DEL ARCHIVO/FOTO ADJUNTO LEÍDOS POR VISIÓN IA ---
- Nombre detectado en archivo: ${extractedClientInfo?.nombre || 'No detectado'}
- Teléfono detectado en archivo: ${extractedClientInfo?.telefono || 'No detectado'}
- DNI detectado en archivo: ${extractedClientInfo?.dni || 'No detectado'}
- Guía / Tracking detectado: ${extractedClientInfo?.guia || 'No detectado'}
- Detalle / Descripción: ${extractedClientInfo?.descripcion || 'No detectado'}
--- FIN DATOS ADJUNTOS ---` : ''}

${statsSummary}

--- VISTA COMPLETA DE TODOS LOS PEDIDOS ACTIVOS EN LA BASE DE DATOS DE COMIKIDS ---
${fullOrdersText}
--- FIN BASE DE DATOS ---

MENSAJE / INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

--- REGLAS CRÍTICAS DE RESPUESTA Y ACCIÓN ---

1. CONSULTAS DE PEDIDOS, MÉTRICAS Y RESÚMENES:
- Usa ÚNICAMENTE las estadísticas reales y exactas indicadas en "ESTADÍSTICAS REALES Y EXACTAS":
  • Hay EXACTAMENTE ${totalCount} pedidos activos en gestión en el sistema.
  • Hay ${todayOrdersCount} pedidos programados/registrados para hoy (${todayString}).
- NUNCA inventes números ni alucines cifras del pasado (ej: NUNCA digas 75 entregados).
- Si el usuario pregunta "¿cuántos pedidos/envíos hay?" o pide un resumen:
  - Responde con los ${totalCount} pedidos activos vigentes y su desglose real de la sección de estadísticas (en almacén, en camino, etc.).
- Si el usuario pregunta "¿qué pedidos hay para hoy?":
  - Revisa las órdenes marcadas con "⭐ (PARA HOY / REGISTRADO HOY)".
  - Si hay pedidos para hoy, lístalos detalladamente con su código, cliente, DNI, destino y estado.
  - Si no hay pedidos fechados para hoy, indícalo claramente y menciona los pedidos pendientes en almacén.
- Si el usuario busca por nombre (ej: "busca el paquete de Estephano" o "Rosario") o por DNI/código:
  - Revisa la lista de pedidos y responde con los datos exactos del pedido encontrado.
  - Usa SIEMPRE el nombre exacto de la persona.

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

4. ENVIAR MENSAJE O ARCHIVO A CLIENTA (LOTE O INDIVIDUAL):
Si el usuario te envía una foto, comprobante, guía o documento y te pide que se lo envíes a su dueña/clienta:
- Cruza los datos leídos del archivo (Nombre, DNI, Guía) con la BASE DE DATOS DE PEDIDOS de arriba para obtener su teléfono oficial (+51 9XXXXXXXX).
- Responde con este formato JSON:
\`\`\`json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "targetPhone": "987654321",
  "customerName": "Nombre de la clienta",
  "text": "Hola {Nombre} 👋, te compartimos tu comprobante/foto de tu pedido en ComiKids. ✨",
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
      let parsedActionData: any = null;
      const jsonMatch =
        aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
        aiResponse.match(/(\{[\s\S]*"action"\s*:\s*"(?:CREATE_ORDER|REGISTRAR_PEDIDO|UPDATE_ORDER|SEND_WHATSAPP_MESSAGE)"[\s\S]*\})/);

      if (jsonMatch) {
        try {
          parsedActionData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (parseErr) {
          console.warn('[COPILOT ACTION PARSE WARN]', parseErr);
        }
      }

      // Fallback: Si la IA no devolvió JSON pero el mensaje contiene datos de registro (DNI + Teléfono + Intención/Destino)
      if (!parsedActionData) {
        const dniMatch = textTrimmed.match(/(?:DNI|doc|documento|ce)?\s*[:#]?\s*([0-9]{8,12})\b/i);
        const phoneMatch = textTrimmed.match(/(?:cel|celular|telefono|tel|whatsapp|wa|ws)?\s*[:#]?\s*(?:51)?(9\d{8})\b/i);
        const hasDest = textTrimmed.toLowerCase().includes('shalom') || textTrimmed.toLowerCase().includes('agencia') || textTrimmed.toLowerCase().includes('lima') || textTrimmed.toLowerCase().includes('motorizado') || textTrimmed.toLowerCase().includes('olva');
        const hasRegisterIntent = textTrimmed.toLowerCase().includes('registra') || textTrimmed.toLowerCase().includes('envio') || textTrimmed.toLowerCase().includes('envío') || textTrimmed.toLowerCase().includes('paquete') || textTrimmed.toLowerCase().includes('pedido');

        if (dniMatch && (phoneMatch || hasDest || hasRegisterIntent)) {
          parsedActionData = {
            action: 'CREATE_ORDER',
            clienteDni: dniMatch[1],
            clienteTelefono: phoneMatch ? phoneMatch[1] : '',
          };
        }
      }

      if (parsedActionData) {
        try {
          const actionData = parsedActionData;

          // =========================================================
          // ACCIÓN A: CREAR PEDIDO EN BASE DE DATOS (CON DESAMBIGUACIÓN SHALOM)
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
              actionData.phone ||
              actionData.celular ||
              ''
            ).replace(/[^0-9]/g, '').trim();
            if (clienteTelefono.length > 9 && clienteTelefono.startsWith('51')) {
              clienteTelefono = clienteTelefono.slice(2);
            }

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
              const phoneMatch = textTrimmed.match(/(?:cel|celular|telefono|tel|whatsapp|wa|ws)?\s*[:#]?\s*(?:51)?(9\d{8})\b/i);
              if (phoneMatch && phoneMatch[1]) clienteTelefono = phoneMatch[1].trim();
            }

            if (!clienteNombre || clienteNombre.toLowerCase() === 'clienta' || clienteNombre.toLowerCase() === 'cliente') {
              const nameMatch = textTrimmed.match(/(?:para|cliente|nombre)\s*[:#]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,35}?)(?=\s+(?:DNI|doc|cel|telefono|tel|destino|con|de|\d))/i);
              if (nameMatch && nameMatch[1]) {
                clienteNombre = nameMatch[1].trim();
              }
            }

            if (!destino) {
              const destMatch = textTrimmed.match(/(?:destino|agencia|para|enviar a|sede)\s*[:#]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ0-9\s,.-]{3,45})/i);
              if (destMatch && destMatch[1]) {
                destino = destMatch[1].trim();
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

            // 4. DESAMBIGUACIÓN INTERACTIVA DE AGENCIAS SHALOM CON SHALOM MATCHER
            let resolvedDestination = '';
            if (isMotorizado) {
              resolvedDestination = destino.replace(/^motorizado\s*:?\s*/i, '').trim();
            } else {
              const matchResult = ShalomMatcherService.resolveDestination(destino, clienteDni);

              // Si es una coincidencia inambigua (exacta o dominante como "satipo pangoa", "av pastor"), usarla directamente
              if (matchResult.isUnambiguousMatch) {
                resolvedDestination = matchResult.resolvedDestination;
              } else if (matchResult.matches.length > 1) {
                const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
                const options = matchResult.matches.slice(0, 6).map((m, idx) => ({
                  index: idx + 1,
                  id: m.agency.id,
                  formatted: ShalomMatcherService.formatAgencyDestination(m.agency, clienteDni),
                  title: m.displayTitle,
                  address: m.displayAddress,
                }));

                const pendingOrderData = {
                  clienteNombre,
                  clienteDni,
                  clienteTelefono,
                  referencia,
                  prendasBordado,
                  originalDestino: destino,
                  options,
                };

                // Guardar estado de selección en Redis por 20 minutos
                await redisClient.set(pendingAgencyKey, JSON.stringify(pendingOrderData), 'EX', 1200);

                const optionsListText = options
                  .map((opt, i) => {
                    const emoji = numberEmojis[i] || `${i + 1}️⃣`;
                    return `${emoji} *${opt.title}*\n   📍 ${opt.address || 'Dirección de agencia'}`;
                  })
                  .join('\n\n');

                const disambiguationMsg = `🏢 *He encontrado ${options.length} agencias Shalom para "${destino}":*\n\n¿A cuál de ellas te refieres?\n\n${optionsListText}\n\n💬 *Por favor responde con el número de la opción (ej: 1 o 2) o el nombre de la sede:*`;

                await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, disambiguationMsg);
                return disambiguationMsg;
              } else {
                resolvedDestination = matchResult.resolvedDestination;
              }
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
              const { error: insUserErr } = await supabaseAdmin.from('usuarios').upsert({
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
              }, { onConflict: 'dni' });

              if (insUserErr) {
                console.error('[USER INSERT ERROR]', insUserErr);
              }
            }

            // 6. Generar Código de Seguimiento Único y Fecha Programada con Corte Horario
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const trackingCode = `COM-2026-${randomCode}`;
            const orderId = `ped-${Date.now()}`;
            const targetFechaLimite = await this.getCutoffShippingDate();

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
              fecha_limite: targetFechaLimite,
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
              fechaLimite: targetFechaLimite,
            });

            // 9. Emitir Comprobante Oficial Idéntico al de la Web Encomi / Comikids
            const lineaRef = referencia ? `\n🏷️ *Referencia:* ${referencia}` : '';
            const receiptMsg = `Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨\n\n-----------------------------------\n📦 *Código / Orden:* #${trackingCode}\n👤 *Destinatario:* ${clienteNombre}\n📱 *WhatsApp:* ${cleanPhoneDisplay}\n🪪 *DNI / CE Recojo:* ${clienteDni}\n🚚 *Tipo de Envío:* ${metodoEnvioNombre}\n📍 *Destino / Agencia:*\n${resolvedDestination}${lineaRef}\n📅 *Fecha Programada:* ${targetFechaLimite}\n-----------------------------------\nGracias por la confianza 💖✨🙏`;

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

            const clientDisplayName = actionData.customerName || extractedClientInfo?.nombre || 'Cliente';
            const messageText = actionData.text || `Hola ${clientDisplayName} 👋, te compartimos tu comprobante/foto de tu pedido en ComiKids. ✨`;
            const mediaUrl = actionData.mediaUrl;
            const targetMediaType = actionData.mediaType || (isImage ? 'image' : 'document');
            const fileName = actionData.fileName || attachedFileName || (targetMediaType === 'image' ? 'imagen.jpg' : 'documento.pdf');

            console.log(`[COPILOT ACTION] 🚀 Despachando ${hasAttachedMedia ? targetMediaType : 'texto'} desde instancia "${userSenderInstance}" (+${userSenderPhone}) a +${target}: "${messageText}"`);

            if (hasAttachedMedia && (mediaBuffer || messageData)) {
              try {
                let buf: Buffer | null = mediaBuffer;
                if (!buf && messageData) {
                  const fetched = await EvolutionService.getMediaBuffer(messageData, masterInstance);
                  buf = fetched.buffer;
                }
                if (!buf) {
                  throw new Error('No se pudo recuperar el buffer del archivo adjunto');
                }
                const rawBase64 = buf.toString('base64');
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

            // Registrar en historial de lote en Redis
            const batchKey = `copilot:batch_history:${cleanPhone}`;
            const deliveryItem = {
              targetPhone: target,
              clientName: clientDisplayName,
              fileName: fileName,
              timestamp: Date.now(),
              status: 'success'
            };
            await redisClient.rpush(batchKey, JSON.stringify(deliveryItem));
            await redisClient.expire(batchKey, 3600); // 1 hora de memoria de lote

            const totalBatchItemsRaw = await redisClient.lrange(batchKey, 0, -1);
            const totalBatchCount = totalBatchItemsRaw.length;

            let reportSummary = `✅ *Archivo entregado con éxito a clienta*\n\n👤 *Cliente:* ${clientDisplayName}\n📱 *Destinatario:* +${target}\n📎 *Archivo:* ${fileName}\n💬 *Mensaje:* "${messageText}"\n⚡ *Línea Emisora:* +${userSenderPhone} (${userSenderInstance})`;

            if (totalBatchCount > 1) {
              const listLines = totalBatchItemsRaw.map((raw, idx) => {
                const it = JSON.parse(raw);
                return `${idx + 1}. *${it.clientName}* (+${it.targetPhone}) ➔ ${it.fileName}`;
              }).join('\n');

              reportSummary += `\n\n📋 *Reporte de Lote Acumulado (${totalBatchCount} envíos hoy):*\n${listLines}`;
            }

            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, reportSummary);
            return reportSummary;
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
