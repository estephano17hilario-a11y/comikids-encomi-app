import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { redisClient } from '../config/redis.js';
import { EvolutionService } from './evolution.service.js';
import { Pedido, Usuario } from '../types/database.types.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const DEFAULT_SHALOM_EMAIL = 'milagrosjanetamis@gmail.com';
const DEFAULT_SHALOM_PASSWORD = '986398Mi$';

const SHOP_DNIS = ['42020312', '00000000', '20512528458', '20000000001'];
const SHOP_PHONES = ['927781412', '987654321', '986398000', '989834969', '51927781412', '51987654321'];

export interface ListenerExecutionReport {
  timestamp: string;
  isFirstRun: boolean;
  totalShippedOrdersChecked: number;
  newlyArrivedCount: number;
  notifiedCount: number;
  baselineClassifiedCount: number;
  details: Array<{
    orderId: string;
    trackingCode: string;
    guia: string;
    clientName: string;
    clientPhone: string;
    action: 'BASELINE_SILENT_UPDATE' | 'WHATSAPP_NOTIFIED' | 'ALREADY_NOTIFIED' | 'STILL_IN_TRANSIT' | 'METADATA_SYNCED';
    details?: string;
  }>;
  errors: string[];
}

export class ShalomTrackingListenerService {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static lastReport: ListenerExecutionReport | null = null;

  /**
   * Resuelve credenciales de Shalom Pro de taller_config o variables de entorno
   */
  private static async getShalomCredentials(): Promise<{ email: string; password?: string; apiKey: string }> {
    let email = DEFAULT_SHALOM_EMAIL;
    let password = DEFAULT_SHALOM_PASSWORD;
    let apiKey = env.SHALOM_API_KEY || DEFAULT_API_KEY;

    try {
      const { data: configRow } = await supabaseAdmin
        .from('taller_config')
        .select('shalom_email, shalom_password, shalom_api_key')
        .limit(1)
        .maybeSingle();

      if (configRow) {
        if (configRow.shalom_email) email = configRow.shalom_email.trim();
        if (configRow.shalom_password) password = configRow.shalom_password.trim();
        if (configRow.shalom_api_key) apiKey = configRow.shalom_api_key.trim();
      }
    } catch (err) {
      console.warn('[SHALOM LISTENER] Error leyendo credenciales de Supabase:', err);
    }

    return { email, password, apiKey };
  }

  /**
   * Resuelve la instancia de WhatsApp de la línea oficial de ComiKids (+51 927 781 412 / Sub QR)
   * garantizando que NUNCA se utilice el bot maestro (+51 901 985 319)
   */
  public static async resolveComikidsMainSenderInstance(): Promise<string> {
    const DEFAULT_STORE_INSTANCE = 'tenant_Comikids_tienda';
    try {
      const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 5000,
      });
      const instances = Array.isArray(fetchRes.data) ? fetchRes.data : [];

      // 1. Buscar la línea oficial de ComiKids (+51 927 781 412)
      const comikidsStoreOpen = instances.find((i: any) => 
        i.connectionStatus === 'open' && (
          String(i.ownerJid || '').includes('927781412') ||
          String(i.name || '').toLowerCase().includes('comikids_tienda') ||
          String(i.name || '').toLowerCase().includes('tenant_comikids')
        )
      );
      if (comikidsStoreOpen) return comikidsStoreOpen.name;

      // 2. Si no, cualquier sub-instancia que no sea el bot (+51 901 985 319 / comikids_whatsapp)
      const subOpen = instances.find((i: any) =>
        i.connectionStatus === 'open' &&
        i.name !== 'main_bot' &&
        i.name !== 'comikids_whatsapp' &&
        !String(i.ownerJid || '').includes('901985319')
      );
      if (subOpen) return subOpen.name;
    } catch (err: any) {
      console.warn('[SHALOM LISTENER] Error resolviendo instancia de WhatsApp:', err?.message);
    }
    return DEFAULT_STORE_INSTANCE;
  }

  /**
   * Limpia y formatea la dirección y nombre de agencia eliminando códigos internos técnicos
   */
  public static cleanAgencyDestinationText(destinoDetalle: string): string {
    if (!destinoDetalle) return 'Agencia Shalom Destino';
    let clean = destinoDetalle
      .replace(/^Agencia\s*Shalom\s*:?\s*/i, '')
      .replace(/\(DNI[\s\/]*CE[^)]*\)/gi, '')
      .replace(/\(DNI[^)]*\)/gi, '')
      .replace(/\(CE[^)]*\)/gi, '')
      .replace(/\(Doc[^)]*\)/gi, '')
      .replace(/\(Tel[^)]*\)/gi, '')
      .replace(/\(Correo[^)]*\)/gi, '')
      .replace(/\(Ref[^)]*\)/gi, '')
      .replace(/\(CÓDIGO:[^)]+\)/gi, '')
      .replace(/\(CODIGO:[^)]+\)/gi, '')
      .replace(/\(COD:[^)]+\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return clean;
  }

  /**
   * Extrae el DNI del destinatario desde el texto de destino o usuario
   */
  public static extractRecipientDni(destinoDetalle?: string, userDni?: string): string {
    // 1. Intentar de destino_detalle con etiqueta específica
    if (destinoDetalle) {
      const matchLabel = destinoDetalle.match(/(?:DNI[\s\/]*CE|DNI|CE|Doc|Documento)[\s:]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})/i);
      if (matchLabel && matchLabel[1] && !matchLabel[1].startsWith('usr-')) {
        const clean = matchLabel[1].replace(/\D/g, '').trim();
        if (clean.length >= 8 && !SHOP_DNIS.includes(clean)) return clean;
      }

      // 2. Número de 8 dígitos en destino_detalle
      const match8 = destinoDetalle.match(/\b(\d{8})\b/);
      if (match8 && match8[1]) {
        const clean = match8[1].trim();
        if (!SHOP_DNIS.includes(clean)) return clean;
      }
    }

    // 3. Del usuario si es válido
    if (userDni) {
      const cleanUserDni = userDni.replace(/\D/g, '').trim();
      if (cleanUserDni.length >= 8 && !SHOP_DNIS.includes(cleanUserDni)) {
        return cleanUserDni;
      }
    }

    return '';
  }

  /**
   * Extrae el teléfono limpio para WhatsApp (9 dígitos peruanos formato E.164: 519XXXXXXXX)
   */
  public static extractRecipientPhone(userPhone?: string, destinoDetalle?: string): string {
    let raw = (userPhone || '').replace(/\D/g, '');
    if (raw.length < 9 && destinoDetalle) {
      const matchTel = destinoDetalle.match(/(?:Tel|Cel|Whatsapp|Celular)[\s:]*([0-9]{9})/i);
      if (matchTel && matchTel[1]) {
        raw = matchTel[1];
      }
    }

    if (raw.length >= 9) {
      const last9 = raw.slice(-9);
      if (last9.startsWith('9') && !SHOP_PHONES.includes(last9)) {
        return `51${last9}`;
      }
    }
    return '';
  }

  /**
   * Extrae solo los dígitos numéricos del número de envío (sin letras)
   */
  public static extractNumericShipmentCode(guiaOrTracking: string): string {
    if (!guiaOrTracking) return '';
    // Ejemplos: "V204-93805781" -> "93805781", "93805781" -> "93805781", "COM-2026-6729" -> "6729"
    if (guiaOrTracking.includes('-')) {
      const parts = guiaOrTracking.split('-');
      const lastPart = parts[parts.length - 1].replace(/\D/g, '');
      if (lastPart.length >= 4) return lastPart;
    }
    const digitsOnly = guiaOrTracking.replace(/\D/g, '');
    return digitsOnly || guiaOrTracking;
  }

  /**
   * Obtiene la clave alfabética oficial de la boleta de Shalom
   */
  public static resolveShalomSecurityKey(orderShalomMatch: any, pedido: Pedido): string {
    if (orderShalomMatch?.codigo && typeof orderShalomMatch.codigo === 'string' && orderShalomMatch.codigo.trim().length >= 2) {
      return orderShalomMatch.codigo.trim().toUpperCase();
    }
    if (orderShalomMatch?.pickup_code && typeof orderShalomMatch.pickup_code === 'string' && orderShalomMatch.pickup_code.trim()) {
      return orderShalomMatch.pickup_code.trim().toUpperCase();
    }
    if (pedido.shalom_clave_recojo && pedido.shalom_clave_recojo.trim()) {
      return pedido.shalom_clave_recojo.trim().toUpperCase();
    }
    return '0808';
  }

  /**
   * Construye el mensaje oficial de WhatsApp para la clienta
   */
  public static buildArrivalWhatsAppMessage(params: {
    clientName: string;
    clientDni: string;
    agencyFormatted: string;
    numericShipmentNumber: string;
    securityKey: string;
    brandName: string;
  }): string {
    const { clientName, clientDni, agencyFormatted, numericShipmentNumber, securityKey, brandName } = params;

    return `¡Hola *${clientName}*! 📦✨\n\nTe escribimos de parte de *${brandName}*. Nos acaban de informar de Shalom que tu pedido ya se encuentra *Listo para recoger* en la agencia:\n\n📍 *Agencia de Recojo:*\n${agencyFormatted}\n\n👤 *Destinatario:* ${clientName}\n🪪 *DNI / CE:* ${clientDni}\n📦 *N° de Envío:* *${numericShipmentNumber}*\n🔑 *Clave de Seguridad:* *${securityKey}*\n🌐 *Link de Rastreo Oficial:* https://rastrea.shalom.pe\n\nMuchísimas gracias por la confianza en *${brandName}* 💖✨ Esperamos que disfrutes mucho tus prendas y estaremos aquí para atenderte con mucho cariño en tu próxima compra. ¡Que tengas un maravilloso día! 🙏🌸`;
  }

  /**
   * Descarga TODAS las órdenes de Shalom Pro API con soporte para paginación completa (100% de órdenes)
   */
  public static async fetchAllShalomOrders(headers: Record<string, string>): Promise<any[]> {
    const allOrders: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore && page <= 10) {
      try {
        const res = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
          params: { per_page: perPage, page },
          headers,
          timeout: 15000,
        });

        const list = res.data?.orders || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        if (!list || list.length === 0) {
          hasMore = false;
        } else {
          allOrders.push(...list);
          const totalFromMeta = res.data?.meta?.total;
          const lastPageFromMeta = res.data?.meta?.last_page;
          if (lastPageFromMeta && page >= lastPageFromMeta) {
            hasMore = false;
          } else if (totalFromMeta && allOrders.length >= totalFromMeta) {
            hasMore = false;
          } else if (list.length < perPage) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } catch (err: any) {
        console.warn(`[SHALOM LISTENER] Error consultando página ${page} de Shalom API:`, err?.message);
        hasMore = false;
      }
    }

    // Ordenar de más recientes a más antiguas (ID descendente)
    allOrders.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    console.log(`[SHALOM LISTENER] ✓ Total órdenes descargadas de Shalom API: ${allOrders.length} (en ${page} páginas)`);
    return allOrders;
  }

  /**
   * Búsqueda dirigida de una orden en Shalom API por número de guía o DNI
   */
  public static async fetchShalomOrderByGuia(guiaOrDni: string, headers: Record<string, string>): Promise<any | null> {
    const clean = guiaOrDni.replace(/[^A-Z0-9]/gi, '').trim();
    if (!clean || clean.length < 5) return null;

    try {
      const res = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
        params: { guia: clean },
        headers,
        timeout: 10000,
      });
      const list = res.data?.orders || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (list && list.length > 0) {
        return list[0];
      }
    } catch {}

    return null;
  }

  /**
   * Ejecuta el ciclo completo de escucha y sincronización de estado con Shalom
   */
  public static async executeListenerCycle(forceFirstRunCheck: boolean = false): Promise<ListenerExecutionReport> {
    if (this.isRunning) {
      console.log('[SHALOM LISTENER] Ciclo anterior aún en ejecución, omitiendo...');
      return this.lastReport || {
        timestamp: new Date().toISOString(),
        isFirstRun: false,
        totalShippedOrdersChecked: 0,
        newlyArrivedCount: 0,
        notifiedCount: 0,
        baselineClassifiedCount: 0,
        details: [],
        errors: ['Ciclo anterior en ejecución']
      };
    }

    this.isRunning = true;
    const report: ListenerExecutionReport = {
      timestamp: new Date().toISOString(),
      isFirstRun: false,
      totalShippedOrdersChecked: 0,
      newlyArrivedCount: 0,
      notifiedCount: 0,
      baselineClassifiedCount: 0,
      details: [],
      errors: []
    };

    try {
      console.log('🔍 [SHALOM LISTENER 24/7] Iniciando verificación periódica de paquetes en Shalom...');

      // 1. Obtener pedidos Shalom activos en Supabase
      const { data: pedidosRaw, error: pErr } = await supabaseAdmin
        .from('pedidos')
        .select(`
          id,
          codigo_seguimiento,
          usuario_id,
          detalles_bordado,
          metodo_envio_codigo,
          metodo_envio_nombre,
          destino_detalle,
          estado_produccion,
          estado_envio,
          shalom_ose_id,
          shalom_numero_guia,
          shalom_clave_recojo,
          registrado_shalom,
          created_at,
          updated_at
        `)
        .eq('metodo_envio_codigo', 'shalom')
        .in('estado_envio', ['en_camino', 'despachado', 'en_ruta', 'pendiente', 'listo_para_recojo']);

      if (pErr) {
        throw new Error(`Error consultando pedidos en Supabase: ${pErr.message}`);
      }

      const activeOrders = (pedidosRaw || []) as Pedido[];
      report.totalShippedOrdersChecked = activeOrders.length;

      if (activeOrders.length === 0) {
        console.log('[SHALOM LISTENER] No hay pedidos de Shalom activos para verificar.');
        this.isRunning = false;
        this.lastReport = report;
        return report;
      }

      // 2. Obtener usuarios vinculados
      const userIds = Array.from(new Set(activeOrders.map(p => p.usuario_id).filter(Boolean)));
      let usersMap = new Map<string, Usuario>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabaseAdmin
          .from('usuarios')
          .select('id, dni, nombre_completo, telefono_default, direccion_default, dni_default')
          .in('id', userIds);
        if (usersData) {
          usersData.forEach(u => usersMap.set(u.id, u as Usuario));
        }
      }

      // 3. Consultar TODAS las órdenes de Shalom Pro API con paginación
      const credentials = await this.getShalomCredentials();
      const headers = {
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        (headers as any)['X-Shalom-Password'] = credentials.password;
      }

      const shalomApiOrders = await this.fetchAllShalomOrders(headers);

      // Helper para buscar coincidencia en Shalom API
      const findShalomApiMatch = async (p: Pedido, recipientDni: string): Promise<any | null> => {
        const cleanGuia = (p.shalom_numero_guia || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        const numericGuia = this.extractNumericShipmentCode(cleanGuia);
        const oseIdStr = String(p.shalom_ose_id || '');

        // 1. Coincidencia por OSE ID
        if (oseIdStr && oseIdStr !== 'null') {
          const byOse = shalomApiOrders.find(o => String(o.id) === oseIdStr);
          if (byOse) return byOse;
        }

        // 2. Coincidencia por Número de Guía Exacto
        if (cleanGuia && cleanGuia.length >= 5) {
          const byGuia = shalomApiOrders.find(o => {
            const fullG = `${o.serie || ''}${o.guia || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const gOnly = String(o.guia || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return fullG === cleanGuia || gOnly === cleanGuia || (numericGuia && gOnly === numericGuia);
          });
          if (byGuia) return byGuia;
        }

        // 3. Coincidencia por DNI del Destinatario (Toma el despacho activo más reciente)
        if (recipientDni && recipientDni.length >= 8) {
          const byDni = shalomApiOrders.filter(o => {
            const oDni = String(o.receiver?.document || o.receiver?.document_number || '').replace(/\D/g, '');
            return oDni === recipientDni;
          });
          if (byDni.length > 0) {
            // Ya están ordenados por ID desc, tomar el primero (más reciente)
            return byDni[0];
          }
        }

        // 4. Fallback directo a endpoint individual si tiene guía numérica
        if (numericGuia && numericGuia.length >= 5) {
          const directMatch = await ShalomTrackingListenerService.fetchShalomOrderByGuia(numericGuia, headers);
          if (directMatch) return directMatch;
        }

        return null;
      };

      // 4. Evaluar cada pedido activo
      for (const p of activeOrders) {
        const user = usersMap.get(p.usuario_id);
        const clientName = user?.nombre_completo || 'Clienta';
        const clientDni = this.extractRecipientDni(p.destino_detalle, user?.dni || user?.dni_default) || 'S/DNI';
        const cleanPhone = this.extractRecipientPhone(user?.telefono_default, p.destino_detalle);

        const shalomMatch = await findShalomApiMatch(p, clientDni);

        if (shalomMatch) {
          // Auto-Sincronizar metadatos del despacho si estaban incompletos en Supabase
          const fullGuia = `${shalomMatch.serie || 'V204'}-${shalomMatch.guia || shalomMatch.id}`;
          const oseId = String(shalomMatch.id);
          const pin = shalomMatch.codigo || shalomMatch.pickup_code || p.shalom_clave_recojo || '0808';

          const metadataNeedsUpdate =
            !p.shalom_numero_guia ||
            !p.shalom_ose_id ||
            p.shalom_numero_guia !== fullGuia ||
            p.shalom_ose_id !== oseId ||
            !p.registrado_shalom;

          if (metadataNeedsUpdate) {
            await supabaseAdmin.from('pedidos').update({
              shalom_numero_guia: fullGuia,
              shalom_ose_id: oseId,
              shalom_clave_recojo: pin,
              registrado_shalom: true,
              updated_at: new Date().toISOString()
            }).eq('id', p.id);

            p.shalom_numero_guia = fullGuia;
            p.shalom_ose_id = oseId;
            p.shalom_clave_recojo = pin;
            p.registrado_shalom = true;
          }
        }

        // Detectar si el paquete ya llegó a destino / desembarcado / listo para recojo
        // En Shalom: delivered === true, status >= 2, o estado textual 'desembarcado'/'agencia'/'recojo'/'entreg'
        const isArrivedAtDestination = Boolean(
          shalomMatch && (
            shalomMatch.delivered === true ||
            Number(shalomMatch.status || 0) >= 2 ||
            (shalomMatch.status_name && /desembarcado|agencia|recojo|entreg|arribado|destino|disponible/i.test(String(shalomMatch.status_name))) ||
            (shalomMatch.items && shalomMatch.items.some((i: any) => Number(i.status || 0) >= 2))
          )
        );

        const notificationKey = `shalom:pickup_notified:${p.id}`;
        const alreadyNotified = await redisClient.get(notificationKey);

        if (isArrivedAtDestination) {
          if (!alreadyNotified) {
            // =========================================================================
            // PAQUETE LISTO PARA RECOJO: Disparar WhatsApp y actualizar estado
            // =========================================================================
            const cleanAgencyFormatted = this.cleanAgencyDestinationText(p.destino_detalle);
            const rawGuia = p.shalom_numero_guia || (shalomMatch ? `${shalomMatch.serie}-${shalomMatch.guia}` : '') || p.codigo_seguimiento;
            const numericShipmentNumber = this.extractNumericShipmentCode(rawGuia);
            const securityKey = this.resolveShalomSecurityKey(shalomMatch, p);
            const brandName = 'ComiKids';

            const whatsappMessage = this.buildArrivalWhatsAppMessage({
              clientName,
              clientDni,
              agencyFormatted: cleanAgencyFormatted,
              numericShipmentNumber,
              securityKey,
              brandName
            });

            // Consultar comprobante oficial de Shalom Pro en PDF si está disponible
            let voucherBase64: string | null = null;
            if (shalomMatch?.id) {
              try {
                const vRes = await axios.get(`${SHALOM_BASE_URL}/v1/orders/${shalomMatch.id}/voucher`, {
                  headers,
                  responseType: 'arraybuffer',
                  timeout: 10000,
                });
                if (vRes.status === 200 && vRes.data && vRes.data.length > 500) {
                  voucherBase64 = Buffer.from(vRes.data).toString('base64');
                  console.log(`[SHALOM LISTENER] ✓ Comprobante oficial de Shalom Pro recuperado para #${numericShipmentNumber} (${vRes.data.length} bytes)`);
                }
              } catch (vErr: any) {
                console.warn(`[SHALOM LISTENER VOUCHER FETCH WARN ${shalomMatch.id}]`, vErr?.message);
              }
            }

            let sentSuccess = false;
            if (cleanPhone && cleanPhone.length >= 9) {
              try {
                // Resolver siempre la línea oficial de ComiKids (+51 927 781 412 / Sub QR)
                const senderInstance = await ShalomTrackingListenerService.resolveComikidsMainSenderInstance();

                if (voucherBase64) {
                  console.log(`[SHALOM LISTENER] Enviando Ticket Oficial PDF con aviso de recojo a ${clientName} (+${cleanPhone}) desde ${senderInstance} (+51 927 781 412)...`);
                  await EvolutionService.sendWhatsAppMedia(senderInstance, cleanPhone, voucherBase64, {
                    caption: whatsappMessage,
                    fileName: `Comprobante_Shalom_${numericShipmentNumber || p.codigo_seguimiento}.pdf`,
                    mediaType: 'document',
                    mimeType: 'application/pdf',
                  });
                } else {
                  console.log(`[SHALOM LISTENER] Enviando WhatsApp de aviso a ${clientName} (+${cleanPhone}) desde ${senderInstance} (+51 927 781 412)...`);
                  await EvolutionService.sendWhatsAppMessage(senderInstance, cleanPhone, whatsappMessage);
                }

                sentSuccess = true;
                console.log(`[SHALOM LISTENER] ✅ WhatsApp de aviso enviado con éxito a ${clientName} (+${cleanPhone}) para pedido #${p.codigo_seguimiento} vía ${senderInstance}`);
              } catch (msgErr: any) {
                console.error(`[SHALOM LISTENER ERROR] Error enviando WhatsApp a ${cleanPhone}:`, msgErr?.message);
                report.errors.push(`Error WhatsApp ${cleanPhone}: ${msgErr?.message}`);
              }
            } else {
              console.warn(`[SHALOM LISTENER WARN] Pedido #${p.codigo_seguimiento} no tiene teléfono válido para enviar WhatsApp (DNI ${clientDni}).`);
            }

            // Actualizar estado en Supabase a 'listo_para_recojo'
            await supabaseAdmin.from('pedidos').update({
              estado_envio: 'listo_para_recojo',
              updated_at: new Date().toISOString()
            }).eq('id', p.id);

            // Registrar en Redis para no enviar spam (90 días de retención)
            await redisClient.set(notificationKey, JSON.stringify({
              timestamp: new Date().toISOString(),
              phone: cleanPhone,
              sentSuccess,
              guia: rawGuia,
              pin: securityKey
            }), 'EX', 86400 * 90);

            report.newlyArrivedCount++;
            if (sentSuccess) report.notifiedCount++;

            report.details.push({
              orderId: p.id,
              trackingCode: p.codigo_seguimiento,
              guia: rawGuia,
              clientName,
              clientPhone: cleanPhone,
              action: 'WHATSAPP_NOTIFIED',
              details: `Notificado vía WhatsApp a +${cleanPhone}. Estado actualizado a listo_para_recojo.`
            });
          } else {
            // Ya fue notificado previamente
            report.details.push({
              orderId: p.id,
              trackingCode: p.codigo_seguimiento,
              guia: p.shalom_numero_guia || (shalomMatch ? `${shalomMatch.serie}-${shalomMatch.guia}` : 'S/G'),
              clientName,
              clientPhone: cleanPhone,
              action: 'ALREADY_NOTIFIED',
              details: 'El cliente ya recibió la notificación de recojo previamente.'
            });
          }
        } else {
          // Aún en camino / no arribado
          report.details.push({
            orderId: p.id,
            trackingCode: p.codigo_seguimiento,
            guia: p.shalom_numero_guia || (shalomMatch ? `${shalomMatch.serie}-${shalomMatch.guia}` : 'S/G'),
            clientName,
            clientPhone: cleanPhone,
            action: 'STILL_IN_TRANSIT',
            details: shalomMatch ? `Despachado en Shalom (#${shalomMatch.id}), en tránsito hacia destino.` : 'Pendiente de despacho o no registrado en Shalom.'
          });
        }
      }

      console.log(`[SHALOM LISTENER] ✓ Ciclo completado: ${report.totalShippedOrdersChecked} verificados | ${report.newlyArrivedCount} nuevos arribos | ${report.notifiedCount} notificados.`);
    } catch (err: any) {
      console.error('[SHALOM LISTENER FATAL ERROR]', err);
      report.errors.push(err?.message || 'Error desconocido');
    } finally {
      this.isRunning = false;
      this.lastReport = report;
    }

    return report;
  }

  /**
   * Inicia el temporizador en segundo plano para ejecutar el listener cada 35 minutos
   */
  public static startListenerScheduler(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    const INTERVAL_MS = 35 * 60 * 1000; // 35 minutos

    console.log('⏰ [SHALOM LISTENER 24/7] Programador activo: Monitoreo cada 35 minutos.');

    // Ejecutar ciclo inicial 15 segundos después de arrancar
    setTimeout(() => {
      this.executeListenerCycle().catch(err => console.error('[SHALOM LISTENER STARTUP ERROR]', err));
    }, 15000);

    // Repetir cada 35 minutos
    this.intervalTimer = setInterval(() => {
      this.executeListenerCycle().catch(err => console.error('[SHALOM LISTENER INTERVAL ERROR]', err));
    }, INTERVAL_MS);
  }

  /**
   * Retorna el último reporte de ejecución del listener
   */
  public static getLastReport(): ListenerExecutionReport | null {
    return this.lastReport;
  }
}
