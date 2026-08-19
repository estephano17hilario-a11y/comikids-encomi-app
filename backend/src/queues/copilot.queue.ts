import { Queue } from 'bullmq';
import { redisClient, redisConnectionOptions } from '../config/redis.js';
import { EvolutionMessageData } from '../types/evolution.types.js';

export const COPILOT_QUEUE_NAME = 'copilot-query-queue';

export interface CopilotJobData {
  userPhone: string;
  remoteJid: string;
  queryText: string;
  messageData?: EvolutionMessageData;
  timestamp: number;
}

export const copilotQueue = new Queue<CopilotJobData>(COPILOT_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
    removeOnComplete: {
      count: 500,
      age: 3600 * 24,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

/**
 * Encola una consulta al Bot Master con verificación de idempotencia.
 */
export async function enqueueCopilotQuery(data: CopilotJobData, messageId: string): Promise<boolean> {
  const lockKey = `idempotency:copilot:${messageId}`;
  const isNew = await redisClient.set(lockKey, '1', 'EX', 86400, 'NX');

  if (!isNew) {
    console.log(`[IDEMPOTENCY COPILOT] Consulta duplicada omitida: ${messageId}`);
    return false;
  }

  await copilotQueue.add('process-copilot-query', data, {
    jobId: `copilot_${messageId}`,
  });

  return true;
}
