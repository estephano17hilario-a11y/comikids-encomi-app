import { Job, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { INGESTION_QUEUE_NAME, IngestionJobData } from '../queues/ingestion.queue.js';
import { EvolutionService } from '../services/evolution.service.js';
import { auditPaymentVoucher, processAudioMessage } from '../services/ai.service.js';
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
      // 1. NOTAS DE VOZ O AUDIOS
      if (message?.audioMessage || messageType === 'audioMessage') {
        processingType = isFromMe ? 'audio_saliente' : 'audio_recibido';
        extractedText = isFromMe ? '[Nota de voz saliente enviada]' : '[Nota de voz recibida]';
      }

      // 2. IMÁGENES / COMPROBANTES DE PAGO
      else if (message?.imageMessage || messageType === 'imageMessage') {
        if (isFromMe) {
          processingType = 'imagen_saliente';
          extractedText = extractedText || '[Imagen saliente enviada por el comercio]';
        } else {
          // Solo auditar con IA si el texto / pie de foto tiene palabras clave de pago o comprobante
          const isVoucherCandidate =
            Boolean(extractedText) &&
            /(yape|plin|pago|pagó|pague|pagué|bcp|bbva|interbank|banco|transferencia|transferí|deposito|depósito|abono|constancia|comprobante|voucher|vaucher|captura|boleta|operacion|operación|s\/|soles)/i.test(
              extractedText
            );

          if (isVoucherCandidate) {
            processingType = 'ocr_comprobante';
            try {
              const media = await EvolutionService.getMediaBuffer(messageData, instanceName);
              const voucher = await auditPaymentVoucher(
                media.buffer.toString('base64'),
                media.mimeType || 'image/jpeg'
              );

              const parsedVoucher = {
                banco: voucher.banco || 'Desconocido',
                monto: Number(voucher.monto) || 0,
                moneda: 'PEN',
                numeroOperacion: String(voucher.numero_operacion || ''),
                fechaHora: voucher.fecha || new Date().toISOString(),
                esComprobanteValido: Boolean(voucher.es_comprobante_valido),
                motivoRechazo: voucher.es_comprobante_valido ? undefined : 'Comprobante no válido o ilegible',
              };

              await SupabaseService.registerPaymentVoucher(parsedVoucher as any, {
                tenantId,
                whatsappSender: phoneClean,
                imageUrl: message?.imageMessage?.url,
              });

              extractedText = `[COMPROBANTE EXTRAÍDO]: Banco=${parsedVoucher.banco}, Monto=${parsedVoucher.monto}, Op=${parsedVoucher.numeroOperacion}, Valido=${parsedVoucher.esComprobanteValido}`;
              console.log(
                `[INGESTION WORKER] ✅ Comprobante indexado con IA para tenant ${tenantId}: Banco ${parsedVoucher.banco} S/ ${parsedVoucher.monto}`
              );
            } catch (voucherErr) {
              console.warn(`[INGESTION WORKER] Error analizando comprobante:`, voucherErr);
              extractedText = '[Imagen / Comprobante no procesable]';
            }
          } else {
            // Imagen normal (ropa, prendas, capturas, stickers, fotos de catálogo) -> No consume tokens IA
            processingType = 'imagen_recibida';
            extractedText = extractedText || '[Imagen adjunta recibida]';
          }
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
