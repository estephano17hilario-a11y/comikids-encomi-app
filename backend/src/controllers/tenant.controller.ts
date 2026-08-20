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

      // 1. Determinar instancia activa para envíos (prioridad a sub-instancia del usuario)
      let userSenderInstance = `tenant_${tenantId}`;
      try {
        const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: env.EVOLUTION_API_KEY },
          timeout: 5000,
        });
        const openSub = (fetchRes.data || []).find((i: any) =>
          (i.name.startsWith('tenant_') || i.name.startsWith('tienda_')) && i.connectionStatus === 'open'
        );
        if (openSub) {
          userSenderInstance = openSub.name;
        }
      } catch (err) {
        console.warn('[SYNC DISPATCH INSTANCE CHECK WARN]', err);
      }

      console.log(`[SYNC DISPATCH] Sincronizando ${orders.length} órdenes despachadas vía "${userSenderInstance}"...`);

      const results = [];
      let successCount = 0;

      for (const order of orders) {
        let phoneClean = String(order.phone || '').replace(/[^0-9]/g, '');
        if (phoneClean.length === 9) phoneClean = `51${phoneClean}`;

        if (!phoneClean || phoneClean.length < 9) {
          results.push({ phone: order.phone, status: 'error', error: 'Teléfono inválido' });
          continue;
        }

        const messageText = `¡Hola ${order.customerName || 'estimada clienta'}! 👋✨\n\nTu pedido *#${order.orderCode || order.trackingCode}* ya fue registrado y despachado hacia *Agencia Shalom (${order.agencyName || 'Destino'})* 📦🚀\n\n📋 *Número de Guía:* ${order.guideNumber || 'En trámite'}\n🔍 *Código de Seguimiento:* ${order.trackingCode || order.orderCode}\n🌐 *Rastreo en tiempo real:* https://rastrea.shalom.pe\n\n¡Muchas gracias por tu preferencia! Cualquier consulta estamos a tu servicio.`;

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

          // Enviar mensaje de WhatsApp
          await EvolutionService.sendWhatsAppMessage(userSenderInstance, phoneClean, messageText);
          results.push({ phone: phoneClean, status: 'success' });
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
}

