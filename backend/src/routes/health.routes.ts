import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { whatsappQueue } from '../queues/whatsapp.queue.js';
import { redisClient } from '../config/redis.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const redisStatus = redisClient.status;
      const [waiting, active, completed, failed] = await Promise.all([
        whatsappQueue.getWaitingCount(),
        whatsappQueue.getActiveCount(),
        whatsappQueue.getCompletedCount(),
        whatsappQueue.getFailedCount(),
      ]);

      return reply.status(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime_seconds: process.uptime(),
        memory_usage_mb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        redis: {
          status: redisStatus,
        },
        queue: {
          waiting,
          active,
          completed,
          failed,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        status: 'degraded',
        error: error?.message || 'Error checking health',
      });
    }
  });
}
