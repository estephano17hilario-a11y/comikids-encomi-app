import { FastifyInstance } from 'fastify';
import { ShalomController } from '../controllers/shalom.controller.js';

export async function shalomRoutes(fastify: FastifyInstance) {
  fastify.post('/api/shalom/auth/test', ShalomController.testAuth);
  fastify.post('/api/shalom/auth/login', ShalomController.testAuth);
  fastify.post('/api/shalom/orders', ShalomController.createOrder);
  fastify.get('/api/shalom/orders/:oseId/label', ShalomController.getOrderLabel);
}
