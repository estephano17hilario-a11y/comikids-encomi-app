import { getApiBaseUrl } from '../config/api';

export interface DniLookupResult {
  success: boolean;
  data?: {
    dni: string;
    ruc: string;
    nombreCompleto: string;
    estado?: string;
    condicion?: string;
    ubigeo?: string;
    direccion?: string;
  };
  message?: string;
  source?: 'sunat_padron_local' | 'database_history' | 'cache';
  latencyMs?: number;
}

// Cache local en memoria para resolución instantánea en 0ms
const dniMemoryCache = new Map<string, DniLookupResult>();

/**
 * Reordena nombres de SUNAT (APELLIDOS NOMBRES) a formato estándar de cliente (NOMBRES APELLIDOS)
 */
export function formatSunatNameToGivenFirst(rawName: string): string {
  if (!rawName) return '';
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return rawName.trim();

  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }

  if (parts.length === 3) {
    if (['DE', 'DEL', 'SAN', 'SANTA'].includes(parts[0].toUpperCase())) {
      return `${parts[2]} ${parts[0]} ${parts[1]}`;
    }
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  }

  if (parts.length === 4) {
    if (['DE', 'DEL', 'SAN', 'SANTA'].includes(parts[0].toUpperCase())) {
      return `${parts[3]} ${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[2]} ${parts[3]} ${parts[0]} ${parts[1]}`;
  }

  const surnames = parts.slice(0, 2);
  const givenNames = parts.slice(2);
  return `${givenNames.join(' ')} ${surnames.join(' ')}`;
}

import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Servicio de autocompletado de nombre legal por DNI (< 1ms en backend, fallback en Supabase y local)
 */
export class DniService {
  /**
   * Consulta el nombre legal completo por DNI (8 dígitos)
   */
  public static async lookupByDni(dni: string): Promise<DniLookupResult> {
    const cleanDni = String(dni || '').replace(/\D/g, '').trim();

    if (cleanDni.length !== 8) {
      return {
        success: false,
        message: 'El DNI debe tener 8 dígitos numéricos.',
      };
    }

    // 1. Revisar caché local en memoria (0ms)
    if (dniMemoryCache.has(cleanDni)) {
      const cached = dniMemoryCache.get(cleanDni)!;
      return {
        ...cached,
        source: 'cache',
      };
    }

    const startTime = performance.now();

    // 2. Revisar usuarios locales en LocalStorage (0ms)
    try {
      const localUsersRaw = localStorage.getItem('incomi_users_v2');
      if (localUsersRaw) {
        const localUsers = JSON.parse(localUsersRaw);
        if (Array.isArray(localUsers)) {
          const matched = localUsers.find((u: any) => 
            (u.dni && u.dni.replace(/\D/g, '') === cleanDni) ||
            (u.dni_default && u.dni_default.replace(/\D/g, '') === cleanDni)
          );
          if (matched && matched.nombre_completo) {
            const formatted = formatSunatNameToGivenFirst(matched.nombre_completo);
            const res: DniLookupResult = {
              success: true,
              source: 'database_history',
              latencyMs: 1,
              data: {
                dni: cleanDni,
                ruc: '10' + cleanDni,
                nombreCompleto: formatted,
                estado: 'ACTIVO',
                condicion: 'HABIDO',
              }
            };
            dniMemoryCache.set(cleanDni, res);
            try { localStorage.setItem('incomi_saved_fullname', formatted); } catch {}
            return res;
          }
        }
      }
    } catch {}

    // 3. Revisar directamente en Supabase usuarios (ultra-rápido ~30ms)
    if (isSupabaseConfigured && supabase) {
      try {
        const sbPromise = supabase
          .from('usuarios')
          .select('nombre_completo, dni, dni_default')
          .or(`dni.eq.${cleanDni},dni_default.eq.${cleanDni}`)
          .limit(1)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null }>((resolve) => 
          setTimeout(() => resolve({ data: null }), 1200)
        );

        const { data: userRow } = await Promise.race([sbPromise, timeoutPromise]) as any;

        if (userRow && userRow.nombre_completo) {
          const formatted = formatSunatNameToGivenFirst(userRow.nombre_completo);
          const endTime = performance.now();
          const latencyMs = Number((endTime - startTime).toFixed(1));
          const res: DniLookupResult = {
            success: true,
            source: 'database_history',
            latencyMs,
            data: {
              dni: cleanDni,
              ruc: '10' + cleanDni,
              nombreCompleto: formatted,
              estado: 'ACTIVO',
              condicion: 'HABIDO',
            }
          };
          dniMemoryCache.set(cleanDni, res);
          try { localStorage.setItem('incomi_saved_fullname', formatted); } catch {}
          console.log(`[DNI SERVICE SUPABASE DIRECT RESOLVED] ${cleanDni} -> ${formatted} (${latencyMs}ms)`);
          return res;
        }
      } catch (sbErr: any) {
        console.warn('[DNI SERVICE SUPABASE LOOKUP WARN]', sbErr?.message);
      }
    }

    // 4. Consultar Backend Microservicio (SQLite padron.db 1.34 GB)
    try {
      let baseUrl = getApiBaseUrl().replace(/\/+$/, '');
      
      let url: string;
      if (baseUrl.includes('/api/proxy') || baseUrl.endsWith('/api')) {
        url = `${baseUrl}/dni/${cleanDni}`;
      } else {
        url = `${baseUrl}/api/dni/${cleanDni}`;
      }

      console.log(`[DNI SERVICE] Consultando DNI: ${cleanDni} en: ${url}`);
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3500),
        });
      } catch (fetchErr) {
        console.warn('[DNI SERVICE PROXY FAIL, TRYING DIRECT]', fetchErr);
        response = await fetch(`http://89.117.73.97:3000/api/dni/${cleanDni}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(3500),
        });
      }

      const result: DniLookupResult = await response.json();
      const endTime = performance.now();
      result.latencyMs = Number((endTime - startTime).toFixed(1));

      if (result.success && result.data?.nombreCompleto) {
        result.data.nombreCompleto = formatSunatNameToGivenFirst(result.data.nombreCompleto);
        console.log(`[DNI SERVICE RESOLVED] ${cleanDni} -> ${result.data.nombreCompleto} (${result.latencyMs}ms)`);
        dniMemoryCache.set(cleanDni, result);
        try { localStorage.setItem('incomi_saved_fullname', result.data.nombreCompleto); } catch {}
        return result;
      }
    } catch (err: any) {
      console.warn('[DNI SERVICE ERROR]', err?.message);
    }

    // 5. Fallback adicional: Buscar en pedidos locales y de Supabase si hubo uno para este DNI
    try {
      const localOrdersRaw = localStorage.getItem('incomi_orders_v2');
      if (localOrdersRaw) {
        const localOrders = JSON.parse(localOrdersRaw);
        if (Array.isArray(localOrders)) {
          const matched = localOrders.find((o: any) =>
            o.destino_detalle?.includes(cleanDni) ||
            o.usuario?.dni === cleanDni ||
            o.usuario?.dni_default === cleanDni
          );
          if (matched && matched.usuario?.nombre_completo) {
            const formatted = formatSunatNameToGivenFirst(matched.usuario.nombre_completo);
            const res: DniLookupResult = {
              success: true,
              source: 'database_history',
              latencyMs: Number((performance.now() - startTime).toFixed(1)),
              data: {
                dni: cleanDni,
                ruc: '10' + cleanDni,
                nombreCompleto: formatted,
              }
            };
            dniMemoryCache.set(cleanDni, res);
            try { localStorage.setItem('incomi_saved_fullname', formatted); } catch {}
            return res;
          }
        }
      }
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: orderMatches } = await supabase
          .from('pedidos')
          .select('destino_detalle, usuario_id')
          .ilike('destino_detalle', `%${cleanDni}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (orderMatches && orderMatches.length > 0 && orderMatches[0].usuario_id) {
          const { data: u } = await supabase
            .from('usuarios')
            .select('nombre_completo')
            .eq('id', orderMatches[0].usuario_id)
            .maybeSingle();

          if (u && u.nombre_completo) {
            const formatted = formatSunatNameToGivenFirst(u.nombre_completo);
            const res: DniLookupResult = {
              success: true,
              source: 'database_history',
              latencyMs: Number((performance.now() - startTime).toFixed(1)),
              data: {
                dni: cleanDni,
                ruc: '10' + cleanDni,
                nombreCompleto: formatted,
              }
            };
            dniMemoryCache.set(cleanDni, res);
            try { localStorage.setItem('incomi_saved_fullname', formatted); } catch {}
            return res;
          }
        }
      } catch {}
    }

    // 6. Consulta directa a RENIEC Padrón Nacional en Vivo (apis.net.pe)
    try {
      const reniecRes = await fetch(`https://api.apis.net.pe/v1/dni?numero=${cleanDni}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (reniecRes.ok) {
        const reniecData: any = await reniecRes.json();
        if (reniecData && (reniecData.nombre || reniecData.nombres)) {
          const given = (reniecData.nombres || '').trim();
          const pat = (reniecData.apellidoPaterno || '').trim();
          const mat = (reniecData.apellidoMaterno || '').trim();
          const fullName = given ? `${given} ${pat} ${mat}`.trim() : formatSunatNameToGivenFirst(reniecData.nombre);

          const endTime = performance.now();
          const latencyMs = Number((endTime - startTime).toFixed(1));
          const res: DniLookupResult = {
            success: true,
            source: 'sunat_padron_local',
            latencyMs,
            data: {
              dni: cleanDni,
              ruc: '10' + cleanDni,
              nombreCompleto: fullName,
              estado: 'ACTIVO',
              condicion: 'HABIDO',
            }
          };
          dniMemoryCache.set(cleanDni, res);
          try { localStorage.setItem('incomi_saved_fullname', fullName); } catch {}
          return res;
        }
      }
    } catch (reniecErr) {
      console.warn('[DNI SERVICE RENIEC FALLBACK WARN]', reniecErr);
    }

    return {
      success: false,
      message: 'No se encontró el nombre para el DNI ingresado.',
    };
  }
}
