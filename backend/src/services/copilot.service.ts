import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { queryCopilotContext, generateAssistantResponse } from './ai.service.js';
import { EvolutionService } from './evolution.service.js';
import { env } from '../config/env.js';
import { EvolutionMessageData } from '../types/evolution.types.js';


interface SubInstanceMeta {
  instanceName: string;
  ownerPhone: string;
  profileName: string;
  status: string;
}

export class CopilotService {
  /**
   * Obtiene la sub-instancia de WhatsApp vinculada del usuario (su número personal)
   */
  private static async getLinkedUserSubInstance(): Promise<SubInstanceMeta | null> {
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 10000,
      });

      const instances = Array.isArray(response.data) ? response.data : [];
      // Buscar primera sub-instancia conectada que empiece con tenant_ o tienda_
      const sub = instances.find(
        (i: any) =>
          (i.name?.startsWith('tenant_') || i.name?.startsWith('tienda_')) &&
          i.connectionStatus === 'open'
      ) || instances.find((i: any) => i.name?.startsWith('tenant_') || i.name?.startsWith('tienda_'));

      if (sub) {
        const ownerClean = sub.ownerJid?.replace(/[^0-9]/g, '') || '';
        return {
          instanceName: sub.name,
          ownerPhone: ownerClean,
          profileName: sub.profileName || 'Estephano',
          status: sub.connectionStatus || 'open',
        };
      }
      return null;
    } catch (e) {
      console.warn('[COPILOT SUB-INSTANCE WARN] Error buscando sub-instancias:', e);
      return null;
    }
  }

  /**
   * Resuelve la consulta o ejecuta la acción solicitada por el dueño del negocio
   * despachando desde su propia línea de WhatsApp si tiene Sub-QR conectado.
   */
  public static async answerCopilotQuery(
    userPhone: string,
    remoteJid: string,
    queryText: string,
    messageData?: EvolutionMessageData
  ): Promise<string> {
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');

    try {
      console.log(`[COPILOT SERVICE] 🧠 Procesando instrucción de ${cleanPhone}: "${queryText}"`);

      // 1. Detectar la sub-instancia vinculada (número propio del usuario)
      const linkedSub = await this.getLinkedUserSubInstance();
      const userSenderInstance = linkedSub?.instanceName || env.EVOLUTION_INSTANCE_NAME;
      const userSenderPhone = linkedSub?.ownerPhone || '51963097546';
      const userName = linkedSub?.profileName || 'Estephano';

      // 2. Obtener comprobantes REALES de pago en Supabase
      const { data: recentPayments } = await supabaseAdmin
        .from('comprobantes_pago')
        .select('created_at, banco_emisor, monto, moneda, numero_operacion, titular_origen, es_valido, estado_verificacion, whatsapp_sender')
        .not('banco_emisor', 'eq', 'Desconocido')
        .order('created_at', { ascending: false })
        .limit(10);

      // 3. Obtener pedidos REALES del sistema
      const { data: recentOrders } = await supabaseAdmin
        .from('pedidos')
        .select('id, created_at, nombre_cliente, estado_produccion, estado_envio, total, codigo_seguimiento, destino_detalle')
        .order('created_at', { ascending: false })
        .limit(10);

      // 4. Obtener conversaciones indexadas reales de su sub-instancia
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
        : 'No hay comprobantes de pago registrados en el sistema actualmente.';

      const ordersSummary = recentOrders && recentOrders.length > 0
        ? recentOrders.map(o => `• Pedido #${o.id?.slice(0, 6)}: ${o.nombre_cliente} | Prod: ${o.estado_produccion} | Envío: ${o.estado_envio} | Total: S/ ${o.total} | Guía: ${o.codigo_seguimiento || 'S/G'}`).join('\n')
        : 'No hay pedidos activos actualmente en el sistema.';

      const chatsSummary = recentChats && recentChats.length > 0
        ? recentChats.map(c => `• (${c.push_name || c.remote_jid.replace('@s.whatsapp.net', '')}): "${c.contenido_texto}"`).join('\n')
        : 'No hay mensajes recientes de clientes registrados.';

      const accountInfo = linkedSub
        ? `Cuenta vinculada al Sub-QR: Instancia "${linkedSub.instanceName}", Número propio: +${linkedSub.ownerPhone} (${linkedSub.profileName}), Estado: ${linkedSub.status}`
        : 'Sub-QR pendiente de sincronización.';

      const isImage = Boolean(messageData?.message?.imageMessage);
      const isDoc = Boolean(messageData?.message?.documentMessage);
      const hasAttachedMedia = isImage || isDoc;
      const attachedFileName =
        messageData?.message?.documentMessage?.fileName ||
        messageData?.message?.documentMessage?.title ||
        (isImage ? 'imagen_adjunta.jpg' : 'documento.pdf');
      const attachedMimeType =
        messageData?.message?.documentMessage?.mimetype ||
        messageData?.message?.imageMessage?.mimetype ||
        (isImage ? 'image/jpeg' : 'application/pdf');

      const masterPrompt = `
Eres el "Copiloto Master de Inteligencia de Negocios y Control de WhatsApp" de Encomi SaaS.
Estás comunicándote directamente con el dueño del negocio: ${userName} (Número personal: +${userSenderPhone}).

INFORMACIÓN DE SU CUENTA Y LÍNEA VINCULADA:
- ${accountInfo}
- Archivo o documento adjunto en este mensaje: ${hasAttachedMedia ? `SÍ (${isImage ? 'FOTO/IMAGEN' : 'DOCUMENTO'}: ${attachedFileName})` : 'NO'}

INSTRUCCIÓN DEL ADMINISTRADOR:
"${queryText}"

--- REGLAS DE EJECUCIÓN ESTRICTAS ---

1. ORDEN DE ENVIAR MENSAJE, ARCHIVO, FOTO, IMAGEN O DOCUMENTO:
Si el usuario te pide enviar un mensaje, archivo, comprobante, foto, imagen o documento a un número o cliente (ej: "manda un mensaje a 987654321 diciendo...", "envía a 987654321 este documento...", "manda esta foto a 987654321", "envía esta imagen al 987...", "reenvía a 987..."):
Debes responder ÚNICAMENTE con este JSON:
\`\`\`json
{
  "action": "SEND_WHATSAPP_MESSAGE",
  "targetPhone": "987654321",
  "text": "Texto explicativo o mensaje que acompañará al archivo/mensaje",
  "mediaUrl": null,
  "sendAttachedDoc": ${hasAttachedMedia},
  "mediaType": "${isImage ? 'image' : (isDoc ? 'document' : 'image')}",
  "fileName": "${attachedFileName}"
}
\`\`\`

2. PREGUNTAS SOBRE SU CUENTA, SUB-QR O ESTADO:
Explica con claridad que su cuenta está vinculada a su Sub-QR con su número personal (+${userSenderPhone}) y que los envíos o respuestas a clientes salen desde SU número propio.

3. PREGUNTAS GENERALES O CONVERSACIONALES (ej. "¿Cuánto es 1+1?", "Hola", "¿Cómo estás?"):
Responde DIRECTAMENTE de forma amable y concisa. NUNCA inventes ni menciones pagos, comprobantes ni pedidos si no te los han preguntado.

4. CONSULTAS DE NEGOCIOS O AUDITORÍA (ej. "¿Qué pagos entraron?", "¿Cómo van los pedidos?"):
Usa EXCLUSIVAMENTE estos datos reales:
--- COMPROBANTES DE PAGO REGISTRADOS ---
${paymentsSummary}

--- PEDIDOS ACTIVOS EN EL SISTEMA ---
${ordersSummary}

--- ÚLTIMOS CHATS DE CLIENTES ---
${chatsSummary}
--- FIN DATOS ---

REGLA DE VERACIDAD: Si las listas indican que no hay registros, responde transparentemente: "Actualmente no tienes registros pendientes en tu sistema." NUNCA inventes clientes ni montos.
`;

      const aiResponse = await queryCopilotContext(masterPrompt, queryText);

      const masterInstance = env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';

      // 5. Verificar si la IA determinó una ACCIÓN de envío
      const jsonMatch =
        aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
        aiResponse.match(/(\{[\s\S]*"action"\s*:\s*"SEND_WHATSAPP_MESSAGE"[\s\S]*\})/);

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
            const targetMediaType = actionData.mediaType || (isImage ? 'image' : 'document');
            const fileName = actionData.fileName || attachedFileName || (targetMediaType === 'image' ? 'imagen.jpg' : 'documento.pdf');

            console.log(`[COPILOT ACTION] 🚀 Despachando ${hasAttachedMedia ? targetMediaType : 'texto'} desde instancia "${userSenderInstance}" (+${userSenderPhone}) a +${target}: "${messageText}"`);

            // Si el dueño adjuntó un documento o imagen en este mensaje
            if (hasAttachedMedia && messageData) {
              try {
                console.log(`[COPILOT ACTION] Descargando buffer multimedia desde ${masterInstance}...`);
                const media = await EvolutionService.getMediaBuffer(messageData, masterInstance);
                const rawBase64 = media.buffer.toString('base64');
                const actualMime = media.mimeType || attachedMimeType;
                const finalMediaType = actualMime.startsWith('image/') ? 'image' : (actualMime.startsWith('audio/') ? 'audio' : 'document');

                console.log(`[COPILOT ACTION] Media listo (${media.buffer.length} bytes, ${actualMime}). Despachando a +${target}...`);

                await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, rawBase64, {
                  caption: messageText,
                  fileName: fileName,
                  mediaType: finalMediaType,
                  mimeType: actualMime,
                });

                console.log(`[COPILOT ACTION] ✅ Archivo ${fileName} (${finalMediaType}) despachado con éxito.`);
              } catch (mediaErr: any) {
                console.error('[COPILOT FORWARD MEDIA ERROR]', mediaErr?.response?.data || mediaErr?.message || mediaErr);
                // Fallback a texto
                await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText || 'Te comparto el archivo adjunto.');
              }
            } else if (mediaUrl && mediaUrl.startsWith('http')) {
              await EvolutionService.sendWhatsAppMedia(userSenderInstance, target, mediaUrl, {
                caption: messageText,
                fileName: fileName,
                mediaType: targetMediaType,
              });
            } else {
              await EvolutionService.sendWhatsAppMessage(userSenderInstance, target, messageText);
            }

            // Confirmar al dueño en el Master Bot
            const confirmMsg = `✅ *Mensaje despachado exitosamente desde tu número propio (+${userSenderPhone})*\n\n📱 *Destinatario:* +${target}\n💬 *Mensaje:* "${messageText}"${hasAttachedMedia || mediaUrl ? `\n📎 *Archivo enviado:* ${fileName} (${targetMediaType})` : ''}`;
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
