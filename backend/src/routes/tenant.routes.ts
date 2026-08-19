import { FastifyInstance } from 'fastify';
import { TenantController } from '../controllers/tenant.controller.js';

export async function tenantRoutes(fastify: FastifyInstance) {
  // Rutas solicitadas en Directiva Técnica (Master vs Sub-Instancias)
  fastify.post('/api/tenant/create-sub-instance', TenantController.createSubInstance);
  fastify.post('/api/tenant/instance/create', TenantController.createSubInstance);
  fastify.get('/api/tenant/instances', TenantController.listInstances);
  fastify.get('/api/tenant/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/api/tenant/instance/:tenantId/qr', TenantController.getQrCode);
  fastify.get('/api/tenant/:tenantId/status', TenantController.getStatus);
  fastify.get('/api/tenant/instance/:tenantId/status', TenantController.getStatus);
  fastify.delete('/api/tenant/:tenantId', TenantController.deleteInstance);
  fastify.delete('/api/tenant/instance/:tenantId', TenantController.deleteInstance);
}
