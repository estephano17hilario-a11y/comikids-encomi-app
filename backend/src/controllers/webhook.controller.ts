import { FastifyReply, FastifyRequest } from 'fastify';
import { EvolutionWebhookPayload } from '../types/evolution.types.js';
import { enqueueCopilotQuery } from '../queues/copilot.queue.js';
import { enqueueIngestionEvent } from '../queues/ingestion.queue.js';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';

export class WebhookController {
  /**
   * Enrutador jerárquico de Webhooks:
   * - Nivel 1: Master Bot (main_bot / comikids_whatsapp) -> Copiloto Activo
   * - Nivel 2: Sub-Instancias (tenant_*) -> Ingesta Silenciosa 24/7 (Sin auto-reply)
   */
  public static async handleEvolutionWebhook(
    request: FastifyRequest<{ Body: EvolutionWebhookPayload }>,
    reply: FastifyReply
  ) {
    const startTime = process.hrtime.bigint();
    const payload = request.body;
    const { instance, data, event } = payload || {};

    console.log(`\n=======================================================`);
    console.log(`[WEBHOOK HIERARCHY] Evento: "${event}" en Instancia: "${instance}"`);
    console.log(`=======================================================\n`);

    // Capturar y almacenar código QR emitido por Evolution API (en cualquier evento)
    const anyData = data as any;
    const qrB64 = anyData?.qrcode?.base64 || anyData?.base64 || anyData?.qr || (typeof anyData === 'string' && anyData.startsWith('data:image') ? anyData : null);
    const pairingCode = anyData?.qrcode?.pairingCode || anyData?.pairingCode;
    const qrCode = anyData?.qrcode?.code || anyData?.code;

    if ((qrB64 || pairingCode || qrCode) && instance) {
      console.log(`[QRCODE WEBHOOK] ✓ Recibido código QR fresco para instancia "${instance}"`);
      try {
        await redisClient.set(
          `copilot:qr:${instance}`,
          JSON.stringify({
            base64: qrB64 || '',
            pairingCode: pairingCode || '',
            code: qrCode || '',
            updatedAt: Date.now(),
          }),
          'EX',
          180
        );
      } catch (rErr) {
        console.warn('[QR REDIS CACHE WARN]', rErr);
      }
    }

    // Si la conexión se abre exitosamente, limpiar QR en caché
    if (event === 'connection.update') {
      const state = (data as any)?.state;
      if (state === 'open' && instance) {
        console.log(`[CONNECTION WEBHOOK] ✓ Instancia "${instance}" CONECTADA en modo OPEN`);
        try {
          await redisClient.del(`copilot:qr:${instance}`);
        } catch {}
      }
    }

    if (event === 'messages.upsert' && data) {
      const messagesList = Array.isArray(data) ? data : [data];

      for (const msgItem of messagesList) {
        if (!msgItem?.key?.remoteJid) continue;
        const remoteJid = msgItem.key.remoteJid;

        // Ignorar grupos y broadcasts en webhooks
        if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
          continue;
        }

        const senderNumber = remoteJid.replace('@s.whatsapp.net', '');
        const queryText =
          msgItem.message?.conversation ||
          msgItem.message?.extendedTextMessage?.text ||
          msgItem.message?.imageMessage?.caption ||
          msgItem.message?.documentMessage?.caption ||
          msgItem.message?.documentMessage?.title ||
          msgItem.message?.documentMessage?.fileName ||
          (msgItem.message?.imageMessage ? 'Reenvía esta imagen adjunta' : '') ||
          (msgItem.message?.documentMessage ? 'Reenvía este documento adjunto' : '') ||
          '';

        const isAdminSender = ['51963097546', '51927781412', '51901985319', '963097546', '927781412', '901985319'].includes(senderNumber);

        // CASO A: Mensaje dirigido al BOT MASTER o enviado por Administrador
        if (
          instance === 'main_bot' ||
          instance === env.EVOLUTION_INSTANCE_NAME ||
          instance === 'comikids_whatsapp' ||
          isAdminSender
        ) {
          if (!msgItem.key.fromMe) {
            console.log(`[COPILOT ROUTE] Encolando consulta de ${senderNumber} (Instancia: ${instance}) al Copiloto: "${queryText}"`);

            await enqueueCopilotQuery(
              {
                userPhone: senderNumber,
                remoteJid: remoteJid,
                queryText,
                messageData: msgItem,
                timestamp: msgItem.messageTimestamp || Date.now(),
              },
              msgItem.key.id
            );
          }
        }

        // CASO B: Ingesta Pasiva Silenciosa en sub-instancias
        if (instance?.startsWith('tenant_') || instance?.startsWith('tienda_')) {
          const tenantId = instance.replace(/^(tenant_|tienda_)/, '');

          console.log(
            `[SILENT INGESTION ROUTE] Encolando mensaje ${msgItem.key.id} de Sub-Instancia "${instance}" (fromMe: ${msgItem.key.fromMe})`
          );

          await enqueueIngestionEvent({
            tenantId,
            instanceName: instance,
            messageData: msgItem,
            isFromMe: Boolean(msgItem.key.fromMe),
          });
        }
      }
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    return reply.status(200).send({
      status: 'acknowledged',
      hierarchy: instance === 'main_bot' ? 'master_bot' : 'sub_instance_silent',
      duration_ms: durationMs.toFixed(2),
    });
  }
}
