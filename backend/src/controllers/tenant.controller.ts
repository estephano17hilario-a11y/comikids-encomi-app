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
}
