import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './config/env.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { ingestionWorker } from './workers/ingestion.worker.js';
import { copilotWorker } from './workers/copilot.worker.js';
import { redisClient } from './config/redis.js';

const app = Fastify({
  bodyLimit: 50 * 1024 * 1024, // 50MB para soportar sincronización de mensajes e imágenes
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
  disableRequestLogging: env.NODE_ENV === 'production',
});


async function start() {
  try {
    // 1. Plugins de Seguridad y Rendimiento
    await app.register(helmet, {
      contentSecurityPolicy: false,
    });

    await app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    // 2. Registrar Rutas
    await app.register(healthRoutes);
    await app.register(webhookRoutes, { prefix: '/webhook' });
    await app.register(tenantRoutes);


    // 3. Iniciar Servidor HTTP
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 [BACKEND MASTER & MULTI-TENANT] Fastify escuchando en http://${env.HOST}:${env.PORT}`);

    // 4. Manejo de Cierre Elegante (Graceful Shutdown)
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[SHUTDOWN] Señal ${signal} recibida. Cerrando conexiones...`);
      await app.close();
      await ingestionWorker.close();
      await copilotWorker.close();
      await redisClient.quit();
      console.log('[SHUTDOWN] Servidor cerrado limpiamente.');
      process.exit(0);
    };


    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
