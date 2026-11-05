import { FastifyInstance } from 'fastify';
import { runEmpresaAgent, runClientAssistant, verifyEmpresaAccess, AgentMessage } from '../services/aiAgent.service.js';
import { OPENROUTER_API_KEY } from '../services/ai.service.js';

// Límite simple por IP para el modo público (clientas)
const hits = new Map<string, { n: number; reset: number }>();
const rateLimited = (ip: string, max: number, windowMs: number) => {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n += 1;
  return h.n > max;
};

export async function aiRoutes(fastify: FastifyInstance) {
  const handler = async (request: any, reply: any) => {
    if (!OPENROUTER_API_KEY) {
      return reply.code(503).send({ success: false, code: 'AI_NOT_CONFIGURED', message: 'La IA no está configurada en el servidor (falta OPENROUTER_API_KEY).' });
    }
    const body = request.body || {};

    // ---- Modo clienta: sin base de datos, solo logística pública ----
    if (body.mode === 'client') {
      if (rateLimited(request.ip, 20, 60_000)) {
        return reply.code(429).send({ success: false, code: 'RATE_LIMIT', message: 'Demasiadas consultas seguidas. Espera un momento.' });
      }
      try {
        const r = await runClientAssistant({
          question: String(body.question || ''),
          clientName: String(body.clientName || 'Cliente').slice(0, 60),
          empresaNombre: String(body.empresaNombre || 'tu tienda').slice(0, 60),
          order: body.order || null,
        });
        return { success: true, reply: r.reply, model: r.model };
      } catch (e: any) {
        request.log.error(e);
        return reply.code(502).send({ success: false, code: 'AI_UNAVAILABLE', message: 'La IA no pudo responder ahora. Intenta en unos segundos.' });
      }
    }

    // ---- Modo empresa: con autenticación y acceso a la base de datos ----
    const empresaId = String(body.empresaId || '');
    const credential = String(body.credential || '');
    const messages: AgentMessage[] = Array.isArray(body.messages)
      ? body.messages.filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      : [];
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return reply.code(400).send({ success: false, code: 'VALIDATION_ERROR', message: 'Escribe un mensaje.' });
    }
    if (rateLimited(`emp:${empresaId}`, 40, 60_000)) {
      return reply.code(429).send({ success: false, code: 'RATE_LIMIT', message: 'Vas muy rápido. Espera unos segundos.' });
    }
    const access = await verifyEmpresaAccess(empresaId, credential);
    if (!access.ok) {
      return reply.code(401).send({ success: false, code: 'AUTH_REQUIRED', message: 'No se pudo verificar tu cuenta. Cierra sesión y vuelve a entrar.' });
    }
    try {
      const result = await runEmpresaAgent({ empresaId, empresaNombre: String(body.empresaNombre || access.nombre || 'tu empresa').slice(0, 80), messages });
      return { success: true, ...result };
    } catch (e: any) {
      request.log.error(e);
      return reply.code(502).send({ success: false, code: 'AI_UNAVAILABLE', message: 'La IA está saturada en este momento. Intenta de nuevo en unos segundos.' });
    }
  };

  fastify.post('/api/ai/chat', handler);
  fastify.post('/ai/chat', handler);
  fastify.get('/api/ai/status', async () => ({ success: true, configured: Boolean(OPENROUTER_API_KEY) }));
}
