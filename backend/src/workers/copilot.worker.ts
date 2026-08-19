import { Job, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { COPILOT_QUEUE_NAME, CopilotJobData } from '../queues/copilot.queue.js';
import { CopilotService } from '../services/copilot.service.js';

/**
 * Worker de Consultas Interactivas para la Instancia Master (main_bot / comikids_whatsapp)
 */
export const copilotWorker = new Worker<CopilotJobData>(
  COPILOT_QUEUE_NAME,
  async (job: Job<CopilotJobData>) => {
    const { userPhone, remoteJid, queryText } = job.data;
    console.log(`[COPILOT WORKER] Procesando consulta interactiva de ${userPhone}...`);

    await CopilotService.answerCopilotQuery(userPhone, remoteJid, queryText);
  },
  {
    connection: redisConnectionOptions,
    concurrency: 5,
    limiter: {
      max: 15,
      duration: 10000,
    },
  }
);
