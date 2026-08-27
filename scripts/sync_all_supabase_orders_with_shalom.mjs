import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwmdjsxwetjvsxsdngko.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE5MTEsImV4cCI6MjEwMjIxNzkxMX0.KaqryIyoe4IDQGTJD_cswZkW-wfgnMcyV9tJoWxHMq8';
const SHALOM_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const SHALOM_EMAIL = 'milagrosjanetamis@gmail.com';
const SHALOM_PASSWORD = '986398Mi$';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncAll() {
  console.log('[*] Descargando todas las órdenes activas de Shalom Pro...');
  const allShalomOrders = [];

  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://api.shalom-api-peru.com/v1/orders?per_page=100&page=${page}`, {
      headers: {
        'X-API-Key': SHALOM_API_KEY,
        'X-Shalom-Email': SHALOM_EMAIL,
        'X-Shalom-Password': SHALOM_PASSWORD,
      }
    });
    const json = await res.json();
    const list = json.orders || json.data || [];
    for (const item of list) {
      if (item && item.id) allShalomOrders.push(item);
    }
  }

  // Ordenar por ID descendente (las más recientes primero)
  allShalomOrders.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  console.log(`[*] Total órdenes en Shalom Pro: ${allShalomOrders.length}`);

  // Agrupar órdenes por DNI del destinatario
  const shalomByDni = {};
  for (const o of allShalomOrders) {
    const dni = String(o.receiver?.document || '').replace(/\D/g, '').trim();
    if (dni && dni.length >= 6) {
      if (!shalomByDni[dni]) {
        shalomByDni[dni] = [];
      }
      shalomByDni[dni].push(o);
    }
  }

  // Descargar pedidos de Supabase
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('id, codigo_seguimiento, shalom_ose_id, shalom_numero_guia, shalom_clave_recojo, registrado_shalom, destino_detalle');

  if (error) {
    console.error('[-] Error obteniendo pedidos:', error);
    return;
  }

  console.log(`[*] Procesando ${pedidos.length} pedidos de Supabase...`);

  let updatedCount = 0;

  for (const pedido of pedidos) {
    // Extraer DNI del destino_detalle o del pedido
    const dniMatch = (pedido.destino_detalle || '').match(/DNI[^:\d]*:\s*([0-9]{8,11})/i) ||
                     (pedido.destino_detalle || '').match(/\b([0-9]{8})\b/);
    const dni = dniMatch ? dniMatch[1] : '';

    if (!dni) continue;

    const shalomOrders = shalomByDni[dni];
    if (shalomOrders && shalomOrders.length > 0) {
      // Tomar la orden MÁS RECIENTE activa (ID más alto)
      const newestShalomOrder = shalomOrders[0];
      const fullGuia = `${newestShalomOrder.serie || ''}-${newestShalomOrder.guia || ''}`;
      const oseId = String(newestShalomOrder.id);
      const pin = newestShalomOrder.pickup_code || newestShalomOrder.codigo || null;

      // Verificar si necesita actualización
      const needsUpdate = 
        pedido.shalom_ose_id !== oseId ||
        pedido.shalom_numero_guia !== fullGuia ||
        !pedido.registrado_shalom;

      if (needsUpdate) {
        console.log(`[+] Actualizando Pedido #${pedido.codigo_seguimiento} (DNI ${dni}):`);
        console.log(`    Antiguo: OSE=${pedido.shalom_ose_id} | Guía=${pedido.shalom_numero_guia}`);
        console.log(`    NUEVO (Más Reciente): OSE=${oseId} | Guía=${fullGuia} | PIN=${pin}`);

        const { error: updErr } = await supabase
          .from('pedidos')
          .update({
            shalom_ose_id: oseId,
            shalom_numero_guia: fullGuia,
            ...(pin ? { shalom_clave_recojo: pin } : {}),
            registrado_shalom: true,
          })
          .eq('id', pedido.id);

        if (updErr) {
          console.error(`    [-] Error actualizando pedido ${pedido.id}:`, updErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`\n[✓] Sincronización completada. ${updatedCount} pedidos actualizados con las guías más recientes.`);
}

syncAll().catch(console.error);
