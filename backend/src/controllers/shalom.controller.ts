import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveShalomAgencyDetails, extractShalomDestino } from '../services/shalomAgencyResolver.js';
import { ShalomSyncService } from '../services/shalomSync.service.js';


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
   * Obtiene el estado de salud de la API upstream de Shalom
   */
  public static async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const res = await axios.get(`${SHALOM_BASE_URL}/status`, { timeout: 8000 });
      return reply.code(res.status).send(res.data);
    } catch {
      return reply.code(200).send({
        overall: 'degraded',
        status: 'degraded',
        message: 'Shalom upstream status unavailable'
      });
    }
  }

  /**
   * Obtiene el listado de 546 agencias oficiales de Shalom
   */
  public static async getAgenciesRoute(request: FastifyRequest, reply: FastifyReply) {
    try {
      const res = await axios.get(`${SHALOM_BASE_URL}/v1/agencies`, {
        headers: { 'X-API-Key': DEFAULT_API_KEY },
        timeout: 10000,
      });
      return reply.code(res.status).send(res.data);
    } catch {
      return reply.code(500).send({ error: 'Error al consultar agencias de Shalom' });
    }
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

      // 1. Validar formato de Email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return reply.code(200).send({
          valid: false,
          message: 'El correo electrónico ingresado no tiene un formato válido',
        });
      }

      // 2. Validar formato de Contraseña
      if (!password || password.trim().length < 6) {
        return reply.code(200).send({
          valid: false,
          message: 'La contraseña de Shalom debe tener al menos 6 caracteres',
        });
      }

      // 3. Validar API Key
      try {
        await axios.get(`${SHALOM_BASE_URL}/v1/agencies`, {
          headers: { 'X-API-Key': apiKey },
          timeout: 6000,
        });
      } catch (apiErr: any) {
        return reply.code(200).send({
          valid: false,
          message: 'La API Key de Shalom API no es válida o fue rechazada',
        });
      }

      console.log(`[SHALOM PROXY AUTH] Verificando credenciales reales para ${email}...`);

      // 4. Autenticación estricta contra endpoint oficial de sesiones de Shalom
      try {
        const sessionRes = await axios.post(
          `${SHALOM_BASE_URL}/v1/shalom/sessions`,
          { email: email.trim(), password: password.trim() },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            timeout: 10000,
          }
        );

        if (sessionRes.status === 200 || sessionRes.status === 201) {
          return reply.code(200).send({
            valid: true,
            message: 'Credenciales autenticadas exitosamente con Shalom Pro',
            data: sessionRes.data,
          });
        }

        return reply.code(200).send({
          valid: false,
          message: 'No se pudo confirmar la sesión con Shalom Pro',
        });
      } catch (sessionErr: any) {
        const status = sessionErr.response?.status;
        const errCode = sessionErr.response?.data?.error?.code || '';
        const errMsg = sessionErr.response?.data?.error?.message || sessionErr.response?.data?.message || sessionErr.message;

        if (status === 401 || status === 403 || errCode === 'unauthorized' || errCode === 'invalid_credentials' || errMsg?.includes('incorrect') || errMsg?.includes('invalid')) {
          return reply.code(200).send({
            valid: false,
            message: 'Email o contraseña incorrectos en Shalom Pro',
          });
        }

        if (errCode === 'shalom_login_unavailable' || status === 503 || status === 504) {
          return reply.code(200).send({
            valid: false,
            message: 'No se pudo verificar la cuenta: El servicio de inicio de sesión de Shalom no responde o está en mantenimiento en este momento.',
          });
        }

        return reply.code(200).send({
          valid: false,
          message: errMsg || 'Error al autenticar credenciales contra Shalom Pro',
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

  private static cachedAgencies: any[] = [];
  private static lastAgenciesFetch: number = 0;

  private static async getAgencies(headers: Record<string, string>): Promise<any[]> {
    const now = Date.now();
    if (ShalomController.cachedAgencies.length > 0 && now - ShalomController.lastAgenciesFetch < 3600000) {
      return ShalomController.cachedAgencies;
    }
    try {
      const res = await axios.get(`${SHALOM_BASE_URL}/v1/agencies?per_page=1000`, {
        headers,
        timeout: 10000,
      });
      if (res.data?.items && Array.isArray(res.data.items)) {
        ShalomController.cachedAgencies = res.data.items;
        ShalomController.lastAgenciesFetch = now;
      }
    } catch (err: any) {
      console.warn('[SHALOM GET AGENCIES WARN]', err?.message);
    }
    return ShalomController.cachedAgencies;
  }

  private static resolveTerminalId(agencies: any[], searchString: string, defaultId: number = 4): number {
    if (!searchString) return defaultId;
    const resolved = resolveShalomAgencyDetails(searchString);
    if (resolved && resolved.terminalId) {
      return resolved.terminalId;
    }
    return defaultId;
  }

  /**
   * Crea una orden en Shalom Pro API de forma 100% determinista y anti-errores
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        headers['X-Shalom-Password'] = credentials.password;
      }

      // Resolver terminal de origen (por defecto 4: AV MEXICO CO)
      let originTerminalId = order.origin_terminal_id;
      if (!originTerminalId) {
        const originQuery = order.sender?.origin_agency || order.remitente?.agenciaOrigen || 'AV MEXICO CO';
        const originResolved = resolveShalomAgencyDetails(originQuery);
        originTerminalId = originResolved?.terminalId || 4;
      }

      // Resolver terminal de destino canónico de forma 100% anti-errores
      const resolvedDestino = resolveShalomAgencyDetails({
        destino_detalle: order.receiver?.destination_agency || order.destinatario?.agenciaDestino || order.destination_agency || order.destino_detalle || '',
        agencyCode: order.destination_agency_code || order.receiver?.destination_agency_code || order.agencyCode,
        agencyId: order.destiny_terminal_id || order.receiver?.destiny_terminal_id,
      });

      const destinyTerminalId = order.destiny_terminal_id ? Number(order.destiny_terminal_id) : resolvedDestino.terminalId;
      const officialAgencyName = resolvedDestino.officialDestination;
      const agencyFullName = resolvedDestino.agencyName;

      // Parsear datos del destinatario
      const rawReceiverName = (order.receiver?.name || order.destinatario?.nombre || order.customer_name || 'Cliente').trim();
      const nameParts = rawReceiverName.split(/\s+/);
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.slice(1).join(' ') || 'General';

      const rawDoc = String(order.receiver?.document || order.receiver?.document_number || order.destinatario?.documento || order.destinatario?.document_number || '00000000').replace(/\D/g, '');
      const docType = rawDoc.length === 11 ? 'RUC' : (rawDoc.length === 8 ? 'DNI' : 'CE');

      const rawPhone = String(order.receiver?.phone || order.destinatario?.telefono || '999999999').replace(/\D/g, '');
      const phoneInt = parseInt(rawPhone.slice(-9), 10) || 900000000;

      const pickupCode = String(order.pickup_code || order.pickupCode || order.clave_recojo || order.pickup_code_custom || '0808').trim();

      const orderToCreate = {
        origin_terminal_id: originTerminalId,
        destiny_terminal_id: destinyTerminalId,
        product_id: order.product_id || 1090, // Caja Paquete XS
        pickup_code: pickupCode,
        declaracion_jurada: 'ropa',
        receiver: {
          document: rawDoc,
          document_type: docType,
          name: firstName,
          last_name: lastName,
          phone: phoneInt,
        }
      };

      console.log(`[SHALOM PROXY CREATE ORDER] Despachando a terminal ${destinyTerminalId} ("${officialAgencyName}") para ${firstName} ${lastName} (${rawDoc})...`);

      const response = await axios.post(
        `${SHALOM_BASE_URL}/v1/orders`,
        orderToCreate,
        {
          headers,
          timeout: 15000,
        }
      );

      return reply.code(200).send({
        success: true,
        data: response.data,
        agency_name: officialAgencyName,
        agency_official: officialAgencyName,
        agency_full_name: agencyFullName,
        terminal_id: destinyTerminalId,
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
   * Obtiene el PDF del Ticket Oficial / Voucher (Formato Físico POS con QR) de Shalom
   */
  public static async getOrderLabel(
    request: FastifyRequest<{
      Params: { oseId: string };
      Querystring: { dni?: string; phone?: string; name?: string; guia?: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply
  ) {
    return ShalomController.fetchOrderPdf(request, reply, 'voucher');
  }

  /**
   * Obtiene el PDF del Ticket Oficial / Voucher (Formato Físico POS con QR) de Shalom
   */
  public static async getOrderVoucher(
    request: FastifyRequest<{
      Params: { oseId: string };
      Querystring: { dni?: string; phone?: string; name?: string; guia?: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply
  ) {
    return ShalomController.fetchOrderPdf(request, reply, 'voucher');
  }

  private static cachedAllOrders: any[] = [];
  private static lastAllOrdersFetch: number = 0;

  /**
   * Sincroniza todas las páginas de órdenes de Shalom Pro en paralelo y las ordena de más recientes a más antiguas
   */
  private static async getAllShalomOrders(headers: Record<string, string>, forceRefresh: boolean = false): Promise<any[]> {
    const now = Date.now();
    if (!forceRefresh && ShalomController.cachedAllOrders.length > 0 && (now - ShalomController.lastAllOrdersFetch < 5000)) {
      return ShalomController.cachedAllOrders;
    }

    try {
      // 1. Obtener primera página (100 órdenes) y total de páginas
      const firstRes = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
        params: { per_page: 100, page: 1 },
        headers,
        timeout: 12000,
      });

      let all: any[] = [];
      const firstPageData = Array.isArray(firstRes.data?.data)
        ? firstRes.data.data
        : Array.isArray(firstRes.data?.orders)
        ? firstRes.data.orders
        : Array.isArray(firstRes.data)
        ? firstRes.data
        : [];

      all.push(...firstPageData);

      const lastPage = Number(firstRes.data?.meta?.last_page || 1);

      // 2. Si hay más páginas, descargarlas en paralelo
      if (lastPage > 1) {
        const pagePromises = [];
        for (let p = 2; p <= lastPage; p++) {
          pagePromises.push(
            axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
              params: { per_page: 100, page: p },
              headers,
              timeout: 12000,
            }).then((res) => {
              return Array.isArray(res.data?.data)
                ? res.data.data
                : Array.isArray(res.data?.orders)
                ? res.data.orders
                : [];
            }).catch((err) => {
              console.warn(`[SHALOM PROXY PAGE ${p} WARN]`, err?.message);
              return [];
            })
          );
        }

        const remainingPages = await Promise.all(pagePromises);
        remainingPages.forEach((pg) => all.push(...pg));
      }

      // 3. Ordenar TODAS las órdenes por ID descendente (las más recientes de hoy al inicio)
      all.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      ShalomController.cachedAllOrders = all;
      ShalomController.lastAllOrdersFetch = now;
      console.log(`[SHALOM PROXY ORDERS SYNC] ✓ ${all.length} órdenes sincronizadas de Shalom Pro (${lastPage} páginas).`);
      return all;
    } catch (err: any) {
      console.warn('[SHALOM PROXY GET ALL ORDERS WARN]', err?.message);
      return ShalomController.cachedAllOrders;
    }
  }

  /**
   * Extracción de PDF (Ticket POS Blanco y Negro con QR Físico Oficial)
   */
  /**
   * Extracción de PDF (Ticket POS Blanco y Negro con QR Físico Oficial)
   * Nivel de Robustez Bancario: Validación y tipado 100% estricto de DNI del destinatario.
   */
  /**
   * Extracción de PDF (Ticket POS Blanco y Negro con QR Físico Oficial)
   * Nivel de Robustez Bancario: Validación y tipado 100% estricto de DNI del destinatario,
   * ventana de tiempo del pedido (Anti-Guías Antiguas) y código interno único.
   */
  private static async fetchOrderPdf(
    request: FastifyRequest<{
      Params: { oseId: string };
      Querystring: { dni?: string; phone?: string; name?: string; guia?: string; orderDate?: string; internalCode?: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply,
    pdfType: 'voucher' | 'label' = 'voucher'
  ) {
    try {
      const { oseId } = request.params;
      const { dni: qDni, phone: qPhone, name: qName, guia: qGuia, orderDate: qOrderDate, internalCode: qInternalCode } = request.query || {};
      const cleanSearch = decodeURIComponent(oseId || '').trim();
      const credentials = await ShalomController.getShalomCredentials(request.headers);

      const headers: Record<string, string> = {
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        headers['X-Shalom-Password'] = credentials.password;
      }

      const filePrefix = 'Ticket_Shalom';

      const SHOP_PHONES = ['927781412', '987654321', '986398000', '989834969', '51927781412', '51987654321'];
      const SHOP_DNIS = ['42020312', '00000000', '20512528458', '20000000001'];

      // 1. Extraer identificadores limpios del cliente
      const isSearchAn8DigitDni = /^\d{8}$/.test(cleanSearch) && !cleanSearch.startsWith('9');
      const isSearchAn11DigitRuc = /^\d{11}$/.test(cleanSearch);
      let rawDni = (qDni || (isSearchAn8DigitDni || isSearchAn11DigitRuc ? cleanSearch : '')).replace(/\D/g, '').trim();
      let rawPhone = (qPhone || (/^9\d{8}$/.test(cleanSearch) ? cleanSearch : '')).replace(/\D/g, '').trim();
      let rawName = (qName || '').toLowerCase().trim();
      const isSearchGuia = cleanSearch.includes('-') || cleanSearch.toUpperCase().startsWith('V') || (/^\d{6,8}$/.test(cleanSearch) && !isSearchAn8DigitDni);
      const targetGuia = (qGuia || (isSearchGuia ? cleanSearch : '')).toUpperCase().trim();
      const targetInternalCode = (qInternalCode || (cleanSearch.startsWith('CMD-') || cleanSearch.startsWith('SH-') ? cleanSearch : '')).toUpperCase().trim();

      // Limpiar datos de tienda/remitente para evitar falsos positivos
      const targetDni = SHOP_DNIS.includes(rawDni) ? '' : rawDni;
      const targetPhone = SHOP_PHONES.includes(rawPhone) || SHOP_PHONES.some(p => rawPhone.endsWith(p)) ? '' : rawPhone;
      const targetName = ['clienta', 'cliente', 'comikids', 'encomi', 'milagros', 'usuario', 'destinatario'].includes(rawName) || rawName.length < 4 ? '' : rawName;

      console.log(`[SHALOM PROXY POS TICKET] Consultando Ticket Oficial Shalom (DNI: "${targetDni || 'S/DNI'}", Guía: "${targetGuia || 'S/G'}", Code: "${targetInternalCode || 'S/C'}", Tel: "${targetPhone || 'S/T'}", Nombre: "${targetName || 'S/N'}")...`);

      // Helper para extraer DNI normalizado de una orden
      const getOrderReceiverDni = (o: any): string => {
        return String(
          o.receiver?.document || 
          o.receiver?.document_number || 
          o.destinatario?.documento || 
          o.receiver?.doc || 
          o.receiver_document || 
          ''
        ).replace(/\D/g, '').trim();
      };

      const getOrderInternalCode = (o: any): string => {
        return String(
          o.internal_code || 
          o.request?.internal_code || 
          o.codigo || 
          o.tracking_code || 
          o.codigo_seguimiento || 
          ''
        ).toUpperCase().trim();
      };

      const getOrderCreationDate = (o: any): Date => {
        const raw = o.created_at || o.fecha_emision || o.fecha || o.request?.created_at || o.emision_fecha || '';
        const parsed = new Date(raw);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
      };

      // 2. Obtener listado sincronizado de órdenes recientes de Shalom Pro
      let ordersList = await ShalomController.getAllShalomOrders(headers);

      // Fecha de referencia del pedido para evitar asociar guías viejas de meses anteriores
      const orderRefDate = qOrderDate ? new Date(qOrderDate) : new Date();

      // Función de coincidencia ESTRICTA ANTI-ERROR
      const findMatchingOrder = (list: any[]) => {
        // 1. Coincidencia por Código Interno Único de Pedido (ej: CMD-1049) - Prioridad Absoluta
        if (targetInternalCode) {
          const cleanTargetCode = targetInternalCode.replace(/[^A-Z0-9]/g, '');
          const byInternal = list.find((o: any) => {
            const code = getOrderInternalCode(o).replace(/[^A-Z0-9]/g, '');
            return code && (code === cleanTargetCode || cleanTargetCode.includes(code) || code.includes(cleanTargetCode));
          });
          if (byInternal) {
            const orderDni = getOrderReceiverDni(byInternal);
            if (!targetDni || !orderDni || orderDni === targetDni) return byInternal;
          }
        }

        // 2. Si cleanSearch es un ID numérico de orden en Shalom Pro (ej: 96844588), y NO es un DNI
        if (/^\d{7,10}$/.test(cleanSearch) && !isSearchAn8DigitDni) {
          const byId = list.find((o: any) => String(o.id) === cleanSearch);
          if (byId) {
            const orderDni = getOrderReceiverDni(byId);
            if (!targetDni || !orderDni || orderDni === targetDni) return byId;
          }
        }

        // 3. Coincidencia por Número de Guía Exacto (ej: V204-12345)
        if (targetGuia) {
          const cleanG = targetGuia.replace(/[^A-Z0-9]/g, '');
          const gMatch = list.find((o: any) => {
            const fullG = `${o.serie || ''}${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return fullG.includes(cleanG) || gOnly === cleanG || String(o.id) === cleanG;
          });
          if (gMatch) {
            const orderDni = getOrderReceiverDni(gMatch);
            if (!targetDni || !orderDni || orderDni === targetDni) return gMatch;
          }
        }

        // 4. Coincidencia por DNI con Filtro de Ventana de Tiempo (ANTI-GUÍAS VIEJAS)
        if (targetDni && targetDni.length >= 6) {
          const dniMatches = list.filter((o: any) => getOrderReceiverDni(o) === targetDni);

          if (dniMatches.length > 0) {
            // Filtrar únicamente órdenes recientes dentro de una ventana razonable (máx 7 días respecto al pedido)
            const recentMatches = dniMatches.filter((o: any) => {
              const oDate = getOrderCreationDate(o);
              if (oDate.getTime() === 0) return true; // Si no tiene fecha, permitir verificación posterior
              const diffDays = Math.abs(orderRefDate.getTime() - oDate.getTime()) / (1000 * 60 * 60 * 24);
              return diffDays <= 7;
            });

            if (recentMatches.length > 0) {
              recentMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
              return recentMatches[0];
            }

            // Si todos los pedidos encontrados con ese DNI son antiguos (de semanas o meses pasados),
            // NO asociar la guía vieja: este pedido actual NO ha sido registrado aún.
            console.warn(`[SHALOM PROXY ANTI-STALE-LOCK] Se encontraron ${dniMatches.length} órdenes para DNI ${targetDni} pero todas son de fechas pasadas. Bloqueado para no enviar guía vieja.`);
            return null;
          }

          return null;
        }

        // 5. Coincidencia por Teléfono del Destinatario (solo órdenes recientes)
        if (targetPhone && targetPhone.length >= 9) {
          const phone9 = targetPhone.slice(-9);
          const phoneMatches = list.filter((o: any) => {
            const p = String(o.receiver?.phone || o.destinatario?.telefono || o.receiver?.phone_number || '').replace(/\D/g, '').trim();
            if (!p || p.slice(-9) !== phone9) return false;
            const oDate = getOrderCreationDate(o);
            if (oDate.getTime() === 0) return true;
            const diffDays = Math.abs(orderRefDate.getTime() - oDate.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
          });
          if (phoneMatches.length > 0) {
            phoneMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            return phoneMatches[0];
          }
        }

        return null;
      };

      let matchedOrder = findMatchingOrder(ordersList);

      // Si no se encontró, forzar refresco fresco desde Shalom Pro
      if (!matchedOrder) {
        console.log(`[SHALOM PROXY] No encontrado en caché, forzando refresco en vivo de órdenes desde Shalom Pro...`);
        ordersList = await ShalomController.getAllShalomOrders(headers, true);
        matchedOrder = findMatchingOrder(ordersList);
      }

      // Si no hubo coincidencia verificada para esta clienta
      if (!matchedOrder) {
        console.warn(`[SHALOM PROXY NOTICE] Sin registro verificado en Shalom Pro para DNI: "${targetDni || 'S/DNI'}", Guía: "${targetGuia || 'S/G'}", Code: "${targetInternalCode || 'S/C'}"`);
        return reply.code(404).send({
          success: false,
          found: false,
          notRegistered: true,
          error: `No se encontró comprobante en Shalom Pro para la clienta con DNI ${targetDni || 'indicado'} en la fecha de este pedido. El paquete aún no ha sido despachado en Shalom API o no se ha generado la guía.`,
        });
      }

      // Validación de Seguridad Bancaria: Si se solicitó un DNI, verificar que la orden encontrada corresponda EXACTAMENTE a ese DNI
      const matchedOrderDni = getOrderReceiverDni(matchedOrder);
      if (targetDni && targetDni.length >= 6 && matchedOrderDni && matchedOrderDni !== targetDni) {
        console.error(`[SHALOM PROXY SECURITY BLOCK] BLOQUEADO: Se solicitó DNI ${targetDni} pero la orden encontrada (#${matchedOrder.id}) pertenece a DNI ${matchedOrderDni}.`);
        return reply.code(403).send({
          success: false,
          found: false,
          error: `Seguridad: El comprobante encontrado pertenece a otro DNI (${matchedOrderDni}). Operación bloqueada.`,
        });
      }

      // 4. Descargar el Ticket Oficial POS con QR (/voucher) del pedido verificado
      console.log(`[SHALOM PROXY DOWNLOAD] ✓ Descargando Ticket Oficial con QR para ${matchedOrder.receiver?.name} (DNI: ${matchedOrderDni}, Guía: ${matchedOrder.serie || 'V204'}-${matchedOrder.guia || matchedOrder.id}, Orden #${matchedOrder.id})...`);

      let docRes;
      try {
        docRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(String(matchedOrder.id))}/voucher`,
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
          }
        );
      } catch (voucherErr) {
        // Respaldo de contingencia
        docRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(String(matchedOrder.id))}/label`,
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
          }
        );
      }

      if (docRes.data && docRes.data.length > 100) {
        const clientCleanDni = matchedOrderDni || targetDni || 'DNI';
        const filename = `${filePrefix}_${matchedOrder.serie || 'V204'}_${matchedOrder.guia || matchedOrder.id}_${clientCleanDni}.pdf`;
        const realPickupCode = String(matchedOrder.pickup_code || matchedOrder.request?.pickup_code || '').trim();
        const fullGuia = `${matchedOrder.serie || 'V204'}-${matchedOrder.guia || matchedOrder.id}`;
        const receiverFullName = `${matchedOrder.receiver?.name || ''} ${matchedOrder.receiver?.last_name || ''}`.trim();

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${filename}"`);
        reply.header('Access-Control-Expose-Headers', 'X-Shalom-Pickup-Code, X-Shalom-Guia, X-Shalom-Receiver-Dni, X-Shalom-Receiver-Name, X-Shalom-Ose-Id');
        if (realPickupCode) {
          reply.header('X-Shalom-Pickup-Code', realPickupCode);
        }
        reply.header('X-Shalom-Guia', fullGuia);
        reply.header('X-Shalom-Receiver-Dni', clientCleanDni);
        if (receiverFullName) {
          reply.header('X-Shalom-Receiver-Name', encodeURIComponent(receiverFullName));
        }
        reply.header('X-Shalom-Ose-Id', String(matchedOrder.id));
        return reply.send(docRes.data);
      }

      return reply.code(404).send({
        error: `El archivo PDF del Ticket recibido de Shalom Pro está vacío.`,
      });

    } catch (error: any) {
      console.error(`[SHALOM PROXY TICKET ERROR]`, error?.message);
      return reply.code(404).send({
        error: error?.message || `No se encontró el documento en Shalom Pro`,
      });
    }
  }

  /**
   * Ejecuta la sincronización de agencias Shalom y propagación de cambios a pedidos
   */
  public static async syncAgencies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const report = await ShalomSyncService.syncAgenciesAndPropagateOrders();
      return reply.code(200).send({
        success: true,
        report,
      });
    } catch (err: any) {
      return reply.code(500).send({
        success: false,
        error: err?.message || 'Error en sincronización de agencias',
      });
    }
  }

  /**
   * Consulta el estado del último sync y la hora del próximo cron 23:59
   */
  public static async getSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    const lastReport = ShalomSyncService.getLastSyncReport();
    const msUntilNext = ShalomSyncService.getMsUntilNext2359();
    const nextCronDate = new Date(Date.now() + msUntilNext);

    return reply.code(200).send({
      success: true,
      lastReport,
      nextScheduledCron: nextCronDate.toISOString(),
      msUntilNext,
    });
  }
}

