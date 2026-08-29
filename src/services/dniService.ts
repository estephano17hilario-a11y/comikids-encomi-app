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

/**
 * Servicio de autocompletado de nombre legal por DNI (< 1ms en backend)
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

    try {
      const startTime = performance.now();
      let baseUrl = getApiBaseUrl().replace(/\/+$/, '');
      
      // Manejar correctamente proxy Vercel (/api/proxy) y backend directo (.../api)
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
        });
      } catch (fetchErr) {
        // Si el proxy falla en HTTPS, intentar llamada directa como fallback
        console.warn('[DNI SERVICE PROXY FAIL, TRYING DIRECT]', fetchErr);
        response = await fetch(`http://89.117.73.97:3000/api/dni/${cleanDni}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result: DniLookupResult = await response.json();
      const endTime = performance.now();
      result.latencyMs = Number((endTime - startTime).toFixed(1));

      if (result.success && result.data?.nombreCompleto) {
        result.data.nombreCompleto = formatSunatNameToGivenFirst(result.data.nombreCompleto);
        console.log(`[DNI SERVICE RESOLVED] ${cleanDni} -> ${result.data.nombreCompleto} (${result.latencyMs}ms)`);
        // Guardar en caché local
        dniMemoryCache.set(cleanDni, result);
      }

      return result;
    } catch (err: any) {
      console.warn('[DNI SERVICE ERROR]', err?.message);
      return {
        success: false,
        message: 'No se pudo conectar con el servicio de consulta de DNI.',
      };
    }
  }
}
