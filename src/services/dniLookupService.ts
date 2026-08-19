/**
 * Servicio frontend para consulta de DNI peruano
 * Llama al endpoint /api/dni/[numero] del backend (Vercel Serverless)
 * con caché en Supabase y scraping en cascada de portales públicos.
 *
 * NUNCA llama directamente a los portales estatales (evita CORS).
 */

export interface DniLookupResult {
  success: boolean;
  nombreCompleto?: string;
  fuente?: 'cache' | 'live' | 'sunat' | 'sis' | 'essalud' | 'midis' | 'timeout' | 'none';
  error?: string;
}

const LOOKUP_TIMEOUT_MS = 3500;

/**
 * Detecta si estamos en producción (Vercel), desarrollo local (Vite) o Capacitor móvil.
 * El endpoint siempre es relativo para que funcione en cualquier entorno.
 */
function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    // Capacitor app (file://) → usar la URL de producción Vercel
    if (origin.startsWith('file://') || origin === 'capacitor://localhost') {
      return import.meta.env.VITE_API_BASE_URL || 'https://incomi-app.vercel.app';
    }
    return origin;
  }
  return '';
}

/**
 * Consulta el nombre completo de un DNI peruano.
 *
 * @param dni - 8 dígitos numéricos
 * @returns DniLookupResult con nombreCompleto si se encontró
 *
 * @example
 * const result = await lookupDni('74561234');
 * if (result.success) {
 *   console.log(result.nombreCompleto); // "GARCIA PEREZ JUAN"
 *   console.log(result.fuente);         // "cache" | "sunat" | "sis" ...
 * }
 */
export async function lookupDni(dni: string): Promise<DniLookupResult> {
  // Validación defensiva en cliente
  if (!dni || !/^\d{8}$/.test(dni.trim())) {
    return { success: false, error: 'DNI inválido' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/dni/${dni.trim()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    return data as DniLookupResult;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        success: false,
        fuente: 'timeout',
        error: 'Tiempo de espera agotado. Puedes ingresar tu nombre manualmente.',
      };
    }
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
