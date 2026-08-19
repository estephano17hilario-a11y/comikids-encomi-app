import { Job, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { INGESTION_QUEUE_NAME, IngestionJobData } from '../queues/ingestion.queue.js';
import { EvolutionService } from '../services/evolution.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { SupabaseService } from '../services/supabase.service.js';

/**
 * Worker de Ingesta Pasiva Silenciosa 24/7 para Sub-Instancias (tenant_{id})
 * REGLA ESTRICTA: CERO auto-respuestas hacia los contactos del cliente en esta línea.
 */
export const ingestionWorker = new Worker<IngestionJobData>(
  INGESTION_QUEUE_NAME,
  async (job: Job<IngestionJobData>) => {
    const startTime = Date.now();
    const { tenantId, instanceName, messageData, isFromMe } = job.data;
    const { key, pushName, message, messageType } = messageData || {};

    if (!key || !key.remoteJid) return;

    const messageId = key.id;
    const remoteJid = key.remoteJid;

    // Ignorar grupos de WhatsApp (@g.us), estados (@broadcast) y reacciones
    if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || messageType === 'reactionMessage') {
      return;
    }

    const phoneClean = remoteJid.replace(/[^0-9]/g, '');


    console.log(
      `[INGESTION WORKER 24/7] [Tenant: ${tenantId}] Indexando mensaje ${messageId} (fromMe: ${isFromMe}, Tipo: ${messageType})`
    );

    let extractedText =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      '';
    let processingType = 'texto_plano';

    try {
      // 1. SI ES NOTA DE VOZ O AUDIO: Transcribir en segundo plano
      if (message?.audioMessage || messageType === 'audioMessage') {
        processingType = 'audio_transcripcion';
        try {
          const media = await EvolutionService.getMediaBuffer(messageData, instanceName);
          const transcription = await GeminiService.processAudioMessage(
            media.buffer,
            media.mimeType || 'audio/ogg; codecs=opus',
            { storeName: `Tienda ${tenantId}`, customerName: pushName }
          );
          extractedText = `[AUDIO TRANSCRITO]: ${transcription}`;
          console.log(`[INGESTION WORKER] ✅ Audio transcrito para tenant ${tenantId}: "${extractedText.slice(0, 80)}..."`);
        } catch (audioErr) {
          console.warn(`[INGESTION WORKER] No se pudo transcribir audio:`, audioErr);
          extractedText = '[Audio sin transcribir]';
        }
      }

      // 2. SI ES IMAGEN O COMPROBANTE DE PAGO: Extraer OCR estructurado
      else if (message?.imageMessage || messageType === 'imageMessage') {
        processingType = 'ocr_comprobante';
        try {
          const media = await EvolutionService.getMediaBuffer(messageData, instanceName);
          const voucher = await GeminiService.parsePaymentVoucher(media.buffer, media.mimeType);

          await SupabaseService.registerPaymentVoucher(voucher, {
            tenantId,
            whatsappSender: phoneClean,
            imageUrl: message?.imageMessage?.url,
          });

          extractedText = `[COMPROBANTE EXTRAÍDO]: Banco=${voucher.banco}, Monto=${voucher.monto}, Op=${voucher.numeroOperacion}, Valido=${voucher.esComprobanteValido}`;
          console.log(`[INGESTION WORKER] ✅ Comprobante indexado para tenant ${tenantId}: Banco ${voucher.banco} S/ ${voucher.monto}`);
        } catch (voucherErr) {
          console.warn(`[INGESTION WORKER] Error analizando comprobante:`, voucherErr);
          extractedText = '[Imagen no comprobante]';
        }
      }

      // 3. Persistir en el log omnisciente de mensajes de Supabase
      const durationMs = Date.now() - startTime;
      await SupabaseService.logWhatsAppMessage({
        tenantId,
        messageId,
        remoteJid,
        pushName: isFromMe ? 'Comercio (Saliente)' : pushName,
        tipoMensaje: messageType || 'unknown',
        contenidoTexto: extractedText,
        mediaUrl: message?.imageMessage?.url,
        tipoProcesamiento: processingType,
        respuestaEnviada: '[MODO SILENCIOSO - SIN AUTO-RESPUESTA]',
        duracionMs: durationMs,
        estado: 'completado',
      });


      console.log(`[INGESTION WORKER] ✅ Mensaje ${messageId} indexado en BD con éxito en ${durationMs}ms`);
    } catch (error: any) {
      console.error(`[INGESTION WORKER ERROR] Error indexando mensaje ${messageId}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5,
    limiter: {
      max: 30,
      duration: 10000,
    },
  }
);
