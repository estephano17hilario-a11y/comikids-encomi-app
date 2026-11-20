import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Configuración y CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const getArgVal = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const REPORT_MD_PATH = path.resolve(ROOT_DIR, getArgVal('--report-md', 'reports/shalom-sync-latest.md'));
const REPORT_JSON_PATH = path.resolve(ROOT_DIR, getArgVal('--report-json', 'reports/shalom-sync-latest.json'));
const HISTORY_JSON_PATH = path.resolve(ROOT_DIR, 'reports/shalom-sync-history.json');

const envPath = path.resolve(ROOT_DIR, '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      envVars[key.trim()] = rest.join('=').trim();
    }
  });
}

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://api.89.117.73.97.sslip.io').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU';
const SHALOM_API_KEY = process.env.SHALOM_API_KEY || envVars.SHALOM_API_KEY || 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const SHALOM_API_URL = (process.env.SHALOM_API_URL || envVars.SHALOM_API_URL || 'https://api.shalom-api-peru.com').replace(/\/+$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EXPIRED_DELETED_AT = '2025-01-01T00:00:00.000Z';
const MIN_EXPECTED_API_AGENCIES = 400; // Safety guard against truncated API responses

function sameTimestamp(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta === tb;
}

// ---------------------------------------------------------------------------
// 2. Utilidades de limpieza, clasificación y normalización inteligente
// ---------------------------------------------------------------------------
function cleanText(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Decodificar secuencias literales \u00XX que a veces vienen crudas desde Shalom
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Corregir mojibake UTF-8 común (ej. "GRAUÂ\u00a0MZ" -> "GRAU MZ")
  s = s.replace(/Â[\u00a0\s]/g, ' ').replace(/Â/g, '');
  // Reemplazar NBSP y saltos de línea por espacio simple
  s = s.replace(/[\u00a0\r\n\t]+/g, ' ');
  // Corregir "N? 441" o "N?533" -> "N° 441" / "N° 533"
  s = s.replace(/\bN\?\s*(\d)/gi, 'N° $1');
  // Colapsar espacios múltiples y recortar
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function normalizeCompactKey(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isQaOrTestAgency(name, address) {
  const n = cleanText(name).toUpperCase();
  const a = cleanText(address).toUpperCase();
  return (
    /\bPRUEBA\b|PRUEBA[A-Z0-9_]|_PRUEBA|\bTEST\b|PRUEBATEST|\bZZ\s*QA\b|TERMINAL DE PRUEBA|AV\s+PRUEBAS|NO USAR DE PRE?UBA/i.test(n) ||
    /\bPRUEBA\b|PRUEBA_DE_ALMACEN|TERMINAL DE PRUEBA|AV\s+PRUEBAS/i.test(a)
  );
}

function classifyApiAgency(raw) {
  const nameUpper = cleanText(raw.nombre).toUpperCase();
  const addrUpper = cleanText(raw.direccion).toUpperCase();
  const catUpper = cleanText(raw.categoria).toUpperCase();
  const habilitado = raw.habilitado === true;

  if (isQaOrTestAgency(nameUpper, addrUpper)) {
    return {
      status: 'qa_test',
      isActive: false,
      hideImmediately: true,
      reason: 'Terminal de prueba / QA de Shalom'
    };
  }

  if (habilitado) {
    return {
      status: 'active_valid',
      isActive: true,
      hideImmediately: false,
      reason: 'Habilitada y operativa en Shalom'
    };
  }

  // habilitado === false: distinguir por qué no está habilitada
  if (nameUpper.includes('(POR DEFINIR)')) {
    return {
      status: 'unlaunched_por_definir',
      isActive: false,
      hideImmediately: true,
      reason: 'Sede por definir / aún no inaugurada (habilitado=false)'
    };
  }

  if (nameUpper.includes('AEROPUERTO') || nameUpper.includes('APEROPUERTO')) {
    return {
      status: 'airport_internal',
      isActive: false,
      hideImmediately: true,
      reason: 'Terminal aeroportuaria interna (habilitado=false)'
    };
  }

  if (catUpper === 'SOLO ENVÍOS' || catUpper === 'SOLO ENVIOS') {
    return {
      status: 'solo_envios',
      isActive: false,
      hideImmediately: true,
      reason: 'Agencia SOLO ENVÍOS (no habilitada para recojo destino)'
    };
  }

  if (
    nameUpper.includes('CAJA ') ||
    nameUpper.includes('AREA SHALOM') ||
    nameUpper.includes('TALLERES-HUACHIPA') ||
    nameUpper.includes('REPARTO SAN LUIS') ||
    nameUpper.includes('ALMACENES BSF') ||
    nameUpper.includes('PUERTO YURIMAGUAS') ||
    nameUpper.includes('PUERTO IQUITOS')
  ) {
    return {
      status: 'internal_facility',
      isActive: false,
      hideImmediately: true,
      reason: 'Instalación interna / caja / almacén (habilitado=false)'
    };
  }

  return {
    status: 'disabled_real',
    isActive: false,
    hideImmediately: false,
    reason: 'Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false)'
  };
}

function buildFullName(dep, prov, dist, name, address, code) {
  const codeTag = code ? ` (CÓDIGO: ${code})` : '';
  const addrPart = address ? ` - ${address}` : '';
  // Evitar duplicación "LIMA / LIMA / ... / LIMA / LIMA / ..." cuando name ya incluye la jerarquía
  const basePath = name.includes('/') ? name : `${dep} / ${prov} / ${dist} / ${name}`;
  return `${basePath}${addrPart}${codeTag}`.toUpperCase();
}

function normalizeApiItem(raw, nowIso) {
  let scheduleText = 'Lunes a Sábado: 8:00 AM - 8:00 PM';
  if (typeof raw.horario === 'string' && raw.horario.trim()) {
    scheduleText = cleanText(raw.horario);
  } else if (raw.horario && typeof raw.horario === 'object' && raw.horario.hora_atencion) {
    scheduleText = cleanText(raw.horario.hora_atencion);
  }

  const department = cleanText(raw.departamento || 'LIMA').toUpperCase();
  const province = cleanText(raw.provincia || 'LIMA').toUpperCase();
  const district = cleanText(raw.distrito || raw.lugar_over || raw.zona || 'CENTRO').toUpperCase();
  const rawCode = raw.abrebiatura || raw.code || null;
  const code = rawCode ? cleanText(rawCode) : null;
  const name = cleanText(raw.nombre || '');
  const address = cleanText(raw.direccion || '');

  let ubigeo = null;
  if (raw.ubi_id) {
    ubigeo = String(raw.ubi_id).padStart(6, '0');
  } else if (raw.ubigeo) {
    ubigeo = String(raw.ubigeo).padStart(6, '0');
  }

  let phone = cleanText(raw.telefono || '');
  if (!phone || phone.toLowerCase() === 'null' || phone.toLowerCase() === 'none') {
    phone = '(01) 500-7878';
  }

  const fullName = buildFullName(department, province, district, name, address, code);
  const classification = classifyApiAgency(raw);

  const latitude = typeof raw.latitud === 'number' && !Number.isNaN(raw.latitud)
    ? raw.latitud
    : (raw.latitud !== null && raw.latitud !== undefined && !Number.isNaN(Number(raw.latitud)) ? Number(raw.latitud) : null);
  const longitude = typeof raw.longitud === 'number' && !Number.isNaN(raw.longitud)
    ? raw.longitud
    : (raw.longitud !== null && raw.longitud !== undefined && !Number.isNaN(Number(raw.longitud)) ? Number(raw.longitud) : null);

  return {
    id: Number(raw.id),
    code,
    name,
    nombre: name,
    full_name: fullName,
    department,
    departamento: department,
    province,
    provincia: province,
    district,
    distrito: district,
    ubigeo,
    dep_id: typeof raw.dep_id === 'number' ? raw.dep_id : null,
    prov_id: typeof raw.prov_id === 'number' ? raw.prov_id : null,
    dist_id: typeof raw.dist_id === 'number' ? raw.dist_id : null,
    address,
    direccion: address,
    phone,
    telefono: phone,
    schedule: scheduleText,
    horario: scheduleText,
    latitude,
    longitude,
    is_active: classification.isActive,
    updated_at: nowIso,
    previous_name: null,
    previous_address: null,
    previous_agency_info: null,
    name_changed_at: null,
    deleted_at: null,
    _meta: {
      classification: classification.status,
      hideImmediately: classification.hideImmediately,
      reason: classification.reason,
      habilitadoApi: raw.habilitado === true,
      categoriaApi: cleanText(raw.categoria || ''),
      estadoApi: cleanText(raw.estado || '')
    }
  };
}

function fromDbRowToCatalogItem(row) {
  return {
    id: Number(row.id),
    code: row.code ? cleanText(row.code) : null,
    name: cleanText(row.name || ''),
    nombre: cleanText(row.name || ''),
    full_name: cleanText(row.full_name || ''),
    department: cleanText(row.department || 'LIMA').toUpperCase(),
    departamento: cleanText(row.department || 'LIMA').toUpperCase(),
    province: cleanText(row.province || 'LIMA').toUpperCase(),
    provincia: cleanText(row.province || 'LIMA').toUpperCase(),
    district: cleanText(row.district || 'CENTRO').toUpperCase(),
    distrito: cleanText(row.district || 'CENTRO').toUpperCase(),
    ubigeo: row.ubigeo || null,
    dep_id: row.dep_id ?? null,
    prov_id: row.prov_id ?? null,
    dist_id: row.dist_id ?? null,
    address: cleanText(row.address || ''),
    direccion: cleanText(row.address || ''),
    phone: cleanText(row.phone || '(01) 500-7878'),
    telefono: cleanText(row.phone || '(01) 500-7878'),
    schedule: cleanText(row.schedule || 'Lunes a Sábado: 8:00 AM - 8:00 PM'),
    horario: cleanText(row.schedule || 'Lunes a Sábado: 8:00 AM - 8:00 PM'),
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    is_active: row.is_active !== false,
    updated_at: row.updated_at || new Date().toISOString(),
    previous_name: row.previous_name || null,
    previous_address: row.previous_address || null,
    previous_agency_info: row.previous_agency_info || null,
    name_changed_at: row.name_changed_at || null,
    deleted_at: row.deleted_at || null
  };
}

function toDbRow(item) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    full_name: item.full_name,
    department: item.department,
    province: item.province,
    district: item.district,
    ubigeo: item.ubigeo,
    dep_id: item.dep_id,
    prov_id: item.prov_id,
    dist_id: item.dist_id,
    address: item.address,
    phone: item.phone,
    schedule: item.schedule,
    latitude: item.latitude,
    longitude: item.longitude,
    is_active: item.is_active,
    updated_at: item.updated_at,
    previous_name: item.previous_name || null,
    previous_address: item.previous_address || null,
    previous_agency_info: item.previous_agency_info || null,
    name_changed_at: item.name_changed_at || null,
    deleted_at: item.deleted_at || null
  };
}

function stripMeta(item) {
  const { _meta, ...clean } = item;
  return clean;
}

// ---------------------------------------------------------------------------
// 3. Descarga completa paginada desde Shalom API (con reintentos)
// ---------------------------------------------------------------------------
async function fetchAllAgenciesFromApi() {
  let allAgencies = [];
  let page = 1;
  const perPage = 100;
  let expectedTotal = null;

  console.log('🔄 Descargando catálogo completo desde Shalom API...');

  while (true) {
    const url = `${SHALOM_API_URL}/v1/agencies?page=${page}&per_page=${perPage}`;
    let json = null;
    let lastErr = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            'X-API-Key': SHALOM_API_KEY,
            'User-Agent': 'Incomi-AutoSync/2.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(25000)
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        json = await res.json();
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`  ⚠️ Intento ${attempt}/3 falló en página ${page}: ${err.message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }

    if (!json) {
      throw new Error(`No se pudo descargar página ${page} de la API de Shalom: ${lastErr?.message}`);
    }

    const items = Array.isArray(json) ? json : (json.items || json.data || []);
    if (expectedTotal === null && typeof json.total === 'number') {
      expectedTotal = json.total;
    }

    if (!items || items.length === 0) {
      break;
    }

    allAgencies.push(...items);
    console.log(`  ✅ Página ${page}: +${items.length} agencias (acumulado: ${allAgencies.length}${expectedTotal ? `/${expectedTotal}` : ''})`);

    if (items.length < perPage || (expectedTotal !== null && allAgencies.length >= expectedTotal)) {
      break;
    }
    page++;
    await new Promise((r) => setTimeout(r, 350));
  }

  // Deduplicar por ID por seguridad
  const uniqueMap = new Map();
  for (const ag of allAgencies) {
    if (ag && ag.id !== undefined && ag.id !== null) {
      uniqueMap.set(Number(ag.id), ag);
    }
  }
  const uniqueList = Array.from(uniqueMap.values());

  if (uniqueList.length < MIN_EXPECTED_API_AGENCIES) {
    throw new Error(
      `SAFETY GUARD ACTIVADO: La API devolvió solo ${uniqueList.length} agencias (mínimo esperado: ${MIN_EXPECTED_API_AGENCIES}). Se aborta para proteger la BD.`
    );
  }
  if (expectedTotal !== null && uniqueList.length < expectedTotal) {
    throw new Error(
      `SAFETY GUARD ACTIVADO: Descarga incompleta (${uniqueList.length} de ${expectedTotal} reportadas por la API). Se aborta para evitar bajas falsas.`
    );
  }

  return uniqueList;
}

// ---------------------------------------------------------------------------
// 4. Descarga paginada completa de Supabase (>1000 rows safe)
// ---------------------------------------------------------------------------
async function fetchAllDbAgencies() {
  const allRows = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('shalom_agencies')
      .select('id, code, name, full_name, department, province, district, ubigeo, dep_id, prov_id, dist_id, address, phone, schedule, latitude, longitude, is_active, updated_at, previous_name, previous_address, previous_agency_info, name_changed_at, deleted_at')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Error leyendo shalom_agencies de Supabase: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

// ---------------------------------------------------------------------------
// 5. Generación de archivos estáticos + mapas canónicos (src/ y backend/)
// ---------------------------------------------------------------------------
function generateStaticFiles(activeItems, recentClosedRealItems, allDbItemsAfter) {
  const catalogWithVigencia = [...activeItems, ...recentClosedRealItems]
    .map(stripMeta)
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));

  // 5a. data/shalom_agencies_full.json
  fs.mkdirSync(path.resolve(ROOT_DIR, 'data'), { recursive: true });
  fs.writeFileSync(
    path.resolve(ROOT_DIR, 'data/shalom_agencies_full.json'),
    JSON.stringify(catalogWithVigencia, null, 2) + '\n',
    'utf8'
  );

  const deptList = Array.from(new Set(activeItems.map((a) => a.department).filter(Boolean))).sort();
  const departamentosArray = ['TODOS', ...deptList];

  const makeTsCatalog = (importPath) => `// Catálogo Oficial de Agencias Shalom Perú (Sincronizado Automáticamente)
// Activas operativas: ${activeItems.length} | Cerradas recientes (<30d): ${recentClosedRealItems.length}
import { ShalomAgency } from '${importPath}';

export const DEPARTAMENTOS_PERU = ${JSON.stringify(departamentosArray, null, 2)};

export const SHALOM_AGENCIES: ShalomAgency[] = ${JSON.stringify(catalogWithVigencia, null, 2)};
`;

  // 5b. src/data/shalomAgencies.ts & backend/src/data/shalomAgencies.ts
  fs.writeFileSync(path.resolve(ROOT_DIR, 'src/data/shalomAgencies.ts'), makeTsCatalog('../types/database.types'), 'utf8');
  fs.writeFileSync(path.resolve(ROOT_DIR, 'backend/src/data/shalomAgencies.ts'), makeTsCatalog('../types/database.types.js'), 'utf8');

  // 5c. shalom_official_agencies.json (solo activas válidas)
  const destSet = new Set();
  const extractCanonicalDest = (a) => {
    const segs = (a.name || '').split('/').map((s) => s.trim().toUpperCase()).filter(Boolean);
    return segs.length > 0 ? segs[segs.length - 1] : (a.district || a.name || '').toUpperCase().trim();
  };

  for (const a of activeItems) {
    const d = extractCanonicalDest(a);
    if (d) destSet.add(d);
  }
  const sortedDests = Array.from(destSet).sort();
  const officialJson = JSON.stringify({ origins: sortedDests, destinations: sortedDests }, null, 2) + '\n';
  fs.writeFileSync(path.resolve(ROOT_DIR, 'src/data/shalom_official_agencies.json'), officialJson, 'utf8');
  fs.writeFileSync(path.resolve(ROOT_DIR, 'backend/src/data/shalom_official_agencies.json'), officialJson, 'utf8');

  // 5d. shalomAgencyCanonicalMap.ts (activas primero para evitar colisiones de códigos duplicados)
  const codeMap = {};
  const nameMap = {};
  const localMap = {};

  const registerAgencyMappings = (a, allowOverwrite) => {
    const targetOfficial = extractCanonicalDest(a);
    if (!targetOfficial) return;

    const setIf = (obj, k, v) => {
      if (!k) return;
      if (allowOverwrite || !(k in obj)) obj[k] = v;
    };

    const code = (a.code || '').trim().toUpperCase();
    if (code) {
      setIf(codeMap, code, targetOfficial);
      setIf(codeMap, normalizeCompactKey(code), targetOfficial);
    }

    const nameUpper = (a.name || '').trim().toUpperCase();
    if (nameUpper) {
      setIf(nameMap, nameUpper, targetOfficial);
      setIf(nameMap, normalizeCompactKey(nameUpper), targetOfficial);
    }

    const lastClean = targetOfficial.replace(/[()]/g, '').trim();
    if (lastClean) {
      setIf(localMap, lastClean, targetOfficial);
      setIf(localMap, normalizeCompactKey(lastClean), targetOfficial);
    }

    // Registrar también previous_name como alias de resolución hacia el nombre actual
    if (a.previous_name) {
      const prevUpper = cleanText(a.previous_name).toUpperCase();
      setIf(nameMap, prevUpper, targetOfficial);
      setIf(nameMap, normalizeCompactKey(prevUpper), targetOfficial);
      const prevSegs = prevUpper.split('/').map((s) => s.trim()).filter(Boolean);
      const prevLast = prevSegs.length > 0 ? prevSegs[prevSegs.length - 1].replace(/[()]/g, '').trim() : '';
      if (prevLast && !prevLast.includes('POR DEFINIR')) {
        setIf(localMap, prevLast, targetOfficial);
        setIf(localMap, normalizeCompactKey(prevLast), targetOfficial);
      }
    }
  };

  // Primero activas (prioridad máxima)
  for (const a of activeItems) {
    registerAgencyMappings(a, false);
  }
  // Luego cerradas recientes solo si no pisan un código/nombre activo
  for (const a of recentClosedRealItems) {
    registerAgencyMappings(a, false);
  }

  const canonicalTs = `// Generado automáticamente: Mapeo Canónico Oficial 100% Preciso de Agencias Shalom
// Activas mapeadas: ${activeItems.length} | Con alias históricos para nombres renombrados

export const SHALOM_CODE_TO_OFFICIAL_MAP: Record<string, string> = ${JSON.stringify(codeMap, null, 2)};

export const SHALOM_NAME_TO_OFFICIAL_MAP: Record<string, string> = ${JSON.stringify(nameMap, null, 2)};

export const SHALOM_LOCAL_TO_OFFICIAL_MAP: Record<string, string> = ${JSON.stringify(localMap, null, 2)};
`;

  fs.writeFileSync(path.resolve(ROOT_DIR, 'src/data/shalomAgencyCanonicalMap.ts'), canonicalTs, 'utf8');
  fs.writeFileSync(path.resolve(ROOT_DIR, 'backend/src/data/shalomAgencyCanonicalMap.ts'), canonicalTs, 'utf8');

  return {
    totalCatalog: catalogWithVigencia.length,
    totalDestinations: sortedDests.length
  };
}

// ---------------------------------------------------------------------------
// 6. Auditoría y limpieza segura de pedidos activos en curso
// ---------------------------------------------------------------------------
async function auditAndCleanActiveOrders(apiById, activeByCode, renamedIds, deactivatedRealIds, nowIso) {
  const updatedOrders = [];
  const warningOrders = [];

  const { data: activeOrders, error } = await supabase
    .from('pedidos')
    .select('id, codigo_seguimiento, estado_envio, metodo_envio_codigo, destino_detalle, registrado_shalom')
    .not('estado_envio', 'in', '("cancelado","entregado")');

  if (error || !Array.isArray(activeOrders)) {
    console.warn(`⚠️ No se pudieron auditar pedidos activos: ${error?.message}`);
    return { updatedOrders, warningOrders };
  }

  for (const order of activeOrders) {
    const rawDest = order.destino_detalle || '';
    const isShalom = order.metodo_envio_codigo === 'shalom' || rawDest.toLowerCase().includes('shalom');
    if (!isShalom || !rawDest) continue;

    // 1. Limpieza de mojibake/caracteres corruptos en pedidos en curso
    const cleanedDest = rawDest
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/Â[\u00a0\s]/g, ' ')
      .replace(/Â/g, '')
      .replace(/\u00a0/g, ' ');

    // Extraer código embebido
    const codeMatch = cleanedDest.match(/\((?:CÓDIGO|CODIGO|COD)[\s:]*([^)]+)\)/i);
    const codeKey = codeMatch ? cleanText(codeMatch[1]).toUpperCase() : null;
    const matchedAg = codeKey ? activeByCode.get(codeKey) : null;

    // Verificar si apunta a una agencia desactivada
    if (codeKey && !matchedAg) {
      const anyInactive = Array.from(apiById.values()).find(
        (a) => !a.is_active && (a.code || '').toUpperCase() === codeKey
      );
      if (anyInactive) {
        warningOrders.push({
          orderId: order.id,
          trackingCode: order.codigo_seguimiento,
          estado: order.estado_envio,
          agencyId: anyInactive.id,
          agencyCode: anyInactive.code,
          agencyName: anyInactive.name,
          reason: anyInactive._meta?.reason || 'Agencia deshabilitada en Shalom'
        });
      }
    }

    let finalDest = cleanedDest;

    // Si la agencia fue renombrada y el pedido aún no fue entregado/cancelado
    if (matchedAg && renamedIds.has(matchedAg.id)) {
      const tailMatch = cleanedDest.match(/(\((?:DNI|CE|Doc)[^)]*\)\s*)$/i);
      const tailTag = tailMatch ? ` ${tailMatch[1].trim()}` : '';
      const candidate = `Agencia Shalom: ${matchedAg.department} / ${matchedAg.province} / ${matchedAg.district} (CÓDIGO: ${matchedAg.code}) – ${matchedAg.address}${tailTag}`;
      if (candidate !== rawDest) {
        finalDest = candidate;
      }
    }

    if (finalDest !== rawDest) {
      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('pedidos')
          .update({ destino_detalle: finalDest, updated_at: nowIso })
          .eq('id', order.id);
        if (upErr) {
          console.warn(`⚠️ Error actualizando pedido ${order.codigo_seguimiento}: ${upErr.message}`);
          continue;
        }
      }
      updatedOrders.push({
        orderId: order.id,
        trackingCode: order.codigo_seguimiento,
        oldDestino: rawDest,
        newDestino: finalDest
      });
    }
  }

  return { updatedOrders, warningOrders };
}

// ---------------------------------------------------------------------------
// 7. Generador de Reporte Markdown para GitHub (Actions Summary + Issue + Repo)
// ---------------------------------------------------------------------------
function escMd(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function buildMarkdownReport(report) {
  const lines = [];
  const peruDate = new Date(report.timestamp).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  lines.push(`# 📦 Reporte Diario de Sincronización de Agencias Shalom`);
  lines.push('');
  lines.push(`- **Fecha (Hora Perú):** ${peruDate}`);
  lines.push(`- **Ejecución:** ${report.dryRun ? '🧪 Simulación (Dry-Run)' : '✅ Producción (Base de datos actualizada)'}`);
  lines.push(`- **Duración:** ${report.durationSec}s`);
  lines.push(`- **Estado:** ${report.hasChanges ? '🔔 **CAMBIOS DETECTADOS Y APLICADOS**' : '✨ **SIN CAMBIOS (Catálogo 100% al día)**'}`);
  lines.push('');

  lines.push('## 📊 Resumen Ejecutivo');
  lines.push('');
  lines.push('| Métrica | Cantidad |');
  lines.push('|---|---:|');
  lines.push(`| 📡 Total registros devueltos por API Shalom | **${report.totals.apiTotal}** |`);
  lines.push(`| ✅ Agencias activas válidas en BD (habilitadas para clientes) | **${report.totals.activeValid}** |`);
  lines.push(`| 🛑 Agencias cerradas/deshabilitadas (visibles 30d con aviso \`YA NO EXISTE\`) | **${report.totals.disabledReal}** |`);
  lines.push(`| 🧹 Registros internos / aeropuertos / \`SOLO ENVÍOS\` / \`(POR DEFINIR)\` / QA ocultos | **${report.totals.hiddenInternalOrQa}** |`);
  lines.push(`| ✨ Nuevas agencias agregadas | **${report.changes.newAgencies.length}** |`);
  lines.push(`| 🌟 Agencias reactivadas / recién habilitadas | **${report.changes.reactivated.length}** |`);
  lines.push(`| 🏷️ Cambios de nombre / sucursal / nomenclatura | **${report.changes.renamed.length}** |`);
  lines.push(`| 🔤 Cambios de código / abreviatura | **${report.changes.codeChanged.length}** |`);
  lines.push(`| 📍 Cambios de dirección / mudanzas / saneamiento de texto | **${report.changes.addressChanged.length}** |`);
  lines.push(`| 🗺️ Cambios de ubicación (Depto / Prov / Ubigeo / GPS) | **${report.changes.locationChanged.length}** |`);
  lines.push(`| 🕐 Cambios de horario o teléfono | **${report.changes.scheduleOrPhoneChanged.length}** |`);
  lines.push(`| 🛑 Bajas reales detectadas (deshabilitadas o eliminadas) | **${report.changes.deactivatedReal.length}** |`);
  lines.push(`| 🧹 Depuración de QA / internos / aeropuertos / \`(POR DEFINIR)\` | **${report.changes.deactivatedInternalOrQa.length}** |`);
  lines.push(`| 📦 Pedidos activos actualizados / limpiados | **${report.orders.updated.length}** |`);
  lines.push(`| ⚠️ Alertas en pedidos activos | **${report.orders.warnings.length}** |`);
  lines.push('');

  if (report.changes.newAgencies.length > 0) {
    lines.push(`## ✨ 1. Nuevas Agencias Activas (${report.changes.newAgencies.length})`);
    lines.push('');
    lines.push('| ID | Código | Nombre / Sucursal | Departamento / Provincia | Dirección |');
    lines.push('|---:|---|---|---|---|');
    for (const a of report.changes.newAgencies) {
      lines.push(`| ${a.id} | \`${escMd(a.code || 'N/A')}\` | ${escMd(a.name)} | ${escMd(a.department)} / ${escMd(a.province)} | ${escMd(a.address)} |`);
    }
    lines.push('');
  }

  if (report.changes.reactivated.length > 0) {
    lines.push(`## 🌟 2. Agencias Reactivadas / Recién Habilitadas (${report.changes.reactivated.length})`);
    lines.push('');
    lines.push('| ID | Código | Nombre Actual | Nombre Anterior | Dirección |');
    lines.push('|---:|---|---|---|---|');
    for (const a of report.changes.reactivated) {
      lines.push(`| ${a.id} | \`${escMd(a.code || 'N/A')}\` | ${escMd(a.name)} | ${escMd(a.previousName || '—')} | ${escMd(a.address)} |`);
    }
    lines.push('');
  }

  if (report.changes.renamed.length > 0) {
    lines.push(`## 🏷️ 3. Cambios de Nombre / Sucursal / Nomenclatura (${report.changes.renamed.length})`);
    lines.push('');
    lines.push('| ID | Código | Nombre Anterior (BD) | Nombre Nuevo (API Shalom) |');
    lines.push('|---:|---|---|---|');
    for (const c of report.changes.renamed) {
      lines.push(`| ${c.id} | \`${escMd(c.code || 'N/A')}\` | ~~${escMd(c.oldName)}~~ | **${escMd(c.newName)}** |`);
    }
    lines.push('');
  }

  if (report.changes.codeChanged.length > 0) {
    lines.push(`## 🔤 4. Cambios de Código / Abreviatura (${report.changes.codeChanged.length})`);
    lines.push('');
    lines.push('| ID | Agencia | Código Anterior | Código Nuevo |');
    lines.push('|---:|---|---|---|');
    for (const c of report.changes.codeChanged) {
      lines.push(`| ${c.id} | ${escMd(c.name)} | \`${escMd(c.oldCode)}\` | \`${escMd(c.newCode)}\` |`);
    }
    lines.push('');
  }

  if (report.changes.addressChanged.length > 0) {
    lines.push(`## 📍 5. Cambios de Dirección / Saneamiento (${report.changes.addressChanged.length})`);
    lines.push('');
    lines.push('| ID | Código | Agencia | Dirección Anterior | Dirección Nueva |');
    lines.push('|---:|---|---|---|---|');
    for (const c of report.changes.addressChanged) {
      lines.push(`| ${c.id} | \`${escMd(c.code || 'N/A')}\` | ${escMd(c.name)} | ${escMd(c.oldAddress)} | ${escMd(c.newAddress)} |`);
    }
    lines.push('');
  }

  if (report.changes.locationChanged.length > 0) {
    lines.push(`## 🗺️ 6. Cambios de Ubicación / Ubigeo / Coordenadas (${report.changes.locationChanged.length})`);
    lines.push('');
    lines.push('| ID | Código | Agencia | Detalle del Cambio |');
    lines.push('|---:|---|---|---|');
    for (const c of report.changes.locationChanged) {
      lines.push(`| ${c.id} | \`${escMd(c.code || 'N/A')}\` | ${escMd(c.name)} | ${escMd(c.details)} |`);
    }
    lines.push('');
  }

  if (report.changes.scheduleOrPhoneChanged.length > 0) {
    lines.push(`## 🕐 7. Cambios de Horario / Teléfono (${report.changes.scheduleOrPhoneChanged.length})`);
    lines.push('');
    lines.push('| ID | Código | Agencia | Detalle |');
    lines.push('|---:|---|---|---|');
    for (const c of report.changes.scheduleOrPhoneChanged) {
      lines.push(`| ${c.id} | \`${escMd(c.code || 'N/A')}\` | ${escMd(c.name)} | ${escMd(c.details)} |`);
    }
    lines.push('');
  }

  if (report.changes.deactivatedReal.length > 0) {
    lines.push(`## 🛑 8. Agencias Cerradas / Deshabilitadas (Bajas con vigencia informativa de 30 días) (${report.changes.deactivatedReal.length})`);
    lines.push('');
    lines.push('| ID | Código | Agencia | Motivo |');
    lines.push('|---:|---|---|---|');
    for (const d of report.changes.deactivatedReal) {
      lines.push(`| ${d.id} | \`${escMd(d.code || 'N/A')}\` | ${escMd(d.name)} | ${escMd(d.reason)} |`);
    }
    lines.push('');
  }

  if (report.changes.deactivatedInternalOrQa.length > 0) {
    lines.push(`## 🧹 9. Depuración: Pruebas QA, Aeropuertos, Solo Envíos, Cajas Internas y (POR DEFINIR) (${report.changes.deactivatedInternalOrQa.length})`);
    lines.push('');
    lines.push('<details><summary>Ver listado completo depurado (' + report.changes.deactivatedInternalOrQa.length + ' registros ocultados del catálogo público)</summary>');
    lines.push('');
    lines.push('| ID | Código | Nombre | Motivo |');
    lines.push('|---:|---|---|---|');
    for (const d of report.changes.deactivatedInternalOrQa) {
      lines.push(`| ${d.id} | \`${escMd(d.code || 'N/A')}\` | ${escMd(d.name)} | ${escMd(d.reason)} |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (report.changes.sanitizedNotable && report.changes.sanitizedNotable.length > 0) {
    lines.push(`## ✨ 9b. Saneamiento de Encoding y Espacios (${report.changes.sanitizedCount} textos normalizados, ${report.changes.sanitizedNotable.length} correcciones de caracteres)`);
    lines.push('');
    lines.push('| ID | Código | Agencia | Corrección Aplicada |');
    lines.push('|---:|---|---|---|');
    for (const s of report.changes.sanitizedNotable) {
      lines.push(`| ${s.id} | \`${escMd(s.code || 'N/A')}\` | ${escMd(s.name)} | ${escMd(s.detail)} |`);
    }
    lines.push('');
  }

  if (report.orders.updated.length > 0) {
    lines.push(`## 📦 10. Pedidos Activos Actualizados / Saneados (${report.orders.updated.length})`);
    lines.push('');
    lines.push('| Código Seguimiento | Destino Anterior | Destino Actualizado |');
    lines.push('|---|---|---|');
    for (const o of report.orders.updated) {
      lines.push(`| \`${escMd(o.trackingCode)}\` | ${escMd(o.oldDestino)} | ${escMd(o.newDestino)} |`);
    }
    lines.push('');
  }

  if (report.orders.warnings.length > 0) {
    lines.push(`## ⚠️ 11. Alertas en Pedidos Activos (${report.orders.warnings.length})`);
    lines.push('');
    lines.push('| Código Seguimiento | Estado | Agencia | Motivo |');
    lines.push('|---|---|---|---|');
    for (const w of report.orders.warnings) {
      lines.push(`| \`${escMd(w.trackingCode)}\` | ${escMd(w.estado)} | \`${escMd(w.agencyCode)}\` ${escMd(w.agencyName)} | ${escMd(w.reason)} |`);
    }
    lines.push('');
  }

  if (report.upcomingOrDisabledSummary && report.upcomingOrDisabledSummary.length > 0) {
    lines.push(`## 👀 Próximas Sedes en Preparación en API Shalom (\`habilitado=false\`) (${report.upcomingOrDisabledSummary.length})`);
    lines.push('');
    lines.push('> Estas sedes existen en la API de Shalom pero aún tienen `habilitado: false`. En cuanto Shalom las habilite, el cron diario de las **5:00 AM** las activará automáticamente.');
    lines.push('');
    lines.push('| ID | Código | Nombre | Dirección |');
    lines.push('|---:|---|---|---|');
    for (const u of report.upcomingOrDisabledSummary) {
      lines.push(`| ${u.id} | \`${escMd(u.code || 'N/A')}\` | ${escMd(u.name)} | ${escMd(u.address)} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('_Generado automáticamente por `scripts/sync-shalom.mjs` (Cron Diario 05:00 AM Hora Perú)._');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 8. Flujo Principal de Sincronización Inteligente
// ---------------------------------------------------------------------------
async function runShalomSync() {
  const startTime = Date.now();
  const nowIso = new Date().toISOString();

  console.log('====================================================================');
  console.log(`🚀 SINCRONIZACIÓN INTELIGENTE SHALOM PERÚ ${DRY_RUN ? '[DRY-RUN]' : '[PRODUCCIÓN]'}`);
  console.log('====================================================================');
  console.log(`📡 API Shalom  : ${SHALOM_API_URL}`);
  console.log(`🗄️  Supabase DB : ${SUPABASE_URL}`);
  console.log(`🕐 Timestamp   : ${nowIso}`);
  console.log('--------------------------------------------------------------------');

  // 1. Descargar 100% del catálogo desde la API oficial
  const rawApiAgencies = await fetchAllAgenciesFromApi();
  console.log(`📡 Total registros únicos recibidos de la API: ${rawApiAgencies.length}`);

  // 2. Normalizar y clasificar todos los registros de la API
  const normalizedApi = rawApiAgencies.map((raw) => normalizeApiItem(raw, nowIso));
  const apiById = new Map(normalizedApi.map((a) => [a.id, a]));

  // 3. Descargar estado actual completo de Supabase
  const existingRows = await fetchAllDbAgencies();
  const existingMap = new Map(existingRows.map((r) => [Number(r.id), r]));
  console.log(`📦 Registros actuales en Supabase: ${existingRows.length} (${existingRows.filter((r) => r.is_active !== false).length} activos)`);

  // 4. Análisis diferencial exhaustivo
  const changes = {
    newAgencies: [],
    reactivated: [],
    renamed: [],
    codeChanged: [],
    addressChanged: [],
    locationChanged: [],
    scheduleOrPhoneChanged: [],
    deactivatedReal: [],
    deactivatedInternalOrQa: [],
    sanitizedCount: 0,
    sanitizedNotable: []
  };

  const rowsToUpsert = [];
  const renamedIds = new Set();
  const deactivatedRealIds = new Set();

  for (const item of normalizedApi) {
    const existing = existingMap.get(item.id);
    const meta = item._meta;

    // Resolver columnas de historial (previous_name / deleted_at)
    if (!existing) {
      if (item.is_active) {
        changes.newAgencies.push({
          id: item.id,
          code: item.code,
          name: item.name,
          department: item.department,
          province: item.province,
          district: item.district,
          address: item.address
        });
      } else {
        item.deleted_at = meta.hideImmediately ? EXPIRED_DELETED_AT : nowIso;
        item.previous_name = item.name;
        item.previous_agency_info = item.full_name;
      }
      rowsToUpsert.push(item);
      continue;
    }

    const wasActive = existing.is_active !== false;

    // Caso A: Agencia que pasa o permanece INACTIVA según clasificación inteligente
    if (!item.is_active) {
      if (meta.hideImmediately) {
        item.deleted_at = EXPIRED_DELETED_AT;
        item.previous_name = existing.previous_name || existing.name || item.name;
        item.previous_agency_info = existing.previous_agency_info || existing.full_name || item.full_name;
        if (wasActive) {
          changes.deactivatedInternalOrQa.push({
            id: item.id,
            code: item.code,
            name: item.name,
            reason: meta.reason
          });
        }
      } else {
        // Sede real deshabilitada: conservar deleted_at previo si ya estaba inactiva, o marcar hoy (30d vigencia)
        item.deleted_at = wasActive ? nowIso : (existing.deleted_at || nowIso);
        item.previous_name = existing.previous_name || existing.name || item.name;
        item.previous_address = existing.previous_address || existing.address || item.address;
        item.previous_agency_info = existing.previous_agency_info || existing.full_name || item.full_name;
        if (wasActive) {
          deactivatedRealIds.add(item.id);
          changes.deactivatedReal.push({
            id: item.id,
            code: item.code,
            name: item.name,
            reason: meta.reason
          });
        }
      }

      // Actualizar fila si cambió estado, texto, full_name o deleted_at
      const needsDbUpdate =
        wasActive ||
        !sameTimestamp(existing.deleted_at, item.deleted_at) ||
        (existing.name || '') !== item.name ||
        (existing.address || '') !== item.address ||
        (existing.code || null) !== item.code ||
        (existing.full_name || '') !== item.full_name;

      if (needsDbUpdate) {
        rowsToUpsert.push(item);
      }
      continue;
    }

    // Caso B: Agencia ACTIVA Y VÁLIDA
    item.is_active = true;
    item.deleted_at = null;

    const oldNameRaw = existing.name || '';
    const oldName = cleanText(oldNameRaw);
    const oldDist = cleanText(existing.district || '').toUpperCase();
    const oldCodeRaw = existing.code !== null && existing.code !== undefined ? String(existing.code) : '';
    const oldCodeClean = cleanText(oldCodeRaw);
    const oldAddrRaw = existing.address || '';
    const oldAddrClean = cleanText(oldAddrRaw);
    const oldDep = cleanText(existing.department || '').toUpperCase();
    const oldProv = cleanText(existing.province || '').toUpperCase();
    const oldUbi = existing.ubigeo || null;
    const oldPhone = cleanText(existing.phone || '');
    const oldSched = cleanText(existing.schedule || '');
    const oldFullName = existing.full_name || '';

    const nameChanged = oldName.toUpperCase() !== item.name.toUpperCase();
    const distChanged = oldDist !== item.district;
    const codeChangedReal = oldCodeClean.toUpperCase() !== (item.code || '').toUpperCase();
    const codeChangedRaw = oldCodeRaw !== (item.code || '');
    const addrChangedReal = oldAddrClean.toUpperCase() !== item.address.toUpperCase();
    const addrChangedRaw = oldAddrRaw !== item.address;
    const nameChangedRaw = oldNameRaw !== item.name;
    const depProvUbiChanged = oldDep !== item.department || oldProv !== item.province || oldUbi !== item.ubigeo;
    const latChanged =
      (existing.latitude === null) !== (item.latitude === null) ||
      (existing.latitude !== null && item.latitude !== null && Math.abs(Number(existing.latitude) - Number(item.latitude)) > 0.0002);
    const lngChanged =
      (existing.longitude === null) !== (item.longitude === null) ||
      (existing.longitude !== null && item.longitude !== null && Math.abs(Number(existing.longitude) - Number(item.longitude)) > 0.0002);
    const phoneChanged = oldPhone !== item.phone;
    const schedChanged = oldSched !== item.schedule;
    const fullNameChanged = oldFullName !== item.full_name;

    if (!wasActive) {
      changes.reactivated.push({
        id: item.id,
        code: item.code,
        name: item.name,
        previousName: existing.previous_name || existing.name,
        address: item.address
      });
    }

    if (nameChanged || distChanged) {
      renamedIds.add(item.id);
      item.previous_name = existing.name;
      item.previous_address = existing.address;
      item.previous_agency_info = existing.full_name || `${existing.name} - ${existing.address}`;
      item.name_changed_at = nowIso;
      changes.renamed.push({
        id: item.id,
        code: item.code,
        oldName: existing.name,
        newName: item.name
      });
    } else if (existing.previous_name) {
      const changedTime = existing.name_changed_at ? new Date(existing.name_changed_at).getTime() : 0;
      if (changedTime && Date.now() - changedTime <= THIRTY_DAYS_MS) {
        item.previous_name = existing.previous_name;
        item.previous_address = existing.previous_address;
        item.previous_agency_info = existing.previous_agency_info;
        item.name_changed_at = existing.name_changed_at;
      }
    }

    if (codeChangedReal) {
      changes.codeChanged.push({
        id: item.id,
        name: item.name,
        oldCode: oldCodeClean || '(vacío)',
        newCode: item.code || '(vacío)'
      });
    }

    if (addrChangedReal) {
      changes.addressChanged.push({
        id: item.id,
        code: item.code,
        name: item.name,
        oldAddress: oldAddrClean,
        newAddress: item.address
      });
    }

    // Registrar saneamiento de encoding/espacios (sin ruido en cambios reales)
    const hadNotableEncodingBug =
      /\\u[0-9a-fA-F]{4}|Â|\bN\?\s*\d/i.test(oldAddrRaw) ||
      (codeChangedRaw && !codeChangedReal);
    if ((addrChangedRaw && !addrChangedReal) || (codeChangedRaw && !codeChangedReal) || (nameChangedRaw && !nameChanged)) {
      changes.sanitizedCount++;
      if (hadNotableEncodingBug) {
        changes.sanitizedNotable.push({
          id: item.id,
          code: item.code,
          name: item.name,
          detail: codeChangedRaw && !codeChangedReal
            ? `Código recortado: "${oldCodeRaw}" → "${item.code}"`
            : `Encoding corregido: "${oldAddrRaw}" → "${item.address}"`
        });
      }
    }

    if (depProvUbiChanged || latChanged || lngChanged) {
      const parts = [];
      if (oldDep !== item.department) parts.push(`Depto: ${oldDep} → ${item.department}`);
      if (oldProv !== item.province) parts.push(`Prov: ${oldProv} → ${item.province}`);
      if (oldUbi !== item.ubigeo) parts.push(`Ubigeo: ${oldUbi || 'null'} → ${item.ubigeo || 'null'}`);
      if (latChanged || lngChanged) parts.push(`GPS: (${existing.latitude}, ${existing.longitude}) → (${item.latitude}, ${item.longitude})`);
      changes.locationChanged.push({
        id: item.id,
        code: item.code,
        name: item.name,
        details: parts.join(' | ')
      });
    }

    if (phoneChanged || schedChanged) {
      const parts = [];
      if (schedChanged) parts.push(`Horario: "${oldSched}" → "${item.schedule}"`);
      if (phoneChanged) parts.push(`Tel: "${oldPhone}" → "${item.phone}"`);
      changes.scheduleOrPhoneChanged.push({
        id: item.id,
        code: item.code,
        name: item.name,
        details: parts.join(' | ')
      });
    }

    const needsDbUpdate =
      !wasActive ||
      nameChanged ||
      nameChangedRaw ||
      distChanged ||
      codeChangedReal ||
      codeChangedRaw ||
      addrChangedReal ||
      addrChangedRaw ||
      depProvUbiChanged ||
      latChanged ||
      lngChanged ||
      phoneChanged ||
      schedChanged ||
      fullNameChanged ||
      existing.deleted_at !== null ||
      (existing.previous_name !== item.previous_name);

    if (needsDbUpdate) {
      rowsToUpsert.push(item);
    }
  }

  // 5. Detectar agencias que desaparecieron por completo de la API
  const removedFromApiRows = [];
  for (const [dbId, existing] of existingMap.entries()) {
    if (apiById.has(dbId)) continue;
    const isJunk = isQaOrTestAgency(existing.name, existing.address);
    const targetDeletedAt = isJunk ? EXPIRED_DELETED_AT : (existing.deleted_at || nowIso);

    if (existing.is_active !== false || !sameTimestamp(existing.deleted_at, targetDeletedAt)) {
      const row = {
        ...fromDbRowToCatalogItem(existing),
        is_active: false,
        deleted_at: targetDeletedAt,
        previous_name: existing.previous_name || existing.name,
        previous_agency_info: existing.previous_agency_info || existing.full_name,
        updated_at: nowIso
      };
      removedFromApiRows.push(row);

      if (existing.is_active !== false) {
        if (isJunk) {
          changes.deactivatedInternalOrQa.push({
            id: dbId,
            code: existing.code,
            name: existing.name,
            reason: 'Terminal de prueba eliminada de la API'
          });
        } else {
          deactivatedRealIds.add(dbId);
          changes.deactivatedReal.push({
            id: dbId,
            code: existing.code,
            name: existing.name,
            reason: 'Eliminada del catálogo oficial de la API Shalom'
          });
        }
      }
    }
  }

  // 6. Aplicar cambios en Supabase PostgreSQL
  if (!DRY_RUN) {
    if (rowsToUpsert.length > 0) {
      console.log(`💾 Aplicando Batch Upsert de ${rowsToUpsert.length} agencias modificadas/nuevas/actualizadas en Supabase...`);
      const batchSize = 100;
      for (let i = 0; i < rowsToUpsert.length; i += batchSize) {
        const batch = rowsToUpsert.slice(i, i + batchSize).map(toDbRow);
        const { error } = await supabase
          .from('shalom_agencies')
          .upsert(batch, { onConflict: 'id' });
        if (error) {
          throw new Error(`Error en upsert lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        }
      }
      console.log(`  ✅ ${rowsToUpsert.length} filas sincronizadas en shalom_agencies.`);
    } else {
      console.log('✨ Base de datos shalom_agencies ya estaba idéntica a la API.');
    }

    if (removedFromApiRows.length > 0) {
      console.log(`🛑 Actualizando ${removedFromApiRows.length} registros ausentes de la API...`);
      for (const row of removedFromApiRows) {
        const { error } = await supabase
          .from('shalom_agencies')
          .update({
            is_active: false,
            deleted_at: row.deleted_at,
            previous_name: row.previous_name,
            previous_agency_info: row.previous_agency_info,
            updated_at: nowIso
          })
          .eq('id', row.id);
        if (error) {
          throw new Error(`Error actualizando baja ID ${row.id}: ${error.message}`);
        }
      }
    }
  } else {
    console.log(`🧪 [DRY-RUN] Se omitieron escrituras en BD (${rowsToUpsert.length} upserts, ${removedFromApiRows.length} bajas).`);
  }

  // 7. Auditar y limpiar pedidos activos en curso
  const activeValidItems = normalizedApi.filter((a) => a.is_active);
  const activeByCode = new Map();
  for (const a of activeValidItems) {
    if (a.code) activeByCode.set(a.code.toUpperCase(), a);
  }
  const ordersResult = await auditAndCleanActiveOrders(apiById, activeByCode, renamedIds, deactivatedRealIds, nowIso);

  // 8. Construir listado de cerradas reales con vigencia < 30 días (sin QA ni internas)
  const nowMs = Date.now();
  const recentClosedRealItems = [];
  for (const item of normalizedApi) {
    if (!item.is_active && !item._meta.hideImmediately) {
      const delMs = item.deleted_at ? new Date(item.deleted_at).getTime() : nowMs;
      if (nowMs - delMs <= THIRTY_DAYS_MS) {
        recentClosedRealItems.push(item);
      }
    }
  }
  for (const [dbId, existing] of existingMap.entries()) {
    if (apiById.has(dbId)) continue;
    if (isQaOrTestAgency(existing.name, existing.address)) continue;
    const delMs = existing.deleted_at ? new Date(existing.deleted_at).getTime() : nowMs;
    if (nowMs - delMs <= THIRTY_DAYS_MS) {
      recentClosedRealItems.push({
        ...fromDbRowToCatalogItem(existing),
        is_active: false,
        deleted_at: existing.deleted_at || nowIso
      });
    }
  }

  // 9. Regenerar archivos estáticos (frontend + backend + data/)
  let staticInfo = { totalCatalog: activeValidItems.length + recentClosedRealItems.length, totalDestinations: 0 };
  if (!DRY_RUN) {
    staticInfo = generateStaticFiles(activeValidItems, recentClosedRealItems, normalizedApi);
    console.log(`📁 Archivos estáticos regenerados (src/data, backend/src/data, data/): ${staticInfo.totalCatalog} agencias (${activeValidItems.length} activas + ${recentClosedRealItems.length} cerradas recientes <30d).`);
  }

  // 10. Próximas sedes nuevas (ID >= 719 con habilitado=false y no QA)
  const upcomingOrDisabledSummary = normalizedApi
    .filter((a) => !a.is_active && a.id >= 719 && a._meta.classification !== 'qa_test' && a._meta.classification !== 'airport_internal')
    .sort((a, b) => a.id - b.id)
    .map((a) => ({ id: a.id, code: a.code, name: a.name, address: a.address }));

  // 11. Verificación espacial PostGIS
  if (!DRY_RUN) {
    const { data: nearby, error: rpcError } = await supabase.rpc('get_nearby_shalom_agencies', {
      user_lat: -12.046374,
      user_lng: -77.042793,
      max_limit: 3
    });
    if (rpcError) {
      console.warn('⚠️ Nota RPC PostGIS:', rpcError.message);
    } else if (nearby?.length) {
      console.log('📍 PostGIS OK — 3 agencias activas más cercanas a Lima Centro:');
      nearby.forEach((ag, i) => console.log(`   ${i + 1}. [${ag.code || 'N/A'}] ${ag.name} (${(ag.distance_meters / 1000).toFixed(2)} km)`));
    }
  }

  const totalMeaningfulChanges =
    changes.newAgencies.length +
    changes.reactivated.length +
    changes.renamed.length +
    changes.codeChanged.length +
    changes.addressChanged.length +
    changes.locationChanged.length +
    changes.scheduleOrPhoneChanged.length +
    changes.deactivatedReal.length +
    changes.deactivatedInternalOrQa.length +
    ordersResult.updatedOrders.length;

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  const report = {
    timestamp: nowIso,
    dryRun: DRY_RUN,
    durationSec: Number(durationSec),
    hasChanges: totalMeaningfulChanges > 0,
    totalChangesCount: totalMeaningfulChanges,
    totals: {
      apiTotal: normalizedApi.length,
      activeValid: activeValidItems.length,
      disabledReal: normalizedApi.filter((a) => a._meta.classification === 'disabled_real').length,
      hiddenInternalOrQa: normalizedApi.filter((a) => a._meta.hideImmediately).length +
        Array.from(existingMap.values()).filter((e) => !apiById.has(Number(e.id)) && isQaOrTestAgency(e.name, e.address)).length,
      dbUpserted: rowsToUpsert.length,
      staticCatalogCount: staticInfo.totalCatalog,
      canonicalDestinations: staticInfo.totalDestinations
    },
    changes,
    orders: {
      updated: ordersResult.updatedOrders,
      warnings: ordersResult.warningOrders
    },
    upcomingOrDisabledSummary
  };

  const mdContent = buildMarkdownReport(report);

  // Guardar reportes
  fs.mkdirSync(path.dirname(REPORT_MD_PATH), { recursive: true });
  fs.writeFileSync(REPORT_MD_PATH, mdContent, 'utf8');
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  if (!DRY_RUN) {
    let history = [];
    if (fs.existsSync(HISTORY_JSON_PATH)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_JSON_PATH, 'utf8'));
        if (!Array.isArray(history)) history = [];
      } catch {
        history = [];
      }
    }
    history.unshift({
      timestamp: nowIso,
      hasChanges: report.hasChanges,
      totalChangesCount: report.totalChangesCount,
      activeValid: report.totals.activeValid,
      newCount: changes.newAgencies.length,
      reactivatedCount: changes.reactivated.length,
      renamedCount: changes.renamed.length,
      codeChangedCount: changes.codeChanged.length,
      addressChangedCount: changes.addressChanged.length,
      locationChangedCount: changes.locationChanged.length,
      scheduleOrPhoneCount: changes.scheduleOrPhoneChanged.length,
      deactivatedRealCount: changes.deactivatedReal.length,
      deactivatedInternalOrQaCount: changes.deactivatedInternalOrQa.length,
      ordersUpdatedCount: ordersResult.updatedOrders.length,
      ordersWarningsCount: ordersResult.warningOrders.length
    });
    fs.writeFileSync(HISTORY_JSON_PATH, JSON.stringify(history.slice(0, 90), null, 2) + '\n', 'utf8');
  }

  console.log('====================================================================');
  console.log(`🏁 SINCRONIZACIÓN FINALIZADA EN ${durationSec}s`);
  console.log(`   ✅ Activas válidas      : ${report.totals.activeValid}`);
  console.log(`   🆕 Nuevas               : ${changes.newAgencies.length}`);
  console.log(`   🌟 Reactivadas          : ${changes.reactivated.length}`);
  console.log(`   🏷️  Renombradas          : ${changes.renamed.length}`);
  console.log(`   🔤 Código cambiado      : ${changes.codeChanged.length}`);
  console.log(`   📍 Dirección cambiada   : ${changes.addressChanged.length}`);
  console.log(`   🗺️  Ubicación/GPS        : ${changes.locationChanged.length}`);
  console.log(`   🕐 Horario/Teléfono     : ${changes.scheduleOrPhoneChanged.length}`);
  console.log(`   🛑 Bajas reales         : ${changes.deactivatedReal.length}`);
  console.log(`   🧹 Depuradas (QA/Int)   : ${changes.deactivatedInternalOrQa.length}`);
  console.log(`   📦 Pedidos actualizados : ${ordersResult.updatedOrders.length}`);
  console.log(`   📝 Reporte MD           : ${REPORT_MD_PATH}`);
  console.log('====================================================================');
}

runShalomSync().catch((err) => {
  console.error('❌ Error fatal en sincronización:', err);
  process.exit(1);
});
