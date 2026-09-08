import { FastifyReply, FastifyRequest } from 'fastify';
import { EvolutionService } from '../services/evolution.service.js';
import { z } from 'zod';
import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

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
      const formattedTenantId =
        tenantId === 'comikids_whatsapp' ||
        tenantId === 'main_bot' ||
        tenantId === env.EVOLUTION_INSTANCE_NAME ||
        tenantId.startsWith('tenant_') ||
        tenantId.startsWith('tienda_')
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
        isMaster:
          inst.name === 'tenant_Comikids' ||
          inst.name === 'main_bot' ||
          inst.name === 'comikids_whatsapp' ||
          inst.name === env.EVOLUTION_INSTANCE_NAME,
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
    request: FastifyRequest<{ Params: { tenantId: string }; Querystring: { force?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = request.params;
      const forceRecreate = request.query?.force === 'true';
      const formattedTenantId =
        tenantId === 'comikids_whatsapp' ||
        tenantId === 'main_bot' ||
        tenantId === env.EVOLUTION_INSTANCE_NAME ||
        tenantId.startsWith('tenant_') ||
        tenantId.startsWith('tienda_')
          ? tenantId
          : `tenant_${tenantId}`;

      const result = await EvolutionService.getTenantQrCode(formattedTenantId, forceRecreate);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(200).send({
        success: true,
        data: {
          instanceName: request.params.tenantId,
          status: 'connecting',
          qrcode: {},
        },
      });
    }
  }

  public static async getStatus(
    request: FastifyRequest<{ Params: { tenantId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { tenantId } = request.params;
      const formattedTenantId =
        tenantId === 'comikids_whatsapp' ||
        tenantId === 'main_bot' ||
        tenantId === env.EVOLUTION_INSTANCE_NAME ||
        tenantId.startsWith('tenant_') ||
        tenantId.startsWith('tienda_')
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
      const formattedTenantId =
        tenantId === 'comikids_whatsapp' ||
        tenantId === 'main_bot' ||
        tenantId === env.EVOLUTION_INSTANCE_NAME ||
        tenantId.startsWith('tenant_') ||
        tenantId.startsWith('tienda_')
          ? tenantId
          : `tenant_${tenantId}`;

      // Protección estricta: No permitir borrar el Master Bot
      if (formattedTenantId === 'main_bot' || formattedTenantId === env.EVOLUTION_INSTANCE_NAME || formattedTenantId === 'comikids_whatsapp') {
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
   * Resuelve con estricta seguridad la instancia de WhatsApp de la cuenta de empresa (Sub-QR).
   * BLOQUEA TERMINANTEMENTE el uso de la instancia del Bot Maestro (main_bot / comikids_whatsapp / 901985319)
   * para evitar que los mensajes a clientes se envíen desde el número del bot.
   */
  public static async resolveEmpresaSenderInstance(
    requestedTenantId?: string,
    preferredPhone?: string
  ): Promise<{ instanceName: string; isFallback: boolean; ownerPhone?: string; error?: string }> {
    try {
      const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 6000,
      });
      const instances: any[] = Array.isArray(fetchRes.data) ? fetchRes.data : [];

      // Filtro estricto: EXCLUIR bots maestros (main_bot, comikids_whatsapp, 901985319, o instance name env)
      const isMasterBot = (inst: any) => {
        const name = String(inst.name || '').toLowerCase();
        const jid = String(inst.ownerJid || '');
        const masterEnv = String(env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp').toLowerCase();
        return (
          name === 'main_bot' ||
          name === 'comikids_whatsapp' ||
          name === masterEnv ||
          jid.includes('901985319')
        );
      };

      const subInstances = instances.filter((inst) => !isMasterBot(inst));

      if (subInstances.length === 0) {
        return {
          instanceName: '',
          isFallback: false,
          error: 'No hay ninguna sub-instancia de WhatsApp (Sub-QR de empresa) registrada en el sistema. Por favor crea o escanea el código QR de tu empresa en el panel.',
        };
      }

      // Normalizar identificadores de búsqueda
      const rawId = String(requestedTenantId || '').trim();
      const cleanId = rawId.toLowerCase();
      const cleanPhone = String(preferredPhone || '').replace(/\D/g, '');

      let matchedInstance: any = null;

      // 1. Coincidencia por teléfono emisor si se proveyó
      if (cleanPhone && cleanPhone.length >= 7) {
        matchedInstance = subInstances.find((i) =>
          String(i.ownerJid || '').includes(cleanPhone.slice(-9))
        );
      }

      // 2. Coincidencia exacta por nombre
      if (!matchedInstance && rawId) {
        matchedInstance = subInstances.find((i) => i.name === rawId);
      }

      // 3. Coincidencia con prefijo 'tenant_'
      if (!matchedInstance && rawId) {
        const withPrefix = rawId.startsWith('tenant_') ? rawId : `tenant_${rawId}`;
        matchedInstance = subInstances.find(
          (i) => i.name.toLowerCase() === withPrefix.toLowerCase()
        );
      }

      // 4. Coincidencia flexible por alias o slug (ej. 'Comikids' -> 'tenant_Comikids_tienda', o viceversa)
      if (!matchedInstance && rawId && cleanId !== 'matrix' && cleanId !== 'default') {
        matchedInstance = subInstances.find((i) => {
          const iName = i.name.toLowerCase();
          return (
            iName.includes(cleanId.replace(/^tenant_/, '')) ||
            cleanId.includes(iName.replace(/^tenant_/, ''))
          );
        });
      }

      // 5. Si no se especificó o era Comikids default, buscar la línea histórica de ComiKids (+51 927 781 412 / tenant_Comikids_tienda)
      if (!matchedInstance) {
        matchedInstance = subInstances.find((i) =>
          String(i.ownerJid || '').includes('927781412') ||
          i.name.toLowerCase().includes('comikids')
        );
      }

      // 6. Fallback únicamente al primer sub-instance si no hubo coincidencia (NUNCA AL BOT)
      if (!matchedInstance) {
        matchedInstance = subInstances[0];
      }

      const instanceName = matchedInstance.name;
      const ownerPhone = String(matchedInstance.ownerJid || '').replace(/[^0-9]/g, '');

      // Verificar si la sub-instancia seleccionada está conectada
      if (matchedInstance.connectionStatus === 'open') {
        return { instanceName, isFallback: false, ownerPhone };
      }

      // Si la candidata está close o connecting, verificar si hay alguna otra sub-instancia de tienda abierta
      const openAlternative = subInstances.find((i) => i.connectionStatus === 'open');
      if (openAlternative) {
        console.warn(
          `[SUB-QR ROUTING] Sub-instancia "${instanceName}" está en estado "${matchedInstance.connectionStatus}". Usando alternativa abierta: "${openAlternative.name}"`
        );
        return {
          instanceName: openAlternative.name,
          isFallback: true,
          ownerPhone: String(openAlternative.ownerJid || '').replace(/[^0-9]/g, ''),
        };
      }

      // NINGUNA sub-instancia de empresa está abierta: BLOQUEAR ENVÍO Y NO USAR BOT MAESTRO
      return {
        instanceName,
        isFallback: false,
        ownerPhone,
        error: `La línea de WhatsApp de tu empresa (${instanceName}${ownerPhone ? ` / +${ownerPhone}` : ''}) no está conectada (Estado: ${matchedInstance.connectionStatus || 'close'}). Por favor escanea el Sub Código QR de WhatsApp de tu empresa para reconectarla antes de enviar.`,
      };
    } catch (err: any) {
      console.error('[RESOLVE EMPRESA SENDER ERROR]', err?.message || err);
      return {
        instanceName: '',
        isFallback: false,
        error: `Error al verificar la línea de WhatsApp de la empresa: ${err?.message || 'Fallo de conexión'}`,
      };
    }
  }

  /**
   * Sincroniza y notifica a las clientas por WhatsApp cuando los pedidos son despachados en ruta hacia Shalom
   */
  public static async syncDispatchWhatsApp(
    request: FastifyRequest<{
      Body: {
        orders?: Array<{
          phone: string;
          customerName: string;
          trackingCode: string;
          guideNumber: string;
          agencyName: string;
          orderCode?: string;
        }>;
        labelName?: string;
        tenantId?: string;
        instanceName?: string;
        subInstance?: string;
        phone?: string;
        customerName?: string;
        message?: string;
        trackingCode?: string;
        agencyName?: string;
        guideNumber?: string;
        pickupCode?: string;
        orderCode?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const body = request.body || ({} as any);
      let orders = Array.isArray(body.orders) && body.orders.length > 0
        ? body.orders
        : [];

      // Si se envió un solo pedido en la raíz (ej. aviso rápido o prueba)
      if (orders.length === 0 && body.phone) {
        orders = [{
          phone: body.phone,
          customerName: body.customerName || 'Cliente',
          trackingCode: body.trackingCode || '',
          guideNumber: body.guideNumber || '',
          agencyName: body.agencyName || 'Agencia Shalom',
          orderCode: body.orderCode || body.trackingCode,
        }];
      }

      const labelName = body.labelName || 'Despachando en Shalom';
      const requestedTenant = body.tenantId || body.instanceName || body.subInstance;

      if (!Array.isArray(orders) || orders.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No se enviaron órdenes para sincronizar.',
        });
      }

      // 1. Determinar instancia oficial de despacho: Sub-QR de la empresa (NUNCA EL BOT)
      const resolution = await TenantController.resolveEmpresaSenderInstance(requestedTenant);
      if (resolution.error || !resolution.instanceName) {
        return reply.code(400).send({
          success: false,
          error: resolution.error || 'La línea de WhatsApp de tu empresa (Sub-QR) no está conectada. Escanea el código QR de la empresa para habilitar los envíos.',
        });
      }

      const userSenderInstance = resolution.instanceName;
      const userSenderPhone = resolution.ownerPhone || '51927781412';

      console.log(`[SYNC DISPATCH] Sincronizando ${orders.length} órdenes despachadas vía Sub-QR "${userSenderInstance}" (+${userSenderPhone}) con protección Anti-Ban...`);


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

        // Delay Anti-Ban: Pausa intercalada de 3 a 5 segundos entre mensajes para no ser bloqueados por spam
        if (i > 0) {
          const randomDelay = Math.floor(Math.random() * 2000) + 3000; // 3000ms a 5000ms (3 a 5 segundos)
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
        orders?: Array<{
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
        dispatches?: any[];
        tenantId?: string;
        instanceName?: string;
        subInstance?: string;
        pickupCode?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const body = request.body || ({} as any);
      const orders = Array.isArray(body.orders) && body.orders.length > 0
        ? body.orders
        : (Array.isArray(body.dispatches) ? body.dispatches : []);
      const requestedTenant = body.tenantId || body.instanceName || body.subInstance || 'Comikids';

      if (!Array.isArray(orders) || orders.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No se enviaron órdenes con guías para entregar.',
        });
      }

      // 1. Determinar instancia oficial de despacho: Sub-QR de la empresa (NUNCA EL BOT)
      const resolution = await TenantController.resolveEmpresaSenderInstance(requestedTenant);
      if (resolution.error || !resolution.instanceName) {
        return reply.code(400).send({
          success: false,
          error: resolution.error || 'La línea de WhatsApp de tu empresa (Sub-QR) no está conectada. Escanea el código QR de la empresa para habilitar los envíos.',
        });
      }

      const userSenderInstance = resolution.instanceName;
      const userSenderPhone = resolution.ownerPhone || '51927781412';

      console.log(`[DELIVERY VOUCHERS] Despachando ${orders.length} guías de remisión oficiales vía Sub-QR "${userSenderInstance}" (+${userSenderPhone}) con Anti-Ban (3-6s)...`);

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

        // Delay Anti-Ban (3 a 5 segundos intercalados)
        if (i > 0) {
          const randomDelay = Math.floor(Math.random() * 2000) + 3000;
          console.log(`[ANTI-BAN VOUCHER] Esperando ${randomDelay}ms antes de enviar guía a ${phoneClean}...`);
          await new Promise(r => setTimeout(r, randomDelay));
        }

        const rawExtractedDni = (order.agencyName?.match(/\b(?:DNI[\s\/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i)?.[1]) || '';
        const safeExtractedDni = (rawExtractedDni.toUpperCase() !== 'NCIADOS' && rawExtractedDni.replace(/\D/g, '').length >= 6) ? rawExtractedDni : '';
        const clientDni = String((order as any).dni || (order as any).customerDni || '').replace(/\D/g, '').trim() || safeExtractedDni || '';

        const safeClientName = (order.customerName || 'Clienta').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
        const formattedFileName = order.fileName || `Ticket_Shalom_${safeClientName}_${clientDni || phoneClean.slice(-9)}.pdf`;
        
        // Solo números en el código de orden
        const rawCode = String(order.orderCode || order.trackingCode || '').trim();
        const numbersOnly = rawCode.replace(/^[^\d]*/, '').replace(/\D/g, '') || rawCode;

        let pdfToSend = order.pdfBase64;
        let individualPickupCode = String((order as any).pickupCode || (order as any).claveRecojo || (order as any).shalom_clave_recojo || '').trim();

        // 1. Búsqueda en vivo de la versión más actualizada del ticket en Shalom Pro API emparejado por DNI estricto
        const searchKey = clientDni || order.guideNumber || order.trackingCode || phoneClean.slice(-9);
        if (searchKey && !pdfToSend) {
          try {
            const qParams = new URLSearchParams();
            if (clientDni) qParams.set('dni', clientDni);
            if (order.customerName) qParams.set('name', order.customerName);
            if (phoneClean) qParams.set('phone', phoneClean);
            if (order.guideNumber && !order.guideNumber.startsWith('SH-') && order.guideNumber !== 'S/G') qParams.set('guia', order.guideNumber);

            console.log(`[DELIVERY VOUCHER FETCH] Consultando ticket en Shalom Pro para clienta ${order.customerName} (DNI: ${clientDni})...`);
            const pdfRes = await axios.get(`http://127.0.0.1:3000/api/shalom/orders/${encodeURIComponent(searchKey)}/voucher?${qParams.toString()}`, {
              responseType: 'arraybuffer',
              timeout: 12000,
            });
            if (pdfRes.status === 200 && pdfRes.data && pdfRes.data.length > 100) {
              const returnedDni = (pdfRes.headers['x-shalom-receiver-dni'] as string) || '';
              if (!clientDni || !returnedDni || returnedDni === clientDni) {
                pdfToSend = Buffer.from(pdfRes.data).toString('base64');
              } else {
                console.warn(`[DELIVERY VOUCHER SECURITY LOCK] Comprobante rechazado: DNI devuelto ${returnedDni} no coincide con ${clientDni}`);
              }
              
              // Extraer la clave de recojo REAL con la que se registró en Shalom Pro
              const shalomLivePin = (pdfRes.headers['x-shalom-pickup-code'] as string) || (pdfRes.headers['X-Shalom-Pickup-Code'] as string);
              if (shalomLivePin && shalomLivePin.trim()) {
                individualPickupCode = shalomLivePin.trim();
                console.log(`[DELIVERY VOUCHER] ✓ Clave de recojo oficial extraída en vivo de Shalom Pro para #${numbersOnly}: "${individualPickupCode}"`);
              }

              // Extraer la guía de remisión REAL más actualizada de Shalom Pro
              const shalomLiveGuia = (pdfRes.headers['x-shalom-guia'] as string) || (pdfRes.headers['X-Shalom-Guia'] as string);
              if (shalomLiveGuia && shalomLiveGuia.trim()) {
                order.guideNumber = shalomLiveGuia.trim();
                console.log(`[DELIVERY VOUCHER] ✓ Guía oficial más actualizada extraída en vivo de Shalom Pro para #${numbersOnly}: "${order.guideNumber}"`);
              }
              const shalomLiveOseId = (pdfRes.headers['x-shalom-ose-id'] as string) || (pdfRes.headers['X-Shalom-Ose-Id'] as string);
              if (shalomLiveOseId && shalomLiveOseId.trim()) {
                (order as any).oseId = shalomLiveOseId.trim();
              }
            }
          } catch (pdfErr: any) {
            console.warn(`[DELIVERY VOUCHER LIVE FETCH WARN ${searchKey}]`, pdfErr?.message);
          }
        }

        // 2. Si aún no tenemos PIN o es '0808' default, buscar directamente en la BD Supabase
        if (!individualPickupCode || individualPickupCode === '0808') {
          try {
            const { data: dbOrder } = await supabaseAdmin
              .from('pedidos')
              .select('shalom_clave_recojo')
              .or(`codigo_seguimiento.eq.${numbersOnly},codigo_seguimiento.eq.${rawCode},id.eq.${rawCode}`)
              .limit(1)
              .maybeSingle();

            if (dbOrder && dbOrder.shalom_clave_recojo) {
              individualPickupCode = dbOrder.shalom_clave_recojo;
              console.log(`[DELIVERY VOUCHER] ✓ Clave de recojo específica recuperada de BD para pedido #${numbersOnly}: "${individualPickupCode}"`);
            }
          } catch (dbErr: any) {
            console.warn(`[DELIVERY VOUCHER DB PIN FETCH WARN]`, dbErr?.message);
          }
        }

        if (!individualPickupCode) {
          individualPickupCode = (request.body as any)?.pickupCode || '0909';
        }

        // 3. Armar el Mensaje Oficial Conciso para WhatsApp
        const messageCaption = `¡Hola ${order.customerName || 'clienta'}! 👋✨\n\n📦 Tu pedido *#${numbersOnly}* ya fue entregado en *Shalom* (${order.agencyName || 'Agencia Destino'}).\n\n📋 *Guía:* ${order.guideNumber || 'Oficial'}\n🔐 *Clave de recojo:* ${individualPickupCode}\n🔍 *Seguimiento:* ${order.trackingCode || numbersOnly}\n🌐 *Rastreo:* https://rastrea.shalom.pe\n\n📎 Adjuntamos tu *Ticket Oficial con QR* de Shalom. ¡Gracias por tu compra en Comikids! ❤️`;



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


          // Persistir estado entregado y datos oficiales más actualizados en Supabase
          try {
            await supabaseAdmin
              .from('pedidos')
              .update({
                estado_envio: 'entregado',
                registrado_shalom: true,
                ...(order.guideNumber && order.guideNumber !== 'S/G' && !order.guideNumber.startsWith('SH-') ? { shalom_numero_guia: order.guideNumber } : {}),
                ...(individualPickupCode ? { shalom_clave_recojo: individualPickupCode } : {}),
                ...((order as any).oseId ? { shalom_ose_id: String((order as any).oseId) } : {}),
              })
              .or(`codigo_seguimiento.eq.${numbersOnly},codigo_seguimiento.eq.${rawCode},id.eq.${rawCode}`);
          } catch (supErr: any) {
            console.warn('[DELIVERY VOUCHER SUPABASE UPDATE WARN]', supErr?.message);
          }

          results.push({ phone: phoneClean, fileName: formattedFileName, guideNumber: order.guideNumber, pickupCode: individualPickupCode, status: 'success' });
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


