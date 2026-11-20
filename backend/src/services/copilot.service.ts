import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { queryCopilotWithUsage, extractClientFromMedia } from './ai.service.js';
import { EvolutionService } from './evolution.service.js';
import { ShalomMatcherService, ShalomRenameNotice } from './shalomMatcher.service.js';
import { runWhatsAppAutonomousAgent } from './whatsappCopilotTools.js';
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

// Límite diario de tokens por cuenta de Sub-QR (2,000,000 tokens)
const DAILY_TOKEN_LIMIT = 2_000_000;

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
        const subEmpresaId = cleanName.toLowerCase().includes('comikids')
          ? 'empresa-master-comikids'
          : `empresa-${cleanName}`;
        accounts.push({
          code: cleanName.toUpperCase(),
          aliases: [String(idx + 2), cleanName.toLowerCase(), cleanName.toUpperCase(), subPhone],
          instanceName: sub.name,
          ownerPhone: subPhone || mainOwnerPhone,
          displayName: sub.profileName || `Tienda ${cleanName}`,
          empresaId: subEmpresaId,
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

  private static cutoffCache: { dateStr: string; expiresAt: number } | null = null;

  private static async getCachedCutoffShippingDate(): Promise<string> {
    const now = Date.now();
    if (this.cutoffCache && this.cutoffCache.expiresAt > now) {
      return this.cutoffCache.dateStr;
    }
    const dateStr = await this.getCutoffShippingDate();
    this.cutoffCache = { dateStr, expiresAt: now + 5 * 60 * 1000 };
    return dateStr;
  }

  private static normalizePhone(rawPhone: string): { display: string; full: string } {
    const digits = (rawPhone || '').replace(/\D/g, '');
    const display = digits.length >= 9 ? digits.slice(-9) : digits;
    const full = display.length === 9 ? `51${display}` : digits;
    return { display, full };
  }

  private static normalizeDni(rawDni: string): string {
    return (rawDni || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Persiste cliente en `usuarios` (garantizando ID real sin huérfanos) y pedido en `pedidos`
   * con todos los campos sincronizados para Encomi Web.
   */
  private static async persistRegisteredOrder(params: {
    clienteNombre: string;
    clienteDni: string;
    clienteTelefono: string;
    metodoEnvio: 'shalom' | 'motorizado';
    destinoDetalle: string;
    referencia?: string | null;
    prendasBordado?: string | null;
    empresaId?: string | null;
  }) {
    const cleanName = (params.clienteNombre || '').trim() || 'Cliente';
    const cleanDni = this.normalizeDni(params.clienteDni);
    const { display: cleanPhoneDisplay, full: cleanPhoneFull } = this.normalizePhone(params.clienteTelefono);

    // Normalizar empresaId: cualquier variante de comikids apunta a la cuenta maestra
    let targetEmpresaId = (params.empresaId || 'empresa-master-comikids').trim();
    if (!targetEmpresaId || targetEmpresaId.toLowerCase().includes('comikids')) {
      targetEmpresaId = 'empresa-master-comikids';
    }

    let targetUserId: string | null = null;
    if (cleanDni) {
      const { data: byDni } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre_completo, telefono_default')
        .or(`dni.eq.${cleanDni},dni_default.eq.${cleanDni}`)
        .limit(1);
      if (byDni && byDni.length > 0) targetUserId = byDni[0].id;
    }
    if (!targetUserId && cleanPhoneDisplay) {
      const orClause =
        cleanPhoneDisplay && cleanPhoneDisplay !== cleanPhoneFull
          ? `telefono_default.eq.${cleanPhoneDisplay},telefono_default.eq.${cleanPhoneFull}`
          : `telefono_default.eq.${cleanPhoneDisplay}`;
      const { data: byPhone } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre_completo, telefono_default')
        .or(orClause)
        .limit(1);
      if (byPhone && byPhone.length > 0) targetUserId = byPhone[0].id;
    }

    const userUpdatePayload: Record<string, any> = {
      nombre_completo: cleanName,
      telefono_default: cleanPhoneDisplay, // 9 dígitos estándar en Encomi
      dni_default: cleanDni || null,
      direccion_default: params.destinoDetalle,
      referencia_default: params.referencia || null,
    };

    if (targetUserId) {
      const { error: updErr } = await supabaseAdmin
        .from('usuarios')
        .update(userUpdatePayload)
        .eq('id', targetUserId);
      if (updErr) {
        console.warn('[Copilot persistRegisteredOrder] Error actualizando usuario:', updErr.message);
      }
    } else {
      const generatedId = 'usr-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const uniqueDniKey = cleanDni || `BOT-${cleanPhoneDisplay || Date.now().toString(36)}`;
      const { data: insertedUser, error: insErr } = await supabaseAdmin
        .from('usuarios')
        .upsert(
          {
            id: generatedId,
            dni: uniqueDniKey,
            nombre_completo: cleanName,
            telefono_default: cleanPhoneDisplay,
            dni_default: cleanDni || null,
            direccion_default: params.destinoDetalle,
            referencia_default: params.referencia || null,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uniqueDniKey)}`,
            password_hash: cleanDni || cleanPhoneDisplay || '1234',
            rol: 'client',
            puntos_xp: 0,
            nivel: 1,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'dni' }
        )
        .select('id')
        .maybeSingle();

      if (insertedUser?.id) {
        targetUserId = insertedUser.id;
      } else {
        if (insErr) {
          console.warn('[Copilot persistRegisteredOrder] Error en upsert usuario:', insErr.message);
        }
        const { data: fallbackUser } = await supabaseAdmin
          .from('usuarios')
          .select('id')
          .eq('dni', uniqueDniKey)
          .limit(1);
        if (fallbackUser && fallbackUser.length > 0) {
          targetUserId = fallbackUser[0].id;
          await supabaseAdmin.from('usuarios').update(userUpdatePayload).eq('id', targetUserId);
        } else {
          targetUserId = generatedId;
        }
      }
    }

    // Enriquecer destino_detalle con teléfono para que el regex en Encomi siempre lo extraiga
    let enrichedDestino = params.destinoDetalle;
    if (cleanPhoneDisplay && !enrichedDestino.includes(cleanPhoneDisplay)) {
      if (enrichedDestino.includes('DNI/CE Recojo:')) {
        enrichedDestino = enrichedDestino.replace(/(DNI\/CE Recojo:\s*[0-9A-Za-z]+)/i, `$1 • Tel: ${cleanPhoneDisplay}`);
      } else if (enrichedDestino.includes('DNI:')) {
        enrichedDestino = enrichedDestino.replace(/(DNI:\s*[0-9A-Za-z]+)/i, `$1 • Tel: ${cleanPhoneDisplay}`);
      } else {
        enrichedDestino = `${enrichedDestino} (Tel: ${cleanPhoneDisplay})`;
      }
    }

    // Formatear detalles_bordado con el nombre explícito para extracción inmediata en Encomi
    const cleanPrendas = (params.prendasBordado || '').trim();
    const detallesBordado = cleanPrendas && cleanPrendas.toLowerCase() !== 'bordado personalizado'
      ? `${cleanPrendas} - Envío de Mercadería para ${cleanName}`
      : `Envío de Mercadería para ${cleanName}`;

    // En pedidos creados por el bot los datos viajan en sus columnas oficiales (usuarios y pedidos).
    // campos_personalizados queda limpio para no ensuciar la ficha del pedido con etiquetas redundantes.
    const camposPersonalizados: Record<string, string> = {};

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const trackingCode = `COM-2026-${randomCode}`;
    const orderId = `ped-${Date.now()}`;
    const targetFechaLimite = await this.getCachedCutoffShippingDate();
    const nowIso = new Date().toISOString();

    const { error: orderErr } = await supabaseAdmin.from('pedidos').insert({
      id: orderId,
      codigo_seguimiento: trackingCode,
      usuario_id: targetUserId,
      empresa_id: targetEmpresaId,
      detalles_bordado: detallesBordado,
      metodo_envio_codigo: params.metodoEnvio,
      metodo_envio_nombre: params.metodoEnvio === 'shalom' ? 'Agencia Shalom Nacional' : 'Motorizado Local',
      destino_detalle: enrichedDestino,
      campos_personalizados: camposPersonalizados,
      estado_produccion: 'en_cola',
      estado_envio: 'pendiente',
      fecha_limite: targetFechaLimite,
      shalom_clave_recojo: params.metodoEnvio === 'shalom' ? '0808' : null,
      observaciones_cliente: params.referencia ? `Ref: ${params.referencia}` : null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (orderErr) {
      throw new Error(`Error guardando pedido en Supabase: ${orderErr.message}`);
    }

    return {
      orderId,
      trackingCode,
      targetUserId,
      targetFechaLimite,
      cleanName,
      cleanDni,
      cleanPhoneDisplay,
      cleanPhoneFull,
      resolvedDestination: enrichedDestino,
    };
  }

  private static async executeCreateOrderAction(params: {
    actionData: any;
    textTrimmed: string;
    masterInstance: string;
    remoteJid: string;
    pendingAgencyKey: string;
    sessionData: any;
  }): Promise<string> {
    const { actionData, textTrimmed, masterInstance, remoteJid, pendingAgencyKey, sessionData } = params;

    let clienteNombre = String(
      actionData.clienteNombre ||
      actionData.nombre ||
      actionData.nombreCompleto ||
      actionData.cliente ||
      actionData.customerName ||
      ''
    ).trim();

    let clienteDni = this.normalizeDni(
      String(
        actionData.clienteDni ||
        actionData.dni ||
        actionData.documento ||
        actionData.doc ||
        ''
      )
    );

    let clienteTelefono = this.normalizePhone(
      String(
        actionData.clienteTelefono ||
        actionData.telefono ||
        actionData.phone ||
        actionData.celular ||
        ''
      )
    ).display;

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
    const metodoEnvioCodigo: 'shalom' | 'motorizado' = isMotorizado ? 'motorizado' : 'shalom';

    if (!clienteDni || clienteDni.length < 8) {
      const dniMatch = textTrimmed.match(/(?:DNI|doc|documento|ce)\s*[:#]?\s*([0-9A-Za-z]{8,12})\b|\b([0-9]{8})\b/i);
      const rawMatchedDni = dniMatch ? (dniMatch[1] || dniMatch[2] || '') : '';
      if (rawMatchedDni) clienteDni = this.normalizeDni(rawMatchedDni);
    }

    if (!clienteTelefono || clienteTelefono.length < 9) {
      const phoneMatch = textTrimmed.match(/(?:cel|celular|tel[eé]fono|tel|whatsapp|wa|ws)?\s*[:#]?\s*(?:\+?51[\s-]*)?(9(?:[\s-]?\d){8})\b/i);
      if (phoneMatch && phoneMatch[1]) {
        clienteTelefono = this.normalizePhone(phoneMatch[1]).display;
      }
    }

    if (!clienteNombre || clienteNombre.toLowerCase() === 'clienta' || clienteNombre.toLowerCase() === 'cliente') {
      const nameMatch = textTrimmed.match(/(?:para|cliente|nombre)\s*[:#]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,40}?)(?=\s*(?:\n|DNI|doc|cel|tel|destino|con|de|\d))/i);
      if (nameMatch && nameMatch[1]) {
        clienteNombre = nameMatch[1].trim();
      }
    }

    if (!destino) {
      const destMatch = textTrimmed.match(/(?:destino|agencia|direcci[oó]n|para|enviar a|sede)\s*[:#]?\s*([A-Za-záéíóúÁÉÍÓÚñÑ0-9\s,.-]{3,60})/i);
      if (destMatch && destMatch[1]) {
        destino = destMatch[1].trim();
      }
    }

    const missingList: string[] = [];
    if (!clienteNombre || ['clienta', 'cliente'].includes(clienteNombre.toLowerCase())) {
      missingList.push('• Nombre completo de la clienta');
    }
    if (!clienteDni || clienteDni.length < 8) {
      missingList.push('• DNI o Carnet de Extranjería (8 dígitos)');
    }
    if (!clienteTelefono || clienteTelefono.length < 9) {
      missingList.push('• Teléfono WhatsApp (9 dígitos, ej: 987654321)');
    }
    if (!destino) {
      missingList.push('• Destino (Agencia Shalom o Dirección para Motorizado)');
    }

    if (missingList.length > 0) {
      const missingFieldsMsg = `📋 *Para registrar el pedido, solo necesito estos 4 datos obligatorios:*\n\n${missingList.join('\n')}\n\n💬 *Por favor envíame los datos completos para emitir tu Comprobante Oficial.*`;
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, missingFieldsMsg);
      return missingFieldsMsg;
    }

    const cleanPhoneDisplay = this.normalizePhone(clienteTelefono).display;

    let resolvedDestination = '';
    let renameNotice: ShalomRenameNotice | null = null;

    if (isMotorizado) {
      resolvedDestination = destino.replace(/^motorizado\s*:?\s*/i, '').trim();
    } else {
      const matchResult = await ShalomMatcherService.resolveDestinationLive(destino, clienteDni);
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

      // CASO 1: Agencia CERRADA / DESHABILITADA / SOLO ENVÍOS / (POR DEFINIR)
      if (matchResult.status === 'closed_or_disabled' && matchResult.closedMatch) {
        const closed = matchResult.closedMatch;
        const altOptions = matchResult.nearestAlternatives.slice(0, 5).map((m, idx) => ({
          index: idx + 1,
          id: m.agency.id,
          formatted: ShalomMatcherService.formatAgencyDestination(m.agency, clienteDni),
          title: m.displayTitle,
          address: m.displayAddress,
          distanceKm: m.distanceKm,
          renameNotice: m.renameNotice || null,
        }));

        await redisClient.set(
          pendingAgencyKey,
          JSON.stringify({
            mode: 'closed_or_missing',
            clienteNombre,
            clienteDni,
            clienteTelefono,
            referencia,
            prendasBordado,
            originalDestino: destino,
            options: altOptions,
          }),
          'EX',
          1200
        );

        const altListText = altOptions.length > 0
          ? altOptions
              .map((opt, i) => {
                const emoji = numberEmojis[i] || `${i + 1}️⃣`;
                const distTag = opt.distanceKm !== undefined ? ` _(a ~${opt.distanceKm} km)_` : '';
                const renameWhen = opt.renameNotice?.changedAtFormatted ? ` el ${opt.renameNotice.changedAtFormatted}` : '';
                const renameTag = opt.renameNotice ? `\n   🔄 _Cambió de nombre${renameWhen} (antes: ${opt.renameNotice.previousName})_` : '';
                return `${emoji} *${opt.title}*${distTag}\n   📍 ${opt.address || 'Dirección de agencia'}${renameTag}`;
              })
              .join('\n\n')
          : '_No se encontraron sedes cercanas automáticamente._';

        const olvaNote = matchResult.olvaAlternatives.length > 0
          ? `\n\n🟡 *Alternativa Olva Courier en la zona:*\n` +
            matchResult.olvaAlternatives.slice(0, 2).map(o => `• *${o.name}* — ${o.address}`).join('\n')
          : '';

        const closedDateLine = closed.deletedAtFormatted
          ? `\n📅 *Fecha de cierre/baja:* ${closed.deletedAtFormatted}`
          : '';

        const closedMsg =
          `🛑 *¡ATENCIÓN! Agencia Shalom NO disponible:*\n\n` +
          `🏢 *${closed.displayTitle}*\n` +
          `⚠️ *Motivo:* ${closed.reason}.${closedDateLine}\n` +
          `_No se registró el pedido para evitar errores en el envío._\n\n` +
          `✅ *Sedes Shalom ACTIVAS más cercanas:*\n\n${altListText}${olvaNote}\n\n` +
          `💬 *Responde con el número (ej: 1 o 2), escribe otra sede Shalom, "motorizado" o "cancelar":*`;

        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, closedMsg);
        return closedMsg;
      }

      // CASO 2: NO EXISTE SUCURSAL SHALOM EN ESA LOCALIDAD
      if (matchResult.status === 'not_found') {
        const altOptions = matchResult.nearestAlternatives.slice(0, 5).map((m, idx) => ({
          index: idx + 1,
          id: m.agency.id,
          formatted: ShalomMatcherService.formatAgencyDestination(m.agency, clienteDni),
          title: m.displayTitle,
          address: m.displayAddress,
          distanceKm: m.distanceKm,
          renameNotice: m.renameNotice || null,
        }));

        await redisClient.set(
          pendingAgencyKey,
          JSON.stringify({
            mode: 'closed_or_missing',
            clienteNombre,
            clienteDni,
            clienteTelefono,
            referencia,
            prendasBordado,
            originalDestino: destino,
            options: altOptions,
          }),
          'EX',
          1200
        );

        const altSection = altOptions.length > 0
          ? `\n\n✅ *Sedes Shalom activas sugeridas en la región:*\n\n` +
            altOptions
              .map((opt, i) => {
                const emoji = numberEmojis[i] || `${i + 1}️⃣`;
                return `${emoji} *${opt.title}*\n   📍 ${opt.address || 'Dirección de agencia'}`;
              })
              .join('\n\n')
          : '';

        const olvaSection = matchResult.olvaAlternatives.length > 0
          ? `\n\n🟡 *Olva Courier SÍ tiene cobertura allí:*\n` +
            matchResult.olvaAlternatives.slice(0, 3).map(o => `• *${o.name}* — ${o.address}`).join('\n')
          : '';

        const notFoundMsg =
          `⚠️ *Shalom NO tiene sucursal activa registrada en "${destino}".*\n\n` +
          `_Por seguridad no registré el pedido en una agencia inexistente._${altSection}${olvaSection}\n\n` +
          `💬 *¿En qué sede Shalom deseas registrarlo? Responde con el número${altOptions.length > 0 ? ' (1-' + altOptions.length + ')' : ''}, escribe otra agencia Shalom, "motorizado" o "cancelar":*`;

        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, notFoundMsg);
        return notFoundMsg;
      }

      // CASO 3: MÚLTIPLES SEDES ACTIVAS (DESAMBIGUACIÓN)
      if (matchResult.status === 'ambiguous' && matchResult.matches.length > 1) {
        const options = matchResult.matches.slice(0, 6).map((m, idx) => ({
          index: idx + 1,
          id: m.agency.id,
          formatted: ShalomMatcherService.formatAgencyDestination(m.agency, clienteDni),
          title: m.displayTitle,
          address: m.displayAddress,
          renameNotice: m.renameNotice || null,
        }));

        await redisClient.set(
          pendingAgencyKey,
          JSON.stringify({
            mode: 'disambiguation',
            clienteNombre,
            clienteDni,
            clienteTelefono,
            referencia,
            prendasBordado,
            originalDestino: destino,
            options,
          }),
          'EX',
          1200
        );

        const optionsListText = options
          .map((opt, i) => {
            const emoji = numberEmojis[i] || `${i + 1}️⃣`;
            const renameWhen = opt.renameNotice?.changedAtFormatted ? ` el ${opt.renameNotice.changedAtFormatted}` : ' recientemente';
            const renameTag = opt.renameNotice ? `\n   🔄 _Nombre cambiado${renameWhen} (antes: ${opt.renameNotice.previousName})_` : '';
            return `${emoji} *${opt.title}*\n   📍 ${opt.address || 'Dirección de agencia'}${renameTag}`;
          })
          .join('\n\n');

        const disambiguationMsg = `🏢 *He encontrado ${options.length} agencias Shalom activas para "${destino}":*\n\n¿A cuál de ellas te refieres?\n\n${optionsListText}\n\n💬 *Por favor responde con el número de la opción (ej: 1 o 2), el nombre de la sede o "cancelar":*`;

        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, disambiguationMsg);
        return disambiguationMsg;
      }

      // CASO 4: COINCIDENCIA ACTIVA EXACTA (CON O SIN CAMBIO DE NOMBRE RECIENTE)
      resolvedDestination = matchResult.resolvedDestination;
      renameNotice = matchResult.renameNotice || null;
    }

    const { orderId, trackingCode, targetFechaLimite } = await this.persistRegisteredOrder({
      clienteNombre,
      clienteDni,
      clienteTelefono,
      metodoEnvio: metodoEnvioCodigo,
      destinoDetalle: resolvedDestination,
      referencia,
      prendasBordado,
      empresaId: sessionData?.empresaId || 'empresa-master-comikids',
    });

    const lineaRef = referencia ? `\n🏷️ *Referencia:* ${referencia}` : '';
    const renameDateLine = renameNotice?.changedAtFormatted ? `\n📅 *Fecha del cambio:* ${renameNotice.changedAtFormatted}` : '';
    const renameBanner = renameNotice
      ? `🔄 *AVISO DE CAMBIO DE NOMBRE SHALOM:*\n• Antes: _${renameNotice.previousName}_\n• Ahora: *${renameNotice.newName}*${renameDateLine}\n_(Pedido registrado automáticamente con el nombre oficial vigente)_\n\n`
      : '';
    const receiptMsg = `${renameBanner}Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨\n\n-----------------------------------\n📦 *Código / Orden:* #${trackingCode}\n👤 *Destinatario:* ${clienteNombre}\n📱 *WhatsApp:* ${cleanPhoneDisplay}\n🪪 *DNI / CE Recojo:* ${clienteDni}\n🚚 *Tipo de Envío:* ${metodoEnvioNombre}\n📍 *Destino / Agencia:*\n${resolvedDestination}${lineaRef}\n📅 *Fecha Programada:* ${targetFechaLimite}\n-----------------------------------\nGracias por la confianza 💖✨🙏`;

    await Promise.allSettled([
      EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, receiptMsg),
      this.recordIncrementalBackup(sessionData?.empresaId || 'empresa-master-comikids', 'CREATE_ORDER', {
        orderId,
        trackingCode,
        clienteNombre,
        clienteDni,
        destino: resolvedDestination,
        metodoEnvio: metodoEnvioNombre,
        fechaLimite: targetFechaLimite,
      }),
    ]);

    return receiptMsg;
  }

  private static looksLikeOrderRegistration(text: string): boolean {
    const trimmed = (text || '').trim();
    if (!trimmed || trimmed.length < 10) return false;

    const lower = trimmed.toLowerCase();
    const hasExplicitRegVerb = /\b(registra|registrar|nuevo\s+pedido|agrega\s+pedido|agregar\s+pedido|crea\s+pedido|crear\s+pedido|anota\s+pedido|ingresa\s+pedido)\b/i.test(lower);
    if (hasExplicitRegVerb) return true;

    const looksLikeQuestionOrCommand =
      trimmed.includes('?') ||
      /\b(cu[aá]ntos|cu[aá]nto|lista|busca|estado|env[ií]a|manda|cambia|edita|actualiza|elimina|borra|reporte|pendientes)\b/i.test(lower);
    if (looksLikeQuestionOrCommand) return false;

    const hasDni = /\b\d{8}\b/.test(trimmed) || /\bdni\b|\bce\b/i.test(lower);
    const hasPhone = /(?:\+?51[\s-]*)?9(?:[\s-]?\d){8}\b/.test(trimmed);
    const hasShippingHint = /\b(shalom|motorizado|delivery|agencia|olva|domicilio|destino)\b/i.test(lower);

    return (hasDni && hasPhone) || (hasPhone && hasShippingHint);
  }

  private static tryParseStructuredOrderDirect(text: string): Record<string, any> | null {
    // Normalizar texto: aceptar separadores por salto de línea o comas
    const normalizedText = text.replace(/[,;]\s*(?=(?:dni|ce|doc|tel|cel|whatsapp|agencia|destino|ref|para)\b)/gi, '\n');
    const rawLines = normalizedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return null;

    let clienteNombre = '';
    let clienteDni = '';
    let clienteTelefono = '';
    let destino = '';
    let referencia = '';
    let prendasBordado = '';

    // Pasada 1: Extraer líneas con etiquetas explícitas (clave: valor o clave - valor)
    const unconsumedLines: string[] = [];
    for (const line of rawLines) {
      const cleanLine = line.trim();
      const m = cleanLine.match(/^([A-Za-záéíóúÁÉÍÓÚñÑ\s/.-]{2,25})\s*[:\-]\s*(.+)$/);
      if (m) {
        const key = m[1].toLowerCase().trim();
        const val = m[2].trim();
        if (/^(nombre|destinatario|cliente|consignado|para|nombre completo)$/.test(key)) {
          clienteNombre = val;
          continue;
        } else if (/^(dni|ce|documento|doc|dni\/ce|carnet|cedula|c\.e)$/.test(key)) {
          clienteDni = val;
          continue;
        } else if (/^(cel|celular|tel|telefono|teléfono|whatsapp|wa|ws|movil|móvil)$/.test(key)) {
          clienteTelefono = val;
          continue;
        } else if (/^(destino|agencia|direccion|dirección|sede|envio|envío|sucursal|lugar)$/.test(key)) {
          destino = val;
          continue;
        } else if (/^(ref|referencia|obs|observacion|observación)$/.test(key)) {
          referencia = val;
          continue;
        } else if (/^(prenda|prendas|bordado|producto|productos|detalle|detalles|items)$/.test(key)) {
          prendasBordado = val;
          continue;
        }
      }
      unconsumedLines.push(cleanLine);
    }

    // Pasada 2: Teléfono móvil peruano (9 dígitos que empiezan con 9)
    if (!clienteTelefono) {
      for (let i = 0; i < unconsumedLines.length; i++) {
        const line = unconsumedLines[i];
        const phoneMatch = line.match(/(?:(?:cel|celular|tel|telefono|wa|ws|whatsapp)\s*[:#]?\s*)?(?:(?:\+?51[\s-]*)|\(51\)\s*)?(9\d{8})\b/i);
        if (phoneMatch) {
          clienteTelefono = phoneMatch[1];
          const rem = line.replace(phoneMatch[0], '').trim();
          if (!rem || rem.length < 3) {
            unconsumedLines.splice(i, 1);
            i--;
          } else {
            unconsumedLines[i] = rem;
          }
          break;
        }
      }
    }

    // Pasada 3: DNI o CE (etiqueta sin dos puntos, e.g. "DNI 43599676")
    if (!clienteDni) {
      for (let i = 0; i < unconsumedLines.length; i++) {
        const line = unconsumedLines[i];
        const labeledDni = line.match(/(?:dni|ce|doc|documento|carnet|c\.e)\s*[:#]?\s*([0-9A-Za-z]{8,12})\b/i);
        if (labeledDni) {
          clienteDni = labeledDni[1];
          const rem = line.replace(labeledDni[0], '').trim();
          if (!rem || rem.length < 3) {
            unconsumedLines.splice(i, 1);
            i--;
          } else {
            unconsumedLines[i] = rem;
          }
          break;
        }
      }
    }

    // Pasada 4: DNI independiente de 8 dígitos (que no coincida con el teléfono)
    if (!clienteDni) {
      for (let i = 0; i < unconsumedLines.length; i++) {
        const line = unconsumedLines[i];
        const dniMatches = line.match(/\b([0-9]{8})\b/g);
        if (dniMatches) {
          const cand = dniMatches.find(d => d !== clienteTelefono);
          if (cand) {
            clienteDni = cand;
            const rem = line.replace(cand, '').trim();
            if (!rem || rem.length < 3) {
              unconsumedLines.splice(i, 1);
              i--;
            } else {
              unconsumedLines[i] = rem;
            }
            break;
          }
        }
      }
    }

    // Pasada 5: Nombre del cliente (línea alfabética de 2 a 6 palabras sin números ni términos de agencia)
    if (!clienteNombre) {
      for (let i = 0; i < unconsumedLines.length; i++) {
        const line = unconsumedLines[i];
        const cleanCand = line.replace(/^(para|cliente|destinatario|nombre|registra(?:r)?(?:\s+a)?)\s*[:#]?\s*/i, '').trim();
        const lower = cleanCand.toLowerCase();
        if (
          !cleanCand ||
          cleanCand.length < 3 ||
          cleanCand.length > 55 ||
          /\d/.test(cleanCand) ||
          /^(shalom|motorizado|delivery|agencia|pedido|nuevo|hola|gracias|por favor)$/i.test(cleanCand) ||
          lower.includes('shalom') ||
          lower.includes('agencia') ||
          lower.includes('motorizado') ||
          /\b(av|calle|jr|mz|lote|dpto|piso|frente)\b/i.test(lower)
        ) {
          continue;
        }
        const words = cleanCand.split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2 && words.length <= 6) {
          clienteNombre = cleanCand;
          unconsumedLines.splice(i, 1);
          break;
        }
      }
    }

    // Pasada 6: Todo lo restante es el Destino y Referencia
    if (!destino) {
      const destParts: string[] = [];
      for (const line of unconsumedLines) {
        if (/^(registrar|registra|nuevo pedido|pedido|hola|buenas|buenas tardes|buenos dias|encomi|por favor)\b/i.test(line)) {
          continue;
        }
        const cleanL = line.replace(/^(destino|agencia|direccion|dirección|sede|envio|envío|sucursal|lugar)\s*[:#]?\s*/i, '').trim();
        if (cleanL) destParts.push(cleanL);
      }
      if (destParts.length > 0) {
        destino = destParts.join(' ').trim();
      }
    }

    const dniNorm = this.normalizeDni(clienteDni);
    const phoneNorm = this.normalizePhone(clienteTelefono).display;

    // Se requieren obligatoriamente los 4 datos mínimos
    if (!clienteNombre || dniNorm.length < 8 || phoneNorm.length < 9 || !destino) {
      return null;
    }

    const lowerAll = text.toLowerCase();
    const isMotorizado =
      /\b(motorizado|delivery|domicilio)\b/i.test(lowerAll) ||
      /\b(motorizado|delivery|domicilio)\b/i.test(destino.toLowerCase());

    const metodoEnvio: 'SHALOM' | 'MOTORIZADO' = isMotorizado ? 'MOTORIZADO' : 'SHALOM';

    return {
      isRegistration: true,
      metodoEnvio,
      clienteNombre,
      clienteDni: dniNorm,
      clienteTelefono: phoneNorm,
      destino,
      referencia,
      prendasBordado: prendasBordado || 'Bordado personalizado',
    };
  }

  private static async tryFastOrderRegistration(params: {
    masterInstance: string;
    remoteJid: string;
    textTrimmed: string;
    pendingAgencyKey: string;
    sessionData: any;
  }): Promise<string | null> {
    const { masterInstance, remoteJid, textTrimmed, pendingAgencyKey, sessionData } = params;
    try {
      let parsed = this.tryParseStructuredOrderDirect(textTrimmed);
      let tokensUsed = 0;

      // Si el parser directo no pudo extraer todos los campos, usar IA compacta ultra-rápida (sin base de datos)
      if (!parsed) {
        const fastSystemPrompt = `Eres un extractor ultrarrápido de pedidos de ComiKids. Analiza el mensaje y responde ÚNICAMENTE con JSON válido (sin markdown):
{"isRegistration":boolean,"metodoEnvio":"SHALOM"|"MOTORIZADO"|null,"clienteNombre":string|null,"clienteDni":string|null,"clienteTelefono":string|null,"destino":string|null,"referencia":string|null,"prendasBordado":string|null}
Reglas:
- isRegistration=true SOLO si el mensaje pide registrar un nuevo pedido o envía datos de un cliente para despacho. Si pregunta estado, busca o modifica un pedido existente, devuelve isRegistration=false.
- metodoEnvio="MOTORIZADO" si dice motorizado/delivery/domicilio o dirección urbana de Lima; "SHALOM" si dice shalom/agencia/provincia o no parece delivery urbano.
- clienteTelefono: solo 9 dígitos peruanos (sin +51). clienteDni: 8-12 dígitos/CE.`;

        const aiRes = await queryCopilotWithUsage(fastSystemPrompt, textTrimmed, {
          temperature: 0.0,
          maxTokens: 320,
          timeoutMs: 5000,
          modelOverride: 'google/gemini-2.5-flash',
        });
        tokensUsed = aiRes.tokensUsed || 250;

        const raw = (aiRes.content || '').replace(/```json|```/gi, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        parsed = JSON.parse(jsonMatch[0]);
      }

      if (!parsed || !parsed.isRegistration) return null;

      const tasks: Promise<any>[] = [
        this.executeCreateOrderAction({
          actionData: parsed,
          textTrimmed,
          masterInstance,
          remoteJid,
          pendingAgencyKey,
          sessionData,
        }),
      ];
      if (tokensUsed > 0) {
        tasks.push(this.incrementTokenUsage(sessionData.accountCode, tokensUsed).catch(() => 0));
      }

      const [receiptMsg] = await Promise.all(tasks);
      return receiptMsg;
    } catch (fastErr: any) {
      console.warn('[COPILOT FAST PATH] Fallback a flujo completo:', fastErr?.message);
      return null;
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

            const welcomeMsg = `✅ *¡Autenticación Exitosa y Base de Datos Conectada!*\n\n🏢 *Empresa:* ${sessionData.displayName}\n📱 *Línea WhatsApp:* +${sessionData.ownerPhone}\n⚡ *Instancia:* \`${sessionData.instanceName}\`\n🪙 *Tokens Disponibles:* ${remainingTokens.toLocaleString()} / ${DAILY_TOKEN_LIMIT.toLocaleString()}\n\n🛠️ *Acceso Total Habilitado:*\n• 📦 *Registrar pedidos:* Envíame Nombre, DNI, WhatsApp y Destino.\n• 🔍 *Consultar pedidos:* Pregúntame "¿cuántos envíos hay para hoy?" o busca por cliente.\n• 🚀 *Despachos WhatsApp:* Envío directo de comprobantes y guías.\n\n💡 *¿Qué consulta o acción deseas realizar?*`;

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
        const options: Array<{ index: number; formatted: string; title: string; address: string; renameNotice?: ShalomRenameNotice | null }> = pendingChoice.options || [];

        // Permitir cancelar explícitamente el registro pendiente
        if (/^(cancelar|anular|no\s+registrar|olv[ií]dalo|salir)$/i.test(textTrimmed)) {
          await redisClient.del(pendingAgencyKey);
          const cancelMsg = '❌ Registro pendiente cancelado. Cuando gustes envíame los datos de nuevo o hazme cualquier consulta.';
          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, cancelMsg);
          return cancelMsg;
        }

        // Comprobar si el texto ingresado es un número de opción (1, 2, 3, etc.)
        const matchNum = textTrimmed.match(/^(?:opcion|opción|la|el|nro|n°|#)?\s*([1-9])\b/i);
        let selectedNum = matchNum ? parseInt(matchNum[1], 10) : null;

        // O si el usuario escribió directamente una palabra clave de una de las opciones sugeridas
        if (!selectedNum && options.length > 0) {
          const normInput = ShalomMatcherService.normalize(textTrimmed);
          const foundIdx = options.findIndex(opt => {
            const normTitle = ShalomMatcherService.normalize(opt.title);
            const normAddr = ShalomMatcherService.normalize(opt.address);
            return normInput.length >= 3 && (normTitle.includes(normInput) || normAddr.includes(normInput));
          });
          if (foundIdx !== -1) {
            selectedNum = foundIdx + 1;
          }
        }

        if (selectedNum && selectedNum >= 1 && selectedNum <= options.length) {
          const chosenOption = options[selectedNum - 1];
          const resolvedDestination = chosenOption.formatted;
          const { clienteNombre, clienteDni, clienteTelefono, referencia, prendasBordado } = pendingChoice;
          const cleanPhoneDisplay = this.normalizePhone(clienteTelefono).display;

          const { orderId, trackingCode, targetFechaLimite } = await this.persistRegisteredOrder({
            clienteNombre,
            clienteDni,
            clienteTelefono,
            metodoEnvio: 'shalom',
            destinoDetalle: resolvedDestination,
            referencia,
            prendasBordado,
            empresaId: (sessionData as any)?.empresaId || 'empresa-master-comikids',
          });

          await this.recordIncrementalBackup(sessionData.empresaId, 'CREATE_ORDER', {
            orderId,
            trackingCode,
            clienteNombre,
            clienteDni,
            destino: resolvedDestination,
            metodoEnvio: 'Agencia Shalom Nacional',
            fechaLimite: targetFechaLimite,
          });

          await redisClient.del(pendingAgencyKey);

          const lineaRef = referencia ? `\n🏷️ *Referencia:* ${referencia}` : '';
          const chosenRenameDate = chosenOption.renameNotice?.changedAtFormatted ? `\n📅 *Fecha del cambio:* ${chosenOption.renameNotice.changedAtFormatted}` : '';
          const renameBanner = chosenOption.renameNotice
            ? `🔄 *AVISO DE CAMBIO DE NOMBRE SHALOM:*\n• Antes: _${chosenOption.renameNotice.previousName}_\n• Ahora: *${chosenOption.renameNotice.newName}*${chosenRenameDate}\n\n`
            : '';
          const receiptMsg = `${renameBanner}Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨\n\n-----------------------------------\n📦 *Código / Orden:* #${trackingCode}\n👤 *Destinatario:* ${clienteNombre}\n📱 *WhatsApp:* ${cleanPhoneDisplay}\n🪪 *DNI / CE Recojo:* ${clienteDni}\n🚚 *Tipo de Envío:* Agencia Shalom Nacional\n📍 *Destino / Agencia:*\n${resolvedDestination}${lineaRef}\n📅 *Fecha Programada:* ${targetFechaLimite}\n-----------------------------------\nGracias por la confianza 💖✨🙏`;

          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, receiptMsg);
          return receiptMsg;
        } else if (
          pendingChoice.mode === 'closed_or_missing' &&
          textTrimmed.length >= 3 &&
          !textTrimmed.includes('?') &&
          !/\b(cu[aá]ntos|lista|reporte|resumen|busca|estado|comprobantes)\b/i.test(textTrimmed)
        ) {
          // El usuario respondió con una NUEVA agencia o "motorizado ..." para completar el pedido pendiente
          await redisClient.del(pendingAgencyKey);
          return await this.executeCreateOrderAction({
            actionData: {
              clienteNombre: pendingChoice.clienteNombre,
              clienteDni: pendingChoice.clienteDni,
              clienteTelefono: pendingChoice.clienteTelefono,
              referencia: pendingChoice.referencia,
              prendasBordado: pendingChoice.prendasBordado,
              destino: textTrimmed,
              metodoEnvio: /motorizado|delivery|domicilio/i.test(textTrimmed) ? 'motorizado' : 'shalom',
            },
            textTrimmed,
            masterInstance,
            remoteJid,
            pendingAgencyKey,
            sessionData,
          });
        } else {
          // Si el usuario envió otra consulta no relacionada, limpiar la desambiguación previa y procesar su nuevo mensaje
          await redisClient.del(pendingAgencyKey);
        }
      }

      // -------------------------------------------------------------
      // PASO 4: CONTROL DE LÍMITE DIARIO DE 2,000,000 TOKENS POR SUB-QR
      // -------------------------------------------------------------
      const currentTokenUsage = await this.getDailyTokenUsage(sessionData.accountCode);
      if (currentTokenUsage >= DAILY_TOKEN_LIMIT) {
        console.warn(`[COPILOT TOKENS LIMIT] Cuenta ${sessionData.accountCode} superó el límite diario (${currentTokenUsage} >= ${DAILY_TOKEN_LIMIT})`);
        const limitMsg = `⚠️ *Límite Diario de IA Alcanzado (${currentTokenUsage.toLocaleString()} / ${DAILY_TOKEN_LIMIT.toLocaleString()} tokens)*\n\nTu cuenta *${sessionData.displayName}* ha llegado al consumo máximo diario permitido de 2M tokens para el Copiloto Encomi AI.\n\n🔄 Tu cuota se reiniciará automáticamente a la medianoche (00:00 hora Perú). Puedes continuar gestionando tus pedidos en el panel web: https://encomi.vercel.app`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, limitMsg);
        return limitMsg;
      }

      // -------------------------------------------------------------
      // PASO 5: SESIÓN AUTORIZADA — EVITAR LLAMADAS REDUNDANTES A EVOLUTION
      // -------------------------------------------------------------
      let userSenderInstance = sessionData.instanceName || '';
      let userSenderPhone = sessionData.ownerPhone || '';
      if (!userSenderInstance) {
        const linkedSub = await this.getSubInstanceByName(env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp');
        userSenderInstance = linkedSub?.instanceName || env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';
        userSenderPhone = linkedSub?.ownerPhone || userSenderPhone;
      }
      const userName = sessionData.displayName || 'ComiKids Envíos';

      const isImage = Boolean(messageData?.message?.imageMessage);
      const isDoc = Boolean(messageData?.message?.documentMessage);
      const hasAttachedMedia = isImage || isDoc;

      // -------------------------------------------------------------
      // PASO 5.5: RUTA RÁPIDA DE REGISTRO (SIN DESCARGAR 1000+ ÓRDENES NI PROMPT PESADO)
      // -------------------------------------------------------------
      if (!hasAttachedMedia && this.looksLikeOrderRegistration(textTrimmed)) {
        const fastResponse = await this.tryFastOrderRegistration({
          masterInstance,
          remoteJid,
          textTrimmed,
          pendingAgencyKey,
          sessionData,
        });
        if (fastResponse) return fastResponse;
      }

      // -------------------------------------------------------------
      // PASO 6: OCR VISUAL DE ADJUNTOS + AGENTE AUTÓNOMO CON ACCESO TOTAL A BD
      // -------------------------------------------------------------
      const attachedFileName =
        messageData?.message?.documentMessage?.fileName ||
        messageData?.message?.documentMessage?.title ||
        (isImage ? 'imagen_adjunta.jpg' : 'documento.pdf');
      const attachedMimeType =
        messageData?.message?.documentMessage?.mimetype ||
        messageData?.message?.imageMessage?.mimetype ||
        (isImage ? 'image/jpeg' : 'application/pdf');

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

      // Cargar memoria conversacional reciente de este chat (últimos 10 turnos en Redis, 6 horas TTL)
      const chatHistoryKey = `copilot:chat_history:${cleanPhone}`;
      let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      try {
        const rawHist = await redisClient.get(chatHistoryKey);
        if (rawHist) {
          const parsedHist = JSON.parse(rawHist);
          if (Array.isArray(parsedHist)) chatHistory = parsedHist.slice(-10);
        }
      } catch {
        chatHistory = [];
      }

      const sendWhatsAppToClient = async (sendParams: {
        targetPhone: string;
        customerName?: string;
        text: string;
        sendAttachedDoc?: boolean;
        mediaUrl?: string | null;
        mediaType?: string;
        fileName?: string;
      }): Promise<string> => {
        let target = String(sendParams.targetPhone).replace(/[^0-9]/g, '');
        if (target.length === 9) target = `51${target}`;

        const clientDisplayName = sendParams.customerName || extractedClientInfo?.nombre || 'Cliente';
        const messageText = sendParams.text || `Hola ${clientDisplayName} 👋, te compartimos tu comprobante/foto de tu pedido en ComiKids. ✨`;
        const targetMediaType = (sendParams.mediaType || (isImage ? 'image' : 'document')) as 'image' | 'document' | 'audio' | 'video';
        const fileName = sendParams.fileName || attachedFileName || (targetMediaType === 'image' ? 'imagen.jpg' : 'documento.pdf');

        if (hasAttachedMedia && sendParams.sendAttachedDoc !== false && (mediaBuffer || messageData)) {
          try {
            let buf: Buffer | null = mediaBuffer;
            if (!buf && messageData) {
              const fetched = await EvolutionService.getMediaBuffer(messageData, masterInstance);
              buf = fetched.buffer;
            }
            if (!buf) throw new Error('No se pudo recuperar el buffer del archivo adjunto');
            const rawBase64 = buf.toString('base64');
            const finalMediaType = actualMime.startsWith('image/') ? 'image' : (actualMime.startsWith('audio/') ? 'audio' : 'document');

            await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, rawBase64, {
              caption: messageText,
              fileName,
              mediaType: finalMediaType,
              mimeType: actualMime,
            });
          } catch (mediaErr: any) {
            console.error('[COPILOT MEDIA ERROR]', mediaErr?.message || mediaErr);
            await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText);
          }
        } else if (sendParams.mediaUrl && sendParams.mediaUrl.startsWith('http')) {
          await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, sendParams.mediaUrl, {
            caption: messageText,
            fileName,
            mediaType: targetMediaType,
          });
        } else {
          await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText);
        }

        const batchKey = `copilot:batch_history:${cleanPhone}`;
        await redisClient.rpush(
          batchKey,
          JSON.stringify({ targetPhone: target, clientName: clientDisplayName, fileName, timestamp: Date.now(), status: 'success' })
        );
        await redisClient.expire(batchKey, 3600);
        const totalBatchItemsRaw = await redisClient.lrange(batchKey, 0, -1);

        let reportSummary = `✅ *Mensaje/archivo enviado con éxito a clienta*\n\n👤 *Cliente:* ${clientDisplayName}\n📱 *Destinatario:* +${target}\n💬 *Mensaje:* "${messageText}"\n⚡ *Línea Emisora:* +${userSenderPhone} (${userSenderInstance})`;
        if (totalBatchItemsRaw.length > 1) {
          const listLines = totalBatchItemsRaw
            .map((raw, idx) => {
              const it = JSON.parse(raw);
              return `${idx + 1}. *${it.clientName}* (+${it.targetPhone}) ➔ ${it.fileName}`;
            })
            .join('\n');
          reportSummary += `\n\n📋 *Reporte de Lote Acumulado (${totalBatchItemsRaw.length} envíos hoy):*\n${listLines}`;
        }

        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, reportSummary);
        return reportSummary;
      };

      const agentRes = await runWhatsAppAutonomousAgent(textTrimmed || (hasAttachedMedia ? `[Adjuntó ${attachedFileName}]` : 'Hola'), chatHistory, {
        empresaId: sessionData.empresaId || 'empresa-master-comikids',
        empresaNombre: userName,
        accountCode: sessionData.accountCode,
        userSenderInstance,
        userSenderPhone,
        hasAttachedMedia,
        attachedFileName,
        isImage,
        isDoc,
        extractedClientInfo,
        registerOrderCallback: async (actionData: any) => {
          const msg = await this.executeCreateOrderAction({
            actionData,
            textTrimmed,
            masterInstance,
            remoteJid,
            pendingAgencyKey,
            sessionData,
          });
          return { sentDirectly: true, message: msg };
        },
        sendWhatsAppToClientCallback: sendWhatsAppToClient,
        recordBackupCallback: async (action: string, data: any) => {
          await this.recordIncrementalBackup(sessionData.empresaId, action, data);
        },
      });

      await this.incrementTokenUsage(sessionData.accountCode, agentRes.tokensUsed);

      // Persistir historial de conversación en Redis (últimos 10 mensajes, 6 horas)
      try {
        const updatedHistory = [
          ...chatHistory,
          { role: 'user' as const, content: textTrimmed || `[Adjunto: ${attachedFileName}]` },
          { role: 'assistant' as const, content: agentRes.reply.slice(0, 2000) },
        ].slice(-10);
        await redisClient.set(chatHistoryKey, JSON.stringify(updatedHistory), 'EX', 6 * 3600);
      } catch {
        // no-op
      }

      if (!agentRes.alreadySentDirectMessage) {
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, agentRes.reply);
      }
      return agentRes.reply;
    } catch (error: any) {
      console.error('[COPILOT ERROR]', error);
      const fallbackReply = '⚠️ Hubo una incidencia procesando tu solicitud. Por favor intenta nuevamente.';
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, fallbackReply);
      return fallbackReply;
    }
  }
}
