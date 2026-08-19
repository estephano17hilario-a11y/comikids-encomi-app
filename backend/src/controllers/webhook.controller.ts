import { FastifyReply, FastifyRequest } from 'fastify';
import { EvolutionWebhookPayload } from '../types/evolution.types.js';
import { enqueueCopilotQuery } from '../queues/copilot.queue.js';
import { enqueueIngestionEvent } from '../queues/ingestion.queue.js';
import { env } from '../config/env.js';

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

    if (event === 'messages.upsert' && data) {
      const messagesList = Array.isArray(data) ? data : [data];

      for (const msgItem of messagesList) {
        if (!msgItem?.key?.remoteJid) continue;
        const remoteJid = msgItem.key.remoteJid;

        // Ignorar grupos y broadcasts en webhooks
        if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
          continue;
        }

        // CASO A: Mensaje dirigido al BOT MASTER (Interacción activa del dueño con su Copiloto)
        if (
          instance === 'main_bot' ||
          instance === env.EVOLUTION_INSTANCE_NAME ||
          instance === 'comikids_whatsapp'
        ) {
          if (!msgItem.key.fromMe) {
            const senderNumber = remoteJid.replace('@s.whatsapp.net', '');
            const queryText =
              msgItem.message?.conversation ||
              msgItem.message?.extendedTextMessage?.text ||
              msgItem.message?.imageMessage?.caption ||
              msgItem.message?.documentMessage?.caption ||
              msgItem.message?.documentMessage?.title ||
              (msgItem.message?.documentMessage ? 'Reenvía este documento' : '') ||
              '';

            console.log(`[MASTER BOT ROUTE] Encolando consulta de ${senderNumber} al Copiloto: "${queryText}"`);

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


        // CASO B: Mensaje en una SUB-INSTANCIA (Ingesta Pasiva Silenciosa 24/7)
        else if (instance?.startsWith('tenant_') || instance?.startsWith('tienda_')) {
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
