import { FastifyPluginAsync } from 'fastify';
import { DniController } from '../controllers/dni.controller.js';

export const dniRoutes: FastifyPluginAsync = async (fastify) => {
  // Rutas estándar y con prefijo de proxies inversos
  fastify.get('/api/dni/:dni', DniController.resolveDni);
  fastify.get('/dni/:dni', DniController.resolveDni);
  fastify.get('/api/api/dni/:dni', DniController.resolveDni);
  fastify.get('/api/proxy/dni/:dni', DniController.resolveDni);
  fastify.get('/api/proxy/api/dni/:dni', DniController.resolveDni);
};
