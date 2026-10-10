import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Cargar variables de entorno desde .env
const envPath = path.resolve(__dirname, '../.env');
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://api.89.117.73.97.sslip.io';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU';
const SHALOM_API_KEY = process.env.SHALOM_API_KEY || envVars.SHALOM_API_KEY || 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const SHALOM_API_URL = (process.env.SHALOM_API_URL || envVars.SHALOM_API_URL || 'https://api.shalom-api-peru.com').replace(/\/+$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeItem(raw) {
  let scheduleText = 'Lunes a Sábado: 8:00 AM - 8:00 PM';
  if (typeof raw.horario === 'string' && raw.horario.trim()) {
    scheduleText = raw.horario.trim();
  } else if (raw.horario && typeof raw.horario === 'object' && raw.horario.hora_atencion) {
    scheduleText = raw.horario.hora_atencion.trim();
  }

  const department = (raw.departamento || 'LIMA').toUpperCase().trim();
  const province = (raw.provincia || 'LIMA').toUpperCase().trim();
  const district = (raw.distrito || raw.lugar_over || raw.zona || 'CENTRO').toUpperCase().trim();
  const code = raw.abrebiatura || raw.code || null;
  const name = (raw.nombre || '').trim();
  const address = (raw.direccion || '').trim();

  // Ubigeo (6 dígitos)
  let ubigeo = null;
  if (raw.ubi_id) {
    ubigeo = String(raw.ubi_id).padStart(6, '0');
  } else if (raw.ubigeo) {
    ubigeo = String(raw.ubigeo).padStart(6, '0');
  }

  // Nombre Completo Detallado Normalizado
  const codeTag = code ? ` (CÓDIGO: ${code})` : '';
  const fullName = `${department} / ${province} / ${district} / ${name}${address ? ` - ${address}` : ''}${codeTag}`.toUpperCase();

  return {
    id: raw.id,
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
    phone: raw.telefono || '(01) 500-7878',
    telefono: raw.telefono || '(01) 500-7878',
    schedule: scheduleText,
    horario: scheduleText,
    latitude: typeof raw.latitud === 'number' ? raw.latitud : null,
    longitude: typeof raw.longitud === 'number' ? raw.longitud : null,
    is_active: true,
    updated_at: new Date().toISOString()
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

async function runShalomSync() {
  console.log('====================================================');
  console.log('🚀 INICIANDO SINCRONIZACIÓN SHALOM PERÚ (POSTGIS DB)');
  console.log('====================================================');
  console.log(`📡 URL API: ${SHALOM_API_URL}`);
  console.log(`🔑 Key detectada: ${SHALOM_API_KEY ? 'Sí (sk_...)' : 'No'}`);
  console.log(`🗄️  Supabase URL: ${SUPABASE_URL}`);
  console.log('----------------------------------------------------');

  const startTime = Date.now();
  let allAgencies = [];
  let page = 1;
  const perPage = 50;
  let hasMore = true;

  console.log('🔄 Iniciando ingesta dinámica de agencias Shalom...');

  while (hasMore) {
    const url = `${SHALOM_API_URL}/v1/agencies?page=${page}&per_page=${perPage}`;
    console.log(`📥 Solicitando Página ${page}...`);

    try {
      const res = await fetch(url, {
        headers: {
          'X-API-Key': SHALOM_API_KEY,
          'User-Agent': 'Incomi-Cron-Sync/1.0'
        }
      });

      if (!res.ok) {
        console.error(`❌ Error en Página ${page}: ${res.status} ${res.statusText}`);
        break;
      }

      const json = await res.json();
      // Extraer array sin importar si viene en items, data o directamente como arreglo
      const items = Array.isArray(json) ? json : (json.items || json.data || []);

      if (!items || items.length === 0) {
        console.log(`🏁 No hay más agencias en la página ${page}. Finalizando bucle.`);
        hasMore = false;
      } else {
        allAgencies = [...allAgencies, ...items];
        console.log(`  ✅ Página ${page} procesada: +${items.length} agencias (Acumulado: ${allAgencies.length})`);

        // Si devolvió menos elementos que perPage, alcanzamos la última página
        if (items.length < perPage) {
          hasMore = false;
        } else {
          page++;
          // Pausa de 500ms para no superar el Rate Limit (60 req/min)
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      console.error(`❌ Error de red en página ${page}:`, err);
      break;
    }
  }

  console.log('----------------------------------------------------');
  console.log(`🎉 Ingesta HTTP finalizada. Total agencias recibidas de Shalom: ${allAgencies.length}`);
  
  const normalized = allAgencies.map(normalizeItem);
  const apiIdsSet = new Set(normalized.map(a => Number(a.id)));

  // 1. Obtener agencias existentes en Supabase para cálculo de Diff
  console.log('🔍 Analizando estado previo en Supabase para detección de cambios...');
  const { data: existingRows } = await supabase
    .from('shalom_agencies')
    .select('id, name, full_name, address, schedule, is_active, previous_name, previous_address, previous_agency_info, name_changed_at, deleted_at, department, province, district, code, ubigeo, dep_id, prov_id, dist_id, latitude, longitude, phone');

  const existingMap = new Map((existingRows || []).map(r => [Number(r.id), r]));
  
  let newCount = 0;
  let updatedCount = 0;
  let nameChangedCount = 0;
  let reactivatedCount = 0;
  const toDeactivateAgencies = [];
  const nowIso = new Date().toISOString();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  normalized.forEach(item => {
    const existing = existingMap.get(Number(item.id));
    if (!existing) {
      newCount++;
    } else {
      // Comparar cambios de nombre
      const nameWasChanged = (existing.name || '').trim().toUpperCase() !== (item.name || '').trim().toUpperCase();
      const addrWasChanged = (existing.address || '').trim().toUpperCase() !== (item.address || '').trim().toUpperCase();
      
      if (nameWasChanged) {
        nameChangedCount++;
        item.previous_name = existing.name;
        item.previous_address = existing.address;
        item.previous_agency_info = existing.full_name || `${existing.name} - ${existing.address}`;
        item.name_changed_at = nowIso;
      } else if (existing.previous_name) {
        // Preservar nombre anterior si aún está dentro de los 30 días de vigencia
        const changedTime = existing.name_changed_at ? new Date(existing.name_changed_at).getTime() : 0;
        if (changedTime && Date.now() - changedTime <= thirtyDaysMs) {
          item.previous_name = existing.previous_name;
          item.previous_address = existing.previous_address;
          item.previous_agency_info = existing.previous_agency_info;
          item.name_changed_at = existing.name_changed_at;
        }
      }

      if (existing.is_active === false) {
        reactivatedCount++;
        item.is_active = true;
        item.deleted_at = null;
      } else if (nameWasChanged || addrWasChanged || existing.schedule !== item.schedule) {
        updatedCount++;
      }
    }
  });

  // Detectar agencias que Shalom eliminó del API oficial
  existingMap.forEach((existing, dbId) => {
    if (existing.is_active !== false && !apiIdsSet.has(dbId)) {
      toDeactivateAgencies.push({
        ...existing,
        is_active: false,
        deleted_at: existing.deleted_at || nowIso,
        previous_name: existing.previous_name || existing.name,
        previous_agency_info: existing.previous_agency_info || existing.full_name || `${existing.name} - ${existing.address}`,
        updated_at: nowIso
      });
    }
  });

  console.log('----------------------------------------------------');
  console.log(`📊 DIFERENCIAL DETECTADO:`);
  console.log(`  ✨ Nuevas agencias detectadas           : ${newCount}`);
  console.log(`  📝 Agencias con cambios generales       : ${updatedCount}`);
  console.log(`  🔄 Agencias con nombre cambiado reciente: ${nameChangedCount}`);
  console.log(`  🌟 Agencias reactivadas                 : ${reactivatedCount}`);
  console.log(`  🛑 Agencias cerradas/eliminadas (bajas) : ${toDeactivateAgencies.length}`);
  console.log('----------------------------------------------------');

  // 2. Guardar / Batch Upsert en Supabase (Lotes de 100)
  console.log('💾 Procediendo a Batch Upsert en Supabase PostgreSQL...');
  let upserted = 0;
  const batchSize = 100;
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize).map(toDbRow);
    const { error } = await supabase
      .from('shalom_agencies')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Error en lote ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      upserted += batch.length;
      console.log(`  💾 Lote ${Math.floor(i / batchSize) + 1} sincronizado (${upserted}/${normalized.length})...`);
    }
  }

  // 3. Desactivar agencias que ya no existen en la API (marcar is_active=false y deleted_at=now)
  if (toDeactivateAgencies.length > 0) {
    console.log(`🛑 Desactivando ${toDeactivateAgencies.length} agencias cerradas por Shalom (con deleted_at para vigencia de 30 días)...`);
    for (const deact of toDeactivateAgencies) {
      const { error: deactError } = await supabase
        .from('shalom_agencies')
        .update({
          is_active: false,
          deleted_at: deact.deleted_at,
          previous_name: deact.previous_name,
          previous_agency_info: deact.previous_agency_info,
          updated_at: nowIso
        })
        .eq('id', deact.id);

      if (deactError) {
        console.warn(`⚠️ Error al desactivar agencia ID ${deact.id}:`, deactError.message);
      }
    }
    console.log(`  ✅ ${toDeactivateAgencies.length} agencias marcadas como inactivas con vigencia de 30 días.`);
  }

  // 4. Actualizar respaldo local en JSON y código estático (incluyendo agencias borradas con < 30 días de vigencia)
  try {
    fs.mkdirSync('data', { recursive: true });

    // Obtener agencias que están inactivas pero eliminadas hace menos de 30 días
    const recentDeleted = [];
    existingMap.forEach((ag) => {
      const isApiPresent = apiIdsSet.has(Number(ag.id));
      if (!isApiPresent) {
        const delTime = ag.deleted_at ? new Date(ag.deleted_at).getTime() : Date.now();
        if (Date.now() - delTime <= thirtyDaysMs) {
          recentDeleted.push({
            ...normalizeItem(ag),
            is_active: false,
            deleted_at: ag.deleted_at || nowIso,
            previous_name: ag.previous_name || ag.name,
            previous_agency_info: ag.previous_agency_info || ag.full_name,
            updated_at: ag.updated_at || nowIso
          });
        }
      }
    });

    const catalogWithVigencia = [...normalized, ...recentDeleted];
    fs.writeFileSync('data/shalom_agencies_full.json', JSON.stringify(catalogWithVigencia, null, 2), 'utf8');

    const staticTs = `import { ShalomAgency } from '../types/database.types';

export const DEPARTAMENTOS_PERU = [
  'TODOS',
  'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO', 'CAJAMARCA',
  'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO', 'ICA', 'JUNIN',
  'LA LIBERTAD', 'LAMBAYEQUE', 'LIMA', 'LORETO', 'MADRE DE DIOS', 'MOQUEGUA',
  'PASCO', 'PIURA', 'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI'
];

export const SHALOM_AGENCIES: ShalomAgency[] = ${JSON.stringify(catalogWithVigencia, null, 2)};
`;
    fs.writeFileSync('src/data/shalomAgencies.ts', staticTs, 'utf8');
    console.log(`📁 Respaldo offline sincronizado en data/ y src/data/shalomAgencies.ts (${catalogWithVigencia.length} agencias: ${normalized.length} activas + ${recentDeleted.length} borradas con vigencia 30d).`);
  } catch (fsErr) {
    console.warn('⚠️ No se pudo actualizar el archivo local:', fsErr.message);
  }

  // 5. Prueba rápida de consulta espacial PostGIS
  console.log('🧪 Verificando consulta espacial PostGIS (Agencias cercanas a Lima Centro)...');
  const testLat = -12.046374;
  const testLng = -77.042793;

  const { data: nearby, error: rpcError } = await supabase.rpc('get_nearby_shalom_agencies', {
    user_lat: testLat,
    user_lng: testLng,
    max_limit: 3
  });

  if (rpcError) {
    console.warn('⚠️ Nota al probar RPC espacial:', rpcError.message);
  } else if (nearby && nearby.length > 0) {
    console.log('📍 3 Agencias más cercanas encontradas:');
    nearby.forEach((ag, idx) => {
      console.log(`  ${idx + 1}. [${ag.code || 'N/A'}] ${ag.name} (${(ag.distance_meters / 1000).toFixed(2)} km)`);
    });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('====================================================');
  console.log(`🏁 Sincronización completada exitosamente en ${durationSec}s.`);
  console.log(`📊 TOTAL ACTIVAS: ${normalized.length} AGENCIAS`);
  console.log('====================================================');
}

runShalomSync().catch((err) => {
  console.error('❌ Error fatal en sincronización:', err);
  process.exit(1);
});
