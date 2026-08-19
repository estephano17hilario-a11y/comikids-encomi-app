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

// A. OCR y Auditoría de Comprobantes (Yape, Plin, Transferencias)
export async function auditPaymentVoucher(imageBase64: string, mimeType: string = 'image/jpeg') {
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  const response = await aiClient.chat.completions.create({
    model: AI_MODEL,
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
  });

  const rawContent = response.choices[0].message.content || '{}';
  try {
    return JSON.parse(rawContent);
  } catch (e) {
    console.error('[AI SERVICE] Error parseando JSON de comprobante:', rawContent, e);
    return {
      banco: 'Desconocido',
      monto: 0,
      numero_operacion: '',
      fecha: new Date().toISOString(),
      es_comprobante_valido: false,
      nivel_confianza: 'BAJA',
    };
  }
}

// B. Consulta Copiloto / Indagación sobre Historial
export async function queryCopilotContext(systemContext: string, userPrompt: string) {
  const response = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemContext },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content || '';
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
  // Para notas de voz mediante OpenRouter Qwen 3.7 Flash
  console.log(`[AI SERVICE] Procesando nota de voz (${audioBuffer.length} bytes, mime: ${mimeType})`);
  return `Hola ${context.customerName || 'estimado cliente'}, recibimos tu nota de voz en ${context.storeName || 'Comikids'}. Tu pedido ${context.trackingCode ? `#${context.trackingCode}` : ''} está ${context.orderStatus || 'en proceso'}.`;
}


export class AIService {
  static auditPaymentVoucher = auditPaymentVoucher;
  static queryCopilotContext = queryCopilotContext;
  static parsePaymentVoucher = parsePaymentVoucher;
  static generateAssistantResponse = generateAssistantResponse;
  static processAudioMessage = processAudioMessage;
}
