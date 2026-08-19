import { Queue } from 'bullmq';
import { redisClient, redisConnectionOptions } from '../config/redis.js';
import { EvolutionMessageData } from '../types/evolution.types.js';

export const INGESTION_QUEUE_NAME = 'whatsapp-ingestion-queue';

export interface IngestionJobData {
  tenantId: string;
  instanceName: string;
  messageData: EvolutionMessageData;
  isFromMe: boolean;
}

export const ingestionQueue = new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 3600 * 24, // 24 horas
    },
    removeOnFail: {
      count: 2000,
    },
  },
});

/**
 * Encola un mensaje de sub-instancia con verificación de idempotencia en Redis.
 */
export async function enqueueIngestionEvent(data: IngestionJobData): Promise<boolean> {
  const messageId = data.messageData?.key?.id;
  if (!messageId) return false;

  const lockKey = `idempotency:ingest:${data.tenantId}:${messageId}`;
  const isNew = await redisClient.set(lockKey, '1', 'EX', 86400, 'NX');

  if (!isNew) {
    console.log(`[IDEMPOTENCY INGEST] Mensaje ya indexado: ${messageId}`);
    return false;
  }

  await ingestionQueue.add('index-chat-message', data, {
    jobId: `ingest_${data.tenantId}_${messageId}`,
  });

  return true;
}
