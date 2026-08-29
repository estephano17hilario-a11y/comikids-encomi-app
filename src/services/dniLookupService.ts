/**
 * Servicio frontend para consulta de DNI peruano
 * Llama al endpoint /api/dni/[numero] del backend (Vercel Serverless)
 * con caché en Supabase y scraping en cascada de portales públicos.
 *
 * NUNCA llama directamente a los portales estatales (evita CORS).
 */

import { DniService } from './dniService';

export interface DniLookupResult {
  success: boolean;
  nombreCompleto?: string;
  fuente?: 'cache' | 'live' | 'sunat' | 'sis' | 'essalud' | 'midis' | 'timeout' | 'none';
  error?: string;
}

/**
 * Consulta el nombre completo de un DNI peruano mediante el microservicio de SUNAT (<1ms).
 *
 * @param dni - 8 dígitos numéricos
 * @returns DniLookupResult con nombreCompleto si se encontró
 */
export async function lookupDni(dni: string): Promise<DniLookupResult> {
  const cleanDni = String(dni || '').replace(/\D/g, '').trim();
  if (cleanDni.length !== 8) {
    return { success: false, error: 'DNI inválido' };
  }

  try {
    const res = await DniService.lookupByDni(cleanDni);
    if (res.success && res.data?.nombreCompleto) {
      return {
        success: true,
        nombreCompleto: res.data.nombreCompleto,
        fuente: 'sunat',
      };
    }

    return {
      success: false,
      fuente: 'none',
      error: res.message || 'DNI no encontrado',
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'No se pudo conectar con el servidor de consulta.',
    };
  }
}

/**
 * Etiquetas amigables por fuente de la respuesta
 */
export function getFuenteLabel(fuente?: DniLookupResult['fuente']): string {
  const labels: Record<string, string> = {
    cache: '⚡ Cargado al instante',
    sunat: '✓ Verificado por SUNAT',
    sis: '✓ Verificado por SIS MINSA',
    essalud: '✓ Verificado por EsSalud',
    midis: '✓ Verificado por MIDIS',
    live: '✓ Verificado en tiempo real',
    timeout: '⏱ Sin respuesta del servidor',
    none: '❌ No encontrado',
  };
  return fuente ? (labels[fuente] ?? '✓ Verificado') : '';
}
