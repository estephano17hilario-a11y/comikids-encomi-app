/**
 * Migrado a Qwen 3.7 Flash vía OpenRouter (ai.service.ts).
 * Este archivo actúa como puente de compatibilidad para evitar roturas.
 */
import {
  AIService,
  auditPaymentVoucher,
  queryCopilotContext,
  parsePaymentVoucher,
  generateAssistantResponse,
  processAudioMessage,
} from './ai.service.js';

export {
  AIService,
  auditPaymentVoucher,
  queryCopilotContext,
  parsePaymentVoucher,
  generateAssistantResponse,
  processAudioMessage,
};

export class GeminiService extends AIService {}
