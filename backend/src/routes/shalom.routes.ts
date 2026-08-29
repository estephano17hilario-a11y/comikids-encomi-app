import { FastifyInstance } from 'fastify';
import { ShalomController } from '../controllers/shalom.controller.js';

export async function shalomRoutes(fastify: FastifyInstance) {
  fastify.get('/api/shalom/status', ShalomController.getStatus);
  fastify.get('/api/shalom/agencies', ShalomController.getAgenciesRoute);
  fastify.post('/api/shalom/auth/test', ShalomController.testAuth);
  fastify.post('/api/shalom/auth/login', ShalomController.testAuth);
  fastify.post('/api/shalom/orders', ShalomController.createOrder);
  fastify.get('/api/shalom/orders/:oseId/label', ShalomController.getOrderLabel);
  fastify.get('/api/shalom/orders/:oseId/voucher', ShalomController.getOrderVoucher);
  fastify.post('/api/shalom/sync-agencies', ShalomController.syncAgencies);
  fastify.get('/api/shalom/sync-status', ShalomController.getSyncStatus);
  fastify.post('/api/shalom/listener/run', ShalomController.runTrackingListener);
  fastify.get('/api/shalom/listener/status', ShalomController.getTrackingListenerStatus);
}


