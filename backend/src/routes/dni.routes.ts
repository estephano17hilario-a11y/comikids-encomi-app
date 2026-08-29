import { FastifyPluginAsync } from 'fastify';
import { DniController } from '../controllers/dni.controller.js';

export const dniRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/dni/:dni
  fastify.get('/api/dni/:dni', DniController.resolveDni);
  // GET /dni/:dni (compatibilidad)
  fastify.get('/dni/:dni', DniController.resolveDni);
};
