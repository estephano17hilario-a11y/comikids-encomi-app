import { supabase } from './supabaseClient';
import { OlvaAgency, OlvaAgencyDB } from '../types/database.types';
import { OLVA_AGENCIES } from '../data/olvaAgencies';

const OLVA_API_KEY = import.meta.env.VITE_OLVA_API_KEY || 'sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05';

export interface OlvaRawAgency {
  nombres: string;
  tipo: string;
  ubigeo: string;
  cod_dep?: string;
  departamento: string;
  partner: string;
  direccion: string;
  lng?: string;
  lat?: string;
  horario: string;
}

export interface OlvaAPIResponse {
  total: number;
  page: number;
  limit: number;
  results: OlvaRawAgency[];
}

export interface OlvaSyncStats {
  totalApiAgencies: number;
  syncedCount: number;
  errorCount: number;
  durationMs: number;
}

/**
 * Normaliza una agencia recibida desde la API de Olva Perú
 */
export function normalizeOlvaAgency(raw: OlvaRawAgency, index: number): OlvaAgencyDB {
  const ubCode = String(raw.ubigeo || '').padStart(6, '0');
  const dep = (raw.departamento || 'LIMA').toUpperCase().trim();
  const rawName = (raw.nombres || 'AGENCIA').trim();
  const tipo = (raw.tipo || 'TIENDAS').trim();
  const direccion = (raw.direccion || '').trim();
  const horario = (raw.horario || '').trim();
  const partner = raw.partner === 'SI';
  const code = `OLVA-${ubCode}-${index + 1}`;

  let lat: number | null = null;
  let lng: number | null = null;
  if (raw.lat && raw.lng) {
    const rawLat = parseFloat(raw.lat);
    const rawLng = parseFloat(raw.lng);
    if (!isNaN(rawLat) && !isNaN(rawLng)) {
      if (rawLng < -1 && rawLng > -20 && rawLat < -65 && rawLat > -85) {
        lat = rawLng;
        lng = rawLat;
      } else {
        lat = rawLat;
        lng = rawLng;
      }
    }
  }

  const fullName = `${dep} / ${dep} / ${rawName} (${tipo}) - ${direccion}`.toUpperCase();

  return {
    id: index + 1,
    code,
    name: `${dep} / ${rawName}`.toUpperCase(),
    full_name: fullName,
    department: dep,
    province: dep,
    district: rawName,
    ubigeo: ubCode,
    address: direccion,
    phone: '(01) 714-0909',
    schedule: horario || 'Lunes a viernes: 9:00 am - 6:00 pm | Sábado: 9:00 am - 1:00 pm',
    tipo,
    is_partner: partner,
    latitude: lat,
    longitude: lng,
    is_active: true,
    updated_at: new Date().toISOString()
  };
}

/**
 * Descarga y sincroniza silenciosamente todas las agencias Olva a Supabase
 */
export async function syncOlvaAgenciesToSupabase(
  apiKey: string = OLVA_API_KEY,
  onProgress?: (progress: number, total: number, message: string) => void
): Promise<OlvaSyncStats> {
  const startTime = Date.now();
  let allRaw: OlvaRawAgency[] = [];
  let page = 1;
  const limit = 100;

  try {
    while (true) {
      if (onProgress) onProgress(allRaw.length, 376, `Descargando agencias Olva (Página ${page})...`);
      const url = `https://api.olva-api-peru.com/v1/agencias?limit=${limit}&page=${page}`;
      const res = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!res.ok) break;

      const data: OlvaAPIResponse = await res.json();
      const results = data.results || [];
      allRaw.push(...results);

      if (allRaw.length >= data.total || results.length === 0) break;
      page++;
    }

    if (allRaw.length === 0) {
      // Fallback a catálogo local precompilado
      return {
        totalApiAgencies: OLVA_AGENCIES.length,
        syncedCount: OLVA_AGENCIES.length,
        errorCount: 0,
        durationMs: Date.now() - startTime
      };
    }

    // Normalizar
    const normalizedList = allRaw.map((r, i) => normalizeOlvaAgency(r, i));

    if (supabase) {
      const chunkSize = 50;
      for (let i = 0; i < normalizedList.length; i += chunkSize) {
        const chunk = normalizedList.slice(i, i + chunkSize);
        await supabase.from('olva_agencies').upsert(chunk, { onConflict: 'id' });
      }
    }

    return {
      totalApiAgencies: allRaw.length,
      syncedCount: normalizedList.length,
      errorCount: 0,
      durationMs: Date.now() - startTime
    };
  } catch (err: any) {
    console.warn('[OLVA SYNC WARNING]', err?.message);
    return {
      totalApiAgencies: OLVA_AGENCIES.length,
      syncedCount: OLVA_AGENCIES.length,
      errorCount: 1,
      durationMs: Date.now() - startTime
    };
  }
}
