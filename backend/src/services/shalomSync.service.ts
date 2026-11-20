import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveShalomAgencyDetails } from './shalomAgencyResolver.js';
import { ShalomMatcherService } from './shalomMatcher.service.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const EXPIRED_DELETED_AT = '2025-01-01T00:00:00.000Z';
const MIN_EXPECTED_API_AGENCIES = 400;

function sameTimestamp(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

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
  categoria?: string;
  habilitado?: boolean;
  principal?: boolean;
}

export interface SyncReport {
  timestamp: string;
  totalAgenciesFromApi: number;
  activeValidCount: number;
  newAgenciesCount: number;
  updatedAgenciesCount: number;
  deactivatedAgenciesCount: number;
  unchangedAgenciesCount: number;
  updatedOrdersCount: number;
  updatedOrders: Array<{ orderId: string; trackingCode: string; oldDestino: string; newDestino: string }>;
  errors: string[];
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/Â[\u00a0\s]/g, ' ').replace(/Â/g, '');
  s = s.replace(/[\u00a0\r\n\t]+/g, ' ');
  s = s.replace(/\bN\?\s*(\d)/gi, 'N° $1');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function isQaOrTestAgency(name: string, address: string): boolean {
  const n = cleanText(name).toUpperCase();
  const a = cleanText(address).toUpperCase();
  return (
    /\bPRUEBA\b|PRUEBA[A-Z0-9_]|_PRUEBA|\bTEST\b|PRUEBATEST|\bZZ\s*QA\b|TERMINAL DE PRUEBA|AV\s+PRUEBAS|NO USAR DE PRE?UBA/i.test(n) ||
    /\bPRUEBA\b|PRUEBA_DE_ALMACEN|TERMINAL DE PRUEBA|AV\s+PRUEBAS/i.test(a)
  );
}

function classifyApiAgency(raw: ShalomRawApiAgency): { isActive: boolean; hideImmediately: boolean } {
  const nameUpper = cleanText(raw.nombre).toUpperCase();
  const addrUpper = cleanText(raw.direccion).toUpperCase();
  const catUpper = cleanText(raw.categoria).toUpperCase();
  const habilitado = raw.habilitado === true;

  if (isQaOrTestAgency(nameUpper, addrUpper)) {
    return { isActive: false, hideImmediately: true };
  }
  if (habilitado) {
    return { isActive: true, hideImmediately: false };
  }
  if (
    nameUpper.includes('(POR DEFINIR)') ||
    nameUpper.includes('AEROPUERTO') ||
    nameUpper.includes('APEROPUERTO') ||
    catUpper === 'SOLO ENVÍOS' ||
    catUpper === 'SOLO ENVIOS' ||
    nameUpper.includes('CAJA ') ||
    nameUpper.includes('AREA SHALOM') ||
    nameUpper.includes('TALLERES-HUACHIPA') ||
    nameUpper.includes('REPARTO SAN LUIS') ||
    nameUpper.includes('ALMACENES BSF') ||
    nameUpper.includes('PUERTO YURIMAGUAS') ||
    nameUpper.includes('PUERTO IQUITOS')
  ) {
    return { isActive: false, hideImmediately: true };
  }
  return { isActive: false, hideImmediately: false };
}

export class ShalomSyncService {
  private static lastSyncReport: SyncReport | null = null;
  private static isSyncing = false;
  private static cronTimer: NodeJS.Timeout | null = null;

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

  public static async fetchAllAgenciesFromApi(apiKey?: string): Promise<ShalomRawApiAgency[]> {
    const key = apiKey || await this.getApiKey();
    const allAgencies: ShalomRawApiAgency[] = [];
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
            'User-Agent': 'Incomi-AutoSync-Service/2.0',
          },
          timeout: 20000,
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
            await new Promise(r => setTimeout(r, 350));
          }
        }
      } catch (err: any) {
        console.error(`[SHALOM SYNC API ERROR] Fallo al consultar página ${page}:`, err?.message);
        throw err;
      }
    }

    console.log(`[SHALOM SYNC API] ✓ Descarga finalizada: ${allAgencies.length} agencias obtenidas de la API oficial.`);
    return allAgencies;
  }

  /**
   * Sincronización inteligente completa:
   * - Respeta `habilitado: true` y excluye terminales QA/prueba, aeropuertos, SOLO ENVÍOS, cajas internas y (POR DEFINIR).
   * - Sanea texto/encoding (mojibake, \u00b0, N?, códigos con espacios).
   * - Mantiene vigencia informativa de 30 días para sedes reales cerradas o renombradas.
   * - Propaga cambios de nombre solo a pedidos activos (ni cancelados ni entregados).
   */
  public static async syncAgenciesAndPropagateOrders(): Promise<SyncReport> {
    if (this.isSyncing) {
      console.warn('[SHALOM SYNC] Ya hay una sincronización en curso. Omitiendo ejecución concurrente.');
      return this.lastSyncReport || {
        timestamp: new Date().toISOString(),
        totalAgenciesFromApi: 0,
        activeValidCount: 0,
        newAgenciesCount: 0,
        updatedAgenciesCount: 0,
        deactivatedAgenciesCount: 0,
        unchangedAgenciesCount: 0,
        updatedOrdersCount: 0,
        updatedOrders: [],
        errors: ['Sincronización concurrente omitida'],
      };
    }

    this.isSyncing = true;
    const startTime = new Date();
    const nowIso = startTime.toISOString();
    const errors: string[] = [];
    const updatedOrdersList: Array<{ orderId: string; trackingCode: string; oldDestino: string; newDestino: string }> = [];
    let activeValidCount = 0;
    let newAgenciesCount = 0;
    let updatedAgenciesCount = 0;
    let deactivatedAgenciesCount = 0;
    let unchangedAgenciesCount = 0;

    try {
      // 1. Obtener agencias desde API con guardia de seguridad
      const apiAgencies = await this.fetchAllAgenciesFromApi();
      if (apiAgencies.length < MIN_EXPECTED_API_AGENCIES) {
        throw new Error(`Safety guard: API devolvió solo ${apiAgencies.length} agencias (< ${MIN_EXPECTED_API_AGENCIES}).`);
      }

      // 2. Obtener todas las agencias actuales de Supabase (paginado >1000 safe)
      const dbAgenciesData: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error: dbError } = await supabaseAdmin
          .from('shalom_agencies')
          .select('*')
          .order('id', { ascending: true })
          .range(offset, offset + 499);
        if (dbError) {
          errors.push(`Error consultando BD: ${dbError.message}`);
          break;
        }
        if (!data || data.length === 0) break;
        dbAgenciesData.push(...data);
        if (data.length < 500) break;
        offset += 500;
      }

      const dbAgenciesMap = new Map<number, any>();
      for (const ag of dbAgenciesData) {
        dbAgenciesMap.set(Number(ag.id), ag);
      }

      const agenciesToUpsert: any[] = [];
      const changedAgenciesForOrders: Array<{ id: number; oldData?: any; newData: any }> = [];
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      // 3. Clasificar y comparar cada agencia de la API
      for (const raw of apiAgencies) {
        const agId = Number(raw.id);
        const department = cleanText(raw.departamento || 'LIMA').toUpperCase();
        const province = cleanText(raw.provincia || 'LIMA').toUpperCase();
        const district = cleanText(raw.distrito || raw.lugar_over || raw.zona || 'CENTRO').toUpperCase();
        const rawCode = raw.abrebiatura || raw.code || null;
        const code = rawCode ? cleanText(rawCode) : null;
        const name = cleanText(raw.nombre || '');
        const address = cleanText(raw.direccion || '');

        let scheduleText = 'Lunes a Sábado: 8:00 AM - 8:00 PM';
        if (typeof raw.horario === 'string' && raw.horario.trim()) {
          scheduleText = cleanText(raw.horario);
        } else if (raw.horario && typeof raw.horario === 'object' && (raw.horario as any).hora_atencion) {
          scheduleText = cleanText((raw.horario as any).hora_atencion);
        }

        let ubigeo: string | null = null;
        if (raw.ubi_id) {
          ubigeo = String(raw.ubi_id).padStart(6, '0');
        } else if (raw.ubigeo) {
          ubigeo = String(raw.ubigeo).padStart(6, '0');
        }

        let phone = cleanText(raw.telefono || '');
        if (!phone || phone.toLowerCase() === 'null' || phone.toLowerCase() === 'none') {
          phone = '(01) 500-7878';
        }

        const codeTag = code ? ` (CÓDIGO: ${code})` : '';
        const basePath = name.includes('/') ? name : `${department} / ${province} / ${district} / ${name}`;
        const fullName = `${basePath}${address ? ` - ${address}` : ''}${codeTag}`.toUpperCase();

        const cls = classifyApiAgency(raw);
        if (cls.isActive) activeValidCount++;

        const normalizedDBRecord: any = {
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
          phone,
          schedule: scheduleText,
          latitude: typeof raw.latitud === 'number' ? raw.latitud : null,
          longitude: typeof raw.longitud === 'number' ? raw.longitud : null,
          is_active: cls.isActive,
          updated_at: nowIso,
          previous_name: null,
          previous_address: null,
          previous_agency_info: null,
          name_changed_at: null,
          deleted_at: null,
        };

        const existing = dbAgenciesMap.get(agId);

        if (!existing) {
          if (cls.isActive) {
            newAgenciesCount++;
          } else {
            normalizedDBRecord.deleted_at = cls.hideImmediately ? EXPIRED_DELETED_AT : nowIso;
            normalizedDBRecord.previous_name = name;
            normalizedDBRecord.previous_agency_info = fullName;
          }
          agenciesToUpsert.push(normalizedDBRecord);
          continue;
        }

        const wasActive = existing.is_active !== false;

        if (!cls.isActive) {
          normalizedDBRecord.deleted_at = cls.hideImmediately
            ? EXPIRED_DELETED_AT
            : (wasActive ? nowIso : (existing.deleted_at || nowIso));
          normalizedDBRecord.previous_name = existing.previous_name || existing.name || name;
          normalizedDBRecord.previous_address = existing.previous_address || existing.address || address;
          normalizedDBRecord.previous_agency_info = existing.previous_agency_info || existing.full_name || fullName;

          if (wasActive) {
            deactivatedAgenciesCount++;
            agenciesToUpsert.push(normalizedDBRecord);
          } else if (!sameTimestamp(existing.deleted_at, normalizedDBRecord.deleted_at) || (existing.full_name || '') !== fullName) {
            agenciesToUpsert.push(normalizedDBRecord);
          } else {
            unchangedAgenciesCount++;
          }
          continue;
        }

        const isNameChanged = cleanText(existing.name || '').toUpperCase() !== name.toUpperCase();
        const isAddressChanged = (existing.address || '') !== address;
        const isDistrictChanged = cleanText(existing.district || '').toUpperCase() !== district;
        const isCodeChanged = (existing.code || '') !== (code || '');
        const isScheduleChanged = cleanText(existing.schedule || '') !== scheduleText;
        const isLocationChanged =
          (existing.latitude === null) !== (normalizedDBRecord.latitude === null) ||
          (existing.longitude === null) !== (normalizedDBRecord.longitude === null) ||
          (existing.latitude !== null && normalizedDBRecord.latitude !== null && Math.abs(Number(existing.latitude) - Number(normalizedDBRecord.latitude)) > 0.0002) ||
          (existing.longitude !== null && normalizedDBRecord.longitude !== null && Math.abs(Number(existing.longitude) - Number(normalizedDBRecord.longitude)) > 0.0002);

        if (isNameChanged || isDistrictChanged) {
          normalizedDBRecord.previous_name = existing.name;
          normalizedDBRecord.previous_address = existing.address;
          normalizedDBRecord.previous_agency_info = existing.full_name || `${existing.name} - ${existing.address}`;
          normalizedDBRecord.name_changed_at = nowIso;
        } else if (existing.previous_name) {
          const changedTime = existing.name_changed_at ? new Date(existing.name_changed_at).getTime() : 0;
          if (changedTime && Date.now() - changedTime <= thirtyDaysMs) {
            normalizedDBRecord.previous_name = existing.previous_name;
            normalizedDBRecord.previous_address = existing.previous_address;
            normalizedDBRecord.previous_agency_info = existing.previous_agency_info;
            normalizedDBRecord.name_changed_at = existing.name_changed_at;
          }
        }

        if (!wasActive || isNameChanged || isAddressChanged || isDistrictChanged || isCodeChanged || isScheduleChanged || isLocationChanged || (existing.full_name || '') !== fullName) {
          updatedAgenciesCount++;
          agenciesToUpsert.push(normalizedDBRecord);
          if (isNameChanged || isDistrictChanged) {
            changedAgenciesForOrders.push({ id: agId, oldData: existing, newData: normalizedDBRecord });
          }
        } else {
          unchangedAgenciesCount++;
        }
      }

      // Agencias completamente eliminadas de la API
      const apiIdsSet = new Set(apiAgencies.map(a => Number(a.id)));
      const toDeactivateAgencies: any[] = [];
      for (const [dbId, existing] of dbAgenciesMap.entries()) {
        if (!apiIdsSet.has(dbId)) {
          const isJunk = isQaOrTestAgency(existing.name || '', existing.address || '');
          const targetDeletedAt = isJunk ? EXPIRED_DELETED_AT : (existing.deleted_at || nowIso);
          if (existing.is_active !== false || !sameTimestamp(existing.deleted_at, targetDeletedAt)) {
            if (existing.is_active !== false) deactivatedAgenciesCount++;
            toDeactivateAgencies.push({
              id: dbId,
              is_active: false,
              deleted_at: targetDeletedAt,
              previous_name: existing.previous_name || existing.name,
              previous_agency_info: existing.previous_agency_info || existing.full_name || `${existing.name} - ${existing.address}`,
              updated_at: nowIso,
            });
          }
        }
      }

      // 4. Guardar en Supabase `shalom_agencies` en lotes
      if (agenciesToUpsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < agenciesToUpsert.length; i += batchSize) {
          const batch = agenciesToUpsert.slice(i, i + batchSize);
          const { error: upsertErr } = await supabaseAdmin
            .from('shalom_agencies')
            .upsert(batch, { onConflict: 'id' });
          if (upsertErr) {
            errors.push(`Error en upsert lote ${Math.floor(i / batchSize) + 1}: ${upsertErr.message}`);
          }
        }
      }

      for (const deact of toDeactivateAgencies) {
        const { error: deactErr } = await supabaseAdmin
          .from('shalom_agencies')
          .update({
            is_active: false,
            deleted_at: deact.deleted_at,
            previous_name: deact.previous_name,
            previous_agency_info: deact.previous_agency_info,
            updated_at: deact.updated_at,
          })
          .eq('id', deact.id);
        if (deactErr) {
          errors.push(`Error desactivando ID ${deact.id}: ${deactErr.message}`);
        }
      }

      // 5. Propagar cambios de nombre SOLO a pedidos activos en curso (no entregados ni cancelados)
      if (changedAgenciesForOrders.length > 0) {
        const { data: activeOrders, error: ordersErr } = await supabaseAdmin
          .from('pedidos')
          .select('id, codigo_seguimiento, destino_detalle, metodo_envio_codigo, estado_envio')
          .not('estado_envio', 'in', '("cancelado","entregado")');

        if (ordersErr) {
          errors.push(`Error consultando pedidos activos: ${ordersErr.message}`);
        } else if (Array.isArray(activeOrders)) {
          for (const order of activeOrders) {
            const rawDest = order.destino_detalle || '';
            const isShalom = order.metodo_envio_codigo === 'shalom' || rawDest.toLowerCase().includes('shalom');
            if (!isShalom || !rawDest) continue;

            const currentAgencyDetails = resolveShalomAgencyDetails(rawDest);
            const matchedChange = changedAgenciesForOrders.find(ch => {
              if (currentAgencyDetails.isVerified && currentAgencyDetails.terminalId === ch.id) return true;
              if (currentAgencyDetails.isVerified && currentAgencyDetails.code && ch.newData.code && currentAgencyDetails.code.toUpperCase() === ch.newData.code.toUpperCase()) return true;
              return false;
            });

            if (matchedChange) {
              const newAgency = matchedChange.newData;
              const tailMatch = rawDest.match(/(\((?:DNI|CE|Doc)[^)]*\)\s*)$/i);
              const tailTag = tailMatch ? ` ${tailMatch[1].trim()}` : '';
              const updatedDestinoDetalle = `Agencia Shalom: ${newAgency.department} / ${newAgency.province} / ${newAgency.district} (CÓDIGO: ${newAgency.code}) – ${newAgency.address}${tailTag}`;

              if (updatedDestinoDetalle !== rawDest) {
                const { error: updateOrderErr } = await supabaseAdmin
                  .from('pedidos')
                  .update({ destino_detalle: updatedDestinoDetalle, updated_at: nowIso })
                  .eq('id', order.id);

                if (!updateOrderErr) {
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
        timestamp: nowIso,
        totalAgenciesFromApi: apiAgencies.length,
        activeValidCount,
        newAgenciesCount,
        updatedAgenciesCount,
        deactivatedAgenciesCount,
        unchangedAgenciesCount,
        updatedOrdersCount: updatedOrdersList.length,
        updatedOrders: updatedOrdersList,
        errors,
      };

      // Refrescar caché en memoria del matcher del bot WhatsApp / AI
      ShalomMatcherService.invalidateCache();

      this.lastSyncReport = report;
      console.log(`[SHALOM SYNC COMPLETED] ✓ Sincronización 05:00 AM exitosa: ${activeValidCount} activas válidas de ${apiAgencies.length} en API (${newAgenciesCount} nuevas, ${updatedAgenciesCount} modificadas, ${deactivatedAgenciesCount} desactivadas, ${updatedOrdersList.length} pedidos actualizados).`);
      return report;
    } catch (err: any) {
      console.error('[SHALOM SYNC CRITICAL ERROR]', err?.message);
      errors.push(err?.message || 'Error desconocido durante la sincronización');
      const report: SyncReport = {
        timestamp: nowIso,
        totalAgenciesFromApi: 0,
        activeValidCount: 0,
        newAgenciesCount: 0,
        updatedAgenciesCount: 0,
        deactivatedAgenciesCount: 0,
        unchangedAgenciesCount: 0,
        updatedOrdersCount: 0,
        updatedOrders: [],
        errors,
      };
      // Refrescar caché en memoria del matcher del bot WhatsApp / AI
      ShalomMatcherService.invalidateCache();

      this.lastSyncReport = report;
      return report;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Calcula los milisegundos exactos hasta las 05:00:00 AM en zona horaria de Perú (America/Lima / UTC-5)
   */
  public static getMsUntilNext0500(): number {
    const now = new Date();
    const peruTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Lima' });
    const peruDate = new Date(peruTimeStr);

    const target = new Date(peruDate);
    target.setHours(5, 0, 0, 0);

    if (peruDate.getTime() >= target.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const diffMs = target.getTime() - peruDate.getTime();
    return Math.max(diffMs, 1000);
  }

  /** Alias de compatibilidad hacia atrás */
  public static getMsUntilNext2359(): number {
    return this.getMsUntilNext0500();
  }

  /**
   * Inicializa el Cron Job diario para ejecutarse automáticamente cada día a las 05:00 AM hora Perú.
   */
  public static initDailyCron(): void {
    if (this.cronTimer) {
      clearTimeout(this.cronTimer);
      this.cronTimer = null;
    }

    const msUntilNext = this.getMsUntilNext0500();
    const hours = Math.floor(msUntilNext / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((msUntilNext % (1000 * 60)) / 1000);

    console.log(`⏰ [SHALOM CRON SCHEDULER] Próxima sincronización automática de agencias Shalom programada a las 05:00:00 AM PET (en ${hours}h ${minutes}m ${seconds}s).`);

    this.cronTimer = setTimeout(async () => {
      console.log('🌟 [SHALOM CRON TRIGGER 05:00 AM] Ejecutando sincronización diaria automática de agencias Shalom...');
      try {
        await this.syncAgenciesAndPropagateOrders();
      } catch (e) {
        console.error('[SHALOM CRON TRIGGER ERROR]', e);
      } finally {
        this.initDailyCron();
      }
    }, msUntilNext);
  }

  public static getLastSyncReport(): SyncReport | null {
    return this.lastSyncReport;
  }
}
