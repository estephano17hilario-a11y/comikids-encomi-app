import OpenAI from 'openai';
import { env } from '../config/env.js';
import { PaymentVoucher, PaymentVoucherSchema } from '../types/voucher.types.js';

export const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  env.OPENROUTER_API_KEY ||
  '';

export const AI_MODEL = process.env.AI_MODEL || env.AI_MODEL || 'qwen/qwen3.7-flash';

export const aiClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://encomi.app',
    'X-Title': 'Encomi Logistics AI',
  },
});

// Lista de modelos de respaldo en caso de 429 / sobrecarga / límites de tasa
const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
  'openai/gpt-4o-mini',
  'qwen/qwen-2.5-72b-instruct',
];

// A. OCR y Auditoría de Comprobantes (Yape, Plin, Transferencias)
export async function auditPaymentVoucher(imageBase64: string, mimeType: string = 'image/jpeg') {
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const modelsToTry = [AI_MODEL, 'meta-llama/llama-3.3-70b-instruct', 'openai/gpt-4o-mini'];

  for (const model of modelsToTry) {
    try {
      const response = await aiClient.chat.completions.create(
        {
          model,
          messages: [
            {
              role: 'system',
              content:
                'Eres un auditor contable experto. Analiza el comprobante bancario adjunto y extrae los datos en formato JSON estricto: {"banco": string, "monto": number, "numero_operacion": string, "fecha": string, "es_comprobante_valido": boolean, "nivel_confianza": "ALTA" | "MEDIA" | "BAJA"}. Si no es un comprobante válido, marca es_comprobante_valido en false.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Audita este comprobante:' },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        },
        { timeout: 15000 }
      );

      const rawContent = response.choices[0]?.message?.content || '{}';
      return JSON.parse(rawContent);
    } catch (e: any) {
      console.warn(`[AI SERVICE OCR] Modelo ${model} falló:`, e?.message);
    }
  }

  return {
    banco: 'Desconocido',
    monto: 0,
    numero_operacion: '',
    fecha: new Date().toISOString(),
    es_comprobante_valido: false,
    nivel_confianza: 'BAJA',
  };
}

export interface ExtractedClientMediaInfo {
  nombre?: string;
  telefono?: string;
  dni?: string;
  guia?: string;
  descripcion?: string;
  confidence: 'ALTA' | 'MEDIA' | 'BAJA';
}

// B. Extracción Inteligente de Destinatario en Fotos / Documentos (OCR Visual)
export async function extractClientFromMedia(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedClientMediaInfo> {
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const modelsToTry = [AI_MODEL, 'meta-llama/llama-3.3-70b-instruct', 'openai/gpt-4o-mini'];

  for (const model of modelsToTry) {
    try {
      const response = await aiClient.chat.completions.create(
        {
          model,
          messages: [
            {
              role: 'system',
              content:
                'Eres un asistente de logística y envíos de Comikids. Analiza la imagen o documento adjunto (puede ser una guía de envío, rótulo de paquete, comprobante, captura o etiqueta) y extrae los datos del cliente/destinatario en formato JSON estricto: {"nombre": string, "telefono": string, "dni": string, "guia": string, "descripcion": string, "confidence": "ALTA" | "MEDIA" | "BAJA"}. Si algún dato no aparece, déjalo como null o string vacío.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extrae el nombre, teléfono de WhatsApp, DNI y número de guía del destinatario:' },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        },
        { timeout: 15000 }
      );

      const rawContent = response.choices[0]?.message?.content || '{}';
      return JSON.parse(rawContent);
    } catch (e: any) {
      console.warn(`[AI SERVICE MEDIA CLIENT OCR] Modelo ${model} falló:`, e?.message);
    }
  }

  return {
    nombre: '',
    telefono: '',
    dni: '',
    guia: '',
    descripcion: '',
    confidence: 'BAJA',
  };
}

export interface AICopilotResult {
  content: string;
  tokensUsed: number;
}

// B. Consulta Copiloto / Indagación sobre Historial con Cadena de Respaldo Multi-Modelo
export async function queryCopilotWithUsage(systemContext: string, userPrompt: string): Promise<AICopilotResult> {
  const modelsToTry = [AI_MODEL, ...FALLBACK_MODELS.filter(m => m !== AI_MODEL)];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await aiClient.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: systemContext },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        },
        { timeout: 15000 }
      );

      const content = response.choices[0]?.message?.content || '';
      if (content && content.trim().length > 0) {
        const totalTokens = response.usage?.total_tokens ||
          Math.ceil((systemContext.length + userPrompt.length + content.length) / 3.5);

        return {
          content,
          tokensUsed: totalTokens,
        };
      }
    } catch (err: any) {
      console.warn(`[AI SERVICE RESILIENCE] Modelo "${model}" no disponible (${err?.status || err?.message}), cambiando a modelo alternativo...`);
      lastError = err;
      if (err?.status === 429) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  throw lastError || new Error('Todos los motores de IA están temporalmente saturados.');
}

export async function queryCopilotContext(systemContext: string, userPrompt: string): Promise<string> {
  const result = await queryCopilotWithUsage(systemContext, userPrompt);
  return result.content;
}

/**
 * Adaptador de Compatibilidad para el flujo de parsePaymentVoucher existente
 */
export async function parsePaymentVoucher(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<PaymentVoucher> {
  const base64Data = imageBuffer.toString('base64');
  const rawAudit = await auditPaymentVoucher(base64Data, mimeType);

  const parsed = {
    banco: rawAudit.banco || 'Desconocido',
    monto: Number(rawAudit.monto) || 0,
    moneda: rawAudit.moneda || 'PEN',
    numeroOperacion: String(rawAudit.numero_operacion || rawAudit.numeroOperacion || ''),
    fechaHora: rawAudit.fecha || rawAudit.fechaHora || new Date().toISOString(),
    titularDestino: rawAudit.titular_destino || rawAudit.titularDestino,
    titularOrigen: rawAudit.titular_origen || rawAudit.titularOrigen,
    esComprobanteValido: Boolean(rawAudit.es_comprobante_valido ?? rawAudit.esComprobanteValido ?? (Number(rawAudit.monto) > 0)),
    motivoRechazo: rawAudit.motivo_rechazo || rawAudit.motivoRechazo,
  };

  return PaymentVoucherSchema.parse(parsed);
}

/**
 * Adaptador para respuestas de asistente y consultas en lenguaje natural
 */
export async function generateAssistantResponse(
  userMessage: string,
  context: {
    storeName?: string;
    customerName?: string;
    orderStatus?: string;
    trackingCode?: string;
    agencyInfo?: string;
  } = {}
): Promise<string> {
  const storeTitle = context.storeName || 'Comikids Bordados & Estilo';
  const systemInstruction = `
Eres el asistente virtual inteligente de la tienda "${storeTitle}".
Tu tono es amable, profesional, conciso y cercano.
Responde directamente a la consulta del cliente basándote en la información de su pedido o catálogo de productos.

Contexto actual del cliente:
- Nombre: ${context.customerName || 'Estimado/a cliente'}
- Código de seguimiento: ${context.trackingCode || 'No registrado aún'}
- Estado de su pedido: ${context.orderStatus || 'Sin pedidos activos'}
- Información de agencia/envío: ${context.agencyInfo || 'Envío por coordinar'}

Reglas:
- Sé breve y claro (los clientes leen en WhatsApp).
- Usa emojis de forma moderada y profesional (✨, 📦, 🚚).
- Si el cliente envía un saludo o pregunta por productos/servicios, responde cordialmente.
`;

  return await queryCopilotContext(systemInstruction, userMessage);
}

/**
 * Adaptador para notas de voz y audio
 */
export async function processAudioMessage(
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg; codecs=opus',
  context: {
    storeName?: string;
    customerName?: string;
    orderStatus?: string;
    trackingCode?: string;
    agencyInfo?: string;
  } = {}
): Promise<string> {
  return 'He recibido tu nota de voz y la estoy procesando.';
}

export class AIService {
  public static auditPaymentVoucher = auditPaymentVoucher;
  public static queryCopilotWithUsage = queryCopilotWithUsage;
  public static queryCopilotContext = queryCopilotContext;
  public static parsePaymentVoucher = parsePaymentVoucher;
  public static generateAssistantResponse = generateAssistantResponse;
  public static processAudioMessage = processAudioMessage;
}
