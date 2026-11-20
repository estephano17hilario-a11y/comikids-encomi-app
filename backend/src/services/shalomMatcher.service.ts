import { SHALOM_AGENCIES } from '../data/shalomAgencies.js';
import { ShalomAgency } from '../types/database.types.js';
import { supabaseAdmin } from '../config/supabase.js';

export interface ShalomMatchResult {
  agency: ShalomAgency;
  score: number;
  formattedDestino: string;
  displayTitle: string;
  displayAddress: string;
  code: string;
  distanceKm?: number;
  renameNotice?: ShalomRenameNotice | null;
}

export interface ShalomRenameNotice {
  previousName: string;
  previousAddress?: string | null;
  newName: string;
  changedAt?: string | null;
  changedAtFormatted?: string | null;
  matchedViaOldName: boolean;
}

export interface ShalomClosedInfo {
  agency: ShalomAgency;
  displayTitle: string;
  displayAddress: string;
  reason: string;
  category: 'closed_or_disabled' | 'por_definir' | 'solo_envios' | 'airport' | 'internal' | 'qa_test';
  deletedAt?: string | null;
  deletedAtFormatted?: string | null;
}

export interface OlvaAlternative {
  id: number;
  code?: string | null;
  name: string;
  department: string;
  province: string;
  district: string;
  address: string;
}

export interface ShalomLiveResolution {
  status: 'matched' | 'matched_renamed' | 'ambiguous' | 'closed_or_disabled' | 'not_found';
  isUnambiguousMatch: boolean;
  resolvedDestination: string;
  matches: ShalomMatchResult[];
  topMatch?: ShalomMatchResult;
  closedMatch?: ShalomClosedInfo;
  renameNotice?: ShalomRenameNotice | null;
  nearestAlternatives: ShalomMatchResult[];
  olvaAlternatives: OlvaAlternative[];
  warningMessage?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché en memoria para respuesta rápida + datos frescos
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class ShalomMatcherService {
  private static staticAgencies: ShalomAgency[] = SHALOM_AGENCIES;
  private static liveAgenciesCache: ShalomAgency[] | null = null;
  private static liveCacheExpiresAt = 0;

  /**
   * Invalida la caché en memoria (se llama automáticamente después de cada sincronización)
   */
  public static invalidateCache(): void {
    this.liveAgenciesCache = null;
    this.liveCacheExpiresAt = 0;
  }

  /**
   * Formatea una fecha ISO en hora Perú (America/Lima) con texto relativo legible.
   * Ej: "20 nov 2026 (hoy)", "19 nov 2026 (ayer)", "10 nov 2026 (hace 10 días)"
   */
  public static formatChangeDatePeru(iso?: string | null): string | null {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;

    // Ignorar fecha sentinela de registros internos/QA ocultos (2025-01-01)
    if (parsed.getUTCFullYear() <= 2025) return null;

    const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
    const peruTarget = new Date(parsed.getTime() - 5 * 3600 * 1000);
    const todayYmd = peruNow.toISOString().slice(0, 10);
    const targetYmd = peruTarget.toISOString().slice(0, 10);

    const dayDiff = Math.round(
      (new Date(`${todayYmd}T00:00:00Z`).getTime() - new Date(`${targetYmd}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const [y, m, d] = targetYmd.split('-').map(Number);
    const base = `${d} ${months[(m || 1) - 1]} ${y}`;

    if (dayDiff <= 0) return `${base} (hoy)`;
    if (dayDiff === 1) return `${base} (ayer)`;
    return `${base} (hace ${dayDiff} días)`;
  }

  /**
   * Carga TODAS las agencias Shalom en vivo desde Supabase (activas + cerradas/deshabilitadas)
   * con paginación >1000 y fallback seguro al catálogo estático.
   */
  public static async loadLiveAgencies(forceRefresh: boolean = false): Promise<ShalomAgency[]> {
    const now = Date.now();
    if (!forceRefresh && this.liveAgenciesCache && this.liveCacheExpiresAt > now) {
      return this.liveAgenciesCache;
    }

    try {
      const allRows: ShalomAgency[] = [];
      let offset = 0;
      const pageSize = 500;

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('shalom_agencies')
          .select('id, code, name, full_name, department, province, district, ubigeo, dep_id, prov_id, dist_id, address, phone, schedule, latitude, longitude, is_active, updated_at, previous_name, previous_address, previous_agency_info, name_changed_at, deleted_at')
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(error.message);
        }
        if (!data || data.length === 0) break;

        for (const row of data as any[]) {
          allRows.push({
            id: Number(row.id),
            code: row.code || null,
            name: row.name || '',
            nombre: row.name || '',
            full_name: row.full_name || '',
            department: row.department || 'LIMA',
            departamento: row.department || 'LIMA',
            province: row.province || 'LIMA',
            provincia: row.province || 'LIMA',
            district: row.district || 'CENTRO',
            distrito: row.district || 'CENTRO',
            ubigeo: row.ubigeo || null,
            dep_id: row.dep_id ?? null,
            prov_id: row.prov_id ?? null,
            dist_id: row.dist_id ?? null,
            address: row.address || '',
            direccion: row.address || '',
            phone: row.phone || '(01) 500-7878',
            telefono: row.phone || '(01) 500-7878',
            schedule: row.schedule || '',
            horario: row.schedule || '',
            latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
            longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
            is_active: row.is_active !== false,
            updated_at: row.updated_at || undefined,
            previous_name: row.previous_name || null,
            previous_address: row.previous_address || null,
            previous_agency_info: row.previous_agency_info || null,
            name_changed_at: row.name_changed_at || null,
            deleted_at: row.deleted_at || null,
          });
        }

        if (data.length < pageSize) break;
        offset += pageSize;
      }

      if (allRows.length > 0) {
        this.liveAgenciesCache = allRows;
        this.liveCacheExpiresAt = now + CACHE_TTL_MS;
        return allRows;
      }
    } catch (err: any) {
      console.warn('[SHALOM MATCHER] No se pudo consultar Supabase en vivo, usando respaldo local:', err?.message);
    }

    return this.staticAgencies;
  }

  /**
   * Normaliza texto eliminando tildes, caracteres especiales y convirtiendo a mayúsculas
   */
  public static normalize(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Limpia palabras de ruido no discriminantes en consultas de WhatsApp
   */
  public static extractMeaningfulTokens(query: string): string[] {
    const raw = this.normalize(query);
    const noiseWords = new Set([
      'AGENCIA', 'SHALOM', 'SALOM', 'CHALOM', 'PARA', 'DESTINO', 'ENVIAR', 'ENTREGAR',
      'RECOJO', 'SEDE', 'DIRECCION', 'LLEVAR', 'DESPACHO', 'DESPACHAR', 'EN', 'EL',
      'LA', 'LOS', 'LAS', 'DE', 'DEL', 'A', 'AL', 'POR', 'FAVOR', 'CON', 'MI', 'SU',
      'QUE', 'SEA', 'HOLA', 'QUIERO', 'PORFA', 'MANDAR', 'ENVIAME', 'REGISTRAR', 'REGISTRA',
      'SUCURSAL', 'OFICINA', 'ENVIO', 'PAQUETE', 'PEDIDO', 'HAY', 'TIENE', 'TIENEN', 'EXISTE',
      'PERU', 'CODIGO', 'COD', 'CERCA', 'CERCANA'
    ]);

    return raw.split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w));
  }

  public static cleanAddressText(address?: string): string {
    if (!address) return '';
    let addr = address.trim();
    if (addr.toUpperCase().startsWith('DIRECCION:') || addr.toUpperCase().startsWith('DIRECCIÓN:')) {
      addr = addr.replace(/^DIRECCI[OÓ]N:\s*/i, '').trim();
    }
    return addr;
  }

  public static formatAgencyTitle(agency: ShalomAgency): string {
    const dep = (agency.department || agency.departamento || 'LIMA').toUpperCase().trim();
    const prov = (agency.province || agency.provincia || dep).toUpperCase().trim();
    const dist = (agency.district || agency.distrito || agency.nombre || 'CENTRO').toUpperCase().trim();
    const codeStr = agency.code ? ` (CÓDIGO: ${agency.code.toUpperCase().trim()})` : '';
    return `${dep} / ${prov} / ${dist}${codeStr}`;
  }

  public static formatAgencyDestination(agency: ShalomAgency, dni: string): string {
    const cleanDni = (dni || '').replace(/[^0-9A-Za-z]/g, '').trim() || 'S/DNI';
    const title = this.formatAgencyTitle(agency);
    const cleanAddr = this.cleanAddressText(agency.address || agency.direccion);
    const addrStr = cleanAddr ? ` – ${cleanAddr}` : '';
    return `Agencia Shalom: ${title}${addrStr} (DNI/CE Recojo: ${cleanDni})`;
  }

  private static haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private static isQaOrTest(agency: ShalomAgency): boolean {
    const n = (agency.name || agency.nombre || '').toUpperCase();
    const a = (agency.address || agency.direccion || '').toUpperCase();
    return (
      /\bPRUEBA\b|PRUEBA[A-Z0-9_]|_PRUEBA|\bTEST\b|PRUEBATEST|\bZZ\s*QA\b|TERMINAL DE PRUEBA|AV\s+PRUEBAS/i.test(n) ||
      /\bPRUEBA\b|PRUEBA_DE_ALMACEN|TERMINAL DE PRUEBA|AV\s+PRUEBAS/i.test(a)
    );
  }

  private static classifyClosedReason(agency: ShalomAgency): {
    category: ShalomClosedInfo['category'];
    reason: string;
  } {
    const n = (agency.name || agency.nombre || '').toUpperCase();
    if (this.isQaOrTest(agency)) {
      return { category: 'qa_test', reason: 'Terminal interna de pruebas QA de Shalom (no es una agencia real)' };
    }
    if (n.includes('(POR DEFINIR)')) {
      return { category: 'por_definir', reason: 'Sede nueva en preparación (aún NO habilitada para recibir envíos)' };
    }
    if (n.includes('AEROPUERTO') || n.includes('APEROPUERTO')) {
      return { category: 'airport', reason: 'Terminal aeroportuaria interna (no habilitada para recojo público estándar)' };
    }
    if (n.includes('LUNA PIZARRO') || n.includes('ENVIOS')) {
      return { category: 'solo_envios', reason: 'Agencia de SOLO ENVÍOS (no habilitada como destino de recojo)' };
    }
    if (
      n.includes('CAJA ') ||
      n.includes('AREA SHALOM') ||
      n.includes('TALLERES-HUACHIPA') ||
      n.includes('REPARTO SAN LUIS') ||
      n.includes('ALMACENES BSF') ||
      n.includes('PUERTO ')
    ) {
      return { category: 'internal', reason: 'Instalación interna / almacén de Shalom (no atiende recojo de clientes)' };
    }
    return { category: 'closed_or_disabled', reason: 'Agencia cerrada o actualmente deshabilitada en el sistema oficial de Shalom' };
  }

  /**
   * Evalúa si una agencia activa tiene aviso de cambio de nombre reciente (o si el usuario la buscó por su nombre anterior)
   */
  private static buildRenameNotice(agency: ShalomAgency, tokens: string[], fullNormQuery: string): ShalomRenameNotice | null {
    const prevName = (agency.previous_name || '').trim();
    if (!prevName) return null;

    const currentName = (agency.name || agency.nombre || '').trim();
    if (this.normalize(prevName) === this.normalize(currentName)) return null;

    // Verificar si coincide con el nombre anterior
    const normPrev = this.normalize(prevName);
    const normCurr = this.normalize(currentName);
    const matchedViaOldName =
      (fullNormQuery.length >= 4 && normPrev.includes(fullNormQuery) && !normCurr.includes(fullNormQuery)) ||
      tokens.some(t => t.length >= 3 && normPrev.includes(t) && !normCurr.includes(t));

    // Verificar si el cambio fue reciente (últimos 30 días)
    const changedMs = agency.name_changed_at ? Date.parse(agency.name_changed_at) : 0;
    const isRecent = Boolean(changedMs && Date.now() - changedMs <= THIRTY_DAYS_MS);

    if (!isRecent && !matchedViaOldName) return null;

    return {
      previousName: prevName,
      previousAddress: agency.previous_address || null,
      newName: currentName,
      changedAt: agency.name_changed_at || null,
      changedAtFormatted: this.formatChangeDatePeru(agency.name_changed_at),
      matchedViaOldName,
    };
  }

  /**
   * Calcula puntaje detallado de afinidad contra nombre actual, dirección, código y nombre anterior
   */
  private static scoreAgencyDetailed(
    agency: ShalomAgency,
    tokens: string[],
    fullNormQuery: string
  ): { score: number; matchedTokens: number; matchedNonGenericTokens: number; exactCodeMatch: boolean; matchedViaPrevName: boolean; matchedDistrictOrLocal: boolean } {
    if (tokens.length === 0) {
      return { score: 0, matchedTokens: 0, matchedNonGenericTokens: 0, exactCodeMatch: false, matchedViaPrevName: false, matchedDistrictOrLocal: false };
    }

    const genericWords = new Set([
      'PUEBLO', 'SAN', 'SANTA', 'VILLA', 'NUEVO', 'NUEVA', 'ALTO', 'ALTA', 'BAJO', 'BAJA',
      'AV', 'AVENIDA', 'JR', 'JIRON', 'CALLE', 'URB', 'URBANIZACION', 'SECTOR', 'ZONA',
      'BARRIO', 'CENTRO', 'CIUDAD', 'PUERTO', 'PLAZA', 'PARQUE', 'OVALO', 'PUENTE', 'KM',
      'MZ', 'LT', 'LOTE', 'CDRA', 'CUADRA', 'NORTE', 'SUR', 'ESTE', 'OESTE', 'CO'
    ]);

    const dep = this.normalize(agency.department || agency.departamento || '');
    const prov = this.normalize(agency.province || agency.provincia || '');
    const dist = this.normalize(agency.district || agency.distrito || '');
    const name = this.normalize(agency.name || agency.nombre || '');
    const prevName = this.normalize(agency.previous_name || '');
    const addr = this.normalize(agency.address || agency.direccion || '');
    const code = this.normalize(agency.code || '');

    // Extraer el segmento del distrito oficial dentro de "DEP / PROV / DIST_REAL / LOCAL"
    const nameParts = (agency.name || agency.nombre || '').split('/').map(s => this.normalize(s)).filter(Boolean);
    const adminDist = nameParts.length >= 3 ? nameParts[2] : dist;
    const localName = nameParts.length >= 4 ? nameParts[nameParts.length - 1] : dist;

    let score = 0;
    let tokensMatchedCount = 0;
    let matchedNonGenericTokens = 0;
    let exactCodeMatch = false;
    let matchedViaPrevName = false;
    let matchedDistrictOrLocal = false;

    for (const token of tokens) {
      if (code && token === code) {
        score += 260;
        tokensMatchedCount++;
        matchedNonGenericTokens++;
        exactCodeMatch = true;
        matchedDistrictOrLocal = true;
        continue;
      }

      let tokenMatched = false;

      if (localName === token || dist === token || adminDist === token) {
        score += 120;
        tokenMatched = true;
        matchedDistrictOrLocal = true;
      } else if (
        localName.split(/\s+/).includes(token) ||
        dist.split(/\s+/).includes(token) ||
        adminDist.split(/\s+/).includes(token)
      ) {
        score += 95;
        tokenMatched = true;
        matchedDistrictOrLocal = true;
      } else if (dist.includes(token) || localName.includes(token) || adminDist.includes(token)) {
        score += 55;
        tokenMatched = true;
        matchedDistrictOrLocal = true;
      }

      if (prov === token || prov.split(/\s+/).includes(token)) {
        score += 65;
        tokenMatched = true;
      } else if (prov.includes(token)) {
        score += 30;
        tokenMatched = true;
      }

      if (name.includes(token)) {
        score += 45;
        tokenMatched = true;
      } else if (prevName && prevName.includes(token)) {
        score += 85;
        tokenMatched = true;
        matchedViaPrevName = true;
        matchedDistrictOrLocal = true;
      }

      if (addr.includes(token)) {
        score += 38;
        tokenMatched = true;
      }

      if (dep === token || dep.split(/\s+/).includes(token)) {
        score += 25;
        tokenMatched = true;
      }

      if (tokenMatched) {
        tokensMatchedCount++;
        if (!genericWords.has(token)) matchedNonGenericTokens++;
      }
    }

    if (tokens.length >= 2) {
      if (tokensMatchedCount >= tokens.length) {
        score += 160;
      } else if (tokensMatchedCount >= 2) {
        score += 55;
      }
    }

    if (fullNormQuery.length >= 4) {
      if (localName === fullNormQuery || dist === fullNormQuery || adminDist === fullNormQuery) {
        score += 200;
        matchedDistrictOrLocal = true;
      } else if (dist.includes(fullNormQuery) || localName.includes(fullNormQuery) || adminDist.includes(fullNormQuery)) {
        score += 130;
        matchedDistrictOrLocal = true;
      } else if (name.includes(fullNormQuery)) {
        score += 110;
      } else if (prevName && prevName.includes(fullNormQuery)) {
        score += 140;
        matchedViaPrevName = true;
        matchedDistrictOrLocal = true;
      } else if (addr.includes(fullNormQuery)) {
        score += 85;
      } else if (prov.includes(fullNormQuery)) {
        score += 60;
      }
    }

    if (dist.includes('CENTRO') || dist.includes('PRINCIPAL') || name.includes('CENTRAL')) score += 3;

    return { score, matchedTokens: tokensMatchedCount, matchedNonGenericTokens, exactCodeMatch, matchedViaPrevName, matchedDistrictOrLocal };
  }

  private static toMatchResult(agency: ShalomAgency, score: number, tokens: string[], fullNormQuery: string, distanceKm?: number): ShalomMatchResult {
    return {
      agency,
      score,
      formattedDestino: this.formatAgencyDestination(agency, ''),
      displayTitle: this.formatAgencyTitle(agency),
      displayAddress: this.cleanAddressText(agency.address || agency.direccion),
      code: agency.code || '',
      distanceKm,
      renameNotice: agency.is_active !== false ? this.buildRenameNotice(agency, tokens, fullNormQuery) : null,
    };
  }

  /**
   * Encuentra las agencias Shalom ACTIVAS más cercanas a una sede cerrada/deshabilitada
   * (priorizando distancia GPS Haversine si existen coordenadas; si no, misma provincia/departamento)
   */
  private static findNearestActiveAlternatives(
    refAgency: ShalomAgency,
    activeAgencies: ShalomAgency[],
    limit: number = 5
  ): ShalomMatchResult[] {
    if (refAgency.latitude != null && refAgency.longitude != null) {
      const withDist = activeAgencies
        .filter(a => a.latitude != null && a.longitude != null)
        .map(a => ({
          agency: a,
          distKm: this.haversineKm(Number(refAgency.latitude), Number(refAgency.longitude), Number(a.latitude), Number(a.longitude)),
        }))
        .sort((x, y) => x.distKm - y.distKm)
        .slice(0, limit);

      return withDist.map(x => this.toMatchResult(x.agency, 100, [], '', Math.round(x.distKm * 10) / 10));
    }

    const refProv = this.normalize(refAgency.province || refAgency.provincia || '');
    const refDep = this.normalize(refAgency.department || refAgency.departamento || '');

    const sameProv = activeAgencies.filter(a => this.normalize(a.province || a.provincia || '') === refProv);
    const pool = sameProv.length > 0 ? sameProv : activeAgencies.filter(a => this.normalize(a.department || a.departamento || '') === refDep);

    return pool.slice(0, limit).map(a => this.toMatchResult(a, 60, [], ''));
  }

  /**
   * Busca alternativas en Olva Courier (tabla `olva_agencies`) cuando Shalom no tiene cobertura
   */
  public static async searchOlvaAlternatives(query: string, limit: number = 4): Promise<OlvaAlternative[]> {
    const tokens = this.extractMeaningfulTokens(query).filter(t => t.length >= 3);
    if (tokens.length === 0) return [];

    try {
      const mainToken = tokens[tokens.length - 1];
      const { data, error } = await supabaseAdmin
        .from('olva_agencies')
        .select('id, code, name, department, province, district, address, is_active')
        .eq('is_active', true)
        .or(`name.ilike.%${mainToken}%,district.ilike.%${mainToken}%,province.ilike.%${mainToken}%,address.ilike.%${mainToken}%`)
        .limit(limit);

      if (error || !data) return [];
      return (data as any[]).map(r => ({
        id: Number(r.id),
        code: r.code || null,
        name: r.name || '',
        department: r.department || '',
        province: r.province || '',
        district: r.district || '',
        address: r.address || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Resolución INTELIGENTE EN VIVO contra PostgreSQL `shalom_agencies`:
   * - Detecta agencias cerradas / deshabilitadas / SOLO ENVÍOS / `(POR DEFINIR)` y ofrece las más cercanas por GPS.
   * - Detecta zonas sin sucursal Shalom (`not_found`) y sugiere sedes cercanas + cobertura Olva.
   * - Detecta agencias que cambiaron de nombre recientemente (`previous_name`) y emite aviso explícito.
   * - Desambigua cuando hay múltiples sedes activas válidas.
   */
  public static async resolveDestinationLive(destinationInput: string, dni: string): Promise<ShalomLiveResolution> {
    const cleanDni = (dni || '').replace(/[^0-9A-Za-z]/g, '').trim();
    const rawDest = (destinationInput || '').trim();

    const allAgencies = await this.loadLiveAgencies();
    const activeAgencies = allAgencies.filter(a => a.is_active !== false && !this.isQaOrTest(a));
    const inactiveAgencies = allAgencies.filter(a => a.is_active === false || this.isQaOrTest(a));

    // Si ya viene formateado con "(CÓDIGO: XXX)", validar que ese código siga ACTIVO en BD
    const embeddedCode = rawDest.match(/\((?:CÓDIGO|CODIGO|COD)[\s:]*([^)]+)\)/i)?.[1]?.trim();
    if (embeddedCode) {
      const normCode = this.normalize(embeddedCode);
      const exactActive = activeAgencies.find(a => this.normalize(a.code || '') === normCode);
      if (exactActive) {
        const renameNotice = this.buildRenameNotice(exactActive, [], '');
        const matchObj = this.toMatchResult(exactActive, 300, [], '');
        return {
          status: renameNotice ? 'matched_renamed' : 'matched',
          isUnambiguousMatch: true,
          resolvedDestination: this.formatAgencyDestination(exactActive, cleanDni),
          matches: [matchObj],
          topMatch: matchObj,
          renameNotice,
          nearestAlternatives: [],
          olvaAlternatives: [],
        };
      }
      const exactClosed = inactiveAgencies.find(a => this.normalize(a.code || '') === normCode);
      if (exactClosed) {
        const cls = this.classifyClosedReason(exactClosed);
        const nearest = this.findNearestActiveAlternatives(exactClosed, activeAgencies, 5);
        const olva = await this.searchOlvaAlternatives(exactClosed.district || exactClosed.province || rawDest, 3);
        return {
          status: 'closed_or_disabled',
          isUnambiguousMatch: false,
          resolvedDestination: '',
          matches: nearest,
          closedMatch: {
            agency: exactClosed,
            displayTitle: this.formatAgencyTitle(exactClosed),
            displayAddress: this.cleanAddressText(exactClosed.address || exactClosed.direccion),
            reason: cls.reason,
            category: cls.category,
            deletedAt: exactClosed.deleted_at || null,
            deletedAtFormatted: this.formatChangeDatePeru(exactClosed.deleted_at),
          },
          nearestAlternatives: nearest,
          olvaAlternatives: olva,
        };
      }
    }

    const tokens = this.extractMeaningfulTokens(rawDest);
    const fullNormQuery = this.normalize(rawDest)
      .replace(/^(?:AGENCIA|SHALOM|PARA|DESTINO|SEDE|SUCURSAL)\s+/gi, '')
      .trim();

    if (tokens.length === 0 && fullNormQuery.length < 2) {
      return {
        status: 'not_found',
        isUnambiguousMatch: false,
        resolvedDestination: '',
        matches: [],
        nearestAlternatives: [],
        olvaAlternatives: [],
      };
    }

    // Evaluar activas e inactivas por separado
    const scoredActive = activeAgencies
      .map(ag => ({ ag, ...this.scoreAgencyDetailed(ag, tokens, fullNormQuery) }))
      .filter(x => x.score >= 35)
      .sort((a, b) => b.score - a.score);

    const scoredInactive = inactiveAgencies
      .filter(ag => !this.isQaOrTest(ag))
      .map(ag => ({ ag, ...this.scoreAgencyDetailed(ag, tokens, fullNormQuery) }))
      .filter(x => x.score >= 85)
      .sort((a, b) => b.score - a.score);

    const bestActive = scoredActive[0] || null;
    const bestInactive = scoredInactive[0] || null;

    // 1. Verificar si la consulta apunta claramente a una agencia CERRADA / DESHABILITADA / SOLO ENVÍOS / POR DEFINIR
    //    (ej: "San Isidro", "Av. Alfredo Benavides", "Rivera Navarrete", "Mochumi", "Av. El Ferrocarril Santa Anita")
    const inactiveBeatsActive =
      bestInactive &&
      bestInactive.matchedDistrictOrLocal &&
      (!bestActive ||
        bestInactive.score >= bestActive.score + 35 ||
        (!bestActive.matchedDistrictOrLocal && bestInactive.score >= 110));

    if (inactiveBeatsActive && bestInactive) {
      const cls = this.classifyClosedReason(bestInactive.ag);
      const nearest = this.findNearestActiveAlternatives(bestInactive.ag, activeAgencies, 5);
      const olva = await this.searchOlvaAlternatives(rawDest, 3);
      return {
        status: 'closed_or_disabled',
        isUnambiguousMatch: false,
        resolvedDestination: '',
        matches: nearest,
        closedMatch: {
          agency: bestInactive.ag,
          displayTitle: this.formatAgencyTitle(bestInactive.ag),
          displayAddress: this.cleanAddressText(bestInactive.ag.address || bestInactive.ag.direccion),
          reason: cls.reason,
          category: cls.category,
          deletedAt: bestInactive.ag.deleted_at || null,
          deletedAtFormatted: this.formatChangeDatePeru(bestInactive.ag.deleted_at),
        },
        nearestAlternatives: nearest,
        olvaAlternatives: olva,
      };
    }

    // 2. Verificar si realmente NO hay agencia Shalom en la localidad solicitada
    //    (ej: ningún match activo, o solo coincidió una palabra genérica como "Pueblo" / "San" / "Villa" en una consulta de varias palabras)
    const noRealActiveMatch =
      !bestActive ||
      bestActive.score < 55 ||
      bestActive.matchedNonGenericTokens === 0 ||
      (tokens.length >= 2 && bestActive.matchedTokens / tokens.length < 0.5 && !bestActive.exactCodeMatch) ||
      (tokens.length >= 2 && bestActive.matchedTokens === 1 && !bestActive.matchedDistrictOrLocal && bestActive.score < 80);

    if (noRealActiveMatch) {
      const regionalAlternatives = scoredActive
        .filter(x => x.matchedNonGenericTokens > 0)
        .slice(0, 5)
        .map(x => this.toMatchResult(x.ag, x.score, tokens, fullNormQuery));
      const olva = await this.searchOlvaAlternatives(rawDest, 4);
      return {
        status: 'not_found',
        isUnambiguousMatch: false,
        resolvedDestination: '',
        matches: regionalAlternatives,
        nearestAlternatives: regionalAlternatives,
        olvaAlternatives: olva,
      };
    }

    // 3. Coincidencias activas válidas
    const topMatches = scoredActive
      .slice(0, 8)
      .map(x => this.toMatchResult(x.ag, x.score, tokens, fullNormQuery));

    const first = topMatches[0];
    const second = topMatches.length > 1 ? topMatches[1] : null;

    const isDominant =
      topMatches.length === 1 ||
      bestActive.exactCodeMatch ||
      (first.score >= 135 && (!second || first.score - second.score >= 35));

    if (isDominant) {
      const renameNotice = first.renameNotice || null;
      return {
        status: renameNotice ? 'matched_renamed' : 'matched',
        isUnambiguousMatch: true,
        resolvedDestination: this.formatAgencyDestination(first.agency, cleanDni),
        matches: topMatches,
        topMatch: first,
        renameNotice,
        nearestAlternatives: [],
        olvaAlternatives: [],
      };
    }

    return {
      status: 'ambiguous',
      isUnambiguousMatch: false,
      resolvedDestination: this.formatAgencyDestination(first.agency, cleanDni),
      matches: topMatches,
      topMatch: first,
      nearestAlternatives: topMatches.slice(0, 6),
      olvaAlternatives: [],
    };
  }

  /**
   * Búsqueda general en vivo de agencias Shalom para herramientas del bot (incluye activas, renombradas y cerradas)
   */
  public static async searchAgenciesLive(query: string, limit: number = 8): Promise<{
    query: string;
    totalActiveCatalog: number;
    activeMatches: Array<{
      id: number;
      code: string | null;
      title: string;
      name: string;
      address: string;
      schedule: string;
      phone: string;
      department: string;
      province: string;
      district: string;
      renamedRecently?: boolean;
      previousName?: string | null;
      changedAt?: string | null;
      changedAtFormatted?: string | null;
    }>;
    closedOrDisabledMatches: Array<{
      id: number;
      code: string | null;
      title: string;
      name: string;
      address: string;
      reason: string;
      deletedAt?: string | null;
      deletedAtFormatted?: string | null;
      nearestActive: Array<{ title: string; address: string; distanceKm?: number }>;
    }>;
    olvaAlternatives: OlvaAlternative[];
  }> {
    const allAgencies = await this.loadLiveAgencies();
    const activeAgencies = allAgencies.filter(a => a.is_active !== false && !this.isQaOrTest(a));
    const inactiveAgencies = allAgencies.filter(a => a.is_active === false && !this.isQaOrTest(a));

    const tokens = this.extractMeaningfulTokens(query);
    const fullNormQuery = this.normalize(query)
      .replace(/^(?:AGENCIA|SHALOM|PARA|DESTINO|SEDE|SUCURSAL)\s+/gi, '')
      .trim();

    const activeMatches = activeAgencies
      .map(ag => ({ ag, ...this.scoreAgencyDetailed(ag, tokens, fullNormQuery) }))
      .filter(x => x.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => {
        const rename = this.buildRenameNotice(x.ag, tokens, fullNormQuery);
        return {
          id: Number(x.ag.id),
          code: x.ag.code || null,
          title: this.formatAgencyTitle(x.ag),
          name: x.ag.name || x.ag.nombre || '',
          address: this.cleanAddressText(x.ag.address || x.ag.direccion),
          schedule: x.ag.schedule || x.ag.horario || '',
          phone: x.ag.phone || x.ag.telefono || '(01) 500-7878',
          department: x.ag.department || x.ag.departamento || '',
          province: x.ag.province || x.ag.provincia || '',
          district: x.ag.district || x.ag.distrito || '',
          renamedRecently: Boolean(rename),
          previousName: rename ? rename.previousName : null,
          changedAt: rename ? rename.changedAt : null,
          changedAtFormatted: rename ? rename.changedAtFormatted : null,
        };
      });

    const closedMatches = inactiveAgencies
      .map(ag => ({ ag, ...this.scoreAgencyDetailed(ag, tokens, fullNormQuery) }))
      .filter(x => x.score >= 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => {
        const cls = this.classifyClosedReason(x.ag);
        const nearest = this.findNearestActiveAlternatives(x.ag, activeAgencies, 3).map(n => ({
          title: n.displayTitle,
          address: n.displayAddress,
          distanceKm: n.distanceKm,
        }));
        return {
          id: Number(x.ag.id),
          code: x.ag.code || null,
          title: this.formatAgencyTitle(x.ag),
          name: x.ag.name || x.ag.nombre || '',
          address: this.cleanAddressText(x.ag.address || x.ag.direccion),
          reason: cls.reason,
          deletedAt: x.ag.deleted_at || null,
          deletedAtFormatted: this.formatChangeDatePeru(x.ag.deleted_at),
          nearestActive: nearest,
        };
      });

    const olvaAlternatives = activeMatches.length === 0 ? await this.searchOlvaAlternatives(query, 4) : [];

    return {
      query,
      totalActiveCatalog: activeAgencies.length,
      activeMatches,
      closedOrDisabledMatches: closedMatches,
      olvaAlternatives,
    };
  }

  /**
   * Obtiene el resumen de cambios recientes en agencias Shalom directamente desde Supabase
   */
  public static async getRecentAgencyChanges(): Promise<{
    totalActive: number;
    totalClosedRecent30d: number;
    totalRenamedRecent30d: number;
    renamedAgencies: Array<{ id: number; code: string | null; previousName: string; currentName: string; address: string; changedAt: string | null; changedAtFormatted: string | null }>;
    closedRecentAgencies: Array<{ id: number; code: string | null; name: string; address: string; deletedAt: string | null; deletedAtFormatted: string | null }>;
  }> {
    const allAgencies = await this.loadLiveAgencies();
    const nowMs = Date.now();

    const active = allAgencies.filter(a => a.is_active !== false && !this.isQaOrTest(a));
    const renamed = active
      .filter(a => {
        if (!a.previous_name || this.normalize(a.previous_name) === this.normalize(a.name || '')) return false;
        const t = a.name_changed_at ? Date.parse(a.name_changed_at) : 0;
        return !t || nowMs - t <= THIRTY_DAYS_MS;
      })
      .map(a => ({
        id: Number(a.id),
        code: a.code || null,
        previousName: a.previous_name || '',
        currentName: a.name || a.nombre || '',
        address: this.cleanAddressText(a.address || a.direccion),
        changedAt: a.name_changed_at || null,
        changedAtFormatted: this.formatChangeDatePeru(a.name_changed_at),
      }));

    const closedRecent = allAgencies
      .filter(a => {
        if (a.is_active !== false || this.isQaOrTest(a)) return false;
        const t = a.deleted_at ? Date.parse(a.deleted_at) : 0;
        return Boolean(t && nowMs - t <= THIRTY_DAYS_MS);
      })
      .map(a => ({
        id: Number(a.id),
        code: a.code || null,
        name: a.name || a.nombre || '',
        address: this.cleanAddressText(a.address || a.direccion),
        deletedAt: a.deleted_at || null,
        deletedAtFormatted: this.formatChangeDatePeru(a.deleted_at),
      }));

    return {
      totalActive: active.length,
      totalClosedRecent30d: closedRecent.length,
      totalRenamedRecent30d: renamed.length,
      renamedAgencies: renamed,
      closedRecentAgencies: closedRecent,
    };
  }

  // -------------------------------------------------------------------------
  // Compatibilidad síncrona hacia atrás (usa caché live si ya está cargada)
  // -------------------------------------------------------------------------
  public static findMatchingAgencies(destinationInput: string, limit: number = 6): ShalomMatchResult[] {
    const rawDest = (destinationInput || '').trim();
    if (!rawDest) return [];

    const pool = (this.liveAgenciesCache || this.staticAgencies).filter(a => a.is_active !== false && !this.isQaOrTest(a));
    const tokens = this.extractMeaningfulTokens(rawDest);
    const fullNormQuery = this.normalize(rawDest)
      .replace(/^(?:AGENCIA|SHALOM|PARA|DESTINO|SEDE|SUCURSAL)\s+/gi, '')
      .trim();

    if (tokens.length === 0 && fullNormQuery.length < 2) return [];

    return pool
      .map(ag => ({ ag, ...this.scoreAgencyDetailed(ag, tokens, fullNormQuery) }))
      .filter(x => x.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => this.toMatchResult(x.ag, x.score, tokens, fullNormQuery));
  }

  public static resolveDestination(destinationInput: string, dni: string): {
    isUnambiguousMatch: boolean;
    resolvedDestination: string;
    matches: ShalomMatchResult[];
    topMatch?: ShalomMatchResult;
  } {
    const cleanDni = (dni || '').replace(/[^0-9A-Za-z]/g, '').trim();
    const rawDest = (destinationInput || '').trim();

    if (rawDest.toUpperCase().includes('AGENCIA SHALOM:') && rawDest.includes('DNI/CE Recojo:')) {
      return { isUnambiguousMatch: true, resolvedDestination: rawDest, matches: [] };
    }

    const matches = this.findMatchingAgencies(destinationInput, 8);
    if (matches.length === 0) {
      return { isUnambiguousMatch: false, resolvedDestination: '', matches: [] };
    }

    const first = matches[0];
    const second = matches.length > 1 ? matches[1] : null;
    const isDominant =
      matches.length === 1 ||
      first.score >= 220 ||
      (first.score >= 140 && (!second || first.score - second.score >= 40));

    return {
      isUnambiguousMatch: isDominant,
      resolvedDestination: this.formatAgencyDestination(first.agency, cleanDni),
      matches,
      topMatch: first,
    };
  }
}
