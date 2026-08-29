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
      const response = await fetch(`${getApiBaseUrl()}/api/dni/${cleanDni}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: DniLookupResult = await response.json();
      const endTime = performance.now();
      result.latencyMs = Number((endTime - startTime).toFixed(1));

      if (result.success && result.data?.nombreCompleto) {
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
