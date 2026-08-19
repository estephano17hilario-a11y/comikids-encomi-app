import { supabaseAdmin } from '../config/supabase.js';
import { GeminiService } from './gemini.service.js';
import { EvolutionService } from './evolution.service.js';
import { env } from '../config/env.js';

export class CopilotService {
  /**
   * Resuelve la consulta o ejecuta la acción solicitada por el dueño del negocio
   * a través del Master Bot inmutable.
   */
  public static async answerCopilotQuery(
    userPhone: string,
    remoteJid: string,
    queryText: string
  ): Promise<string> {
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');

    try {
      console.log(`[COPILOT SERVICE] 🧠 Procesando instrucción de ${cleanPhone}: "${queryText}"`);

      // 1. Identificar si el usuario tiene datos en la tabla usuarios
      const { data: user } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre_completo, rol')
        .or(`dni.eq."${cleanPhone}",dni.ilike."%${cleanPhone.slice(-8)}%"`)
        .maybeSingle();

      const userName = user?.nombre_completo || 'Administrador';

      // 2. Obtener comprobantes REALES de pago (excluyendo tests)
      const { data: recentPayments } = await supabaseAdmin
        .from('comprobantes_pago')
        .select('created_at, banco_emisor, monto, moneda, numero_operacion, titular_origen, es_valido, estado_verificacion, whatsapp_sender')
        .not('banco_emisor', 'eq', 'Desconocido')
        .order('created_at', { ascending: false })
        .limit(15);

      // 3. Obtener pedidos REALES del sistema
      const { data: recentOrders } = await supabaseAdmin
        .from('pedidos')
        .select('id, created_at, nombre_cliente, estado_produccion, estado_envio, total, codigo_seguimiento, destino_detalle')
        .order('created_at', { ascending: false })
        .limit(15);

      // 4. Obtener conversaciones recientes legítimas (no de grupos @g.us)
      const { data: recentChats } = await supabaseAdmin
        .from('whatsapp_mensajes_log')
        .select('created_at, push_name, remote_jid, tipo_mensaje, contenido_texto')
        .not('remote_jid', 'ilike', '%@g.us%')
        .not('contenido_texto', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);

      // Formatear resúmenes limpios
      const paymentsSummary = recentPayments && recentPayments.length > 0
        ? recentPayments.map(p => `• [${new Date(p.created_at).toLocaleTimeString('es-PE')}] ${p.banco_emisor} ${p.moneda} ${p.monto} (Op: ${p.numero_operacion || 'S/N'}, De: ${p.titular_origen || p.whatsapp_sender})`).join('\n')
        : 'No hay comprobantes de pago registrados recientemente.';

      const ordersSummary = recentOrders && recentOrders.length > 0
        ? recentOrders.map(o => `• Pedido #${o.id?.slice(0, 6)}: ${o.nombre_cliente} | Prod: ${o.estado_produccion} | Envío: ${o.estado_envio} | Total: S/ ${o.total} | Guía: ${o.codigo_seguimiento || 'S/G'}`).join('\n')
        : 'No hay pedidos activos actualmente.';

      const chatsSummary = recentChats && recentChats.length > 0
        ? recentChats.map(c => `• (${c.push_name || c.remote_jid.replace('@s.whatsapp.net', '')}): "${c.contenido_texto}"`).join('\n')
        : 'No hay mensajes recientes de clientes.';

      const masterPrompt = `
Eres el "Copiloto Master de Inteligencia de Negocios y Control de WhatsApp" de Encomi SaaS para el administrador (${userName}).

INSTRUCCIÓN DEL ADMINISTRADOR:
"${queryText}"

--- REGLAS DE EJECUCIÓN (MUY IMPORTANTE) ---

1. ACCIÓN DE ENVÍO DE MENSAJE O ARCHIVO:
Si el usuario te ordena enviar un mensaje o archivo a un número (ej. "manda un mensaje a 987654321 diciendo...", "envía a 51987654321 la guía...", "escribe a..."):
Debes responder con este formato JSON exacto:
\`\`\`json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "targetPhone": "51987654321",
  "text": "Texto exacto que se enviará al cliente",
  "mediaUrl": "https://url-del-archivo-si-lo-mencionó (o null)",
  "fileName": "nombre_archivo.pdf (o null)"
}
\`\`\`

2. PREGUNTAS GENERALES O CONVERSACIONALES (ej. "¿Cuánto es 1+1?", "Hola", "¿Qué hora es?", "¿Cómo estás?"):
Responde DIRECTA, SIMPLE Y NATURALMENTE a la pregunta. NUNCA pegues ni menciones comprobantes, pagos ni clientes si el usuario no los ha pedido.

3. CONSULTAS DE NEGOCIOS O AUDITORÍA (ej. "¿Qué pagos entraron?", "¿Cómo van los pedidos?", "¿Quién escribió?"):
Usa EXCLUSIVAMENTE los datos reales aquí presentes:
--- COMPROBANTES DE PAGO REGISTRADOS ---
${paymentsSummary}

--- PEDIDOS ACTIVOS EN EL SISTEMA ---
${ordersSummary}

--- ÚLTIMOS MENSAJES DE CLIENTES ---
${chatsSummary}
--- FIN DATOS ---

REGLA ESTRICTA CONTRA ALUCINACIONES:
- Si las listas dicen "No hay...", di con total transparencia: "Actualmente no tienes comprobantes/pedidos registrados."
- NUNCA inventes nombres de clientes, montos de dinero, números de operación ni horas.
`;

      const aiResponse = await GeminiService.generateAssistantResponse(masterPrompt, {
        storeName: 'Comikids Bordados & Estilo',
        customerName: userName,
      });

      const masterInstance = env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';

      // 5. Verificar si la IA determinó una ACCIÓN de envío
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/(\{[\s\S]*"action"\s*:\s*"SEND_WHATSAPP_MESSAGE"[\s\S]*\})/);

      if (jsonMatch) {
        try {
          const actionData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (actionData.action === 'SEND_WHATSAPP_MESSAGE' && actionData.targetPhone) {
            let target = String(actionData.targetPhone).replace(/[^0-9]/g, '');
            if (target.length === 9) {
              target = `51${target}`;
            }

            const messageText = actionData.text || '';
            const mediaUrl = actionData.mediaUrl;
            const fileName = actionData.fileName;

            console.log(`[COPILOT ACTION] 🚀 Ejecutando envío a ${target}: "${messageText}" (Media: ${mediaUrl})`);

            if (mediaUrl && mediaUrl.startsWith('http')) {
              await EvolutionService.sendWhatsAppMedia(masterInstance, target, mediaUrl, {
                caption: messageText,
                fileName: fileName || 'archivo.pdf',
              });
            } else {
              await EvolutionService.sendWhatsAppMessage(masterInstance, target, messageText);
            }

            // Confirmación al dueño
            const confirmMsg = `✅ *Mensaje despachado exitosamente*\n\n📱 *Destinatario:* +${target}\n💬 *Mensaje:* "${messageText}"${mediaUrl ? `\n📎 *Adjunto:* ${fileName || mediaUrl}` : ''}`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, confirmMsg);
            return confirmMsg;
          }
        } catch (parseErr) {
          console.warn('[COPILOT ACTION PARSE WARN]', parseErr);
        }
      }

      // 6. Respuesta conversacional limpia al dueño
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, aiResponse);
      return aiResponse;
    } catch (error: any) {
      console.error('[COPILOT ERROR]', error);
      const fallbackReply = '⚠️ Hubo una incidencia procesando tu solicitud. Por favor intenta nuevamente.';
      await EvolutionService.sendWhatsAppMessage(env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp', remoteJid, fallbackReply);
      return fallbackReply;
    }
  }
}
