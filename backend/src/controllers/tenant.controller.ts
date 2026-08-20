import { FastifyReply, FastifyRequest } from 'fastify';
import { EvolutionService } from '../services/evolution.service.js';
import { z } from 'zod';
import axios from 'axios';
import { env } from '../config/env.js';

const CreateSubInstanceSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  storeName: z.string().optional(),
});

export class TenantController {
  /**
   * Crea una sub-instancia para un cliente (Sub-QR para ingesta silenciosa 24/7)
   */
  public static async createSubInstance(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = CreateSubInstanceSchema.parse(request.body);
      const formattedTenantId = tenantId.startsWith('tenant_')
        ? tenantId
        : `tenant_${tenantId}`;

      const result = await EvolutionService.createTenantInstance(formattedTenantId);

      return reply.code(201).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error al crear la sub-instancia de WhatsApp',
      });
    }
  }

  /**
   * Lista todas las instancias activas (Master Bot y Sub-Instancias)
   */
  public static async listInstances(
    _request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const response = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 10000,
      });

      const instances = Array.isArray(response.data) ? response.data : [];
      const formatted = instances.map((inst: any) => ({
        instanceName: inst.name,
        isMaster: inst.name === 'main_bot' || inst.name === env.EVOLUTION_INSTANCE_NAME,
        connectionStatus: inst.connectionStatus || 'close',
        ownerJid: inst.ownerJid,
        profileName: inst.profileName,
      }));

      return reply.code(200).send({
        success: true,
        count: formatted.length,
        data: formatted,
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error listando instancias de WhatsApp',
      });
    }
  }

  public static async getQrCode(
    request: FastifyRequest<{ Params: { tenantId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = request.params;
      const formattedTenantId = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

      const result = await EvolutionService.getTenantQrCode(formattedTenantId);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error al obtener el código QR',
      });
    }
  }

  public static async getStatus(
    request: FastifyRequest<{ Params: { tenantId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = request.params;
      const formattedTenantId = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

      const result = await EvolutionService.getTenantStatus(formattedTenantId);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error al consultar estado',
      });
    }
  }

  public static async deleteInstance(
    request: FastifyRequest<{ Params: { tenantId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = request.params;
      const formattedTenantId = tenantId.startsWith('tenant_') || tenantId.startsWith('tienda_')
        ? tenantId
        : `tenant_${tenantId}`;

      // Protección estricta: No permitir borrar el Master Bot
      if (formattedTenantId === 'main_bot' || formattedTenantId === env.EVOLUTION_INSTANCE_NAME) {
        return reply.code(403).send({
          success: false,
          error: 'La instancia Master Bot (main_bot) es protegida e inmutable y no puede eliminarse.',
        });
      }

      const success = await EvolutionService.deleteTenantInstance(formattedTenantId);

      return reply.code(200).send({
        success,
        message: success ? 'Sub-instancia eliminada correctamente' : 'No se pudo eliminar la sub-instancia',
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error al eliminar la sub-instancia',
      });
    }
  }

  /**
   * Sincronización post-despacho: Cambia etiqueta a 'Despachando en Shalom' y notifica a las clientas por WhatsApp
   */
  public static async syncDispatchWhatsApp(
    request: FastifyRequest<{
      Body: {
        orders: Array<{
          phone: string;
          customerName: string;
          trackingCode: string;
          guideNumber: string;
          agencyName: string;
          orderCode?: string;
        }>;
        labelName?: string;
        tenantId?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { orders = [], labelName = 'Despachando en Shalom', tenantId = 'matrix' } = request.body || {};

      if (!Array.isArray(orders) || orders.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No se enviaron órdenes para sincronizar.',
        });
      }

      // 1. Determinar instancia activa para envíos (Prioridad a tenant_Comikids / +51927781412)
      let userSenderInstance = 'tenant_Comikids';
      try {
        const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: env.EVOLUTION_API_KEY },
          timeout: 5000,
        });
        const instances = fetchRes.data || [];
        const comikidsSub = instances.find((i: any) => i.name === 'tenant_Comikids' && i.connectionStatus === 'open');
        const matrixSub = instances.find((i: any) => i.name === 'tenant_matrix' && i.connectionStatus === 'open');
        const anyOpenSub = instances.find((i: any) =>
          (i.name.startsWith('tenant_') || i.name.startsWith('tienda_')) && i.connectionStatus === 'open'
        );

        if (comikidsSub) {
          userSenderInstance = comikidsSub.name;
        } else if (matrixSub) {
          userSenderInstance = matrixSub.name;
        } else if (anyOpenSub) {
          userSenderInstance = anyOpenSub.name;
        }
      } catch (err) {
        console.warn('[SYNC DISPATCH INSTANCE CHECK WARN]', err);
      }

      console.log(`[SYNC DISPATCH] Sincronizando ${orders.length} órdenes despachadas vía "${userSenderInstance}" (+51927781412) con protección Anti-Ban (3-6s)...`);


      const results = [];
      let successCount = 0;

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        let phoneClean = String(order.phone || '').replace(/[^0-9]/g, '');
        if (phoneClean.length === 9) phoneClean = `51${phoneClean}`;

        if (!phoneClean || phoneClean.length < 9) {
          results.push({ phone: order.phone, status: 'error', error: 'Teléfono inválido' });
          continue;
        }

        // Delay Anti-Ban: Pausa intercalada de 3 a 6 segundos entre mensajes para no ser bloqueados
        if (i > 0) {
          const randomDelay = Math.floor(Math.random() * 3000) + 3000; // 3000ms a 6000ms
          console.log(`[ANTI-BAN WHATSAPP] Esperando ${randomDelay}ms antes de notificar al contacto ${phoneClean}...`);
          await new Promise(r => setTimeout(r, randomDelay));
        }

        const safeClientName = (order.customerName || 'Clienta').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
        const rawCode = String(order.orderCode || order.trackingCode || '').trim();
        const numbersOnly = rawCode.replace(/^[^\d]*/, '').replace(/\D/g, '') || rawCode;
        
        // Mensaje de pedido en camino/tránsito hacia la agencia Shalom (Sin PDF aún, porque en agencia ajustan el peso/precio final)
        const messageText = `¡Hola ${order.customerName || 'estimada clienta'}! 👋✨\n\nTu pedido *#${numbersOnly}* ya fue registrado con éxito y se encuentra en camino hacia la *Agencia Shalom (${order.agencyName || 'Destino'})* 📦🚚💨\n\n🔍 *Código de Seguimiento:* ${order.trackingCode || numbersOnly}\n\nEn cuanto sea entregado y pesado en la agencia, te enviaremos tu comprobante oficial con su clave de recojo. 🔐\n\n🌐 *Rastreo en tiempo real:* https://rastrea.shalom.pe\n\n¡Muchas gracias por tu preferencia en Comikids! ❤️`;

        try {
          // Intentar asignar etiqueta si la API lo permite
          try {
            await axios.post(
              `${env.EVOLUTION_API_URL}/chat/setChatLabels/${userSenderInstance}`,
              {
                number: phoneClean,
                label: labelName,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  apikey: env.EVOLUTION_API_KEY,
                },
                timeout: 5000,
              }
            );
          } catch (lblErr) {
            // No crítico si no es cuenta WA Business con etiquetas
          }

          // Enviar mensaje de texto informativo (sin PDF en esta etapa de registro previo)
          await EvolutionService.sendWhatsAppMessage(userSenderInstance, phoneClean, messageText);

          results.push({ phone: phoneClean, status: 'success', withPdf: false });
          successCount++;
        } catch (msgErr: any) {
          console.error(`[SYNC DISPATCH MSG ERROR ${phoneClean}]`, msgErr?.response?.data || msgErr?.message);
          results.push({ phone: phoneClean, status: 'error', error: msgErr?.message });
        }
      }

      return reply.code(200).send({
        success: true,
        notifiedCount: successCount,
        totalOrders: orders.length,
        instanceUsed: userSenderInstance,
        results,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error en la sincronización de WhatsApp post-despacho',
      });
    }
  }

  /**
   * Envío de Guías de Remisión Oficiales en PDF al marcar pedidos como "Entregado a Shalom"
   */
  public static async sendDeliveryVouchers(
    request: FastifyRequest<{
      Body: {
        orders: Array<{
          phone: string;
          customerName: string;
          trackingCode: string;
          guideNumber: string;
          agencyName: string;
          orderCode?: string;
          pdfBase64?: string;
          fileName?: string;
          pickupCode?: string;
        }>;
        tenantId?: string;
        pickupCode?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { orders = [], tenantId = 'Comikids' } = request.body || {};

      if (!Array.isArray(orders) || orders.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No se enviaron órdenes con guías para entregar.',
        });
      }

      // 1. Determinar instancia activa para envíos (Prioridad a tenant_Comikids / +51927781412)
      let userSenderInstance = 'tenant_Comikids';
      try {
        const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: env.EVOLUTION_API_KEY },
          timeout: 5000,
        });
        const instances = fetchRes.data || [];
        const comikidsSub = instances.find((i: any) => i.name === 'tenant_Comikids' && i.connectionStatus === 'open');
        const matrixSub = instances.find((i: any) => i.name === 'tenant_matrix' && i.connectionStatus === 'open');
        const anyOpenSub = instances.find((i: any) =>
          (i.name.startsWith('tenant_') || i.name.startsWith('tienda_')) && i.connectionStatus === 'open'
        );

        if (comikidsSub) {
          userSenderInstance = comikidsSub.name;
        } else if (matrixSub) {
          userSenderInstance = matrixSub.name;
        } else if (anyOpenSub) {
          userSenderInstance = anyOpenSub.name;
        }
      } catch (err) {
        console.warn('[DELIVERY VOUCHER SENDER WARN]', err);
      }

      console.log(`[DELIVERY VOUCHERS] Despachando ${orders.length} guías de remisión oficiales vía "${userSenderInstance}" (+51927781412) con Anti-Ban (3-6s)...`);

      const results = [];
      let successCount = 0;

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        let phoneClean = String(order.phone || '').replace(/[^0-9]/g, '');
        if (phoneClean.length === 9) phoneClean = `51${phoneClean}`;

        if (!phoneClean || phoneClean.length < 9) {
          results.push({ phone: order.phone, status: 'error', error: 'Teléfono inválido' });
          continue;
        }

        // Delay Anti-Ban (3 a 6 segundos)
        if (i > 0) {
          const randomDelay = Math.floor(Math.random() * 3000) + 3000;
          console.log(`[ANTI-BAN VOUCHER] Esperando ${randomDelay}ms antes de enviar guía a ${phoneClean}...`);
          await new Promise(r => setTimeout(r, randomDelay));
        }

        const safeClientName = (order.customerName || 'Clienta').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
        const formattedFileName = order.fileName || `Guia_Shalom_${safeClientName}_${phoneClean.slice(-9)}.pdf`;
        
        // Clave individual registrada por paquete o general
        const pickupCode = (order as any).pickupCode || (order as any).claveRecojo || (order as any).shalom_clave_recojo || (request.body as any)?.pickupCode || '0808';

        // Solo números en el código de orden
        const rawCode = String(order.orderCode || order.trackingCode || '').trim();
        const numbersOnly = rawCode.replace(/^[^\d]*/, '').replace(/\D/g, '') || rawCode;

        const messageCaption = `¡Hola ${order.customerName || 'estimada clienta'}! 👋✨\n\n📦 Tu pedido *#${numbersOnly}* ya fue *Entregado y Recibido con éxito en Agencia Shalom (${order.agencyName || 'Destino'})* 🚚💨\n\n📋 *Número de Guía:* ${order.guideNumber || 'Oficial'}\n🔐 *Clave de recojo:* ${pickupCode}\n🔍 *Código de Seguimiento:* ${order.trackingCode || numbersOnly}\n📎 Te adjuntamos tu *Ticket Oficial de Shalom* con el detalle y costo final registrado en agencia.\n🌐 *Rastreo en tiempo real:* https://rastrea.shalom.pe\n\n¡Muchas gracias por tu preferencia en Comikids! ❤️`;

        let pdfToSend = order.pdfBase64;
        if (!pdfToSend) {
          // Búsqueda en vivo de la versión más actualizada del ticket en Shalom Pro API
          const searchKey = order.guideNumber || order.trackingCode || order.orderCode || phoneClean.slice(-9);
          if (searchKey) {
            try {
              let pdfRes = await axios.get(`http://127.0.0.1:3000/api/shalom/orders/${encodeURIComponent(searchKey)}/voucher`, {
                responseType: 'arraybuffer',
                timeout: 10000,
              });
              if (pdfRes.status === 200 && pdfRes.data && pdfRes.data.length > 100) {
                pdfToSend = Buffer.from(pdfRes.data).toString('base64');
              }
            } catch (pdfErr: any) {
              console.warn(`[DELIVERY VOUCHER LIVE FETCH WARN ${searchKey}]`, pdfErr?.message);
            }
          }
        }

        try {
          // Asignar etiqueta 'Entregado en Shalom'
          try {
            await axios.post(
              `${env.EVOLUTION_API_URL}/chat/setChatLabels/${userSenderInstance}`,
              {
                number: phoneClean,
                label: 'Entregado en Shalom',
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  apikey: env.EVOLUTION_API_KEY,
                },
                timeout: 5000,
              }
            );
          } catch (lblErr) {
            // Ignorar si no aplica
          }

          // Si viene con PDF en Base64
          if (pdfToSend && pdfToSend.length > 100) {
            await EvolutionService.sendWhatsAppMedia(userSenderInstance, phoneClean, pdfToSend, {
              caption: messageCaption,
              fileName: formattedFileName,
              mediaType: 'document',
              mimeType: 'application/pdf',
            });
          } else {
            // Fallback a texto
            await EvolutionService.sendWhatsAppMessage(userSenderInstance, phoneClean, messageCaption);
          }


          results.push({ phone: phoneClean, fileName: formattedFileName, status: 'success' });
          successCount++;
        } catch (deliveryErr: any) {
          console.error(`[DELIVERY VOUCHER SEND ERROR ${phoneClean}]`, deliveryErr?.response?.data || deliveryErr?.message);
          results.push({ phone: phoneClean, status: 'error', error: deliveryErr?.message });
        }
      }

      return reply.code(200).send({
        success: true,
        deliveredCount: successCount,
        totalOrders: orders.length,
        instanceUsed: userSenderInstance,
        results,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error?.message || 'Error enviando guías de remisión de entrega',
      });
    }
  }
}


