import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveShalomAgencyDetails, extractShalomDestino } from './shalomAgencyResolver.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';

export interface ShalomRawApiAgency {
  id: number;
  abrebiatura?: string;
  code?: string;
  nombre: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  lugar_over?: string;
  zona?: string;
  ubi_id?: number;
  ubigeo?: string | number;
  dep_id?: number;
  prov_id?: number;
  dist_id?: number;
  direccion: string;
  telefono?: string;
  latitud?: number;
  longitud?: number;
  horario?: {
    hora_atencion?: string;
    [key: string]: any;
  } | string;
  estado?: string;
  principal?: boolean;
}

export interface SyncReport {
  timestamp: string;
  totalAgenciesFromApi: number;
  newAgenciesCount: number;
  updatedAgenciesCount: number;
  unchangedAgenciesCount: number;
  updatedOrdersCount: number;
  updatedOrders: Array<{ orderId: string; trackingCode: string; oldDestino: string; newDestino: string }>;
  errors: string[];
}

export class ShalomSyncService {
  private static lastSyncReport: SyncReport | null = null;
  private static isSyncing = false;
  private static cronTimer: NodeJS.Timeout | null = null;

  /**
   * Obtiene la API Key de Shalom (de variables de entorno o taller_config en Supabase)
   */
  private static async getApiKey(): Promise<string> {
    try {
      const { data } = await supabaseAdmin
        .from('taller_config')
        .select('shalom_api_key')
        .limit(1)
        .maybeSingle();
      return (data as any)?.shalom_api_key || env.SHALOM_API_KEY || DEFAULT_API_KEY;
    } catch {
      return env.SHALOM_API_KEY || DEFAULT_API_KEY;
    }
  }

  /**
   * Descarga todas las agencias activas desde la API oficial de Shalom Pro
   */
  public static async fetchAllAgenciesFromApi(apiKey?: string): Promise<ShalomRawApiAgency[]> {
    const key = apiKey || await this.getApiKey();
    let allAgencies: ShalomRawApiAgency[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    console.log('[SHALOM SYNC API] Iniciando descarga completa de agencias desde api.shalom-api-peru.com...');

    while (hasMore) {
      try {
        const response = await axios.get(`${SHALOM_BASE_URL}/v1/agencies`, {
          params: { page, per_page: perPage },
          headers: {
            'X-API-Key': key,
            'User-Agent': 'Incomi-AutoSync-Service/1.0',
          },
          timeout: 15000,
        });

        const items: ShalomRawApiAgency[] = Array.isArray(response.data)
          ? response.data
          : (response.data?.items || response.data?.data || []);

        if (!items || items.length === 0) {
          hasMore = false;
        } else {
          allAgencies.push(...items);
          const totalFromApi = response.data?.total || response.data?.meta?.total;
          if (items.length < perPage || (totalFromApi && allAgencies.length >= totalFromApi)) {
            hasMore = false;
          } else {
            page++;
            await new Promise(r => setTimeout(r, 400)); // Rate limit buffer
          }
        }
      } catch (err: any) {
        console.error(`[SHALOM SYNC API ERROR] Fallo al consultar página ${page}:`, err?.message);
        break;
      }
    }

    console.log(`[SHALOM SYNC API] ✓ Descarga finalizada: ${allAgencies.length} agencias obtenidas de la API oficial.`);
    return allAgencies;
  }

  /**
   * Ejecuta la sincronización completa:
   * 1. Consulta la API oficial de Shalom.
   * 2. Compara con la base de datos Supabase para detectar nuevas o modificadas.
   * 3. Guarda cambios en `shalom_agencies`.
   * 4. Si una agencia cambió su nombre, dirección o referencia, actualiza automáticamente los pedidos activos afectados.
   */
  public static async syncAgenciesAndPropagateOrders(): Promise<SyncReport> {
    if (this.isSyncing) {
      console.warn('[SHALOM SYNC] Ya hay una sincronización en curso. Omitiendo ejecución concurrente.');
      return this.lastSyncReport || {
        timestamp: new Date().toISOString(),
        totalAgenciesFromApi: 0,
        newAgenciesCount: 0,
        updatedAgenciesCount: 0,
        unchangedAgenciesCount: 0,
        updatedOrdersCount: 0,
        updatedOrders: [],
        errors: ['Sincronización concurrente omitida'],
      };
    }

    this.isSyncing = true;
    const startTime = new Date();
    const errors: string[] = [];
    const updatedOrdersList: Array<{ orderId: string; trackingCode: string; oldDestino: string; newDestino: string }> = [];
    let newAgenciesCount = 0;
    let updatedAgenciesCount = 0;
    let unchangedAgenciesCount = 0;

    try {
      // 1. Obtener agencias desde API
      const apiAgencies = await this.fetchAllAgenciesFromApi();
      if (apiAgencies.length === 0) {
        throw new Error('No se recibieron agencias de la API de Shalom Pro. Verifica la API Key y conexión.');
      }

      // 2. Obtener agencias actuales de la base de datos Supabase
      const { data: dbAgenciesData, error: dbError } = await supabaseAdmin
        .from('shalom_agencies')
        .select('*');

      if (dbError) {
        console.error('[SHALOM SYNC DB ERROR] Error consultando shalom_agencies:', dbError.message);
        errors.push(`Error consultando BD: ${dbError.message}`);
      }

      const dbAgenciesMap = new Map<number, any>();
      if (Array.isArray(dbAgenciesData)) {
        for (const ag of dbAgenciesData) {
          dbAgenciesMap.set(Number(ag.id), ag);
        }
      }

      const agenciesToUpsert: any[] = [];
      const changedAgenciesForOrders: Array<{ id: number; oldData?: any; newData: any; isModified: boolean }> = [];

      // 3. Comparar cada agencia de la API
      for (const raw of apiAgencies) {
        const agId = Number(raw.id);
        const department = (raw.departamento || 'LIMA').toUpperCase().trim();
        const province = (raw.provincia || 'LIMA').toUpperCase().trim();
        const district = (raw.distrito || raw.lugar_over || raw.zona || 'CENTRO').toUpperCase().trim();
        const code = raw.abrebiatura || raw.code || null;
        const name = (raw.nombre || '').trim();
        const address = (raw.direccion || '').trim();

        let scheduleText = 'Lunes a Sábado: 8:00 AM - 8:00 PM';
        if (typeof raw.horario === 'string' && raw.horario.trim()) {
          scheduleText = raw.horario.trim();
        } else if (raw.horario && typeof raw.horario === 'object' && (raw.horario as any).hora_atencion) {
          scheduleText = (raw.horario as any).hora_atencion.trim();
        }

        let ubigeo: string | null = null;
        if (raw.ubi_id) {
          ubigeo = String(raw.ubi_id).padStart(6, '0');
        } else if (raw.ubigeo) {
          ubigeo = String(raw.ubigeo).padStart(6, '0');
        }

        const codeTag = code ? ` (CÓDIGO: ${code})` : '';
        const fullName = `${department} / ${province} / ${district} / ${name}${address ? ` - ${address}` : ''}${codeTag}`.toUpperCase();

        const normalizedDBRecord = {
          id: agId,
          code,
          name,
          full_name: fullName,
          department,
          province,
          district,
          ubigeo,
          dep_id: typeof raw.dep_id === 'number' ? raw.dep_id : null,
          prov_id: typeof raw.prov_id === 'number' ? raw.prov_id : null,
          dist_id: typeof raw.dist_id === 'number' ? raw.dist_id : null,
          address,
          phone: raw.telefono || '(01) 500-7878',
          schedule: scheduleText,
          latitude: typeof raw.latitud === 'number' ? raw.latitud : null,
          longitude: typeof raw.longitud === 'number' ? raw.longitud : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const existing = dbAgenciesMap.get(agId);

        if (!existing) {
          newAgenciesCount++;
          agenciesToUpsert.push(normalizedDBRecord);
          changedAgenciesForOrders.push({ id: agId, newData: normalizedDBRecord, isModified: true });
        } else {
          // Comprobar si hubo cambios significativos en nombre, dirección, código o distrito
          const isNameChanged = (existing.name || '').trim().toUpperCase() !== name.toUpperCase();
          const isAddressChanged = (existing.address || '').trim().toUpperCase() !== address.toUpperCase();
          const isDistrictChanged = (existing.district || '').trim().toUpperCase() !== district.toUpperCase();
          const isCodeChanged = (existing.code || '').trim().toUpperCase() !== (code || '').toUpperCase();
          const isScheduleChanged = (existing.schedule || '').trim() !== scheduleText;
          const isLocationChanged = existing.latitude !== normalizedDBRecord.latitude || existing.longitude !== normalizedDBRecord.longitude;

          if (isNameChanged || isAddressChanged || isDistrictChanged || isCodeChanged || isScheduleChanged || isLocationChanged) {
            updatedAgenciesCount++;
            agenciesToUpsert.push(normalizedDBRecord);
            changedAgenciesForOrders.push({ id: agId, oldData: existing, newData: normalizedDBRecord, isModified: true });
          } else {
            unchangedAgenciesCount++;
          }
        }
      }

      // 4. Guardar en Supabase `shalom_agencies` en lotes
      if (agenciesToUpsert.length > 0) {
        console.log(`[SHALOM SYNC UPSERT] Guardando ${agenciesToUpsert.length} agencias nuevas/actualizadas en Supabase...`);
        const batchSize = 100;
        for (let i = 0; i < agenciesToUpsert.length; i += batchSize) {
          const batch = agenciesToUpsert.slice(i, i + batchSize);
          const { error: upsertErr } = await supabaseAdmin
            .from('shalom_agencies')
            .upsert(batch, { onConflict: 'id' });

          if (upsertErr) {
            console.error(`[SHALOM SYNC UPSERT BATCH ERROR] Lote ${Math.floor(i / batchSize) + 1}:`, upsertErr.message);
            errors.push(`Error en upsert lote ${Math.floor(i / batchSize) + 1}: ${upsertErr.message}`);
          }
        }
      }

      // 5. PROPAGACIÓN DE CAMBIOS A PEDIDOS ACTIVOS:
      // Si alguna agencia cambió de nombre o dirección, actualizar los pedidos cuyo destino haga referencia a esa agencia
      if (changedAgenciesForOrders.length > 0) {
        console.log(`[SHALOM SYNC ORDER PROPAGATION] Analizando pedidos activos para propagar ${changedAgenciesForOrders.length} agencias modificadas...`);

        // Consultar pedidos activos o en proceso
        const { data: activeOrders, error: ordersErr } = await supabaseAdmin
          .from('pedidos')
          .select('id, codigo_seguimiento, destino_detalle, metodo_envio_codigo, estado_envio')
          .neq('estado_envio', 'cancelado');

        if (ordersErr) {
          console.error('[SHALOM SYNC ORDERS FETCH ERROR]', ordersErr.message);
          errors.push(`Error consultando pedidos activos: ${ordersErr.message}`);
        } else if (Array.isArray(activeOrders)) {
          for (const order of activeOrders) {
            const rawDest = order.destino_detalle || '';
            const isShalom = order.metodo_envio_codigo === 'shalom' || rawDest.toLowerCase().includes('shalom');
            if (!isShalom || !rawDest) continue;

            // Extraer identificadores del pedido
            const currentAgencyDetails = resolveShalomAgencyDetails(rawDest);

            // Verificar si este pedido corresponde a alguna de las agencias modificadas
            const matchedChange = changedAgenciesForOrders.find(ch => {
              if (currentAgencyDetails.terminalId && ch.id === currentAgencyDetails.terminalId) return true;
              if (currentAgencyDetails.code && ch.newData.code && currentAgencyDetails.code.toUpperCase() === ch.newData.code.toUpperCase()) return true;
              if (ch.oldData && ch.oldData.name && rawDest.toUpperCase().includes(ch.oldData.name.toUpperCase())) return true;
              return false;
            });

            if (matchedChange) {
              const newAgency = matchedChange.newData;
              const newOfficialDest = extractShalomDestino(newAgency.full_name, newAgency.code);

              // Preservar DNI de recojo del cliente
              const dniMatch = rawDest.match(/(?:DNI[\s\/]*CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})/i);
              const clientDni = dniMatch ? dniMatch[1].trim() : '';
              const dniTag = clientDni ? ` (DNI/CE Recojo: ${clientDni})` : '';

              const updatedDestinoDetalle = `Agencia Shalom: ${newAgency.full_name}${dniTag}`;

              if (updatedDestinoDetalle !== rawDest) {
                console.log(`[SHALOM SYNC UPDATE ORDER] Pedido #${order.codigo_seguimiento} actualizado de "${rawDest}" -> "${updatedDestinoDetalle}"`);

                const { error: updateOrderErr } = await supabaseAdmin
                  .from('pedidos')
                  .update({
                    destino_detalle: updatedDestinoDetalle,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', order.id);

                if (updateOrderErr) {
                  console.error(`[SHALOM SYNC ORDER UPDATE ERROR] Pedido ${order.id}:`, updateOrderErr.message);
                } else {
                  updatedOrdersList.push({
                    orderId: order.id,
                    trackingCode: order.codigo_seguimiento,
                    oldDestino: rawDest,
                    newDestino: updatedDestinoDetalle,
                  });
                }
              }
            }
          }
        }
      }

      const report: SyncReport = {
        timestamp: startTime.toISOString(),
        totalAgenciesFromApi: apiAgencies.length,
        newAgenciesCount,
        updatedAgenciesCount,
        unchangedAgenciesCount,
        updatedOrdersCount: updatedOrdersList.length,
        updatedOrders: updatedOrdersList,
        errors,
      };

      this.lastSyncReport = report;
      console.log(`[SHALOM SYNC COMPLETED] ✓ Sincronización 23:59 exitosa: ${apiAgencies.length} agencias analizadas, ${newAgenciesCount} nuevas, ${updatedAgenciesCount} modificadas, ${updatedOrdersList.length} pedidos actualizados.`);
      return report;
    } catch (err: any) {
      console.error('[SHALOM SYNC CRITICAL ERROR]', err?.message);
      errors.push(err?.message || 'Error desconocido durante la sincronización');
      const report: SyncReport = {
        timestamp: startTime.toISOString(),
        totalAgenciesFromApi: 0,
        newAgenciesCount: 0,
        updatedAgenciesCount: 0,
        unchangedAgenciesCount: 0,
        updatedOrdersCount: 0,
        updatedOrders: [],
        errors,
      };
      this.lastSyncReport = report;
      return report;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Calcula los milisegundos exactos hasta las 23:59:00 en la zona horaria de Perú (America/Lima / UTC-5)
   */
  public static getMsUntilNext2359(): number {
    const now = new Date();
    // Obtener fecha/hora actual en hora peruana (UTC-5)
    const peruTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Lima' });
    const peruDate = new Date(peruTimeStr);

    const target = new Date(peruDate);
    target.setHours(23, 59, 0, 0);

    // Si ya pasó las 23:59 hoy, programar para mañana a las 23:59
    if (peruDate.getTime() >= target.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const diffMs = target.getTime() - peruDate.getTime();
    return Math.max(diffMs, 1000);
  }

  /**
   * Inicializa el Cron Job diario para que se ejecute a las 23:59 de todos los días automáticamente.
   */
  public static initDailyCron(): void {
    if (this.cronTimer) {
      clearTimeout(this.cronTimer);
      this.cronTimer = null;
    }

    const msUntilNext = this.getMsUntilNext2359();
    const hours = Math.floor(msUntilNext / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((msUntilNext % (1000 * 60)) / 1000);

    console.log(`⏰ [SHALOM CRON SCHEDULER] Próxima sincronización automática de agencias Shalom programada para hoy a las 23:59:00 (en ${hours}h ${minutes}m ${seconds}s).`);

    this.cronTimer = setTimeout(async () => {
      console.log('🌟 [SHALOM CRON TRIGGER 23:59] Ejecutando sincronización diaria nocturna de agencias y pedidos...');
      try {
        await this.syncAgenciesAndPropagateOrders();
      } catch (e) {
        console.error('[SHALOM CRON TRIGGER ERROR]', e);
      } finally {
        // Reprogramar para la siguiente noche a las 23:59
        this.initDailyCron();
      }
    }, msUntilNext);
  }

  /**
   * Obtiene el reporte del último sync ejecutado
   */
  public static getLastSyncReport(): SyncReport | null {
    return this.lastSyncReport;
  }
}
