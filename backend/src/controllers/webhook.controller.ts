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

        // 1. Ignorar grupos de WhatsApp (@g.us), difusiones/estados (@broadcast) y reacciones
        if (
          remoteJid.endsWith('@g.us') ||
          remoteJid.endsWith('@broadcast') ||
          remoteJid.includes('status@broadcast') ||
          (msgItem as any).messageType === 'reactionMessage' ||
          Boolean((msgItem as any).message?.reactionMessage)
        ) {
          continue;
        }

        // 2. Anti-drenaje de tokens: Ignorar mensajes históricos antiguos (> 2 minutos)
        // Evita que reconexiones o sincronizaciones de Baileys consuman tokens en segundo plano
        const nowSec = Math.floor(Date.now() / 1000);
        const rawTs = msgItem.messageTimestamp;
        const msgTs = typeof rawTs === 'number'
          ? (rawTs > 1e11 ? Math.floor(rawTs / 1000) : rawTs)
          : (rawTs?.low ? rawTs.low : nowSec);

        if (nowSec - msgTs > 120) {
          console.log(`[IGNORE OLD MESSAGE] Omitiendo mensaje antiguo (${nowSec - msgTs}s) ${msgItem.key?.id} en "${instance}"`);
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

        // Normalización estricta de la instancia
        const rawInstance = (instance || '').trim();
        const lowerInstance = rawInstance.toLowerCase();
        const masterEnvName = (env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp').trim().toLowerCase();

        // Determinación ESTRICTA de si la instancia que recibió el webhook es el BOT MASTER
        // Solo es Master Bot si coincide exactamente con el nombre de la instancia master y NO es ningún tenant/tienda/sub
        const isMasterBot =
          (lowerInstance === 'main_bot' ||
           lowerInstance === 'comikids_whatsapp' ||
           lowerInstance === masterEnvName) &&
          !lowerInstance.startsWith('tenant_') &&
          !lowerInstance.startsWith('tienda_') &&
          !lowerInstance.startsWith('sub_') &&
          lowerInstance !== 'tenant_comikids_tienda';

        // CASO A: Mensaje recibido DIRECTAMENTE en el BOT MASTER
        if (isMasterBot) {
          // El Bot Master SOLO procesa mensajes entrantes (no enviados por sí mismo)
          // Y SOLO de administradores autorizados para evitar consumo de tokens de terceros o bucles
          if (!msgItem.key.fromMe && isAdminSender) {
            console.log(`[COPILOT ROUTE] Encolando consulta de ${senderNumber} (Instancia Master: ${instance}) al Copiloto: "${queryText}"`);

            await enqueueCopilotQuery(
              {
                userPhone: senderNumber,
                remoteJid: remoteJid,
                queryText,
                messageData: msgItem,
                timestamp: msgTs * 1000,
              },
              msgItem.key.id
            );
          } else if (!msgItem.key.fromMe && !isAdminSender) {
            console.log(`[COPILOT IGNORED] Mensaje en Master Bot de ${senderNumber} (no admin). Omitiendo procesamiento IA.`);
          }
        }

        // CASO B: Sub-Instancias (Sub-QRs de despacho, tiendas, líneas de atención)
        // REGLA FUNDAMENTAL: NUNCA encolar al Copiloto ni responder desde el Bot Master.
        else {
          const tenantId = (rawInstance || 'default').replace(/^(tenant_|tienda_|sub_)/i, '');

          console.log(
            `[SILENT INGESTION ROUTE] Encolando mensaje ${msgItem.key.id} de Sub-Instancia "${instance}" (fromMe: ${msgItem.key.fromMe})`
          );

          await enqueueIngestionEvent({
            tenantId,
            instanceName: rawInstance || 'unknown',
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
