import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load raw olva agencies
const rawAgencies = JSON.parse(fs.readFileSync(path.join(__dirname, 'olva_raw_agencies.json'), 'utf-8'));
const ubigeosDistrito = JSON.parse(fs.readFileSync(path.join(__dirname, 'ubigeo_distrito.json'), 'utf-8'));

// Build ubigeo lookups
const ineiMap = new Map();
const reniecMap = new Map();

for (const u of ubigeosDistrito) {
  if (u.ubigeo_inei) ineiMap.set(String(u.ubigeo_inei).padStart(6, '0'), u);
  if (u.ubigeo_reniec) reniecMap.set(String(u.ubigeo_reniec).padStart(6, '0'), u);
}

function normalizeDept(dept) {
  if (!dept) return 'LIMA';
  const d = dept.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (d.includes('ANCASH') || d.includes('NCASH')) return 'ANCASH';
  if (d.includes('APURIMAC')) return 'APURIMAC';
  if (d.includes('HUANUCO')) return 'HUANUCO';
  if (d.includes('JUNIN')) return 'JUNIN';
  if (d.includes('SAN MARTIN')) return 'SAN MARTIN';
  return d;
}

const canonicalAgencies = [];
const DEPARTAMENTOS_SET = new Set(['TODOS']);

rawAgencies.forEach((raw, idx) => {
  const ubCode = String(raw.ubigeo || '').padStart(6, '0');
  const uInfo = ineiMap.get(ubCode) || reniecMap.get(ubCode);

  let dep = normalizeDept(raw.departamento || (uInfo ? uInfo.departamento : 'LIMA'));
  let prov = uInfo ? uInfo.provincia.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : dep;
  let dist = uInfo ? uInfo.distrito.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : (raw.nombres || 'CENTRO').toUpperCase();

  DEPARTAMENTOS_SET.add(dep);

  // Clean and validate coordinates
  let lat = null;
  let lng = null;
  if (raw.lat && raw.lng) {
    let rawLat = parseFloat(raw.lat);
    let rawLng = parseFloat(raw.lng);

    // Check if inverted (lat should be -0 to -19, lng should be -68 to -82 in Peru)
    if (rawLng < -1 && rawLng > -20 && rawLat < -65 && rawLat > -85) {
      lat = rawLng;
      lng = rawLat;
    } else {
      lat = rawLat;
      lng = rawLng;
    }
  }

  const rawName = (raw.nombres || dist).toUpperCase().trim();
  const tipo = (raw.tipo || 'TIENDAS').toUpperCase().trim();
  const direccion = (raw.direccion || '').trim();
  const horario = (raw.horario || '').trim();
  const partner = raw.partner === 'SI';
  const code = `OLVA-${ubCode}-${idx + 1}`;

  const localName = rawName.startsWith('AGENTE') || rawName.startsWith('TIENDA') || rawName.startsWith('PUNTO')
    ? rawName
    : `${dist} - ${rawName}`;

  const fullName = `${dep} / ${prov} / ${dist} / ${rawName} (${tipo}) - ${direccion}`.toUpperCase();

  canonicalAgencies.push({
    id: idx + 1,
    code,
    name: `${dep} / ${prov} / ${dist} / ${rawName}`,
    nombre: `${dep} / ${prov} / ${dist} / ${rawName}`,
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
    schedule: horario || 'LUNES A VIERNES - 9:00 AM A 6:00 PM',
    horario: horario || 'LUNES A VIERNES - 9:00 AM A 6:00 PM',
    tipo,
    type: tipo,
    partner,
    is_partner: partner,
    latitude: lat,
    longitude: lng,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

console.log(`Processed ${canonicalAgencies.length} canonical Olva agencies.`);
console.log('Departments:', Array.from(DEPARTAMENTOS_SET).sort());

// Generate src/data/olvaAgencies.ts
const fileContent = `import { OlvaAgency } from '../types/database.types';

export const DEPARTAMENTOS_OLVA = ${JSON.stringify(Array.from(DEPARTAMENTOS_SET).sort(), null, 2)};

export const OLVA_AGENCIES: OlvaAgency[] = ${JSON.stringify(canonicalAgencies, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'olvaAgencies.ts'), fileContent, 'utf-8');
console.log('✓ Generated src/data/olvaAgencies.ts');
