import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const DEFAULT_SHALOM_EMAIL = 'milagrosjanetamis@gmail.com';
const DEFAULT_SHALOM_PASSWORD = '986398Mi$';

export class ShalomController {
  /**
   * Resuelve las credenciales de Shalom Pro (de los headers, de Supabase taller_config o credenciales oficiales)
   */
  private static async getShalomCredentials(headers: Record<string, any>): Promise<{ email: string; password?: string; apiKey: string }> {
    let email = (headers['x-shalom-email'] as string) || '';
    let password = (headers['x-shalom-password'] as string) || '';
    const apiKey = (headers['x-api-key'] as string) || DEFAULT_API_KEY;

    if (!email || !password) {
      try {
        const { data: configRow } = await supabaseAdmin
          .from('taller_config')
          .select('shalom_email, shalom_password')
          .limit(1)
          .maybeSingle();

        if (configRow) {
          if (!email && configRow.shalom_email) email = configRow.shalom_email;
          if (!password && configRow.shalom_password) password = configRow.shalom_password;
        }
      } catch (err) {
        console.warn('[SHALOM CONTROLLER] Error leyendo credenciales de Supabase:', err);
      }
    }

    if (!email) email = DEFAULT_SHALOM_EMAIL;
    if (!password) password = DEFAULT_SHALOM_PASSWORD;

    return {
      email: email.trim(),
      password: password ? password.trim() : undefined,
      apiKey,
    };
  }


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
        
        if (status === 401 || status === 403) {
          return reply.code(200).send({
            valid: false,
            message: 'Email o contraseña incorrectos en Shalom Pro',
          });
        }

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
        auth?: {
          email?: string;
          password?: string;
          apiKey?: string;
        };
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { order, auth } = request.body || {};
      const credentials = await ShalomController.getShalomCredentials({
        'x-shalom-email': auth?.email,
        'x-shalom-password': auth?.password,
        'x-api-key': auth?.apiKey,
      });

      if (!order) {
        return reply.code(400).send({
          success: false,
          error: 'Datos de la orden requeridos',
        });
      }

      console.log(`[SHALOM PROXY CREATE ORDER] Despachando pedido #${order.codigoSeguimiento} con cuenta "${credentials.email}"...`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        headers['X-Shalom-Password'] = credentials.password;
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
   * Obtiene el PDF del rótulo oficial de Shalom con búsqueda profunda
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
      const cleanSearch = decodeURIComponent(oseId || '').trim();
      const credentials = await ShalomController.getShalomCredentials(request.headers);

      const headers: Record<string, string> = {
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        headers['X-Shalom-Password'] = credentials.password;
      }

      console.log(`[SHALOM PROXY LABEL] Consultando PDF oficial para "${cleanSearch}" en cuenta "${credentials.email}"...`);

      // 1. Intento Directo por ID / OSE
      try {
        const response = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(cleanSearch)}/label`,
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 12000,
          }
        );

        if (response.data && response.data.length > 100) {
          console.log(`[SHALOM PROXY LABEL] ✓ PDF oficial descargado directamente para "${cleanSearch}"`);
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `inline; filename="Guia_Shalom_${cleanSearch}.pdf"`);
          return reply.send(response.data);
        }
      } catch (directErr: any) {
        console.log(`[SHALOM PROXY LABEL] Intento directo para ${cleanSearch} no encontrado (${directErr?.response?.status || directErr.message})`);
      }

      // 2. Intento de Búsqueda en Órdenes de la Cuenta de Shalom
      try {
        const searchLower = cleanSearch.toLowerCase().replace(/[^a-z0-9]/g, '');
        const searchDigits = cleanSearch.replace(/[^0-9]/g, '');

        // 2a. Búsqueda directa por parámetro search en Shalom Pro
        const searchRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders`,
          {
            params: {
              search: cleanSearch,
            },
            headers,
            timeout: 12000,
          }
        );

        let ordersList: any[] = Array.isArray(searchRes.data?.orders)
          ? searchRes.data.orders
          : Array.isArray(searchRes.data?.data)
          ? searchRes.data.data
          : Array.isArray(searchRes.data)
          ? searchRes.data
          : [];

        // 2b. Si la búsqueda directa no trajo resultados, consultar los 50 pedidos más recientes
        if (ordersList.length === 0) {
          const recentRes = await axios.get(
            `${SHALOM_BASE_URL}/v1/orders`,
            {
              params: {
                per_page: 50,
              },
              headers,
              timeout: 12000,
            }
          );
          ordersList = Array.isArray(recentRes.data?.orders)
            ? recentRes.data.orders
            : Array.isArray(recentRes.data?.data)
            ? recentRes.data.data
            : [];
        }


        const foundOrder = ordersList.find((o: any) => {
          if (!o || typeof o !== 'object') return false;

          // 1. Coincidencia por ID u OSE
          if (String(o.id) === cleanSearch || String(o.internal_id) === cleanSearch) return true;

          // 2. Coincidencia por Guía o Serie-Guía (ej: 92644270 o V204-92644270)
          const fullGuia = `${o.serie || ''}-${o.guia || ''}`.toLowerCase();
          const guiaOnly = String(o.guia || '').toLowerCase();
          if (guiaOnly && (guiaOnly === cleanSearch.toLowerCase() || (searchDigits && guiaOnly.includes(searchDigits)))) return true;
          if (fullGuia && (fullGuia.includes(cleanSearch.toLowerCase()) || fullGuia.replace(/[^a-z0-9]/g, '').includes(searchLower))) return true;

          // 3. Coincidencia por Código de Rastreo (ej: CDPJ, KHKC, 3DTT)
          const trackingCode = String(o.codigo || '').toLowerCase();
          if (trackingCode && trackingCode === cleanSearch.toLowerCase()) return true;

          // 4. Coincidencia por DNI / Documento del Destinatario (ej: 47311650, 72115454)
          const receiverDoc = String(o.receiver?.document || o.destinatario?.documento || '').replace(/[^0-9]/g, '');
          if (searchDigits && receiverDoc && (receiverDoc === searchDigits || receiverDoc.includes(searchDigits) || searchDigits.includes(receiverDoc))) return true;

          // 5. Coincidencia por Nombre del Destinatario (ej: Rosario, Carolina, Huatangari)
          const receiverName = String(o.receiver?.full_name || o.receiver?.name || '').toLowerCase();
          if (cleanSearch.length >= 3 && receiverName && receiverName.includes(cleanSearch.toLowerCase())) return true;

          // 6. Coincidencia por Teléfono
          const receiverPhone = String(o.receiver?.phone || '').replace(/[^0-9]/g, '');
          if (searchDigits && searchDigits.length >= 8 && receiverPhone && receiverPhone.includes(searchDigits.slice(-8))) return true;

          return false;
        });

        if (foundOrder && foundOrder.id) {
          console.log(`[SHALOM PROXY LABEL] ✓ Encontrada orden #${foundOrder.id} (Guía: ${foundOrder.serie}-${foundOrder.guia}, Dest: ${foundOrder.receiver?.full_name}) para "${cleanSearch}", descargando PDF...`);
          const labelRes = await axios.get(
            `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(String(foundOrder.id))}/label`,
            {
              headers,
              responseType: 'arraybuffer',
              timeout: 15000,
            }
          );

          if (labelRes.data && labelRes.data.length > 100) {
            console.log(`[SHALOM PROXY LABEL] ✓ PDF Oficial de Shalom (${labelRes.data.length} bytes) descargado para orden #${foundOrder.id}`);
            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `inline; filename="Guia_Shalom_${foundOrder.serie || 'V204'}_${foundOrder.guia || foundOrder.id}.pdf"`);
            return reply.send(labelRes.data);
          }
        }
      } catch (searchErr: any) {
        console.warn(`[SHALOM PROXY LABEL] Búsqueda en Shalom Pro para ${cleanSearch} falló:`, searchErr?.message);
      }


      return reply.code(404).send({
        error: `No se encontró una orden o guía registrada en Shalom Pro para "${cleanSearch}".`,
      });
    } catch (error: any) {
      console.error('[SHALOM PROXY LABEL ERROR]', error?.message);
      return reply.code(404).send({
        error: error?.message || 'No se encontró la guía en Shalom Pro',
      });
    }
  }
}



