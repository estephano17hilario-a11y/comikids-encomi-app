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

      // 1. Extraer identificadores del cliente
      const targetDni = (qDni || (cleanSearch.match(/^\d{8,12}$/) ? cleanSearch : '')).replace(/\D/g, '').trim();
      const targetPhone = (qPhone || '').replace(/\D/g, '').trim();
      const targetName = (qName || '').toLowerCase().trim();
      const targetGuia = (qGuia || (cleanSearch.match(/^(?:V\d{3}-)?\d{6,12}$/i) ? cleanSearch : '')).toUpperCase().trim();

      console.log(`[SHALOM PROXY ${pdfType.toUpperCase()}] Buscando documento para Clienta (DNI: "${targetDni}", Guía: "${targetGuia}", Tel: "${targetPhone}", Search: "${cleanSearch}")...`);

      // 2. Si cleanSearch es un ID puramente numérico de orden en Shalom (ej: 83583712), intentar directo primero
      if (/^\d{7,10}$/.test(cleanSearch) && !targetDni) {
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

      // 3. Consultar la lista en vivo de órdenes en Shalom Pro (hasta 100 más recientes)
      let ordersList: any[] = [];
      try {
        const listRes = await axios.get(
          `${SHALOM_BASE_URL}/v1/orders`,
          {
            params: { per_page: 100 },
            headers,
            timeout: 12000,
          }
        );
        ordersList = Array.isArray(listRes.data?.orders)
          ? listRes.data.orders
          : Array.isArray(listRes.data?.data)
          ? listRes.data.data
          : Array.isArray(listRes.data)
          ? listRes.data
          : [];
      } catch (err: any) {
        console.warn(`[SHALOM PROXY LIST WARN]`, err?.message);
      }

      if (ordersList.length === 0) {
        return reply.code(404).send({
          error: `No se pudo obtener la lista de órdenes de Shalom Pro para buscar el documento.`,
        });
      }

      // 4. BÚSQUEDA Y EMPAREJAMIENTO DE ALTA PRECISIÓN (POR DNI, GUÍA O TELÉFONO)
      let matchedOrder: any = null;

      // PRIORIDAD 1: Coincidencia Exacta por DNI del Destinatario (8 a 12 dígitos)
      if (targetDni && targetDni.length >= 8) {
        const dniMatches = ordersList.filter((o: any) => {
          const doc = String(o.receiver?.document || o.destinatario?.documento || '').replace(/\D/g, '').trim();
          return doc === targetDni || (targetDni.length === 8 && doc.endsWith(targetDni)) || (doc.length === 8 && targetDni.endsWith(doc));
        });

        if (dniMatches.length > 0) {
          // Si hay varias órdenes con el mismo DNI, ordenar por ID descendente para tomar la MÁS RECIENTE / ACTUALIZADA
          dniMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          matchedOrder = dniMatches[0];
          console.log(`[SHALOM PROXY MATCH] ✓ Encontrado por DNI (${targetDni}): Orden #${matchedOrder.id} (Guía: ${matchedOrder.serie}-${matchedOrder.guia}) para ${matchedOrder.receiver?.name} ${matchedOrder.receiver?.last_name}`);
        }
      }

      // PRIORIDAD 2: Coincidencia Exacta por Número de Guía o Serie-Guía (ej: V204-80109820 o 80109820)
      if (!matchedOrder && targetGuia) {
        const cleanG = targetGuia.replace(/[^A-Z0-9]/g, '');
        matchedOrder = ordersList.find((o: any) => {
          const fullG = `${o.serie || ''}-${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          return (gOnly && gOnly === cleanG) || (fullG && fullG === cleanG) || String(o.id) === cleanG;
        });
        if (matchedOrder) {
          console.log(`[SHALOM PROXY MATCH] ✓ Encontrado por Guía (${targetGuia}): Orden #${matchedOrder.id} para ${matchedOrder.receiver?.name} (DNI: ${matchedOrder.receiver?.document})`);
        }
      }

      // PRIORIDAD 3: Coincidencia Exacta por Teléfono del Destinatario (9 dígitos)
      if (!matchedOrder && targetPhone && targetPhone.length >= 9) {
        const phone9 = targetPhone.slice(-9);
        const phoneMatches = ordersList.filter((o: any) => {
          const p = String(o.receiver?.phone || '').replace(/\D/g, '').trim();
          return p && p.slice(-9) === phone9;
        });
        if (phoneMatches.length > 0) {
          phoneMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          matchedOrder = phoneMatches[0];
          console.log(`[SHALOM PROXY MATCH] ✓ Encontrado por Teléfono (+51 ${phone9}): Orden #${matchedOrder.id} para ${matchedOrder.receiver?.name} (DNI: ${matchedOrder.receiver?.document})`);
        }
      }

      // PRIORIDAD 4: Coincidencia Exacta por Nombre Completo del Destinatario
      if (!matchedOrder && targetName && targetName.length >= 5) {
        const nameMatches = ordersList.filter((o: any) => {
          const rFullName = `${o.receiver?.name || ''} ${o.receiver?.last_name || ''}`.toLowerCase().trim();
          return rFullName.includes(targetName) || targetName.includes(rFullName);
        });
        if (nameMatches.length > 0) {
          nameMatches.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          matchedOrder = nameMatches[0];
          console.log(`[SHALOM PROXY MATCH] ✓ Encontrado por Nombre ("${targetName}"): Orden #${matchedOrder.id} para ${matchedOrder.receiver?.name} (DNI: ${matchedOrder.receiver?.document})`);
        }
      }

      // Si no hubo coincidencia verificada para esta clienta, NO entregar un PDF aleatorio
      if (!matchedOrder) {
        console.warn(`[SHALOM PROXY NOT FOUND] No se encontró orden en Shalom Pro para la clienta DNI: "${targetDni}", Nombre: "${targetName}", Guía: "${targetGuia}"`);
        return reply.code(404).send({
          error: `No se encontró ${typeLabel} en Shalom Pro para la clienta indicada (DNI: ${targetDni || 'S/DNI'}).`,
        });
      }

      // 5. Descargar el PDF oficial (Ticket o Guía) del pedido verificado
      console.log(`[SHALOM PROXY DOWNLOAD] Descargando ${typeLabel} de Shalom para Orden #${matchedOrder.id} (DNI: ${matchedOrder.receiver?.document}, Guía: ${matchedOrder.serie}-${matchedOrder.guia})...`);

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

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `inline; filename="${filename}"`);
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
