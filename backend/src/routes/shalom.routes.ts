import { FastifyInstance } from 'fastify';
import { ShalomController } from '../controllers/shalom.controller.js';

export async function shalomRoutes(fastify: FastifyInstance) {
  fastify.get('/api/shalom/status', ShalomController.getStatus);
  fastify.get('/api/shalom/agencies', ShalomController.getAgenciesRoute);
  fastify.get('/api/shalom/agencies/search', ShalomController.searchAgenciesLive);
  fastify.post('/api/shalom/auth/test', ShalomController.testAuth);
  fastify.post('/api/shalom/auth/login', ShalomController.testAuth);

  // Órdenes & Autogestión Shalom Pro
  fastify.get('/api/shalom/orders', ShalomController.listShalomOrders);
  fastify.post('/api/shalom/orders', ShalomController.createOrder);
  fastify.delete('/api/shalom/orders/:orderId', ShalomController.deleteShalomOrder);
  fastify.get('/api/shalom/orders/:oseId/label', ShalomController.getOrderLabel);
  fastify.get('/api/shalom/orders/:oseId/voucher', ShalomController.getOrderVoucher);

  // Rastreo en vivo (individual, lote, eventos y GRT)
  fastify.get('/api/shalom/tracking', ShalomController.trackOrder);
  fastify.post('/api/shalom/tracking/batch', ShalomController.trackOrdersBatch);
  fastify.get('/api/shalom/tracking/:oseId/events', ShalomController.getTrackingEvents);
  fastify.get('/api/shalom/tracking/:oseId/grt', ShalomController.getTrackingGrt);

  // Cotizador, catálogo de productos y buscador de personas Shalom Pro
  fastify.get('/api/shalom/products', ShalomController.getProducts);
  fastify.post('/api/shalom/tariff/calculate', ShalomController.calculateTariff);
  fastify.get('/api/shalom/persons/search', ShalomController.searchPerson);

  // Constancia visual de prueba + envío manual WhatsApp con foto
  fastify.post('/api/shalom/proof-image', ShalomController.generateProofImage);
  fastify.post('/api/shalom/notify-pickup', ShalomController.notifyPickupManual);

  // Sincronización de agencias
  fastify.post('/api/shalom/sync-agencies', ShalomController.syncAgencies);
  fastify.get('/api/shalom/sync-status', ShalomController.getSyncStatus);

  // Escáner automático cada 3 horas (entregados -> listo para recoger)
  fastify.post('/api/shalom/listener/run', ShalomController.runTrackingListener);
  fastify.get('/api/shalom/listener/status', ShalomController.getTrackingListenerStatus);
  fastify.post('/api/shalom/scanner/run', ShalomController.runTrackingListener);
  fastify.get('/api/shalom/scanner/status', ShalomController.getTrackingListenerStatus);
  fastify.post('/api/shalom/scanner/config', ShalomController.updateScannerConfig);
}
