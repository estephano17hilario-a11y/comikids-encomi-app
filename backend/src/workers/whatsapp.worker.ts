import { Job, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { EvolutionWebhookPayload } from '../types/evolution.types.js';
import { WHATSAPP_QUEUE_NAME } from '../queues/whatsapp.queue.js';
import { EvolutionService } from '../services/evolution.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { SupabaseService } from '../services/supabase.service.js';
import { ShalomService } from '../services/shalom.service.js';
import { env } from '../config/env.js';

export const whatsappWorker = new Worker<EvolutionWebhookPayload>(
  WHATSAPP_QUEUE_NAME,
  async (job: Job<EvolutionWebhookPayload>) => {
    const startTime = Date.now();
    const payload = job.data;
    const { key, pushName, message, messageType } = payload.data || {};

    if (!key || key.fromMe) {
      // Ignorar mensajes enviados por el propio bot
      return;
    }

    const instanceName = payload.instance || env.EVOLUTION_INSTANCE_NAME;
    const tenantId = instanceName.replace(/^tienda_/, '');
    const remoteJid = key.remoteJid;
    const messageId = key.id;
    const phoneClean = remoteJid.replace(/[^0-9]/g, '');

    console.log(
      `[WORKER MULTI-TENANT] [Tienda: ${instanceName}] Mensaje ${messageId} de ${pushName || phoneClean} (${messageType})`
    );

    let responseText = '';
    let processingType = 'conversacion_general';

    try {
      // 1. Obtener contexto de la tienda y del cliente
      const storeInfo = await SupabaseService.getTenantInfo(instanceName);
      const user = await SupabaseService.findUserByPhoneOrDni(phoneClean, tenantId);
      const pendingOrder = await SupabaseService.findPendingOrder(user?.id, tenantId);

      // ========================================================================
      // CASO A: MENSAJE CON IMAGEN (PROBABLE COMPROBANTE DE PAGO YAPE/PLIN/BCP)
      // ========================================================================
      if (message?.imageMessage || messageType === 'imageMessage') {
        processingType = 'ocr_comprobante';

        // 1. Descargar buffer de imagen desde la instancia correspondiente
        let mediaData: { buffer: Buffer; mimeType: string } | null = null;
        try {
          mediaData = await EvolutionService.getMediaBuffer(payload.data, instanceName);
        } catch (downloadErr) {
          console.error(`[WORKER] Error descargando imagen en ${instanceName}:`, downloadErr);
          await EvolutionService.sendWhatsAppMessage(
            instanceName,
            remoteJid,
            '⚠️ No pudimos descargar tu imagen. Por favor vuelve a enviarla.'
          );
          return;
        }

        // 2. Extraer información con Motor de IA Multimodal (OpenRouter qwen3.7-flash o Gemini)
        const voucherData = await GeminiService.parsePaymentVoucher(
          mediaData.buffer,
          mediaData.mimeType
        );

        // 3. Liberar buffer de memoria RAM
        mediaData = null;

        // 4. Guardar en Supabase asociado al tenant_id
        await SupabaseService.registerPaymentVoucher(voucherData, {
          tenantId,
          whatsappSender: phoneClean,
          userId: user?.id,
          orderId: pendingOrder?.id,
          imageUrl: message?.imageMessage?.url,
        });

        // 5. Responder al cliente a través de la instancia de la tienda
        const montoNum = Number(voucherData.monto) || 0;
        const esValido = voucherData.esComprobanteValido ?? voucherData.es_comprobante_valido;

        if (esValido && montoNum > 0) {
          responseText =
            `✅ *¡Comprobante de Pago Validado!*\n\n` +
            `🏪 *Comercio:* ${storeInfo?.nombre || 'Encomi'}\n` +
            `🏦 *Banco/Billetera:* ${voucherData.banco || 'Desconocido'}\n` +
            `💰 *Monto:* ${voucherData.moneda === 'USD' ? '$' : 'S/'} ${montoNum.toFixed(2)}\n` +
            `🔢 *N° Operación:* ${voucherData.numeroOperacion || voucherData.numero_operacion || 'S/N'}\n` +
            (voucherData.titularDestino ? `👤 *Destinatario:* ${voucherData.titularDestino}\n` : '') +
            `\n🎉 Tu pago ha sido registrado exitosamente. Tu pedido pasará a preparación y despacho de inmediato. ¡Muchas gracias! ✨`;
        } else {
          responseText =
            `⚠️ *No pudimos confirmar tu comprobante de pago.*\n\n` +
            `*Motivo:* ${voucherData.motivoRechazo || 'La imagen no parece ser un comprobante de transferencia legible o válido.'}\n\n` +
            `Por favor asegúrate de enviar una foto nítida donde se aprecie claramente el monto, número de operación y fecha.`;
        }

        await EvolutionService.sendWhatsAppMessage(instanceName, remoteJid, responseText);
      }

      // ========================================================================
      // CASO B: MENSAJE DE AUDIO / NOTA DE VOZ (MULTIMODAL CON IA)
      // ========================================================================
      else if (message?.audioMessage || messageType === 'audioMessage') {
        processingType = 'audio_nota_voz';

        let mediaData: { buffer: Buffer; mimeType: string } | null = null;
        try {
          mediaData = await EvolutionService.getMediaBuffer(payload.data, instanceName);
        } catch (downloadErr) {
          console.error(`[WORKER] Error descargando audio en ${instanceName}:`, downloadErr);
          await EvolutionService.sendWhatsAppMessage(
            instanceName,
            remoteJid,
            '⚠️ No pudimos procesar tu audio. Por favor escríbenos o reenvíalo.'
          );
          return;
        }

        const aiReply = await GeminiService.processAudioMessage(
          mediaData.buffer,
          mediaData.mimeType || 'audio/ogg; codecs=opus',
          {
            storeName: storeInfo?.nombre,
            customerName: pushName || user?.nombre_completo,
            orderStatus: pendingOrder?.estado_produccion,
            trackingCode: pendingOrder?.codigo_seguimiento,
            agencyInfo: pendingOrder?.destino_detalle,
          }
        );

        mediaData = null;
        responseText = aiReply;
        await EvolutionService.sendWhatsAppMessage(instanceName, remoteJid, responseText);
      }

      // ========================================================================
      // CASO C: MENSAJE DE TEXTO (CONSULTA LOGÍSTICA / CONVERSACIONAL)
      // ========================================================================
      else {
        const text =
          message?.conversation ||
          message?.extendedTextMessage?.text ||
          message?.imageMessage?.caption ||
          '';

        console.log(`[WORKER] [Tienda: ${instanceName}] Texto recibido: "${text}"`);
        const textUpper = text.toUpperCase().trim();

        // 1. Detectar si el usuario consulta estado de guía de envío (Shalom / Olva)
        const isTrackingQuery =
          textUpper.includes('GUIA') ||
          textUpper.includes('SEGUIMIENTO') ||
          textUpper.includes('PEDIDO') ||
          textUpper.includes('DONDE ESTA') ||
          textUpper.includes('SHALOM') ||
          textUpper.includes('OLVA');

        if (isTrackingQuery && (pendingOrder || textUpper.length >= 4)) {
          processingType = 'consulta_logistica';

          const trackingCode = pendingOrder?.codigo_seguimiento || text.replace(/[^a-zA-Z0-9-]/g, '');
          const tracking = await ShalomService.trackShipment(trackingCode);

          if (tracking) {
            responseText =
              `📦 *Estado de tu Envío*\n\n` +
              `🔖 *Guía / Pedido:* ${tracking.guiaNumero}\n` +
              `🚚 *Estado:* ${tracking.estado}\n` +
              `📍 *Origen:* ${tracking.origen}\n` +
              `🎯 *Destino:* ${tracking.destino}\n` +
              (tracking.fechaEntregaEstimada ? `🗓️ *Fecha Estimada:* ${tracking.fechaEntregaEstimada}\n` : '') +
              `\n¡Tu paquete está en camino seguro! Si necesitas ayuda adicional con tu pedido en ${storeInfo?.nombre || 'la tienda'}, déjanos saber.`;
          } else {
            responseText =
              `🔎 Buscamos tu pedido pero aún no encontramos una guía activa con el código ingresado.\n` +
              `Si realizaste tu pedido recientemente, el código se activará en cuanto sea despachado a la agencia.`;
          }

          await EvolutionService.sendWhatsAppMessage(instanceName, remoteJid, responseText);
        }

        // 2. Consulta conversacional general con IA Multimodal
        else {
          processingType = 'conversacion_general';

          const aiReply = await GeminiService.generateAssistantResponse(text, {
            storeName: storeInfo?.nombre,
            customerName: pushName || user?.nombre_completo,
            orderStatus: pendingOrder?.estado_produccion,
            trackingCode: pendingOrder?.codigo_seguimiento,
            agencyInfo: pendingOrder?.destino_detalle,
          });

          responseText = aiReply;
          await EvolutionService.sendWhatsAppMessage(instanceName, remoteJid, responseText);
        }
      }

      // 6. Auditoría y Logs en Supabase
      const durationMs = Date.now() - startTime;
      await SupabaseService.logWhatsAppMessage({
        tenantId,
        messageId,
        remoteJid,
        pushName,
        tipoMensaje: messageType || 'unknown',
        contenidoTexto: message?.conversation || message?.extendedTextMessage?.text,
        mediaUrl: message?.imageMessage?.url,
        tipoProcesamiento: processingType,
        respuestaEnviada: responseText,
        duracionMs: durationMs,
        estado: 'completado',
      });

      console.log(`[WORKER] ✅ [Tienda: ${instanceName}] Mensaje ${messageId} procesado con éxito en ${durationMs}ms`);
    } catch (error: any) {
      console.error(`[WORKER ERROR] Error procesando mensaje ${messageId} en ${instanceName}:`, error);

      await SupabaseService.logWhatsAppMessage({
        tenantId,
        messageId,
        remoteJid,
        pushName,
        tipoMensaje: messageType || 'unknown',
        tipoProcesamiento: processingType,
        duracionMs: Date.now() - startTime,
        estado: 'error',
        errorDetalle: error?.message || String(error),
      });

      throw error;
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 10000,
    },
  }
);

whatsappWorker.on('failed', (job: Job<EvolutionWebhookPayload> | undefined, err: Error) => {
  console.error(`[WORKER] Job ${job?.id} falló definitivamente:`, err);
});
