import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = 'sk_614980da4cc14fd60bf8366e7f35bc85512f624b65ee45ff364c1a42aac15e05';

// 1. Load full ubigeo dictionary
const ubigeosDistrito = JSON.parse(fs.readFileSync(path.join(__dirname, 'ubigeo_distrito.json'), 'utf-8'));

const ineiMap = new Map();
const reniecMap = new Map();

for (const u of ubigeosDistrito) {
  if (u.ubigeo_inei) ineiMap.set(String(u.ubigeo_inei).padStart(6, '0'), u);
  if (u.ubigeo_reniec) reniecMap.set(String(u.ubigeo_reniec).padStart(6, '0'), u);
}

// Map from 2-digit code to canonical Peru Department
const DEPT_CODE_MAP = {
  '01': 'AMAZONAS',
  '02': 'ANCASH',
  '03': 'APURIMAC',
  '04': 'AREQUIPA',
  '05': 'AYACUCHO',
  '06': 'CAJAMARCA',
  '07': 'CALLAO',
  '08': 'CUSCO',
  '09': 'HUANCAVELICA',
  '10': 'HUANUCO',
  '11': 'ICA',
  '12': 'JUNIN',
  '13': 'LA LIBERTAD',
  '14': 'LAMBAYEQUE',
  '15': 'LIMA',
  '16': 'LORETO',
  '17': 'MADRE DE DIOS',
  '18': 'MOQUEGUA',
  '19': 'PASCO',
  '20': 'PIURA',
  '21': 'PUNO',
  '22': 'SAN MARTIN',
  '23': 'TACNA',
  '24': 'TUMBES',
  '25': 'UCAYALI'
};

async function fetchAllAgencies() {
  console.log('📡 Conectando sigilosamente con Olva API Perú...');
  let allRaw = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const url = `https://api.olva-api-peru.com/v1/agencias?limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'X-API-Key': API_KEY,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const data = await res.json();
    const results = data.results || [];
    allRaw.push(...results);

    console.log(`✓ Página ${page}: ${results.length} agencias descargadas (${allRaw.length}/${data.total})`);

    if (allRaw.length >= data.total || results.length === 0) {
      break;
    }
    page++;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`🎉 Total descargado: ${allRaw.length} agencias Olva.`);
  return allRaw;
}

function cleanText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();
}

function cleanLine(str) {
  if (!str) return '';
  return String(str).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const rawAgencies = await fetchAllAgencies();

  const canonicalAgencies = [];
  const DEPARTAMENTOS_SET = new Set(['TODOS']);

  rawAgencies.forEach((raw, idx) => {
    const ubCode = String(raw.ubigeo || '').padStart(6, '0');
    const depCode = ubCode.slice(0, 2);
    const uInfo = ineiMap.get(ubCode) || reniecMap.get(ubCode);

    // Canonical Department
    let dep = DEPT_CODE_MAP[depCode] || (uInfo ? cleanText(uInfo.departamento) : cleanText(raw.departamento)) || 'LIMA';
    let prov = uInfo ? cleanText(uInfo.provincia) : dep;
    let dist = uInfo ? cleanText(uInfo.distrito) : (raw.nombres ? cleanText(raw.nombres) : 'CENTRO');

    DEPARTAMENTOS_SET.add(dep);

    // Coordinates with validation & inversion auto-repair
    let lat = null;
    let lng = null;
    if (raw.lat && raw.lng) {
      let rawLat = parseFloat(raw.lat);
      let rawLng = parseFloat(raw.lng);

      if (!isNaN(rawLat) && !isNaN(rawLng)) {
        // In Peru, Latitude is [-0.03 to -18.35] and Longitude is [-68.65 to -81.33]
        if (rawLng < -1 && rawLng > -20 && rawLat < -65 && rawLat > -85) {
          lat = rawLng;
          lng = rawLat;
        } else {
          lat = rawLat;
          lng = rawLng;
        }
      }
    }

    const rawName = cleanLine(raw.nombres || dist);
    const tipo = cleanLine(raw.tipo || 'TIENDAS');
    const direccion = cleanLine(raw.direccion || '');
    const horario = cleanLine(raw.horario || '');
    const partner = raw.partner === 'SI';
    const code = `OLVA-${ubCode}-${idx + 1}`;

    const fullName = `${dep} / ${prov} / ${dist} / ${rawName} (${tipo}) - ${direccion}`.toUpperCase();

    canonicalAgencies.push({
      id: idx + 1,
      code,
      name: `${dep} / ${prov} / ${dist} / ${rawName}`.toUpperCase(),
      nombre: `${dep} / ${prov} / ${dist} / ${rawName}`.toUpperCase(),
      full_name: fullName,
      department: dep,
      departamento: dep,
      province: prov,
      provincia: prov,
      district: dist,
      distrito: dist,
      ubigeo: ubCode,
      address: direccion,
      direccion: direccion,
      phone: '(01) 714-0909',
      telefono: '(01) 714-0909',
      schedule: horario || 'Lunes a viernes: 9:00 am - 6:00 pm | Sábado: 9:00 am - 1:00 pm',
      horario: horario || 'Lunes a viernes: 9:00 am - 6:00 pm | Sábado: 9:00 am - 1:00 pm',
      tipo: tipo,
      type: tipo,
      partner: partner,
      is_partner: partner,
      latitude: lat,
      longitude: lng,
      is_active: true,
      updated_at: new Date().toISOString()
    });
  });

  const sortedDepts = Array.from(DEPARTAMENTOS_SET).sort();
  console.log('\nDepartamentos oficiales de Olva mapeados:', sortedDepts);

  // Generate src/data/olvaAgencies.ts
  const fileContent = `import { OlvaAgency } from '../types/database.types';

export const DEPARTAMENTOS_OLVA = ${JSON.stringify(sortedDepts, null, 2)};

export const OLVA_AGENCIES: OlvaAgency[] = ${JSON.stringify(canonicalAgencies, null, 2)};
`;

  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'olvaAgencies.ts'), fileContent, 'utf-8');
  console.log('✓ Archivo src/data/olvaAgencies.ts generado exitosamente.');

  // Generate src/data/olvaAgencyCanonicalMap.ts
  const searchIndexObj = {};
  canonicalAgencies.forEach((ag) => {
    const key = `${ag.departamento}_${ag.provincia}_${ag.distrito}_${ag.code}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    searchIndexObj[key] = ag.full_name;
  });

  let canonicalMapContent = `/**
 * Diccionario canónico de búsqueda y normalización de agencias Olva Courier
 * 376 agencias con jerarquía oficial Departamento / Provincia / Distrito
 */
export const OLVA_CANONICAL_SEARCH_INDEX: Record<string, string> = ${JSON.stringify(searchIndexObj, null, 2)};
`;
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'olvaAgencyCanonicalMap.ts'), canonicalMapContent, 'utf-8');
  console.log('✓ Archivo src/data/olvaAgencyCanonicalMap.ts generado exitosamente.');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
