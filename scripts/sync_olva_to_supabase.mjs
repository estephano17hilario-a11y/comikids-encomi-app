import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://aeydfijgogbuhfuxcqqp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.warn('⚠️ No SUPABASE_SERVICE_ROLE_KEY found, using anon key');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

// Import raw agencies from generated olvaAgencies.ts or JSON
const rawDataPath = path.join(__dirname, '..', 'src', 'data', 'olvaAgencies.ts');
const rawContent = fs.readFileSync(rawDataPath, 'utf-8');

// Extract JSON array from export const OLVA_AGENCIES = [...]
const jsonMatch = rawContent.match(/export const OLVA_AGENCIES:\s*OlvaAgency\[\]\s*=\s*(\[[\s\S]*?\]);/);
if (!jsonMatch) {
  console.error('Could not parse OLVA_AGENCIES from src/data/olvaAgencies.ts');
  process.exit(1);
}

const agencies = JSON.parse(jsonMatch[1]);
console.log(`🚀 Sincronizando ${agencies.length} agencias Olva a Supabase (${SUPABASE_URL})...`);

async function syncToSupabase() {
  const formattedRows = agencies.map(ag => ({
    id: ag.id,
    code: ag.code,
    name: ag.name,
    full_name: ag.full_name,
    department: ag.department || ag.departamento,
    province: ag.province || ag.provincia,
    district: ag.district || ag.distrito,
    ubigeo: ag.ubigeo,
    address: ag.address || ag.direccion,
    phone: ag.phone || ag.telefono,
    schedule: ag.schedule || ag.horario,
    tipo: ag.tipo || ag.type,
    is_partner: Boolean(ag.is_partner || ag.partner),
    latitude: ag.latitude ? Number(ag.latitude) : null,
    longitude: ag.longitude ? Number(ag.longitude) : null,
    is_active: true,
    updated_at: new Date().toISOString()
  }));

  // Batch upsert in chunks of 50
  const chunkSize = 50;
  let totalInserted = 0;

  for (let i = 0; i < formattedRows.length; i += chunkSize) {
    const chunk = formattedRows.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('olva_agencies')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.warn(`[CHUNK ${i / chunkSize + 1} WARN]`, error.message);
    } else {
      totalInserted += chunk.length;
      console.log(`✓ Batch ${i / chunkSize + 1}: ${totalInserted}/${formattedRows.length} agencias sincronizadas.`);
    }
  }

  console.log(`🎉 ¡Sincronización completa! Total en base de datos: ${totalInserted} agencias Olva.`);
}

syncToSupabase().catch(err => {
  console.error('Error during Supabase sync:', err);
});
