import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';

export const redisConnectionOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null, // Requerido por BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log('[REDIS] Conectado exitosamente al broker de Redis');
});

redisClient.on('error', (err) => {
  console.error('[REDIS ERROR]', err);
});
