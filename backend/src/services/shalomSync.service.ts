import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { redisClient } from '../config/redis.js';
import { EvolutionService } from './evolution.service.js';
import { resolveShalomAgencyDetails } from './shalomAgencyResolver.js';
import { ShalomMatcherService } from './shalomMatcher.service.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const SHALOM_OFFICIAL_CONTROL_URL = 'https://newwebservices.shalomcontrol.com/api/v1/web/agencias/listar';
const SOLO_ORIGEN_TAG = '[SOLO_ORIGEN_NO_RECIBE]';
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
  durationMs?: number;
  officialControlCount?: number;
  totalAgenciesFromApi: number;
  activeValidCount: number;
  soloOrigenBlockedCount?: number;
  newAgenciesCount: number;
  reactivatedAgenciesCount?: number;
  updatedAgenciesCount: number;
  deactivatedAgenciesCount: number;
  unchangedAgenciesCount: number;
  updatedOrdersCount: number;
  updatedOrders: Array<{ orderId: string; trackingCode: string; oldDestino: string; newDestino: string }>;
  newAgencies?: Array<{ id: number; code: string | null; name: string }>;
  reactivatedAgencies?: Array<{ id: number; code: string | null; name: string }>;
  renamedAgencies?: Array<{ id: number; code: string | null; oldName: string; newName: string }>;
  deactivatedAgencies?: Array<{ id: number; code: string | null; name: string; reason: string }>;
  whatsappReportSent?: boolean;
  whatsappReportTarget?: string;
  whatsappReportTargets?: string[];
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

interface ShalomOfficialControlRow {
  ter_id: number;
  ter_habilitado_OS?: number | string;
  origen?: number | string;
  destino?: number | string;
  ter_categoria?: string;
  estadoAgencia?: string;
}

function classifyApiAgency(
  raw: ShalomRawApiAgency,
  officialControl: ShalomOfficialControlRow | null = null
): { isActive: boolean; hideImmediately: boolean; isSoloOrigenNoRecibe: boolean } {
  const nameUpper = cleanText(raw.nombre).toUpperCase();
  const addrUpper = cleanText(raw.direccion).toUpperCase();
  const catUpper = cleanText(raw.categoria || officialControl?.ter_categoria || '').toUpperCase();
  const habilitadoApi = raw.habilitado === true;
  const hasOfficial = Boolean(officialControl);
  const officialOS = hasOfficial ? Number(officialControl!.ter_habilitado_OS) === 1 : true;
  const officialDestino = hasOfficial ? Number(officialControl!.destino) === 1 : true;
  const officialOrigen = hasOfficial ? Number(officialControl!.origen) === 1 : false;
  const isSoloEnviosCategory = catUpper === 'SOLO ENVÍOS' || catUpper === 'SOLO ENVIOS';

  if (isQaOrTestAgency(nameUpper, addrUpper)) {
    return { isActive: false, hideImmediately: true, isSoloOrigenNoRecibe: false };
  }
  if (habilitadoApi && officialOS && officialDestino && !isSoloEnviosCategory) {
    return { isActive: true, hideImmediately: false, isSoloOrigenNoRecibe: false };
  }
  if (isSoloEnviosCategory) {
    return { isActive: false, hideImmediately: true, isSoloOrigenNoRecibe: true };
  }
  if (
    nameUpper.includes('(POR DEFINIR)') ||
    nameUpper.includes('AEROPUERTO') ||
    nameUpper.includes('APEROPUERTO') ||
    nameUpper.includes('CAJA ') ||
    nameUpper.includes('AREA SHALOM') ||
    nameUpper.includes('TALLERES-HUACHIPA') ||
    nameUpper.includes('REPARTO SAN LUIS') ||
    nameUpper.includes('ALMACENES BSF') ||
    nameUpper.includes('PUERTO YURIMAGUAS') ||
    nameUpper.includes('PUERTO IQUITOS')
  ) {
    return { isActive: false, hideImmediately: true, isSoloOrigenNoRecibe: false };
  }
  if (hasOfficial && !officialDestino && officialOrigen) {
    return { isActive: false, hideImmediately: false, isSoloOrigenNoRecibe: true };
  }
  return { isActive: false, hideImmediately: false, isSoloOrigenNoRecibe: false };
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

  public static async fetchOfficialControlMap(): Promise<Map<number, ShalomOfficialControlRow>> {
    const map = new Map<number, ShalomOfficialControlRow>();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await axios.get(SHALOM_OFFICIAL_CONTROL_URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Incomi-AutoSync/2.1)',
            Origin: 'https://shalom.com.pe',
            Referer: 'https://shalom.com.pe/',
          },
          timeout: 25000,
        });
        const list: ShalomOfficialControlRow[] = Array.isArray(res.data?.data) ? res.data.data : [];
        if (list.length >= MIN_EXPECTED_API_AGENCIES) {
          for (const row of list) {
            if (row?.ter_id != null) map.set(Number(row.ter_id), row);
          }
          console.log(`[SHALOM SYNC OFFICIAL] ✓ Verificación cruzada shalomcontrol.com OK (${map.size} registros).`);
          return map;
        }
      } catch (err: any) {
        console.warn(`[SHALOM SYNC OFFICIAL WARN] Intento ${attempt}/3 falló:`, err?.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
    return map;
  }

  /**
   * Sincronización inteligente completa:
   * - Respeta `habilitado: true` y excluye terminales QA/prueba, aeropuertos, SOLO ENVÍOS, cajas internas y (POR DEFINIR).
   * - Sanea texto/encoding (mojibake, \u00b0, N?, códigos con espacios).
   * - Mantiene vigencia informativa de 30 días para sedes reales cerradas o renombradas.
   * - Propaga cambios de nombre solo a pedidos activos (ni cancelados ni entregados).
   */
  public static async syncAgenciesAndPropagateOrders(options?: {
    notifyWhatsApp?: boolean;
    notifyPhone?: string;
  }): Promise<SyncReport> {
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
    const newAgenciesList: Array<{ id: number; code: string | null; name: string }> = [];
    const reactivatedAgenciesList: Array<{ id: number; code: string | null; name: string }> = [];
    const renamedAgenciesList: Array<{ id: number; code: string | null; oldName: string; newName: string }> = [];
    const deactivatedAgenciesList: Array<{ id: number; code: string | null; name: string; reason: string }> = [];
    let activeValidCount = 0;
    let soloOrigenBlockedCount = 0;
    let newAgenciesCount = 0;
    let reactivatedAgenciesCount = 0;
    let updatedAgenciesCount = 0;
    let deactivatedAgenciesCount = 0;
    let unchangedAgenciesCount = 0;
    let officialControlSize = 0;

    try {
      // 1. Obtener agencias desde API + verificación cruzada oficial ShalomControl (origen/destino real)
      const [apiAgencies, officialControlMap] = await Promise.all([
        this.fetchAllAgenciesFromApi(),
        this.fetchOfficialControlMap(),
      ]);
      officialControlSize = officialControlMap.size;
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

        const officialRow = officialControlMap.size > 0 ? (officialControlMap.get(agId) || null) : null;
        const cls = classifyApiAgency(raw, officialRow);
        if (cls.isActive) activeValidCount++;
        if (cls.isSoloOrigenNoRecibe) soloOrigenBlockedCount++;

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
            newAgenciesList.push({ id: agId, code, name });
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
          const basePrevInfo = String(existing.previous_agency_info || existing.full_name || fullName || '')
            .replace(/^\[SOLO_ORIGEN_NO_RECIBE\]\s*/i, '')
            .trim();
          const taggedPrevInfo = cls.isSoloOrigenNoRecibe ? `${SOLO_ORIGEN_TAG} ${basePrevInfo}` : basePrevInfo;
          normalizedDBRecord.deleted_at = cls.hideImmediately
            ? EXPIRED_DELETED_AT
            : (wasActive ? nowIso : (existing.deleted_at || nowIso));
          normalizedDBRecord.previous_name = existing.previous_name || existing.name || name;
          normalizedDBRecord.previous_address = existing.previous_address || existing.address || address;
          normalizedDBRecord.previous_agency_info = taggedPrevInfo;

          if (wasActive) {
            deactivatedAgenciesCount++;
            deactivatedAgenciesList.push({
              id: agId,
              code,
              name,
              reason: cls.isSoloOrigenNoRecibe ? 'Solo envíos (no recibe destino)' : 'Deshabilitada en Shalom',
            });
            agenciesToUpsert.push(normalizedDBRecord);
          } else if (
            !sameTimestamp(existing.deleted_at, normalizedDBRecord.deleted_at) ||
            (existing.full_name || '') !== fullName ||
            (existing.previous_agency_info || null) !== (normalizedDBRecord.previous_agency_info || null)
          ) {
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
          renamedAgenciesList.push({ id: agId, code, oldName: existing.name || '', newName: name });
        } else if (existing.previous_name) {
          const changedTime = existing.name_changed_at ? new Date(existing.name_changed_at).getTime() : 0;
          if (changedTime && Date.now() - changedTime <= thirtyDaysMs) {
            normalizedDBRecord.previous_name = existing.previous_name;
            normalizedDBRecord.previous_address = existing.previous_address;
            normalizedDBRecord.previous_agency_info = existing.previous_agency_info;
            normalizedDBRecord.name_changed_at = existing.name_changed_at;
          }
        }

        if (!wasActive) {
          reactivatedAgenciesCount++;
          reactivatedAgenciesList.push({ id: agId, code, name });
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
            if (existing.is_active !== false) {
              deactivatedAgenciesCount++;
              deactivatedAgenciesList.push({
                id: dbId,
                code: existing.code || null,
                name: existing.name || `ID ${dbId}`,
                reason: isJunk ? 'Depurada (QA/Prueba)' : 'Eliminada del catálogo oficial Shalom',
              });
            }
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
        durationMs: Date.now() - startTime.getTime(),
        officialControlCount: officialControlSize,
        totalAgenciesFromApi: apiAgencies.length,
        activeValidCount,
        soloOrigenBlockedCount,
        newAgenciesCount,
        reactivatedAgenciesCount,
        updatedAgenciesCount,
        deactivatedAgenciesCount,
        unchangedAgenciesCount,
        updatedOrdersCount: updatedOrdersList.length,
        updatedOrders: updatedOrdersList,
        newAgencies: newAgenciesList,
        reactivatedAgencies: reactivatedAgenciesList,
        renamedAgencies: renamedAgenciesList,
        deactivatedAgencies: deactivatedAgenciesList,
        errors,
      };

      // Refrescar caché en memoria del matcher del bot WhatsApp / AI
      ShalomMatcherService.invalidateCache();

      if (options?.notifyWhatsApp) {
        const sent = await this.sendDailySyncWhatsAppReport(report, options.notifyPhone);
        report.whatsappReportSent = sent.sent;
        report.whatsappReportTarget = sent.targetPhones.join(',');
        report.whatsappReportTargets = sent.sentPhones;
      }

      this.lastSyncReport = report;
      try {
        await redisClient.set('shalom:agency_sync:last_report', JSON.stringify(report), 'EX', 86400 * 14);
      } catch {}

      console.log(`[SHALOM SYNC COMPLETED] ✓ Sincronización 05:00 AM exitosa: ${activeValidCount} activas válidas de ${apiAgencies.length} en API (${newAgenciesCount} nuevas, ${updatedAgenciesCount} modificadas, ${deactivatedAgenciesCount} desactivadas, ${updatedOrdersList.length} pedidos actualizados).`);
      return report;
    } catch (err: any) {
      console.error('[SHALOM SYNC CRITICAL ERROR]', err?.message);
      errors.push(err?.message || 'Error desconocido durante la sincronización');
      const report: SyncReport = {
        timestamp: nowIso,
        durationMs: Date.now() - startTime.getTime(),
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

      if (options?.notifyWhatsApp) {
        const sent = await this.sendDailySyncWhatsAppReport(report, options.notifyPhone);
        report.whatsappReportSent = sent.sent;
        report.whatsappReportTarget = sent.targetPhones.join(',');
        report.whatsappReportTargets = sent.sentPhones;
      }

      this.lastSyncReport = report;
      return report;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Construye y envía el informe diario de sincronización de agencias Shalom a todos los WhatsApp configurados
   * (+51 963097546 y +51 927781412 por defecto).
   */
  public static async sendDailySyncWhatsAppReport(
    report: SyncReport,
    customPhone?: string
  ): Promise<{ sent: boolean; targetPhones: string[]; sentPhones: string[]; instanceUsed?: string }> {
    const rawTargets = customPhone || env.SHALOM_SYNC_REPORT_PHONE || '51963097546,51927781412';
    const targetPhones = Array.from(
      new Set(
        rawTargets
          .split(/[,;\s]+/)
          .map((p) => p.replace(/\D/g, ''))
          .map((p) => (p.length === 9 ? `51${p}` : p))
          .filter((p) => p.length >= 9)
      )
    );
    const peruDateStr = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(report.timestamp));

    const hasChanges =
      report.newAgenciesCount > 0 ||
      (report.reactivatedAgenciesCount || 0) > 0 ||
      report.updatedAgenciesCount > 0 ||
      report.deactivatedAgenciesCount > 0 ||
      report.updatedOrdersCount > 0;

    const hasErrors = report.errors.length > 0;
    const statusHeader = hasErrors
      ? '⚠️ *COMPLETADO CON OBSERVACIONES*'
      : hasChanges
      ? '🔄 *BD ACTUALIZADA CON CAMBIOS*'
      : '✨ *SIN CAMBIOS (BD 100% AL DÍA)*';

    const durSec = report.durationMs ? `${(report.durationMs / 1000).toFixed(1)}s` : '—';

    const lines: string[] = [
      `📦 *INFORME DIARIO AGENCIAS SHALOM (VPS)*`,
      `🗓️ ${peruDateStr} PET (${durSec})`,
      `Estado: ${statusHeader}`,
      ``,
      `📊 *Resumen Base de Datos VPS:*`,
      `• 📡 Total API Shalom: *${report.totalAgenciesFromApi}*`,
      `• ✅ Activas válidas (destino=1): *${report.activeValidCount}*`,
      ...(report.officialControlCount
        ? [`• 🛡️ Validación oficial ShalomControl: *${report.officialControlCount}* sedes`]
        : []),
      ...(report.soloOrigenBlockedCount
        ? [`• 🚫 Solo envíos bloqueadas: *${report.soloOrigenBlockedCount}*`]
        : []),
      `• ✨ Nuevas: *${report.newAgenciesCount}* | 🌟 Reactivadas: *${report.reactivatedAgenciesCount || 0}*`,
      `• ✏️ Modificadas: *${report.updatedAgenciesCount}* | 🛑 Bajas: *${report.deactivatedAgenciesCount}*`,
      `• 🚚 Pedidos activos actualizados: *${report.updatedOrdersCount}*`,
    ];

    if (report.newAgencies && report.newAgencies.length > 0) {
      lines.push(``, `✨ *Nuevas agencias:*`);
      report.newAgencies.slice(0, 8).forEach((a) => lines.push(`  + ${a.name}${a.code ? ` (${a.code})` : ''}`));
      if (report.newAgencies.length > 8) lines.push(`  … y ${report.newAgencies.length - 8} más`);
    }

    if (report.reactivatedAgencies && report.reactivatedAgencies.length > 0) {
      lines.push(``, `🌟 *Reactivadas / recién habilitadas:*`);
      report.reactivatedAgencies.slice(0, 8).forEach((a) => lines.push(`  + ${a.name}${a.code ? ` (${a.code})` : ''}`));
    }

    if (report.renamedAgencies && report.renamedAgencies.length > 0) {
      lines.push(``, `🏷️ *Renombradas:*`);
      report.renamedAgencies.slice(0, 8).forEach((a) => lines.push(`  ~ ${a.oldName} → *${a.newName}*`));
    }

    if (report.deactivatedAgencies && report.deactivatedAgencies.length > 0) {
      lines.push(``, `🛑 *Cerradas / deshabilitadas:*`);
      report.deactivatedAgencies.slice(0, 8).forEach((a) => lines.push(`  - ${a.name} (${a.reason})`));
    }

    if (report.updatedOrders.length > 0) {
      lines.push(``, `📦 *Pedidos actualizados automáticamente:*`);
      report.updatedOrders.slice(0, 6).forEach((o) => lines.push(`  • #${o.trackingCode}`));
    }

    if (hasErrors) {
      lines.push(``, `⚠️ *Errores detectados:*`);
      report.errors.slice(0, 4).forEach((e) => lines.push(`  • ${e}`));
    }

    lines.push(``, `🤖 _Cron automático 05:00 AM • Servidor VPS Encomi_`);
    const message = lines.join('\n');

    const baseInstances = Array.from(
      new Set([env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp', 'comikids_whatsapp', 'tenant_Comikids'])
    );

    const sentPhones: string[] = [];
    let lastInstanceUsed: string | undefined;

    for (let idx = 0; idx < targetPhones.length; idx++) {
      const phone = targetPhones[idx];
      if (idx > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Si el destino es +51 927781412 (número de tenant_Comikids), priorizar comikids_whatsapp para no auto-enviarse
      const instancesForPhone = phone.endsWith('927781412')
        ? baseInstances.filter((i) => i !== 'tenant_Comikids').concat(['tenant_Comikids'])
        : baseInstances;

      for (const inst of instancesForPhone) {
        try {
          await EvolutionService.sendWhatsAppMessage(inst, phone, message);
          console.log(`[SHALOM SYNC WHATSAPP] ✅ Informe diario enviado a +${phone} vía "${inst}".`);
          sentPhones.push(phone);
          lastInstanceUsed = inst;
          break;
        } catch (err: any) {
          console.warn(`[SHALOM SYNC WHATSAPP WARN] Falló envío a +${phone} vía "${inst}":`, err?.message);
        }
      }
    }

    return {
      sent: sentPhones.length > 0,
      targetPhones,
      sentPhones,
      instanceUsed: lastInstanceUsed,
    };
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
      console.log('🌟 [SHALOM CRON TRIGGER 05:00 AM] Ejecutando sincronización diaria automática de agencias Shalom en VPS + envío de informe por WhatsApp...');
      try {
        await this.syncAgenciesAndPropagateOrders({ notifyWhatsApp: true });
      } catch (e) {
        console.error('[SHALOM CRON TRIGGER ERROR]', e);
      } finally {
        this.initDailyCron();
      }
    }, msUntilNext);
  }

  public static async getLastSyncReportPersisted(): Promise<SyncReport | null> {
    if (this.lastSyncReport) return this.lastSyncReport;
    try {
      const raw = await redisClient.get('shalom:agency_sync:last_report');
      if (raw) {
        this.lastSyncReport = JSON.parse(raw);
        return this.lastSyncReport;
      }
    } catch {}
    return null;
  }

  public static getLastSyncReport(): SyncReport | null {
    return this.lastSyncReport;
  }
}
