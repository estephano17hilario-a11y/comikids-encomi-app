import axios from 'axios';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';
import {
  EvolutionMessageData,
  TenantInstanceInfo,
} from '../types/evolution.types.js';

export class EvolutionService {
  private static getHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: env.EVOLUTION_API_KEY,
    };
  }

  /**
   * Crea una nueva instancia de WhatsApp para una tienda/tenant en Evolution API v2.
   * Retorna el código QR en base64 para que el comercio lo escanee.
   */
  public static async createTenantInstance(
    tenantId: string
  ): Promise<TenantInstanceInfo> {
    const instanceName =
      tenantId === 'comikids_whatsapp' ||
      tenantId === 'main_bot' ||
      tenantId === env.EVOLUTION_INSTANCE_NAME ||
      tenantId.startsWith('tenant_') ||
      tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

    const payload = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    };

    console.log(`[EVOLUTION MULTI-TENANT] Creando instancia para tenant "${tenantId}" -> "${instanceName}"...`);

    try {
      const response = await axios.post(
        `${env.EVOLUTION_API_URL}/instance/create`,
        payload,
        {
          headers: this.getHeaders(),
          timeout: 20000,
        }
      );

      // Configurar webhook para ingesta silenciosa y respuestas del Copiloto
      try {
        await axios.post(
          `${env.EVOLUTION_API_URL}/webhook/set/${instanceName}`,
          {
            webhook: {
              enabled: true,
              url: `http://89.117.73.97:${env.PORT}/webhook/evolution`,
              webhookByEvents: false,
              webhookBase64: false,
              events: [
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_SET',
                'SEND_MESSAGE',
                'CONNECTION_UPDATE',
                'CHATS_UPSERT',
                'CHATS_UPDATE',
                'CONTACTS_UPSERT',
                'CONTACTS_UPDATE'
              ],
            }
          },
          { headers: this.getHeaders(), timeout: 10000 }
        );
      } catch (wErr) {
        console.warn(`[EVOLUTION WEBHOOK WARN] No se pudo vincular webhook a ${instanceName}:`, wErr);
      }

      const data = response.data;
      return {
        instanceName,
        tenantId,
        status: data?.instance?.status || 'created',
        qrcode: {
          pairingCode: data?.qrcode?.pairingCode || data?.pairingCode,
          code: data?.qrcode?.code || data?.code,
          base64: data?.qrcode?.base64 || data?.base64,
        },
      };

    } catch (error: any) {
      // Si la instancia ya existe, intentar obtener su QR de reconexión
      if (error?.response?.status === 403 || error?.response?.data?.message?.includes('already in use') || error?.response?.data?.response?.message?.includes('already in use')) {
        console.log(`[EVOLUTION MULTI-TENANT] Instancia "${instanceName}" ya existe, obteniendo estado/QR...`);
        return await this.getTenantQrCode(instanceName);
      }
      console.error(`[EVOLUTION CREATE INSTANCE ERROR]`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Obtiene el código QR de conexión para una tienda específica.
   */
  public static async getTenantQrCode(tenantId: string): Promise<TenantInstanceInfo> {
    const instanceName =
      tenantId === 'comikids_whatsapp' ||
      tenantId === 'main_bot' ||
      tenantId === env.EVOLUTION_INSTANCE_NAME ||
      tenantId.startsWith('tenant_') ||
      tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

    // 1. Revisar si hay un QR en Redis emitido recientemente por webhook
    try {
      const cachedQrRaw = await redisClient.get(`copilot:qr:${instanceName}`);
      if (cachedQrRaw) {
        const cachedQr = JSON.parse(cachedQrRaw);
        if (cachedQr?.base64 || cachedQr?.pairingCode) {
          return {
            instanceName,
            tenantId,
            status: 'connecting',
            qrcode: {
              pairingCode: cachedQr.pairingCode,
              code: cachedQr.code,
              base64: cachedQr.base64,
            },
          };
        }
      }
    } catch {}

    try {
      // 2. Solicitar conexión a Evolution API
      const response = await axios.get(
        `${env.EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      const data = response.data;
      let pairingCode = data?.pairingCode || data?.qrcode?.pairingCode;
      let code = data?.code || data?.qrcode?.code;
      let base64 = data?.base64 || data?.qrcode?.base64;

      // 3. Si no devolvió base64 de inmediato, esperar 1.2s y revisar Redis
      if (!base64) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        try {
          const freshQrRaw = await redisClient.get(`copilot:qr:${instanceName}`);
          if (freshQrRaw) {
            const freshQr = JSON.parse(freshQrRaw);
            base64 = freshQr?.base64 || base64;
            pairingCode = freshQr?.pairingCode || pairingCode;
            code = freshQr?.code || code;
          }
        } catch {}
      }

      return {
        instanceName,
        tenantId,
        status: data?.instance?.status || 'connecting',
        qrcode: {
          pairingCode,
          code,
          base64,
        },
      };
    } catch (error: any) {
      console.error(`[EVOLUTION GET QR ERROR]`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Consulta el estado de conexión de la instancia de una tienda (open, connecting, close).
   */
  public static async getTenantStatus(tenantId: string): Promise<{
    instanceName: string;
    tenantId: string;
    state: string;
  }> {
    const instanceName =
      tenantId === 'comikids_whatsapp' ||
      tenantId === 'main_bot' ||
      tenantId === env.EVOLUTION_INSTANCE_NAME ||
      tenantId.startsWith('tenant_') ||
      tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

    try {
      const response = await axios.get(
        `${env.EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      const state = response.data?.instance?.state || response.data?.state || 'close';
      return {
        instanceName,
        tenantId,
        state,
      };
    } catch (error: any) {
      console.error(`[EVOLUTION STATUS ERROR]`, error?.response?.data || error?.message);
      return {
        instanceName,
        tenantId,
        state: 'close',
      };
    }
  }

  /**
   * Elimina o desconecta la instancia de una tienda.
   */
  public static async deleteTenantInstance(tenantId: string): Promise<boolean> {
    const instanceName = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
      ? tenantId
      : `tenant_${tenantId}`;


    try {
      await axios.delete(
        `${env.EVOLUTION_API_URL}/instance/delete/${instanceName}`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );
      return true;
    } catch (error: any) {
      console.error(`[EVOLUTION DELETE ERROR]`, error?.response?.data || error?.message);
      return false;
    }
  }

  /**
   * Envía un mensaje de texto por WhatsApp a través de la instancia de una tienda específica.
   */
  public static async sendWhatsAppMessage(
    instanceName: string,
    to: string,
    text: string
  ): Promise<any> {
    const targetInstance = instanceName || env.EVOLUTION_INSTANCE_NAME || 'tenant_Comikids';
    let phoneClean = to.replace(/[^0-9]/g, '');
    if (phoneClean.length === 9) {
      phoneClean = `51${phoneClean}`;
    }

    try {
      const response = await axios.post(
        `${env.EVOLUTION_API_URL}/message/sendText/${targetInstance}`,
        {
          number: phoneClean,
          text,
        },
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error: any) {
      console.warn(`[EVOLUTION SEND WARN en ${targetInstance}] Intentando fallback a instancias abiertas...`);
      const fallbackCandidates = ['tenant_Comikids', 'tenant_matrix', 'comikids_whatsapp'].filter(
        (i) => i !== targetInstance
      );
      for (const altInstance of fallbackCandidates) {
        try {
          const altResponse = await axios.post(
            `${env.EVOLUTION_API_URL}/message/sendText/${altInstance}`,
            { number: phoneClean, text },
            { headers: this.getHeaders(), timeout: 15000 }
          );
          console.log(`[EVOLUTION SEND SUCCESS via fallback "${altInstance}"]`);
          return altResponse.data;
        } catch {}
      }
      console.error(`[EVOLUTION SEND ERROR TOTAL en ${targetInstance}]`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Envía un archivo multimedia (imagen, PDF, documento, audio) por WhatsApp.
   */
  public static async sendWhatsAppMedia(
    instanceName: string,
    to: string,
    mediaUrlOrBase64: string,
    options?: {
      caption?: string;
      mediaType?: 'image' | 'document' | 'audio' | 'video';
      fileName?: string;
      mimeType?: string;
    }
  ): Promise<any> {
    const targetInstance = instanceName || env.EVOLUTION_INSTANCE_NAME;
    let phoneClean = to.replace(/[^0-9]/g, '');
    if (phoneClean.length === 9) {
      phoneClean = `51${phoneClean}`;
    }

    // Limpiar base64 si trae prefijo data:...;base64,
    let cleanMedia = mediaUrlOrBase64;
    if (cleanMedia.startsWith('data:')) {
      cleanMedia = cleanMedia.replace(/^data:[^;]+;base64,/, '');
    }

    // Determinar mediatype
    let detectedType: 'image' | 'document' | 'audio' | 'video' = options?.mediaType || 'image';
    if (!options?.mediaType) {
      if (options?.mimeType?.startsWith('image/') || cleanMedia.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i)) {
        detectedType = 'image';
      } else if (
        options?.mimeType?.startsWith('application/') ||
        options?.mimeType?.startsWith('text/') ||
        cleanMedia.match(/\.(pdf|doc|docx|xls|xlsx|txt)($|\?)/i) ||
        options?.fileName?.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i)
      ) {
        detectedType = 'document';
      } else if (options?.mimeType?.startsWith('audio/') || cleanMedia.match(/\.(mp3|ogg|wav|m4a|opus)($|\?)/i)) {
        detectedType = 'audio';
      }
    }

    let formattedMedia = cleanMedia;
    const defaultMime = options?.mimeType || (detectedType === 'document' ? 'application/pdf' : 'image/jpeg');
    if (!formattedMedia.startsWith('http://') && !formattedMedia.startsWith('https://')) {
      if (!formattedMedia.startsWith('data:')) {
        formattedMedia = `data:${defaultMime};base64,${cleanMedia}`;
      }
    }

    const docFileName = options?.fileName || (detectedType === 'document' ? 'Guia_Shalom.pdf' : 'imagen.jpg');
    let lastError: any = null;

    // Intento 1: con Data URI Prefix
    try {
      const payload1 = {
        number: phoneClean,
        mediatype: detectedType,
        mediaType: detectedType,
        media: formattedMedia,
        caption: options?.caption || '',
        fileName: docFileName,
        mimetype: defaultMime,
      };

      console.log(`[EVOLUTION SEND MEDIA T1] Despachando ${detectedType} (${docFileName}) a ${phoneClean} via ${targetInstance}...`);
      const response1 = await axios.post(
        `${env.EVOLUTION_API_URL}/message/sendMedia/${targetInstance}`,
        payload1,
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response1.data;
    } catch (err1: any) {
      console.warn(`[EVOLUTION SEND MEDIA T1 FALLÓ]`, err1?.response?.data || err1?.message);
      lastError = err1;
    }

    // Intento 2: con Pure Base64 (sin data: prefix)
    try {
      const payload2 = {
        number: phoneClean,
        mediatype: detectedType,
        mediaType: detectedType,
        media: cleanMedia,
        caption: options?.caption || '',
        fileName: docFileName,
        mimetype: defaultMime,
      };

      console.log(`[EVOLUTION SEND MEDIA T2] Reintentando con pure base64 a ${phoneClean} via ${targetInstance}...`);
      const response2 = await axios.post(
        `${env.EVOLUTION_API_URL}/message/sendMedia/${targetInstance}`,
        payload2,
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response2.data;
    } catch (err2: any) {
      console.warn(`[EVOLUTION SEND MEDIA T2 FALLÓ]`, err2?.response?.data || err2?.message);
      lastError = err2;
    }

    // Intento 3: endpoint alternativo /message/sendWhatsAppMedia/:instance
    try {
      const payload3 = {
        number: phoneClean,
        mediatype: detectedType,
        media: cleanMedia,
        caption: options?.caption || '',
        fileName: docFileName,
        mimetype: defaultMime,
      };

      const response3 = await axios.post(
        `${env.EVOLUTION_API_URL}/message/sendWhatsAppMedia/${targetInstance}`,
        payload3,
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response3.data;
    } catch (err3: any) {
      console.error(`[EVOLUTION SEND MEDIA ERROR TOTAL en ${targetInstance}]`, lastError?.response?.data || lastError?.message);
      throw lastError || err3;
    }


  }

  /**
   * Alias compatible con el bot individual por defecto.
   */
  public static async sendTextMessage(to: string, text: string): Promise<any> {
    return this.sendWhatsAppMessage(env.EVOLUTION_INSTANCE_NAME, to, text);
  }


  /**
   * Descarga el buffer de imagen, documento o audio directamente desde Evolution API o URL directa.
   */
  public static async getMediaBuffer(
    messageData: EvolutionMessageData,
    instanceName: string = env.EVOLUTION_INSTANCE_NAME
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const targetInstance = instanceName || env.EVOLUTION_INSTANCE_NAME;

    try {
      // 1. Intentar con getBase64FromMediaMessage en Evolution API v2
      const attempts = [
        { message: messageData, convertToMp4: false },
        { message: messageData?.message || messageData, convertToMp4: false }
      ];

      for (const payload of attempts) {
        try {
          const response = await axios.post(
            `${env.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${targetInstance}`,
            payload,
            {
              headers: this.getHeaders(),
              timeout: 20000,
            }
          );

          if (response.data && response.data.base64) {
            const rawBase64 = String(response.data.base64).replace(/^data:[a-zA-Z0-9/.-]+;base64,/, '');
            const buffer = Buffer.from(rawBase64, 'base64');
            const mimeType = response.data.mimetype || 'image/jpeg';
            return { buffer, mimeType };
          }
        } catch (subErr) {
          // Continuar al siguiente intento si falla
        }
      }

      // 2. Si viene una URL directa accesible (documento, imagen, audio)
      const mediaUrl =
        messageData.message?.imageMessage?.url ||
        messageData.message?.documentMessage?.url ||
        messageData.message?.audioMessage?.url;

      if (mediaUrl && mediaUrl.startsWith('http')) {
        const directRes = await axios.get(mediaUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        const mimeType = String(
          directRes.headers['content-type'] ||
            messageData.message?.documentMessage?.mimetype ||
            messageData.message?.imageMessage?.mimetype ||
            messageData.message?.audioMessage?.mimetype ||
            'application/octet-stream'
        );
        return { buffer: Buffer.from(directRes.data), mimeType };
      }

      throw new Error('No se pudo extraer el buffer del archivo multimedia');
    } catch (error) {
      console.error('[EVOLUTION GET MEDIA ERROR]', error);
      throw error;
    }
  }

  /**
   * Garantiza que todas las instancias activas de Evolution API tengan su Webhook configurado hacia el backend
   */
  public static async ensureAllWebhooksConfigured(): Promise<void> {
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      const instances = Array.isArray(response.data) ? response.data : [];
      console.log(`[EVOLUTION WEBHOOK SYNC] Sincronizando webhooks para ${instances.length} instancias...`);

      for (const inst of instances) {
        const name = inst?.name;
        if (!name) continue;

        try {
          await axios.post(
            `${env.EVOLUTION_API_URL}/webhook/set/${name}`,
            {
              webhook: {
                enabled: true,
                url: `http://89.117.73.97:${env.PORT}/webhook/evolution`,
                webhookByEvents: false,
                webhookBase64: false,
                events: [
                  'MESSAGES_UPSERT',
                  'MESSAGES_UPDATE',
                  'MESSAGES_SET',
                  'SEND_MESSAGE',
                  'CONNECTION_UPDATE',
                  'CHATS_UPSERT',
                  'CHATS_UPDATE',
                  'CONTACTS_UPSERT',
                  'CONTACTS_UPDATE',
                ],
              },
            },
            { headers: this.getHeaders(), timeout: 10000 }
          );
          console.log(`[EVOLUTION WEBHOOK SYNC] ✓ Webhook activo en instancia "${name}"`);
        } catch (e: any) {
          console.warn(`[EVOLUTION WEBHOOK SYNC WARN] No se pudo configurar webhook en "${name}":`, e?.message);
        }
      }
    } catch (err: any) {
      console.warn('[EVOLUTION WEBHOOK SYNC ERROR] No se pudieron sincronizar webhooks globales:', err?.message);
    }
  }
}
