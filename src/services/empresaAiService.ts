import { getApiBaseUrl } from '../config/api';

export interface EmpresaAiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EmpresaAiAction {
  tool: string;
  ok: boolean;
  summary: string;
  write: boolean;
}

export interface EmpresaAiReply {
  reply: string;
  actions: EmpresaAiAction[];
}

export class EmpresaAiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Habla con el agente de IA del servidor. El servidor valida la cuenta y solo toca
 * la base de datos de la empresa que escribe.
 */
export async function askEmpresaAi(params: {
  empresaId: string;
  empresaNombre: string;
  credential: string;
  messages: EmpresaAiMessage[];
}): Promise<EmpresaAiReply> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new EmpresaAiError(
      aborted ? 'La IA tardó demasiado. Intenta con una consulta más corta.' : 'No hay conexión con el servidor. Revisa tu internet e intenta otra vez.',
      aborted ? 'TIMEOUT' : 'NETWORK'
    );
  } finally {
    window.clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // respuesta sin JSON
  }

  if (res.ok && data?.success) {
    return { reply: String(data.reply || ''), actions: Array.isArray(data.actions) ? data.actions : [] };
  }
  if (res.status === 404 || (!data && res.status >= 500)) {
    throw new EmpresaAiError('El servidor todavía no tiene activada la IA nueva. Pide que actualicen el servidor y vuelve a intentar.', 'NOT_DEPLOYED');
  }
  throw new EmpresaAiError(data?.message || 'La IA no pudo responder. Intenta de nuevo.', data?.code || 'ERROR');
}

/** Respuesta de IA para clientas (sin acceso a la base de datos). Devuelve null si el servidor no responde. */
export async function askClientAi(params: {
  question: string;
  clientName: string;
  empresaNombre: string;
  order?: { codigo?: string; destino?: string; estado?: string; agencia?: string } | null;
}): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${getApiBaseUrl()}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'client', ...params }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success && data.reply ? String(data.reply) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
