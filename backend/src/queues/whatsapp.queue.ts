import { Queue } from 'bullmq';
import { redisClient, redisConnectionOptions } from '../config/redis.js';
import { EvolutionWebhookPayload } from '../types/evolution.types.js';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-incoming-queue';

export const whatsappQueue = new Queue<EvolutionWebhookPayload>(WHATSAPP_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 500, // Mantener últimos 500 para telemetría
      age: 3600, // 1 hora
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

/**
 * Verifica idempotencia y encola el webhook en Redis en menos de 5ms.
 */
export async function enqueueWhatsAppEvent(payload: EvolutionWebhookPayload): Promise<boolean> {
  const messageId = payload.data?.key?.id;
  if (!messageId) {
    return false;
  }

  // 1. Verificar idempotencia con SETNX (Clave con TTL de 24 horas = 86400s)
  const lockKey = `idempotency:wa_msg:${messageId}`;
  const isNew = await redisClient.set(lockKey, '1', 'EX', 86400, 'NX');

  if (!isNew) {
    console.log(`[IDEMPOTENCY] Mensaje duplicado omitido: ${messageId}`);
    return false;
  }

  // 2. Encolar en BullMQ
  await whatsappQueue.add('process-whatsapp-event', payload, {
    jobId: messageId,
  });

  return true;
}
