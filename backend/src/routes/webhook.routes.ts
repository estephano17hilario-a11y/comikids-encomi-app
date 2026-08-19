import { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/evolution', WebhookController.handleEvolutionWebhook);
  fastify.post('/evolution/*', WebhookController.handleEvolutionWebhook);
  fastify.post('/evolution/:event', WebhookController.handleEvolutionWebhook);
}

