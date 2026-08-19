/**
 * Script de prueba CLI para el servicio de consulta de DNI
 * Uso: node scripts/test_dni_lookup.mjs [dni]
 * Ejemplo: node scripts/test_dni_lookup.mjs 74561234
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Cargar .env manualmente si no está presente en process.env
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://uwmdjsxwetjvsxsdngko.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const TIMEOUT_MS = 2500;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

function normalizarNombre(raw) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Consulta SUNAT (personas naturales: RUC = "10" + DNI)
async function scrapeSUNATbyDNI(dni) {
  try {
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

    const match = html.match(/(?:Nombre|Apellidos y Nombres)[^<]*<[^>]*>\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s,]{6,80})\s*</i);
    if (match && match[1]) {
      const candidate = normalizarNombre(match[1].replace(/,/g, ' '));
      if (candidate.length > 5 && !/RAZON SOCIAL|RUC/i.test(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Consulta SIS MINSA
async function scrapeSIS(dni) {
  try {
    const url = `http://app.sis.gob.pe/SisConsultaEnLinea/Consulta/jsonConsulta.aspx?dni=${dni}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'http://app.sis.gob.pe/SisConsultaEnLinea/',
      },
    });

    if (!res.ok) return null;
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      const nombre =
        data?.nombre_completo ||
        data?.nombre ||
        (data?.apellido_paterno ? `${data.apellido_paterno} ${data.apellido_materno || ''} ${data.nombres || ''}` : null);
      if (nombre && nombre.trim().length > 3) return normalizarNombre(nombre.trim());
    } catch {}

    const pat = /(?:nombre[^:]*:?\s*)([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,60})/i;
    const match = text.match(pat);
    if (match && match[1]) return normalizarNombre(match[1]);
    return null;
  } catch (e) {
    return null;
  }
}

async function testDniLookup(dni) {
  console.log(`\n=== PROBANDO DNI: ${dni} ===\n`);

  // Paso 1: Caché
  console.log('📦 Paso 1: Verificando caché Supabase...');
  const t1 = Date.now();
  const { data: cached } = await supabase
    .from('dni_cache')
    .select('nombre_completo, fuente')
    .eq('numero_doc', dni)
    .maybeSingle();

  if (cached) {
    console.log(`✅ EN CACHÉ (${Date.now() - t1}ms): ${cached.nombre_completo} [fuente: ${cached.fuente}]`);
    return;
  }
  console.log(`❌ No está en caché (${Date.now() - t1}ms)`);

  // Paso 2: SUNAT
  console.log('\n🔍 Paso 2: Consultando SUNAT (RUC 10+DNI)...');
  const t2 = Date.now();
  const sunatResult = await withTimeout(scrapeSUNATbyDNI(dni), TIMEOUT_MS).catch(() => null);
  console.log(`SUNAT (${Date.now() - t2}ms): ${sunatResult || 'No encontrado'}`);

  if (sunatResult) {
    console.log('\n💾 Guardando en caché...');
    const { error } = await supabase
      .from('dni_cache')
      .upsert({ numero_doc: dni, nombre_completo: sunatResult, fuente: 'sunat', consultas: 1 }, { onConflict: 'numero_doc' });
    console.log(error ? `❌ Error guardando: ${error.message}` : '✅ Guardado en caché exitosamente');
    console.log(`\n🎉 RESULTADO: ${sunatResult} [sunat]`);
    return;
  }

  // Paso 3: SIS
  console.log('\n🔍 Paso 3: Consultando SIS MINSA...');
  const t3 = Date.now();
  const sisResult = await withTimeout(scrapeSIS(dni), TIMEOUT_MS).catch(() => null);
  console.log(`SIS (${Date.now() - t3}ms): ${sisResult || 'No encontrado'}`);

  if (sisResult) {
    await supabase
      .from('dni_cache')
      .upsert({ numero_doc: dni, nombre_completo: sisResult, fuente: 'sis', consultas: 1 }, { onConflict: 'numero_doc' });
    console.log(`\n🎉 RESULTADO: ${sisResult} [sis]`);
    return;
  }

  console.log('\n⚠️  DNI no encontrado en ninguna fuente.');
  console.log('   El usuario puede ingresar su nombre manualmente.');
}

// Ejecutar
const dni = process.argv[2] || '74561234';
if (!/^\d{8}$/.test(dni)) {
  console.error('❌ Error: el DNI debe tener exactamente 8 dígitos. Ejemplo: node scripts/test_dni_lookup.mjs 74561234');
  process.exit(1);
}

testDniLookup(dni).catch(console.error);
