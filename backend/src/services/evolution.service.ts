import axios from 'axios';
import { env } from '../config/env.js';
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
    const instanceName = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
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

      // Configurar webhook para ingesta silenciosa
      try {
        await axios.post(
          `${env.EVOLUTION_API_URL}/webhook/set/${instanceName}`,
          {
            enabled: true,
            url: `http://backend_api:${env.PORT}/webhook/evolution`,
            webhookByEvents: false,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
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
    const instanceName = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
      ? tenantId
      : `tenant_${tenantId}`;

    try {
      const response = await axios.get(
        `${env.EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        {
          headers: this.getHeaders(),
          timeout: 15000,
        }
      );

      const data = response.data;
      return {
        instanceName,
        tenantId,
        status: data?.instance?.status || 'connecting',
        qrcode: {
          pairingCode: data?.pairingCode || data?.qrcode?.pairingCode,
          code: data?.code || data?.qrcode?.code,
          base64: data?.base64 || data?.qrcode?.base64,
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
    const instanceName = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
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
    const targetInstance = instanceName || env.EVOLUTION_INSTANCE_NAME;
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
      console.error(`[EVOLUTION SEND ERROR en ${targetInstance}]`, error?.response?.data || error?.message);
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

    try {
      const payload: any = {
        number: phoneClean,
        mediatype: options?.mediaType || (mediaUrlOrBase64.endsWith('.pdf') ? 'document' : 'image'),
        media: mediaUrlOrBase64,
        caption: options?.caption || '',
      };
      if (options?.fileName) payload.fileName = options.fileName;
      if (options?.mimeType) payload.mimetype = options.mimeType;

      const response = await axios.post(
        `${env.EVOLUTION_API_URL}/message/sendMedia/${targetInstance}`,
        payload,
        {
          headers: this.getHeaders(),
          timeout: 25000,
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(`[EVOLUTION SEND MEDIA ERROR en ${targetInstance}]`, error?.response?.data || error?.message);
      throw error;
    }
  }

  /**
   * Alias compatible con el bot individual por defecto.
   */
  public static async sendTextMessage(to: string, text: string): Promise<any> {
    return this.sendWhatsAppMessage(env.EVOLUTION_INSTANCE_NAME, to, text);
  }


  /**
   * Descarga el buffer de imagen o audio directamente desde Evolution API o URL directa.
   */
  public static async getMediaBuffer(
    messageData: EvolutionMessageData,
    instanceName: string = env.EVOLUTION_INSTANCE_NAME
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      // 1. Intentar obtener base64 a través del endpoint oficial de Evolution API v2
      const targetInstance = instanceName || env.EVOLUTION_INSTANCE_NAME;
      const response = await axios.post(
        `${env.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${targetInstance}`,
        {
          message: messageData,
          convertToMp4: false,
        },
        {
          headers: this.getHeaders(),
          timeout: 20000,
        }
      );

      if (response.data && response.data.base64) {
        const base64Clean = response.data.base64.replace(/^data:[a-zA-Z0-9/.-]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        const mimeType = response.data.mimetype || 'image/jpeg';
        return { buffer, mimeType };
      }

      // 2. Si viene una URL directa accesible
      const mediaUrl =
        messageData.message?.imageMessage?.url ||
        messageData.message?.audioMessage?.url;

      if (mediaUrl && mediaUrl.startsWith('http')) {
        const directRes = await axios.get(mediaUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        const mimeType = String(
          directRes.headers['content-type'] ||
            messageData.message?.audioMessage?.mimetype ||
            'image/jpeg'
        );
        return { buffer: Buffer.from(directRes.data), mimeType };
      }

      throw new Error('No se pudo extraer el buffer del archivo multimedia');
    } catch (error) {
      console.error('[EVOLUTION GET MEDIA ERROR]', error);
      throw error;
    }
  }
}
