import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// MICROSERVICIO BACKEND — CONSULTA DNI PERUANO CON CACHÉ SUPABASE
// GET /api/dni/[numero]
// Respuesta: { success, nombreCompleto, fuente: "cache" | "live" }
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const TIMEOUT_MS = 2500;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ----------------------------------------------------------------------------
// UTILIDADES
// ----------------------------------------------------------------------------

function normalizarNombre(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

// ----------------------------------------------------------------------------
// FUENTE 1: SIS MINSA — Portal Asegurados Gratuito
// ----------------------------------------------------------------------------

async function scrapeSIS(dni: string): Promise<string | null> {
  try {
    const url = `http://app.sis.gob.pe/SisConsultaEnLinea/Consulta/jsonConsulta.aspx?dni=${dni}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'http://app.sis.gob.pe/SisConsultaEnLinea/',
      },
    });

    if (!res.ok) return null;
    const text = await res.text();

    // Intentar JSON primero
    try {
      const data = JSON.parse(text);
      // Estructuras posibles del SIS
      const nombre =
        data?.nombre_completo ||
        data?.nombre ||
        data?.data?.nombre_completo ||
        (data?.nombres && data?.apellido_paterno
          ? `${data.apellido_paterno} ${data.apellido_materno || ''} ${data.nombres}`.trim()
          : null);
      if (nombre && nombre.length > 3) return normalizarNombre(nombre);
    } catch {
      // No es JSON, probar HTML/texto
    }

    // Regex sobre el texto HTML/plano
    const patterns = [
      /(?:nombre[^:]*:?\s*)([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,60})/i,
      /"nombre_completo"\s*:\s*"([^"]{5,80})"/i,
      /"nombres"\s*:\s*"([^"]{3,40})[^"]*"[^}]*"apellido_paterno"\s*:\s*"([^"]{3,30})"/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        return normalizarNombre(match[1]);
      }
    }
  } catch {
    // timeout o red caída
  }
  return null;
}

// ----------------------------------------------------------------------------
// FUENTE 2: EsSalud — Afiliados (REST informal)
// ----------------------------------------------------------------------------

async function scrapeEsSalud(dni: string): Promise<string | null> {
  try {
    const url = `http://ww4.essalud.gob.pe:8080/sispa/PrSaafObtenerDatosAfiliado.do`;
    const body = new URLSearchParams({
      cDniPasaporte: dni,
      cboTipoDocumento: '01',
      aceptar: 'Buscar',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'http://ww4.essalud.gob.pe',
        'Referer': 'http://ww4.essalud.gob.pe:8080/sispa/',
      },
      body: body.toString(),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Extraer nombre del HTML de respuesta de EsSalud
    const patterns = [
      /APELLIDOS Y NOMBRES[^:]*:?\s*<[^>]*>\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ,\s]{5,80})/i,
      /nombre[^"]*">\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,70})\s*</i,
      /<td[^>]*>\s*([A-ZÁÉÍÓÚÜÑ]{2,}\s+[A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,})?)\s*<\/td>/,
    ];

    for (const pat of patterns) {
      const match = html.match(pat);
      if (match && match[1] && match[1].length > 5) {
        const candidate = normalizarNombre(match[1]);
        if (candidate && !/APELLIDOS|NOMBRES|DATOS|AFILIADO/i.test(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // timeout o red caída
  }
  return null;
}

// ----------------------------------------------------------------------------
// FUENTE 3: MIDIS / Mi Peru — Portal social público
// ----------------------------------------------------------------------------

async function scrapeMIDIS(dni: string): Promise<string | null> {
  try {
    const url = `https://www.midis.gob.pe/index.php/es/infosisbec/infoBecas?p=${dni}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/(?:nombre|beneficiario)[^:]*:?\s*<[^>]*>\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s,]{6,70})\s*</i);
    if (match && match[1]) {
      return normalizarNombre(match[1]);
    }
  } catch {
    // timeout
  }
  return null;
}

// ----------------------------------------------------------------------------
// FUENTE 4: SUNAT (RUC-11 = DNI) — algunos DNI aparecen como contribuyentes
// ----------------------------------------------------------------------------

async function scrapeSUNATbyDNI(dni: string): Promise<string | null> {
  try {
    // SUNAT tiene personas naturales como contribuyentes — buscamos RUC = "10" + DNI
    const ruc = `10${dni}`;
    const url = `https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${ruc}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://e-consultaruc.sunat.gob.pe/',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Nombre en la tabla de SUNAT
    const match = html.match(/(?:Nombre|Apellidos y Nombres)[^<]*<[^>]*>\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s,]{6,80})\s*</i);
    if (match && match[1]) {
      const candidate = normalizarNombre(match[1].replace(/,/g, ' '));
      if (candidate.length > 5 && !/RAZON SOCIAL|RUC/i.test(candidate)) {
        return candidate;
      }
    }
  } catch {
    // timeout
  }
  return null;
}

// ----------------------------------------------------------------------------
// PIPELINE PRINCIPAL: CACHÉ → SCRAPERS EN CASCADA
// ----------------------------------------------------------------------------

async function resolverDNI(dni: string): Promise<{ nombreCompleto: string; fuente: string } | null> {
  // FASE 1: Caché Supabase (< 10 ms)
  try {
    const { data: cached } = await supabase
      .from('dni_cache')
      .select('nombre_completo, fuente')
      .eq('numero_doc', dni)
      .maybeSingle();

    if (cached?.nombre_completo) {
      // Incrementar contador de consultas en background
      supabase
        .from('dni_cache')
        .update({ consultas: (cached as any).consultas + 1 })
        .eq('numero_doc', dni)
        .then(() => {});

      return { nombreCompleto: cached.nombre_completo, fuente: 'cache' };
    }
  } catch {
    // Continuar aunque falle la caché
  }

  // FASE 2: Scrapers en cascada con timeout global
  const scrapers: Array<[string, (d: string) => Promise<string | null>]> = [
    ['sunat', scrapeSUNATbyDNI],
    ['sis', scrapeSIS],
    ['essalud', scrapeEsSalud],
    ['midis', scrapeMIDIS],
  ];

  let nombreEncontrado: string | null = null;
  let fuenteEncontrada = 'live';

  for (const [nombre, scraper] of scrapers) {
    try {
      const resultado = await withTimeout(scraper(dni), TIMEOUT_MS);
      if (resultado && resultado.length > 4) {
        nombreEncontrado = resultado;
        fuenteEncontrada = nombre;
        break;
      }
    } catch {
      // Siguiente fuente
    }
  }

  if (!nombreEncontrado) return null;

  // FASE 3: Guardar en caché
  try {
    await supabase
      .from('dni_cache')
      .upsert(
        {
          numero_doc: dni,
          nombre_completo: nombreEncontrado,
          fuente: fuenteEncontrada,
          consultas: 1,
        },
        { onConflict: 'numero_doc' }
      );
  } catch {
    // No bloquea si falla el guardado
  }

  return { nombreCompleto: nombreEncontrado, fuente: fuenteEncontrada };
}

// ----------------------------------------------------------------------------
// HANDLER VERCEL
// ----------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — permite peticiones desde la web app y la app móvil Capacitor
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Extraer número de DNI (puede venir como /api/dni/12345678 o /api/dni?numero=12345678)
  const numero = (req.query.numero as string) || (req.url?.split('/').pop()?.split('?')[0] ?? '');

  // Validación: exactamente 8 dígitos numéricos
  if (!numero || !/^\d{8}$/.test(numero)) {
    return res.status(400).json({
      success: false,
      error: 'DNI inválido. Debe tener exactamente 8 dígitos numéricos.',
    });
  }

  try {
    const resultado = await withTimeout(resolverDNI(numero), TIMEOUT_MS + 500);

    if (!resultado) {
      return res.status(404).json({
        success: false,
        error: 'DNI no encontrado en las fuentes públicas disponibles.',
        fuente: 'none',
      });
    }

    return res.status(200).json({
      success: true,
      nombreCompleto: resultado.nombreCompleto,
      fuente: resultado.fuente,
    });
  } catch (err: any) {
    if (err?.message === 'TIMEOUT') {
      return res.status(408).json({
        success: false,
        error: 'Tiempo de espera agotado. Por favor ingresa tu nombre manualmente.',
        fuente: 'timeout',
      });
    }

    console.error('[DNI Lookup Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor.',
    });
  }
}
