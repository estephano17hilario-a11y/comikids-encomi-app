import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';

export class ShalomController {
  /**
   * Valida credenciales contra la API de Shalom Pro
   */
  public static async testAuth(
    request: FastifyRequest<{
      Body: {
        email: string;
        password?: string;
        apiKey?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { email, password, apiKey = DEFAULT_API_KEY } = request.body || {};

      if (!email) {
        return reply.code(400).send({
          valid: false,
          message: 'El email de Shalom es requerido',
        });
      }

      console.log(`[SHALOM PROXY AUTH] Verificando credenciales para ${email}...`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Shalom-Email': email,
      };
      if (password) {
        headers['X-Shalom-Password'] = password;
      }

      try {
        const response = await axios.post(
          `${SHALOM_BASE_URL}/v1/auth/login`,
          { email, password },
          {
            headers,
            timeout: 10000,
          }
        );

        return reply.code(200).send({
          valid: true,
          message: 'Credenciales validadas exitosamente con Shalom Pro',
          data: response.data,
        });
      } catch (postErr: any) {
        const status = postErr.response?.status;
        const msg = postErr.response?.data?.message || postErr.message;
        
        // Si el endpoint de login devuelve 401 o 403, las credenciales son incorrectas
        if (status === 401 || status === 403) {
          return reply.code(200).send({
            valid: false,
            message: 'Email o contraseña incorrectos en Shalom Pro',
          });
        }

        // Si es 404/405 (endpoint distinto), validar vía health/agencies con headers
        if (status === 404 || status === 405) {
          try {
            const checkRes = await axios.get(`${SHALOM_BASE_URL}/v1/agencies`, {
              headers,
              timeout: 5000,
            });
            return reply.code(200).send({
              valid: true,
              message: 'Conexión con Shalom Pro establecida correctamente',
              data: checkRes.data,
            });
          } catch (getErr: any) {
            return reply.code(200).send({
              valid: false,
              message: getErr.response?.data?.message || 'Error validando con Shalom Pro',
            });
          }
        }

        return reply.code(200).send({
          valid: false,
          message: msg || 'Error al conectar con Shalom Pro',
        });
      }
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        valid: false,
        message: error?.message || 'Error interno en el servidor proxy',
      });
    }
  }

  /**
   * Registra una orden en Shalom Pro vía API
   */
  public static async createOrder(
    request: FastifyRequest<{
      Body: {
        order: any;
        auth: {
          email: string;
          password?: string;
          apiKey?: string;
        };
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { order, auth } = request.body || {};
      const apiKey = auth?.apiKey || DEFAULT_API_KEY;

      if (!order) {
        return reply.code(400).send({
          success: false,
          error: 'Datos de la orden requeridos',
        });
      }

      console.log(`[SHALOM PROXY CREATE ORDER] Despachando pedido #${order.codigoSeguimiento}...`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Shalom-Email': auth?.email || '',
      };
      if (auth?.password) {
        headers['X-Shalom-Password'] = auth.password;
      }

      const response = await axios.post(
        `${SHALOM_BASE_URL}/v1/orders`,
        order,
        {
          headers,
          timeout: 15000,
        }
      );

      return reply.code(200).send({
        success: true,
        data: response.data,
      });
    } catch (error: any) {
      console.error('[SHALOM PROXY CREATE ORDER ERROR]', error?.response?.data || error?.message);
      const errMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error en Shalom Pro';
      return reply.code(200).send({
        success: false,
        error: errMsg,
      });
    }
  }

  /**
   * Obtiene el PDF del rótulo oficial de Shalom
   */
  public static async getOrderLabel(
    request: FastifyRequest<{
      Params: { oseId: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { oseId } = request.params;
      const query = request.query as any;
      const email = (request.headers['x-shalom-email'] as string) || '';
      const password = (request.headers['x-shalom-password'] as string) || '';
      const apiKey = (request.headers['x-api-key'] as string) || DEFAULT_API_KEY;

      const headers: Record<string, string> = {
        'X-API-Key': apiKey,
        'X-Shalom-Email': email,
      };
      if (password) {
        headers['X-Shalom-Password'] = password;
      }

      console.log(`[SHALOM PROXY LABEL] Consultando PDF oficial de guía/rótulo para identificador "${oseId}"...`);

      // 1. Intento Directo por ID / OSE
      try {
        const response = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders/${oseId}/label`,
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
          }
        );

        if (response.data && response.data.length > 0) {
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `inline; filename="Guia_Shalom_${oseId}.pdf"`);
          return reply.send(response.data);
        }
      } catch (directErr: any) {
        console.log(`[SHALOM PROXY LABEL] Intento directo para ${oseId} falló (${directErr?.response?.status || directErr.message}), probando búsqueda en cuenta...`);
      }

      // 2. Intento de Búsqueda en Órdenes de la Cuenta de Shalom por DNI, Guía o Código
      try {
        const searchRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders`,
          {
            params: {
              search: oseId,
              limit: 5,
            },
            headers,
            timeout: 10000,
          }
        );

        const foundOrder = searchRes.data?.data?.[0] || searchRes.data?.orders?.[0] || searchRes.data?.[0];
        const realOseId = foundOrder?.id || foundOrder?.ose_id || foundOrder?.order_id;

        if (realOseId && realOseId !== oseId) {
          console.log(`[SHALOM PROXY LABEL] Encontrada orden en Shalom #${realOseId} asociada a "${oseId}", descargando PDF...`);
          const labelRes = await axios.get(
            `${SHALOM_BASE_URL}/v1/orders/${realOseId}/label`,
            {
              headers,
              responseType: 'arraybuffer',
              timeout: 15000,
            }
          );
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `inline; filename="Guia_Shalom_${realOseId}.pdf"`);
          return reply.send(labelRes.data);
        }
      } catch (searchErr: any) {
        console.warn(`[SHALOM PROXY LABEL] Búsqueda complementaria para ${oseId} no arrojó resultados:`, searchErr?.message);
      }

      return reply.code(404).send({
        error: `No se encontró una orden o guía registrada en Shalom Pro para "${oseId}".`,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        error: error?.message || 'Error al obtener el rótulo PDF de Shalom',
      });
    }
  }
}

