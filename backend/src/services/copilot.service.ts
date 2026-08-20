import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { queryCopilotContext, generateAssistantResponse } from './ai.service.js';
import { EvolutionService } from './evolution.service.js';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';
import { EvolutionMessageData } from '../types/evolution.types.js';

interface SubInstanceMeta {
  instanceName: string;
  ownerPhone: string;
  profileName: string;
  status: string;
  accountCode: string;
}

// 1. LISTA DE NÚMEROS ADMINISTRATIVOS PERMITIDOS (WHITELIST)
const ALLOWED_ADMIN_PHONES = new Set([
  '51963097546', // Estephano (Admin)
  '51927781412', // Comikids Pijamas
  '51901985319', // Master Bot
  '963097546',
  '927781412',
  '901985319',
]);

// 2. CUENTAS / SUB-QRS PREDEFINIDOS CON SUS CÓDIGOS DE ACCESO
interface KnownAccount {
  code: string;
  aliases: string[];
  instanceName: string;
  ownerPhone: string;
  displayName: string;
}

const KNOWN_ACCOUNTS: KnownAccount[] = [
  {
    code: 'COMIKIDS',
    aliases: ['1', 'COM', 'COMIKIDS', 'COM-01', '927781412', '51927781412', 'PIJAMAS'],
    instanceName: 'tenant_Comikids',
    ownerPhone: '51927781412',
    displayName: 'Comikids Pijamas (Línea Principal)',
  },
  {
    code: 'MATRIX',
    aliases: ['2', 'MAT', 'MATRIX', 'ADM-01', '963097546', '51963097546', 'ESTEPHANO'],
    instanceName: 'tenant_matrix',
    ownerPhone: '51963097546',
    displayName: 'Estephano Matrix (Línea Personal)',
  },
];

export class CopilotService {
  /**
   * Obtiene la metadata de una sub-instancia por nombre o número
   */
  private static async getSubInstanceByName(targetInstanceName: string): Promise<SubInstanceMeta | null> {
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 10000,
      });

      const instances = Array.isArray(response.data) ? response.data : [];
      const sub = instances.find((i: any) => i.name === targetInstanceName);

      if (sub) {
        const ownerClean = sub.ownerJid?.replace(/[^0-9]/g, '') || '';
        return {
          instanceName: sub.name,
          ownerPhone: ownerClean,
          profileName: sub.profileName || sub.name,
          status: sub.connectionStatus || 'open',
          accountCode: sub.name.replace(/^tenant_/, '').toUpperCase(),
        };
      }
      return null;
    } catch (e) {
      console.warn('[COPILOT SUB-INSTANCE WARN] Error buscando sub-instancia:', e);
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
    const masterInstance = env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';
    const textTrimmed = (queryText || '').trim();

    try {
      console.log(`[COPILOT SERVICE] 🧠 Procesando mensaje de ${cleanPhone}: "${textTrimmed}"`);

      // -------------------------------------------------------------
      // PASO 1: VERIFICAR LISTA DE NÚMEROS PERMITIDOS (WHITELIST)
      // -------------------------------------------------------------
      const isAllowed = ALLOWED_ADMIN_PHONES.has(cleanPhone) || ALLOWED_ADMIN_PHONES.has(cleanPhone.slice(-9));
      if (!isAllowed) {
        console.warn(`[COPILOT AUTH] Número no autorizado intentó acceder: ${cleanPhone}`);
        const accessDeniedMsg = '⛔ *Acceso Restringido*\n\nEste canal es privado para el personal administrativo y operativo autorizado de Comikids.';
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, accessDeniedMsg);
        return accessDeniedMsg;
      }

      // -------------------------------------------------------------
      // PASO 2: COMANDO PARA CAMBIAR DE CUENTA / LOGOUT
      // -------------------------------------------------------------
      const normalizedQuery = textTrimmed.toLowerCase();
      const sessionKey = `copilot:session:${cleanPhone}`;

      const isSwitchAccountIntent =
        normalizedQuery.includes('cambiar cuenta') ||
        normalizedQuery.includes('cambiar de cuenta') ||
        normalizedQuery.includes('cambiar mi cuenta') ||
        normalizedQuery.includes('cambiar sub qr') ||
        normalizedQuery.includes('cambiar el sub qr') ||
        normalizedQuery.includes('cambiar de sub qr') ||
        normalizedQuery.includes('cambiar qr') ||
        normalizedQuery.includes('me equivoque') ||
        normalizedQuery.includes('me equivoqué') ||
        normalizedQuery.includes('otra cuenta') ||
        normalizedQuery.includes('usar otra cuenta') ||
        normalizedQuery.includes('codigo unico') ||
        normalizedQuery.includes('código único') ||
        normalizedQuery.includes('pedir codigo') ||
        normalizedQuery.includes('pedir código') ||
        normalizedQuery === '/cambiar' ||
        normalizedQuery === '/cambiar_cuenta' ||
        normalizedQuery === 'cambiar' ||
        normalizedQuery === '/logout' ||
        normalizedQuery === 'cerrar sesion' ||
        normalizedQuery === 'salir';

      if (isSwitchAccountIntent) {
        await redisClient.del(sessionKey);
        const switchMenuMsg = `🔄 *Cambio de Cuenta de Sub-QR*\n\nIngresa el *CÓDIGO ÚNICO* de la cuenta o Sub-QR al que deseas conectarte:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ +51 927 781 412 (Comikids Pijamas)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ +51 963 097 546 (Estephano Matrix)\n\n💬 *Responde con tu código único para activar la cuenta:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, switchMenuMsg);
        return switchMenuMsg;
      }


      // -------------------------------------------------------------
      // PASO 3: GESTIÓN DE SESIÓN Y VINCULACIÓN DE CÓDIGO DE CUENTA
      // -------------------------------------------------------------
      let activeInstanceName = await redisClient.get(sessionKey);

      // Si aún no tiene cuenta vinculada en su sesión
      if (!activeInstanceName) {
        // Verificar si el mensaje actual es un intento de ingresar el código de cuenta
        const matchedAccount = KNOWN_ACCOUNTS.find(acc =>
          acc.aliases.some(alias => alias.toLowerCase() === normalizedQuery)
        );

        if (matchedAccount) {
          // Guardar sesión vinculada por 7 días
          await redisClient.set(sessionKey, matchedAccount.instanceName, 'EX', 86400 * 7);
          const welcomeMsg = `✅ *¡Cuenta Vinculada con Éxito!*\n\n👤 *Cuenta Activa:* ${matchedAccount.displayName}\n📱 *Línea Emisora:* +${matchedAccount.ownerPhone}\n⚡ *Instancia:* \`${matchedAccount.instanceName}\`\n\n✨ A partir de ahora, todos los mensajes a clientas, envíos de archivos y consultas se gestionarán desde esta línea (+${matchedAccount.ownerPhone}).\n\n💡 *¿En qué te puedo ayudar hoy?*\n_(Escribe *cambiar cuenta* en cualquier momento si deseas alternar a otro Sub-QR)_`;
          await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, welcomeMsg);
          return welcomeMsg;
        }

        // Si no coincidió con ningún código, pedirle el código de cuenta
        const authRequestMsg = `👋 *¡Hola! Bienvenido al Copiloto Encomi AI*\n\n🔒 Para identificar qué Sub-QR utilizarás para tus consultas y envíos, ingresa tu *Código de Cuenta*:\n\n1️⃣ Escribe *COMIKIDS* (o *1*) ➔ Sub-QR Línea Principal (+51 927 781 412)\n2️⃣ Escribe *MATRIX* (o *2*) ➔ Sub-QR Línea Personal (+51 963 097 546)\n\n💬 *Por favor escribe tu código para continuar:*`;
        await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, authRequestMsg);
        return authRequestMsg;
      }

      // -------------------------------------------------------------
      // PASO 4: SESIÓN AUTORIZADA — RESOLVER SUB-INSTANCIA VINCULADA
      // -------------------------------------------------------------
      let linkedSub = await this.getSubInstanceByName(activeInstanceName);
      if (!linkedSub) {
        // Fallback a Comikids (+51927781412) si la instancia guardada no responde
        linkedSub = await this.getSubInstanceByName('tenant_Comikids');
      }

      const userSenderInstance = linkedSub?.instanceName || 'tenant_Comikids';
      const userSenderPhone = linkedSub?.ownerPhone || '51927781412';
      const userName = linkedSub?.profileName || 'Comikids';

      // -------------------------------------------------------------
      // PASO 5: OBTENER CONTEXTO REAL DE NEGOCIO (Comprobantes, Pedidos y Chats)
      // -------------------------------------------------------------
      const { data: recentPayments } = await supabaseAdmin
        .from('comprobantes_pago')
        .select('created_at, banco_emisor, monto, moneda, numero_operacion, titular_origen, es_valido, estado_verificacion, whatsapp_sender')
        .not('banco_emisor', 'eq', 'Desconocido')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: recentOrders } = await supabaseAdmin
        .from('pedidos')
        .select('id, created_at, nombre_cliente, estado_produccion, estado_envio, total, codigo_seguimiento, destino_detalle')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: recentChats } = await supabaseAdmin
        .from('whatsapp_mensajes_log')
        .select('created_at, push_name, remote_jid, tipo_mensaje, contenido_texto')
        .not('remote_jid', 'ilike', '%@g.us%')
        .not('contenido_texto', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);

      const paymentsSummary = recentPayments && recentPayments.length > 0
        ? recentPayments.map(p => `• [${new Date(p.created_at).toLocaleTimeString('es-PE')}] ${p.banco_emisor} ${p.moneda} ${p.monto} (Op: ${p.numero_operacion || 'S/N'}, De: ${p.titular_origen || p.whatsapp_sender})`).join('\n')
        : 'No hay comprobantes de pago registrados en el sistema actualmente.';

      const ordersSummary = recentOrders && recentOrders.length > 0
        ? recentOrders.map(o => `• Pedido #${o.id?.slice(0, 6)}: ${o.nombre_cliente} | Prod: ${o.estado_produccion} | Envío: ${o.estado_envio} | Total: S/ ${o.total} | Guía: ${o.codigo_seguimiento || 'S/G'}`).join('\n')
        : 'No hay pedidos activos actualmente en el sistema.';

      const chatsSummary = recentChats && recentChats.length > 0
        ? recentChats.map(c => `• (${c.push_name || c.remote_jid.replace('@s.whatsapp.net', '')}): "${c.contenido_texto}"`).join('\n')
        : 'No hay mensajes recientes de clientes registrados.';

      const accountInfo = `Cuenta activa: Instancia "${userSenderInstance}", Número emisor principal: +${userSenderPhone} (${userName})`;

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

      // -------------------------------------------------------------
      // PASO 6: GENERAR PROMPT PARA LA IA
      // -------------------------------------------------------------
      const masterPrompt = `
Eres el "Copiloto Master de Inteligencia de Negocios y Control de WhatsApp" de Encomi SaaS.
Estás comunicándote directamente con el administrador de la cuenta: ${userName} (Línea emisora vinculada: +${userSenderPhone}).

INFORMACIÓN DE SU CUENTA Y LÍNEA VINCULADA:
- ${accountInfo}
- Archivo o documento adjunto en este mensaje: ${hasAttachedMedia ? `SÍ (${isImage ? 'FOTO/IMAGEN' : 'DOCUMENTO'}: ${attachedFileName})` : 'NO'}

INSTRUCCIÓN DEL ADMINISTRADOR:
"${textTrimmed}"

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
Explica con claridad que su sesión está vinculada al Sub-QR con su número emisor (+${userSenderPhone}) y que los envíos o respuestas a clientes salen desde SU número propio. Recuerda que puede escribir "cambiar cuenta" si desea alternar a otro Sub-QR.

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

      const aiResponse = await queryCopilotContext(masterPrompt, textTrimmed);

      // -------------------------------------------------------------
      // PASO 7: EJECUTAR ACCIÓN DE ENVÍO DESDE LA LÍNEA DEL SUB-QR VINCULADO
      // -------------------------------------------------------------
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

                console.log(`[COPILOT ACTION] ✅ Archivo ${fileName} (${finalMediaType}) despachado con éxito desde +${userSenderPhone}.`);
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
            const confirmMsg = `✅ *Mensaje despachado exitosamente desde tu cuenta vinculada (+${userSenderPhone})*\n\n📱 *Destinatario:* +${target}\n💬 *Mensaje:* "${messageText}"${hasAttachedMedia || mediaUrl ? `\n📎 *Archivo enviado:* ${fileName} (${targetMediaType})` : ''}\n\n⚡ *Línea Emisora:* +${userSenderPhone} (${userSenderInstance})`;
            await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, confirmMsg);
            return confirmMsg;
          }
        } catch (parseErr) {
          console.warn('[COPILOT ACTION PARSE WARN]', parseErr);
        }
      }

      // Respuesta conversacional limpia al dueño
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, aiResponse);
      return aiResponse;
    } catch (error: any) {
      console.error('[COPILOT ERROR]', error);
      const fallbackReply = '⚠️ Hubo una incidencia procesando tu solicitud. Por favor intenta nuevamente.';
      await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, fallbackReply);
      return fallbackReply;
    }
  }
}
