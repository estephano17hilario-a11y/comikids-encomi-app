import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { PaymentVoucher, PaymentVoucherSchema } from '../types/voucher.types.js';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const GEMINI_POOL = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

export class GeminiService {
  /**
   * Intenta procesar con OpenRouter API (qwen/qwen3.7-flash) si la API Key está configurada.
   */
  private static async callOpenRouter(
    messages: Array<{ role: string; content: any }>
  ): Promise<string | null> {
    if (!env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY.trim().length === 0) {
      return null;
    }

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: env.AI_MODEL || 'qwen/qwen3.7-flash',
          messages,
          temperature: 0.2,
        },
        {
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://encomi.app',
            'X-Title': 'Encomi SaaS Multi-Tenant',
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      return content || null;
    } catch (error: any) {
      console.warn('[OPENROUTER API WARNING] Falló llamada a OpenRouter, usando motor Gemini...', error?.message || error);
      return null;
    }
  }

  /**
   * Analiza un buffer de imagen de comprobante de pago peruano (Yape, Plin, BCP, BBVA, etc.)
   * utilizando OpenRouter (qwen/qwen3.7-flash) o Gemini con Structured Output validado por Zod.
   */
  public static async parsePaymentVoucher(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<PaymentVoucher> {
    const base64Data = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const systemInstruction = `
Eres un auditor contable experto en validar comprobantes de transferencias y pagos en Perú (Yape, Plin, BCP, BBVA, Interbank, Scotiabank).
Analiza la imagen del comprobante y extrae estrictamente un objeto JSON con esta estructura exacta:
{
  "banco": "Yape | Plin | BCP | Interbank | BBVA | Desconocido",
  "monto": 0.00,
  "numero_operacion": "string",
  "fecha": "YYYY-MM-DD HH:mm",
  "es_comprobante_valido": true
}

Reglas:
- Si la imagen no es un comprobante de pago legible (es foto de un objeto, selfie, meme, etc.), marca "es_comprobante_valido": false, "monto": 0 y "banco": "Desconocido".
- Extrae el monto como número decimal exacto.
- Devuelve SOLAMENTE el JSON, sin bloques de código ni texto adicional.
`;

    // 1. Intentar con OpenRouter si está configurado
    const openRouterMessages = [
      { role: 'system', content: systemInstruction },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza este comprobante de pago y extrae el JSON estructurado.' },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ];

    const openRouterResult = await this.callOpenRouter(openRouterMessages);
    if (openRouterResult) {
      try {
        const cleanJson = openRouterResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return PaymentVoucherSchema.parse({
          ...parsed,
          esComprobanteValido: parsed.es_comprobante_valido ?? parsed.esComprobanteValido ?? false,
          numeroOperacion: parsed.numero_operacion || parsed.numeroOperacion || '',
          monto: Number(parsed.monto) || 0,
        });
      } catch (err) {
        console.warn('[OPENROUTER JSON PARSE WARNING]', err);
      }
    }

    // 2. Motor Gemini con Structured Output
    const prompt = `Analiza este comprobante de pago peruano y devuelve los datos estructurados en formato JSON.`;
    let lastError: any = null;

    for (const modelName of GEMINI_POOL) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const response = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data,
            },
          },
        ]);

        const responseText = response.response.text();
        if (responseText) {
          const parsedJson = JSON.parse(responseText);
          return PaymentVoucherSchema.parse({
            ...parsedJson,
            esComprobanteValido: parsedJson.es_comprobante_valido ?? parsedJson.esComprobanteValido ?? false,
            numeroOperacion: parsedJson.numero_operacion || parsedJson.numeroOperacion || '',
            monto: Number(parsedJson.monto) || 0,
          });
        }
      } catch (error: any) {
        console.warn(`[VOUCHER OCR WARNING] Falló con ${modelName}, probando siguiente modelo...`, error?.message || error);
        lastError = error;
      }
    }

    console.error('[VOUCHER OCR ERROR] Todos los modelos del pool fallaron:', lastError);
    throw lastError || new Error('No se pudo procesar el comprobante');
  }

  /**
   * Responde consultas conversacionales o de seguimiento de pedidos en lenguaje natural.
   */
  public static async generateAssistantResponse(
    userMessage: string,
    context: {
      storeName?: string;
      customerName?: string;
      orderStatus?: string;
      trackingCode?: string;
      agencyInfo?: string;
    }
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

    // 1. OpenRouter
    const openRouterRes = await this.callOpenRouter([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userMessage },
    ]);
    if (openRouterRes && openRouterRes.trim().length > 0) {
      return openRouterRes.trim();
    }

    // 2. Gemini Pool
    for (const modelName of GEMINI_POOL) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            temperature: 0.7,
          },
        });

        const response = await model.generateContent(userMessage);
        const text = response.response.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } catch (error: any) {
        console.warn(`[ASSISTANT WARNING] Modelo ${modelName} falló:`, error?.message || error);
      }
    }

    return `¡Hola! Qué gusto saludarte en ${storeTitle} ✨. ¿En qué podemos ayudarte hoy?`;
  }

  /**
   * Procesa una nota de voz o archivo de audio de WhatsApp utilizando IA multimodal.
   */
  public static async processAudioMessage(
    audioBuffer: Buffer,
    mimeType: string = 'audio/ogg; codecs=opus',
    context: {
      storeName?: string;
      customerName?: string;
      orderStatus?: string;
      trackingCode?: string;
      agencyInfo?: string;
    }
  ): Promise<string> {
    const base64Audio = audioBuffer.toString('base64');
    const storeTitle = context.storeName || 'Comikids Bordados & Estilo';

    const systemInstruction = `
Eres el asistente virtual de "${storeTitle}".
El cliente te ha enviado una nota de voz / audio por WhatsApp.
Escucha atentamente el audio, comprende su intención y responde cordialmente a su consulta o pedido en español.

Contexto actual del cliente:
- Nombre: ${context.customerName || 'Estimado/a cliente'}
- Código de seguimiento: ${context.trackingCode || 'No registrado aún'}
- Estado de su pedido: ${context.orderStatus || 'Sin pedidos activos'}

Reglas:
- Sé conciso, claro y amable.
- Usa emojis de forma moderada (✨, 📦, 🚚).
`;

    const cleanMimeType = mimeType.includes('ogg')
      ? 'audio/ogg'
      : mimeType.includes('mp4')
      ? 'audio/mp4'
      : 'audio/ogg';

    for (const modelName of GEMINI_POOL) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig: {
            temperature: 0.7,
          },
        });

        const response = await model.generateContent([
          'Escucha este audio del cliente y responde a su consulta:',
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio,
            },
          },
        ]);

        const text = response.response.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } catch (error: any) {
        console.warn(`[AUDIO WARNING] Falló audio con ${modelName}:`, error?.message || error);
      }
    }

    return `¡Hola! Escuchamos tu nota de voz en ${storeTitle} ✨. ¿En qué podemos ayudarte?`;
  }
}

export const AIService = GeminiService;
