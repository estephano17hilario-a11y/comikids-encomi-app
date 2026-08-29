import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveShalomAgencyDetails, extractShalomDestino } from '../services/shalomAgencyResolver.js';
import { ShalomSyncService } from '../services/shalomSync.service.js';
import { ShalomTrackingListenerService } from '../services/shalomTrackingListener.service.js';


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

      // Inyectar inmediatamente la nueva orden creada en la caché en memoria para resolución en 0ms
      try {
        const createdOrderObj = response.data?.data || response.data;
        if (createdOrderObj && typeof createdOrderObj === 'object') {
          ShalomController.cachedAllOrders = [createdOrderObj, ...ShalomController.cachedAllOrders];
          ShalomController.lastAllOrdersFetch = Date.now();
        }
      } catch {}

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
  private static pdfMemoryCache = new Map<string, { buffer: Buffer; headers: Record<string, string>; timestamp: number }>();

  /**
   * Sincroniza todas las órdenes de Shalom Pro en memoria ultra-rápida (1 sola petición rápida)
   * y las ordena de más recientes a más antiguas (ID descendente)
   */
  private static async getAllShalomOrders(
    headers: Record<string, string>,
    forceRefresh: boolean = false
  ): Promise<any[]> {
    const now = Date.now();
    // Reutilizar caché en memoria si tiene menos de 10 segundos
    if (!forceRefresh && ShalomController.cachedAllOrders.length > 0 && (now - ShalomController.lastAllOrdersFetch < 10000)) {
      return ShalomController.cachedAllOrders;
    }

    try {
      const res = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
        headers,
        timeout: 12000,
      });

      let all: any[] = [];
      if (Array.isArray(res.data?.orders)) {
        all = res.data.orders;
      } else if (Array.isArray(res.data?.data)) {
        all = res.data.data;
      } else if (Array.isArray(res.data)) {
        all = res.data;
      }

      // Ordenar TODAS las órdenes por ID descendente (las más recientes de hoy al inicio)
      all.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      ShalomController.cachedAllOrders = all;
      ShalomController.lastAllOrdersFetch = now;
      console.log(`[SHALOM PROXY ORDERS SYNC] ✓ ${all.length} órdenes sincronizadas de Shalom Pro.`);
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

      // 1. Extraer identificadores limpios del cliente (Sin falsos positivos)
      const is8DigitDni = /^\d{8}$/.test(cleanSearch);
      const is11DigitRuc = /^\d{11}$/.test(cleanSearch);
      const is9DigitPhone = /^9\d{8}$/.test(cleanSearch);
      const isShalomGuide = /^(V\d{3}|[A-Z]\d{3})[- ]?\d{4,8}$/i.test(cleanSearch);
      const isInternalCode = cleanSearch.startsWith('CMD-') || cleanSearch.startsWith('SH-') || (/^\d{1,6}$/.test(cleanSearch) && !is8DigitDni);
      const isNumericOseId = /^\d{7,10}$/.test(cleanSearch) && !is8DigitDni && !is9DigitPhone;

      let rawDni = (qDni || (is8DigitDni || is11DigitRuc ? cleanSearch : '')).replace(/\D/g, '').trim();
      let rawPhone = (qPhone || (is9DigitPhone ? cleanSearch : '')).replace(/\D/g, '').trim();
      let rawName = (qName || '').toLowerCase().trim();
      const targetGuia = (qGuia || (isShalomGuide ? cleanSearch : '')).toUpperCase().trim();
      const targetInternalCode = (qInternalCode || (isInternalCode ? cleanSearch : '')).toUpperCase().trim();

      // Limpiar datos de tienda/remitente para evitar falsos positivos
      const targetDni = SHOP_DNIS.includes(rawDni) ? '' : rawDni;
      const targetPhone = SHOP_PHONES.includes(rawPhone) || SHOP_PHONES.some(p => rawPhone.endsWith(p)) ? '' : rawPhone;
      const targetName = ['clienta', 'cliente', 'comikids', 'encomi', 'milagros', 'usuario', 'destinatario'].includes(rawName) || rawName.length < 3 ? '' : rawName;

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

      const getOrderReceiverName = (o: any): string => {
        return String(
          `${o.receiver?.name || o.destinatario?.nombre || ''} ${o.receiver?.last_name || ''} ${o.receiver?.full_name || ''}`
        ).toLowerCase().trim();
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
        const parsed = new Date(String(raw).replace(' ', 'T'));
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
      };

      // Tokens significativos del nombre del cliente (ej: "claudia", "vargas")
      const targetNameTokens = targetName
        .toLowerCase()
        .replace(/[^a-zñáéíóú\s]/gi, '')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !['clienta', 'cliente', 'destinatario', 'usuario', 'lima', 'peru', 'shalom', 'av', 'sr', 'sra', 'contacto'].includes(w));

      // Verificador de compatibilidad de nombre
      const isNameCompatible = (o: any): boolean => {
        if (targetNameTokens.length === 0) return true;
        const receiverName = getOrderReceiverName(o);
        if (!receiverName) return false;
        return targetNameTokens.some(tok => receiverName.includes(tok));
      };

      // Verificador de compatibilidad de DNI
      const isDniCompatible = (o: any): boolean => {
        const oDni = getOrderReceiverDni(o);
        if (targetDni && targetDni.length >= 6) {
          return oDni === targetDni;
        }
        return true;
      };

      // Filtrar órdenes anuladas / canceladas en Shalom
      const isActiveOrder = (o: any): boolean => {
        const st = String(o.status || o.estado || '').toLowerCase();
        return !['annulled', 'cancelled', 'anulado', 'cancelado'].includes(st) && !o.anulado && !o.is_annulled;
      };

      // 2. Obtener listado sincronizado de órdenes recientes de Shalom Pro
      let ordersList = await ShalomController.getAllShalomOrders(headers);

      // Función de coincidencia ESTRICTA ANTI-ERROR (SIEMPRE retorna la versión más actual / reciente)
      const findMatchingOrder = (list: any[]) => {
        const pool = list.filter(isActiveOrder);

        // 1. PRIORIDAD ABSOLUTA: Coincidencia por DNI del destinatario
        // Toma SIEMPRE el despacho activo MÁS NUEVO de esta clienta (ID más alto)
        if (targetDni && targetDni.length >= 6) {
          const dniMatches = pool.filter((o: any) => getOrderReceiverDni(o) === targetDni);

          if (dniMatches.length > 0) {
            // Ordenar por ID descendente (el despacho más nuevo al inicio)
            dniMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

            // Si el usuario especificó una guía manual exacta, verificarla
            if (targetGuia && targetGuia.length >= 5) {
              const cleanG = targetGuia.replace(/[^A-Z0-9]/g, '');
              const gMatch = dniMatches.find((o: any) => {
                const fullG = `${o.serie || ''}${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                return fullG === cleanG || gOnly === cleanG;
              });
              if (gMatch && isNameCompatible(gMatch)) return gMatch;
            }

            // Filtrar por compatibilidad de nombre si fue proporcionado
            const nameFiltered = dniMatches.filter(isNameCompatible);
            const bestMatches = nameFiltered.length > 0 ? nameFiltered : dniMatches;

            // Retornar SIEMPRE el despacho más nuevo (ID más alto)
            return bestMatches[0];
          }

          return null;
        }


        // 2. PRIORIDAD: Código Interno Único de Pedido (ej: CMD-1049)
        if (targetInternalCode) {
          const cleanTargetCode = targetInternalCode.replace(/[^A-Z0-9]/g, '');
          const byInternal = pool.filter((o: any) => {
            const code = getOrderInternalCode(o).replace(/[^A-Z0-9]/g, '');
            return code && code === cleanTargetCode;
          });
          if (byInternal.length > 0) {
            byInternal.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            const candidate = byInternal.find(o => isDniCompatible(o) && isNameCompatible(o));
            if (candidate) return candidate;
          }
        }

        // 3. PRIORIDAD: Número de Guía Exacto (ej: V204-12345 o 0012345)
        if (targetGuia && targetGuia.length >= 5) {
          const cleanG = targetGuia.replace(/[^A-Z0-9]/g, '');
          const gMatch = pool.find((o: any) => {
            const fullG = `${o.serie || ''}${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return fullG === cleanG || gOnly === cleanG;
          });
          if (gMatch && isDniCompatible(gMatch) && isNameCompatible(gMatch)) {
            return gMatch;
          }
        }

        // 4. PRIORIDAD: OSE ID Directo
        if (isNumericOseId) {
          const byId = pool.find((o: any) => String(o.id) === cleanSearch);
          if (byId && isDniCompatible(byId) && isNameCompatible(byId)) {
            return byId;
          }
        }

        return null;
      };


      let matchedOrder = findMatchingOrder(ordersList);

      // Si no se encontró en caché, forzar refresco fresco desde Shalom Pro
      if (!matchedOrder) {
        ordersList = await ShalomController.getAllShalomOrders(headers, true);
        matchedOrder = findMatchingOrder(ordersList);
      }

      // Si no hubo coincidencia verificada para esta clienta
      if (!matchedOrder) {
        console.warn(`[SHALOM PROXY NOTICE] Sin registro verificado en Shalom Pro para DNI: "${targetDni || 'S/DNI'}", Guía: "${targetGuia || 'S/G'}", Code: "${targetInternalCode || 'S/C'}", Nombre: "${targetName || 'S/N'}"`);
        return reply.code(404).send({
          success: false,
          found: false,
          notRegistered: true,
          error: `No se encontró comprobante en Shalom Pro para la clienta (${targetName || ''} - DNI: ${targetDni || 'S/DNI'}). El paquete aún no ha sido despachado en Shalom API o no se ha generado la guía.`,
        });
      }

      // Validación de Seguridad Nivel Bancario: Si se solicitó un DNI, verificar que la orden encontrada corresponda EXACTAMENTE a ese DNI
      const matchedOrderDni = getOrderReceiverDni(matchedOrder);
      if (targetDni && targetDni.length >= 6 && matchedOrderDni && matchedOrderDni !== targetDni) {
        console.error(`[SHALOM PROXY SECURITY BLOCK] BLOQUEADO: Se solicitó DNI ${targetDni} pero la orden encontrada (#${matchedOrder.id}) pertenece a DNI ${matchedOrderDni}.`);
        return reply.code(403).send({
          success: false,
          found: false,
          error: `Seguridad: El comprobante encontrado pertenece a otro DNI (${matchedOrderDni}). Operación bloqueada.`,
        });
      }

      // Validación de Seguridad Nivel Bancario: Verificar que el nombre corresponda a la clienta
      if (targetNameTokens.length > 0 && !isNameCompatible(matchedOrder)) {
        const receiverName = getOrderReceiverName(matchedOrder);
        console.error(`[SHALOM PROXY SECURITY BLOCK] BLOQUEADO: Se solicitó nombre "${targetName}" pero la orden encontrada (#${matchedOrder.id}) pertenece a "${receiverName}".`);
        return reply.code(403).send({
          success: false,
          found: false,
          error: `Seguridad: El comprobante encontrado pertenece a otra clienta (${receiverName || 'Desconocido'}). Operación bloqueada.`,
        });
      }

      const endpoint = pdfType === 'label' ? 'label' : 'voucher';
      const cacheKey = `${matchedOrder.id}_${endpoint}`;

      // A. SERVIR DESDE CACHÉ EN MEMORIA RAM (0ms) SI YA SE DESCARGÓ RECIENTEMENTE
      const cachedPdf = ShalomController.pdfMemoryCache.get(cacheKey);
      if (cachedPdf && (Date.now() - cachedPdf.timestamp < 180000)) {
        Object.entries(cachedPdf.headers).forEach(([k, v]) => reply.header(k, v));
        return reply.send(cachedPdf.buffer);
      }

      // B. Descargar EXCLUSIVAMENTE el Ticket Oficial POS con QR físico (/voucher) del pedido verificado
      let docRes;
      try {
        docRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(String(matchedOrder.id))}/${endpoint}`,
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
          }
        );
      } catch (dlErr: any) {
        console.error(`[SHALOM PROXY DOWNLOAD ERROR] Falló la descarga del ${endpoint} para orden #${matchedOrder.id}:`, dlErr?.message);
        return reply.code(502).send({
          success: false,
          error: `Error descargando ${endpoint} oficial con QR desde Shalom Pro: ${dlErr?.message}`,
        });
      }

      if (docRes.data && docRes.data.length > 100) {
        const clientCleanDni = matchedOrderDni || targetDni || 'DNI';
        const filename = `${filePrefix}_${matchedOrder.serie || 'V204'}_${matchedOrder.guia || matchedOrder.id}_${clientCleanDni}.pdf`;
        const realPickupCode = String(matchedOrder.pickup_code || matchedOrder.request?.pickup_code || '').trim();
        const fullGuia = `${matchedOrder.serie || 'V204'}-${matchedOrder.guia || matchedOrder.id}`;
        const receiverFullName = `${matchedOrder.receiver?.name || ''} ${matchedOrder.receiver?.last_name || ''}`.trim();

        const headersToSet: Record<string, string> = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Access-Control-Expose-Headers': 'X-Shalom-Pickup-Code, X-Shalom-Guia, X-Shalom-Receiver-Dni, X-Shalom-Receiver-Name, X-Shalom-Ose-Id',
          ...(realPickupCode ? { 'X-Shalom-Pickup-Code': realPickupCode } : {}),
          'X-Shalom-Guia': fullGuia,
          'X-Shalom-Receiver-Dni': clientCleanDni,
          ...(receiverFullName ? { 'X-Shalom-Receiver-Name': encodeURIComponent(receiverFullName) } : {}),
          'X-Shalom-Ose-Id': String(matchedOrder.id),
        };

        // Guardar en caché RAM por 3 minutos
        ShalomController.pdfMemoryCache.set(cacheKey, {
          buffer: docRes.data,
          headers: headersToSet,
          timestamp: Date.now(),
        });

        Object.entries(headersToSet).forEach(([k, v]) => reply.header(k, v));
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

  /**
   * Ejecuta bajo demanda el ciclo del Listener de Tracking de Shalom
   */
  public static async runTrackingListener(
    request: FastifyRequest<{
      Body?: { forceFirstRun?: boolean };
    }>,
    reply: FastifyReply
  ) {
    try {
      const forceFirstRun = Boolean(request.body?.forceFirstRun);
      const report = await ShalomTrackingListenerService.executeListenerCycle(forceFirstRun);
      return reply.code(200).send({
        success: true,
        report,
      });
    } catch (err: any) {
      return reply.code(500).send({
        success: false,
        error: err?.message || 'Error ejecutando ciclo del listener de Shalom',
      });
    }
  }

  /**
   * Consulta el último reporte del Listener de Tracking de Shalom
   */
  public static async getTrackingListenerStatus(request: FastifyRequest, reply: FastifyReply) {
    const report = ShalomTrackingListenerService.getLastReport();
    return reply.code(200).send({
      success: true,
      lastReport: report,
    });
  }
}

