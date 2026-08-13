import { supabase } from './supabaseClient';
import { ShalomAgency, ShalomAgencyDB } from '../types/database.types';

export interface ShalomRawAgency {
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

export interface ShalomAPIResponse {
  total?: number;
  count?: number;
  page?: number;
  pages?: number;
  items?: ShalomRawAgency[];
  data?: ShalomRawAgency[];
}

export interface SyncStats {
  totalApiAgencies: number;
  totalPages: number;
  syncedCount: number;
  errorCount: number;
  durationMs: number;
}

/**
 * Normaliza un objeto devuelto por la API oficial de Shalom Perú
 * al formato estructurado de la base de datos con Ubigeo y Nombre Completo.
 */
export function normalizeShalomAgency(raw: ShalomRawAgency): ShalomAgencyDB {
  let scheduleText = 'Lunes a Sábado: 8:00 AM - 8:00 PM';
  if (typeof raw.horario === 'string' && raw.horario.trim()) {
    scheduleText = raw.horario.trim();
  } else if (raw.horario && typeof raw.horario === 'object' && raw.horario.hora_atencion) {
    scheduleText = raw.horario.hora_atencion.trim();
  }

  const department = (raw.departamento || 'LIMA').toUpperCase().trim();
  const province = (raw.provincia || 'LIMA').toUpperCase().trim();
  const district = (raw.distrito || raw.lugar_over || raw.zona || 'CENTRO').toUpperCase().trim();
  const code = raw.abrebiatura || raw.code || null;
  const name = (raw.nombre || '').trim();
  const address = (raw.direccion || '').trim();

  // Ubigeo (6 dígitos)
  let ubigeo: string | null = null;
  if (raw.ubi_id) {
    ubigeo = String(raw.ubi_id).padStart(6, '0');
  } else if (raw.ubigeo) {
    ubigeo = String(raw.ubigeo).padStart(6, '0');
  }

  // Nombre Completo Detallado Normalizado
  const codeTag = code ? ` (CÓDIGO: ${code})` : '';
  const fullName = `${department} / ${province} / ${district} / ${name}${address ? ` - ${address}` : ''}${codeTag}`.toUpperCase();

  return {
    id: raw.id,
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
    updated_at: new Date().toISOString()
  };
}

/**
 * Servicio de sincronización e ingesta de agencias Shalom
 */
export async function syncShalomAgenciesCatalog(options?: {
  apiKey?: string;
  apiUrl?: string;
  perPage?: number;
  delayMs?: number;
  onProgress?: (current: number, total: number, page: number, totalPages: number) => void;
}): Promise<SyncStats> {
  const startTime = Date.now();
  const getEnv = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
      return (import.meta as any).env[key];
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.[key]) {
      return (globalThis as any).process.env[key];
    }
    return undefined;
  };

  const apiKey = options?.apiKey || 
    getEnv('SHALOM_API_KEY') || 
    getEnv('VITE_SHALOM_API_KEY') || 
    'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';

  const baseUrl = (
    options?.apiUrl || 
    getEnv('SHALOM_API_URL') || 
    getEnv('VITE_SHALOM_API_URL') || 
    'https://api.shalom-api-peru.com'
  ).replace(/\/+$/, '');

  const perPage = options?.perPage || 50;
  const delayMs = options?.delayMs ?? 500;

  let allRawAgencies: ShalomRawAgency[] = [];
  let page = 1;
  let hasMore = true;

  console.log('🔄 Iniciando ingesta dinámica de agencias Shalom...');

  while (hasMore) {
    const pageUrl = `${baseUrl}/v1/agencies?page=${page}&per_page=${perPage}`;
    console.log(`📥 Solicitando Página ${page}...`);

    try {
      const res = await fetch(pageUrl, {
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'Incomi-Shalom-Sync/1.0'
        }
      });

      if (!res.ok) {
        console.error(`❌ Error en Página ${page}: ${res.status} ${res.statusText}`);
        break;
      }

      const json = await res.json();
      // Extraer array sin importar si viene en items, data o directamente en el root
      const items: ShalomRawAgency[] = Array.isArray(json) 
        ? json 
        : (json.items || json.data || []);

      if (!items || items.length === 0) {
        console.log(`🏁 No hay más agencias en la página ${page}. Finalizando bucle.`);
        hasMore = false;
      } else {
        allRawAgencies = [...allRawAgencies, ...items];
        console.log(`✅ Página ${page} procesada: +${items.length} agencias (Acumulado: ${allRawAgencies.length})`);

        if (options?.onProgress) {
          options.onProgress(allRawAgencies.length, json.total || allRawAgencies.length, page, json.pages || page);
        }

        // Si devolvió menos elementos que perPage, alcanzamos la última página
        if (items.length < perPage) {
          hasMore = false;
        } else {
          page++;
          // Pausa de 500ms para no superar el Rate Limit (60 req/min)
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error de red en página ${page}:`, err);
      break;
    }
  }

  console.log(`🎉 Ingesta completada con éxito. Total descargado: ${allRawAgencies.length} agencias.`);

  // 3. Normalizar y guardar en Supabase si está disponible
  let syncedCount = 0;
  let errorCount = 0;

  if (supabase) {
    console.log('💾 Guardando agencias en base de datos PostgreSQL (Supabase)...');
    const normalizedAgencies = allRawAgencies.map(normalizeShalomAgency);

    // Inserción en lotes de 100
    const batchSize = 100;
    for (let i = 0; i < normalizedAgencies.length; i += batchSize) {
      const batch = normalizedAgencies.slice(i, i + batchSize);
      const { error } = await supabase
        .from('shalom_agencies')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error al insertar lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        syncedCount += batch.length;
      }
    }
    console.log(`✨ Ingesta en Supabase completada: ${syncedCount} guardadas, ${errorCount} errores.`);
  } else {
    console.log('ℹ️ Supabase no está configurado directamente en este entorno; datos listos en memoria.');
    syncedCount = allRawAgencies.length;
  }

  const durationMs = Date.now() - startTime;
  return {
    totalApiAgencies: allRawAgencies.length,
    totalPages: page,
    syncedCount,
    errorCount,
    durationMs
  };
}

/**
 * Consulta las agencias más cercanas por GPS mediante la función RPC PostGIS de Supabase
 */
export async function getNearbyAgenciesFromDB(
  userLat: number,
  userLng: number,
  limit: number = 10
): Promise<ShalomAgency[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_nearby_shalom_agencies', {
      user_lat: userLat,
      user_lng: userLng,
      max_limit: limit
    });

    if (error) {
      console.error('Error en RPC get_nearby_shalom_agencies:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      nombre: row.name,
      departamento: row.department,
      provincia: row.province,
      distrito: row.district,
      direccion: row.address,
      telefono: row.phone,
      horario: row.schedule,
      latitude: row.latitude,
      longitude: row.longitude,
      distance_meters: row.distance_meters
    }));
  } catch (err) {
    console.error('Error al consultar agencias cercanas:', err);
    return [];
  }
}
