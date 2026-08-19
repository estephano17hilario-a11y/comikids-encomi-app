import { supabaseAdmin } from './dist/config/supabase.js';

async function main() {
  console.log("Limpiando datos de prueba antiguos...");

  // 1. Borrar mensajes falsos de prueba con Juan / 150 soles
  const { error: err1 } = await supabaseAdmin
    .from('whatsapp_mensajes_log')
    .delete()
    .or('remote_jid.eq.51988776655@s.whatsapp.net,push_name.ilike.%Comprador Juan%,message_id.ilike.SUB_MSG_%');
  console.log("Mensajes de test eliminados:", err1 || "OK");

  // 2. Borrar comprobantes falsos de test
  const { error: err2 } = await supabaseAdmin
    .from('comprobantes_pago')
    .delete()
    .or('whatsapp_sender.eq.51988776655,numero_operacion.ilike.%TEST%');
  console.log("Comprobantes de test eliminados:", err2 || "OK");

  // 3. Borrar logs que sean de grupos de WhatsApp (@g.us)
  const { error: err3 } = await supabaseAdmin
    .from('whatsapp_mensajes_log')
    .delete()
    .ilike('remote_jid', '%@g.us');
  console.log("Logs de grupos eliminados:", err3 || "OK");

  console.log("Limpieza completada.");
  process.exit(0);
}

main();
