import { FastifyInstance } from 'fastify';
import { TenantController } from '../controllers/tenant.controller.js';

export async function tenantRoutes(fastify: FastifyInstance) {
  // Rutas con prefijo /api/tenant
  fastify.post('/api/tenant/create-sub-instance', TenantController.createSubInstance);
  fastify.post('/api/tenant/instance/create', TenantController.createSubInstance);
  fastify.get('/api/tenant/instances', TenantController.listInstances);
  fastify.get('/api/tenant/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/api/tenant/instance/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/api/tenant/:tenantId/status', TenantController.getStatus);
  fastify.get('/api/tenant/instance/:tenantId/status', TenantController.getStatus);
  fastify.delete('/api/tenant/:tenantId', TenantController.deleteInstance);
  fastify.post('/api/tenant/sync-dispatch-whatsapp', TenantController.syncDispatchWhatsApp);
  fastify.post('/api/tenant/send-delivery-vouchers', TenantController.sendDeliveryVouchers);

  // Rutas directas /tenant
  fastify.post('/tenant/create-sub-instance', TenantController.createSubInstance);
  fastify.post('/tenant/instance/create', TenantController.createSubInstance);
  fastify.get('/tenant/instances', TenantController.listInstances);
  fastify.get('/tenant/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/tenant/instance/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/tenant/:tenantId/status', TenantController.getStatus);
  fastify.get('/tenant/instance/:tenantId/status', TenantController.getStatus);
  fastify.delete('/tenant/:tenantId', TenantController.deleteInstance);
  fastify.post('/tenant/sync-dispatch-whatsapp', TenantController.syncDispatchWhatsApp);
  fastify.post('/tenant/send-delivery-vouchers', TenantController.sendDeliveryVouchers);
}


