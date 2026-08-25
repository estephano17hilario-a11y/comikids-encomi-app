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
    if (!searchString || !Array.isArray(agencies) || agencies.length === 0) return defaultId;
    const cleanSearch = searchString.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const exactMatch = agencies.find(a => {
      const name = (a.name || a.nombre || a.terminal || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const code = (a.code || a.codigo || '').toUpperCase();
      return name === cleanSearch || code === cleanSearch;
    });
    if (exactMatch && exactMatch.id) return exactMatch.id;

    const words = cleanSearch.split(/\s+/).filter(w => w.length > 2 && !['AGENCIA', 'SHALOM', 'PARA', 'LIMA', 'TERMINAL'].includes(w));
    if (words.length > 0) {
      const partialMatch = agencies.find(a => {
        const name = (a.name || a.nombre || a.terminal || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return words.every(w => name.includes(w));
      });
      if (partialMatch && partialMatch.id) return partialMatch.id;

      const anyWordMatch = agencies.find(a => {
        const name = (a.name || a.nombre || a.terminal || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return words.some(w => name.includes(w));
      });
      if (anyWordMatch && anyWordMatch.id) return anyWordMatch.id;
    }

    return defaultId;
  }

  /**
   * Crea una orden en Shalom Pro API
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

      const agencies = await ShalomController.getAgencies(headers);

      // Resolver terminal de origen (por defecto 4: AV MEXICO CO)
      let originTerminalId = order.origin_terminal_id;
      if (!originTerminalId) {
        const originQuery = order.sender?.origin_agency || order.remitente?.agenciaOrigen || 'AV MEXICO CO';
        originTerminalId = ShalomController.resolveTerminalId(agencies, originQuery, 4);
      }

      // Resolver terminal de destino por búsqueda inteligente
      let destinyTerminalId = order.destiny_terminal_id;
      if (!destinyTerminalId) {
        const destQuery = order.receiver?.destination_agency || order.destinatario?.agenciaDestino || order.destination_agency || order.destino_detalle || 'LIMA';
        destinyTerminalId = ShalomController.resolveTerminalId(agencies, destQuery, 4);
      }

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

      console.log(`[SHALOM PROXY CREATE ORDER] Despachando a terminal ${destinyTerminalId} para ${firstName} ${lastName} (${rawDoc})...`);

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
      Querystring: { dni?: string; phone?: string; name?: string; guia?: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply
  ) {
    return ShalomController.fetchOrderPdf(request, reply, 'label');
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
    if (!forceRefresh && ShalomController.cachedAllOrders.length > 0 && (now - ShalomController.lastAllOrdersFetch < 15000)) {
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
   * Extracción de PDF (Ticket o Rótulo) emparejado estrictamente con el DNI/Documento de la clienta
   */
  private static async fetchOrderPdf(
    request: FastifyRequest<{
      Params: { oseId: string };
      Querystring: { dni?: string; phone?: string; name?: string; guia?: string };
      Headers: { [key: string]: string };
    }>,
    reply: FastifyReply,
    pdfType: 'label' | 'voucher' = 'label'
  ) {
    try {
      const { oseId } = request.params;
      const { dni: qDni, phone: qPhone, name: qName, guia: qGuia } = request.query || {};
      const cleanSearch = decodeURIComponent(oseId || '').trim();
      const credentials = await ShalomController.getShalomCredentials(request.headers);

      const headers: Record<string, string> = {
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        headers['X-Shalom-Password'] = credentials.password;
      }

      const typeLabel = pdfType === 'voucher' ? 'Ticket/Voucher Oficial' : 'Rótulo/Guía Oficial';
      const filePrefix = pdfType === 'voucher' ? 'Ticket_Shalom' : 'Guia_Shalom';

      const SHOP_PHONES = ['927781412', '987654321', '986398000', '989834969', '51927781412', '51987654321'];
      const SHOP_DNIS = ['42020312', '00000000'];

      // 1. Extraer identificadores limpios del cliente
      let rawDni = (qDni || (cleanSearch.match(/^\d{8,12}$/) ? cleanSearch : '')).replace(/\D/g, '').trim();
      let rawPhone = (qPhone || '').replace(/\D/g, '').trim();
      let rawName = (qName || '').toLowerCase().trim();
      const targetGuia = (qGuia || (cleanSearch.match(/^(?:V\d{3}-)?\d{6,12}$/i) ? cleanSearch : '')).toUpperCase().trim();

      // Limpiar datos de tienda/remitente para evitar falsos positivos
      const targetDni = SHOP_DNIS.includes(rawDni) ? '' : rawDni;
      const targetPhone = SHOP_PHONES.includes(rawPhone) || SHOP_PHONES.some(p => rawPhone.endsWith(p)) ? '' : rawPhone;
      const targetName = ['clienta', 'cliente', 'comikids', 'encomi', 'milagros', 'usuario', 'destinatario'].includes(rawName) || rawName.length < 4 ? '' : rawName;

      console.log(`[SHALOM PROXY ${pdfType.toUpperCase()}] Buscando documento ESTRICTO para Clienta (DNI: "${targetDni}", Guía: "${targetGuia}", Tel: "${targetPhone}", Nombre: "${targetName}")...`);

      // 2. Si cleanSearch es un ID puramente numérico de orden en Shalom (ej: 96231271) y NO es DNI
      if (/^\d{7,10}$/.test(cleanSearch) && !targetDni && targetGuia === cleanSearch) {
        try {
          const directRes = await axios.get(
            `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(cleanSearch)}/${pdfType}`,
            {
              headers,
              responseType: 'arraybuffer',
              timeout: 10000,
            }
          );

          if (directRes.data && directRes.data.length > 100) {
            console.log(`[SHALOM PROXY ${pdfType.toUpperCase()}] ✓ ${typeLabel} descargado directamente por ID #${cleanSearch}`);
            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `inline; filename="${filePrefix}_${cleanSearch}.pdf"`);
            return reply.send(directRes.data);
          }
        } catch (directErr: any) {
          // continuar a búsqueda en vivo
        }
      }

      // 3. Obtener TODAS las órdenes de Shalom Pro (multi-página sincronizada)
      let ordersList = await ShalomController.getAllShalomOrders(headers);

      // Filtro de Recencia: Órdenes creadas en los últimos 4 días (96 horas)
      const MAX_RECENCY_MS = 4 * 24 * 60 * 60 * 1000;
      const isRecentOrder = (o: any) => {
        const dateRaw = o.created_at || o.date || o.created_date || o.fecha;
        if (!dateRaw) return true;
        const orderTimestamp = new Date(dateRaw).getTime();
        if (isNaN(orderTimestamp)) return true;
        return (Date.now() - orderTimestamp) <= MAX_RECENCY_MS;
      };

      // Función de coincidencia ESTRICTA
      const findMatchingOrder = (list: any[]) => {
        // PRIORIDAD 1: Coincidencia Exacta por Número de Guía (si se especificó guía real)
        if (targetGuia) {
          const cleanG = targetGuia.replace(/[^A-Z0-9]/g, '');
          const gMatch = list.find((o: any) => {
            const fullG = `${o.serie || ''}-${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return (gOnly && gOnly === cleanG) || (fullG && fullG === cleanG) || String(o.id) === cleanG;
          });
          if (gMatch) return gMatch;
        }

        // PRIORIDAD 2: Coincidencia Exacta por DNI del Destinatario (8 a 12 dígitos) en ÓRDENES RECIENTES
        if (targetDni && targetDni.length >= 8) {
          const dniMatches = list.filter((o: any) => {
            const doc = String(o.receiver?.document || o.destinatario?.documento || '').replace(/\D/g, '').trim();
            const docMatches = doc === targetDni || (targetDni.length === 8 && doc.endsWith(targetDni)) || (doc.length === 8 && targetDni.endsWith(doc));
            return docMatches && isRecentOrder(o);
          });

          if (dniMatches.length > 0) {
            dniMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            return dniMatches[0];
          }

          // Si el cliente tiene DNI pero NO coincide con ninguna orden reciente en Shalom Pro, NO caer en fallback de teléfono/nombre
          console.warn(`[SHALOM PROXY] DNI ${targetDni} no tiene registro en Shalom Pro en los últimos 4 días.`);
          return null;
        }

        // PRIORIDAD 3: Coincidencia por Teléfono del Destinatario (solo si no es teléfono de tienda y es orden reciente)
        if (targetPhone && targetPhone.length >= 9) {
          const phone9 = targetPhone.slice(-9);
          const phoneMatches = list.filter((o: any) => {
            const p = String(o.receiver?.phone || '').replace(/\D/g, '').trim();
            return p && p.slice(-9) === phone9 && isRecentOrder(o);
          });
          if (phoneMatches.length > 0) {
            phoneMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            return phoneMatches[0];
          }
        }

        // PRIORIDAD 4: Coincidencia por Nombre Completo (solo si nombre es largo y es orden reciente)
        if (targetName && targetName.length >= 6) {
          const nameMatches = list.filter((o: any) => {
            const rFullName = `${o.receiver?.name || ''} ${o.receiver?.last_name || ''}`.toLowerCase().trim();
            return (rFullName.includes(targetName) || targetName.includes(rFullName)) && isRecentOrder(o);
          });
          if (nameMatches.length > 0) {
            nameMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            return nameMatches[0];
          }
        }

        return null;
      };

      let matchedOrder = findMatchingOrder(ordersList);

      // Si no encontró, forzar refresco fresco desde Shalom Pro
      if (!matchedOrder) {
        console.log(`[SHALOM PROXY] No encontrado en cache, forzando refresco de órdenes de Shalom Pro...`);
        ordersList = await ShalomController.getAllShalomOrders(headers, true);
        matchedOrder = findMatchingOrder(ordersList);
      }

      // Si no hubo coincidencia verificada para esta clienta
      if (!matchedOrder) {
        console.log(`[SHALOM PROXY NOTICE] No hay registro reciente en Shalom Pro para DNI: "${targetDni || 'S/DNI'}", Nombre: "${targetName}", Guía: "${targetGuia}"`);
        return reply.code(200).header('Content-Type', 'application/json').send({
          success: false,
          found: false,
          error: `No se encontró ${typeLabel} reciente en Shalom Pro para la clienta indicada (DNI: ${targetDni || 'S/DNI'}).`,
        });
      }
          found: false,
          error: `No se encontró ${typeLabel} en Shalom Pro para la clienta indicada (DNI: ${targetDni || 'S/DNI'}).`,
        });
      }

      // 4. Descargar el PDF oficial (Ticket o Guía) del pedido verificado
      console.log(`[SHALOM PROXY DOWNLOAD] ✓ Encontrado para ${matchedOrder.receiver?.name}: Descargando ${typeLabel} de Shalom para Orden #${matchedOrder.id} (DNI: ${matchedOrder.receiver?.document}, Guía: ${matchedOrder.serie}-${matchedOrder.guia})...`);

      const docRes = await axios.get(
        `${SHALOM_BASE_URL}/v1/orders/${encodeURIComponent(String(matchedOrder.id))}/${pdfType}`,
        {
          headers,
          responseType: 'arraybuffer',
          timeout: 15000,
        }
      );

      if (docRes.data && docRes.data.length > 100) {
        const clientCleanDni = matchedOrder.receiver?.document || targetDni || 'DNI';
        const filename = `${filePrefix}_${matchedOrder.serie || 'V204'}_${matchedOrder.guia || matchedOrder.id}_${clientCleanDni}.pdf`;
        const realPickupCode = String(matchedOrder.pickup_code || matchedOrder.request?.pickup_code || '').trim();
        const fullGuia = `${matchedOrder.serie || 'V204'}-${matchedOrder.guia || matchedOrder.id}`;

        // Sincronizar en segundo plano la clave real y guía oficial en Supabase
        if (realPickupCode || fullGuia) {
          try {
            const updateFields: any = {};
            if (realPickupCode) updateFields.shalom_clave_recojo = realPickupCode;
            if (matchedOrder.guia) updateFields.shalom_numero_guia = fullGuia;
            if (matchedOrder.id) updateFields.shalom_ose_id = String(matchedOrder.id);

            const searchFilter = cleanSearch.length >= 4
              ? `codigo_seguimiento.ilike.%${cleanSearch}%,destino_detalle.ilike.%${clientCleanDni}%,id.ilike.%${cleanSearch}%`
              : `destino_detalle.ilike.%${clientCleanDni}%`;

            supabaseAdmin
              .from('pedidos')
              .update(updateFields)
              .or(searchFilter)
              .then(() => {
                console.log(`[SHALOM CONTROLLER] ✓ Sincronizada clave real "${realPickupCode}" y guía "${fullGuia}" en BD para clienta DNI ${clientCleanDni}`);
              });
          } catch (err: any) {
            console.warn('[SHALOM CONTROLLER DB SYNC WARN]', err?.message);
          }
        }

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${filename}"`);
        reply.header('Access-Control-Expose-Headers', 'X-Shalom-Pickup-Code, X-Shalom-Guia');
        if (realPickupCode) {
          reply.header('X-Shalom-Pickup-Code', realPickupCode);
        }
        reply.header('X-Shalom-Guia', fullGuia);
        return reply.send(docRes.data);
      }


      return reply.code(404).send({
        error: `El archivo PDF de ${typeLabel} recibido de Shalom Pro está vacío.`,
      });

    } catch (error: any) {
      console.error(`[SHALOM PROXY ${pdfType.toUpperCase()} ERROR]`, error?.message);
      return reply.code(404).send({
        error: error?.message || `No se encontró el documento en Shalom Pro`,
      });
    }
  }

}
