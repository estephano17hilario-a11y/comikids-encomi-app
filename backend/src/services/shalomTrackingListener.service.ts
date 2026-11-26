import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { redisClient } from '../config/redis.js';
import { EvolutionService } from './evolution.service.js';
import { ShalomProofImageService, ShalomTrackingStatusObj } from './shalomProofImage.service.js';
import { Pedido, Usuario } from '../types/database.types.js';

const SHALOM_BASE_URL = 'https://api.shalom-api-peru.com';
const DEFAULT_API_KEY = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const DEFAULT_SHALOM_EMAIL = 'milagrosjanetamis@gmail.com';
const DEFAULT_SHALOM_PASSWORD = '986398Mi$';

const SHOP_DNIS = ['42020312', '00000000', '20512528458', '20000000001'];
const SHOP_PHONES = ['927781412', '987654321', '986398000', '989834969', '51927781412', '51987654321'];

const SCAN_INTERVAL_MS = 3 * 60 * 60 * 1000; // Cada 3 horas
const MICRO_BATCH_SIZE = 5; // Escaneo escalonado (no todos a la vez)
const MICRO_BATCH_DELAY_MS = 4500; // Pausa de 4.5s entre micro-lotes
const LOOKBACK_DAYS = 14; // Escanear pedidos entregados/despachados de los últimos 14 días

export interface ApiEnabledEmpresa {
  empresaId: string;
  brandName: string;
  shalomEmail: string;
  shalomPassword: string;
  shalomApiKey: string;
  whatsappInstance?: string;
  ownerPhone?: string;
  autoScanEnabled: boolean;
}

export interface NotificationHistoryItem {
  id: string;
  pedidoId: string;
  empresaId: string;
  trackingCode: string;
  orderNumber: string;
  orderCode?: string;
  oseId?: string;
  clientName: string;
  clientDni: string;
  clientPhone: string;
  agencyName: string;
  pickupCode: string;
  arrivedAt?: string;
  notifiedAt: string;
  sentWithPhoto: boolean;
  senderInstance: string;
  brandName: string;
  status?: ShalomTrackingStatusObj;
}

export interface ListenerExecutionReport {
  timestamp: string;
  isFirstRun: boolean;
  mode: 'automatic_3h' | 'manual';
  empresaId?: string;
  totalShippedOrdersChecked: number;
  newlyArrivedCount: number;
  notifiedCount: number;
  alreadyPickedUpCount: number;
  baselineClassifiedCount: number;
  deferredNightCount: number;
  nextScheduledRun?: string;
  details: Array<{
    orderId: string;
    empresaId?: string;
    trackingCode: string;
    guia: string;
    orderCode?: string;
    oseId?: string;
    clientName: string;
    clientPhone: string;
    agencyName?: string;
    arrivedAt?: string;
    action:
      | 'BASELINE_SILENT_UPDATE'
      | 'WHATSAPP_NOTIFIED'
      | 'ALREADY_NOTIFIED'
      | 'ALREADY_PICKED_UP'
      | 'DEFERRED_NIGHT_HOURS'
      | 'STILL_IN_TRANSIT'
      | 'METADATA_SYNCED'
      | 'SKIPPED_NO_PHONE';
    details?: string;
  }>;
  errors: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPeruHour(): number {
  try {
    const str = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return Number(str);
  } catch {
    return new Date().getHours();
  }
}

function isWithinRespectfulSendHours(): boolean {
  const hour = getPeruHour();
  return hour >= 7 && hour < 22;
}

export class ShalomTrackingListenerService {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static lastReport: ListenerExecutionReport | null = null;
  private static lastReportByEmpresa = new Map<string, ListenerExecutionReport>();
  private static nextRunTimestamp: number = 0;

  /**
   * Obtiene todas las empresas habilitadas con shalom_modo === 'api'.
   * Las empresas con shalom_modo === 'excel' o sin API quedan 100% excluidas.
   */
  public static async getApiEnabledEmpresas(filterEmpresaId?: string): Promise<ApiEnabledEmpresa[]> {
    const result: ApiEnabledEmpresa[] = [];

    try {
      const [{ data: empresasRaw }, { data: tallerConfigsRaw }] = await Promise.all([
        supabaseAdmin
          .from('usuarios')
          .select('id, dni, nombre_completo, telefono_default, direccion_default, referencia_default')
          .eq('rol', 'empresa'),
        supabaseAdmin
          .from('taller_config')
          .select('id, empresa_id, nombre_taller, shalom_email, shalom_password, copilot_sub_instance, copilot_owner_phone'),
      ]);

      const tallerByEmpresa = new Map<string, any>();
      (tallerConfigsRaw || []).forEach((tc: any) => {
        if (tc.empresa_id) tallerByEmpresa.set(tc.empresa_id, tc);
        if (tc.id === 'config-main' && !tallerByEmpresa.has('empresa-master-comikids')) {
          tallerByEmpresa.set('empresa-master-comikids', tc);
        }
      });

      const empresasList = empresasRaw || [];
      const seenIds = new Set<string>();

      for (const emp of empresasList) {
        seenIds.add(emp.id);
        if (filterEmpresaId && emp.id !== filterEmpresaId) continue;

        let parsedConfig: any = {};
        if (emp.direccion_default) {
          try {
            parsedConfig = JSON.parse(emp.direccion_default);
          } catch {}
        }

        let extraMeta: any = {};
        if (emp.referencia_default) {
          try {
            extraMeta = JSON.parse(emp.referencia_default);
          } catch {
            extraMeta = { sub_instance: emp.referencia_default };
          }
        }

        const isBaseComikids = emp.id === 'empresa-master-comikids' || emp.dni === '061625';
        const shalomModo = parsedConfig?.shalom_modo || (isBaseComikids ? 'api' : 'excel');

        // REGLA ESTRICTA: solo empresas con shalom_modo === 'api'
        if (shalomModo !== 'api') continue;

        const tc = tallerByEmpresa.get(emp.id) || (isBaseComikids ? tallerByEmpresa.get('empresa-master-comikids') : null);
        const shalomEmail = (parsedConfig?.shalom_email || tc?.shalom_email || (isBaseComikids ? DEFAULT_SHALOM_EMAIL : '')).trim();
        const shalomPassword = (parsedConfig?.shalom_password || tc?.shalom_password || (isBaseComikids ? DEFAULT_SHALOM_PASSWORD : '')).trim();

        if (!shalomEmail || !shalomPassword) continue;

        let autoScanEnabled = true;
        try {
          const toggleVal = await redisClient.get(`shalom:scanner:enabled:${emp.id}`);
          if (toggleVal === 'false' || toggleVal === '0') {
            autoScanEnabled = false;
          }
        } catch {}

        const rawBrandName = isBaseComikids
          ? (tc?.nombre_taller?.replace(/\s*Env[ií]os$/i, '').trim() || 'ComiKids')
          : (tc?.nombre_taller || emp.nombre_completo || 'Nuestra Tienda');

        result.push({
          empresaId: emp.id,
          brandName: rawBrandName,
          shalomEmail,
          shalomPassword,
          shalomApiKey: env.SHALOM_API_KEY || DEFAULT_API_KEY,
          whatsappInstance: parsedConfig?.vps_instance_name || extraMeta?.sub_instance || tc?.copilot_sub_instance || (isBaseComikids ? 'tenant_Comikids' : undefined),
          ownerPhone: tc?.copilot_owner_phone || emp.telefono_default || undefined,
          autoScanEnabled,
        });
      }

      // Fallback para ComiKids si no figura en usuarios
      if (!seenIds.has('empresa-master-comikids') && (!filterEmpresaId || filterEmpresaId === 'empresa-master-comikids')) {
        const tc = tallerByEmpresa.get('empresa-master-comikids');
        let autoScanEnabled = true;
        try {
          const toggleVal = await redisClient.get('shalom:scanner:enabled:empresa-master-comikids');
          if (toggleVal === 'false' || toggleVal === '0') autoScanEnabled = false;
        } catch {}
        result.push({
          empresaId: 'empresa-master-comikids',
          brandName: tc?.nombre_taller?.replace(/\s*Env[ií]os$/i, '').trim() || 'ComiKids',
          shalomEmail: tc?.shalom_email || DEFAULT_SHALOM_EMAIL,
          shalomPassword: tc?.shalom_password || DEFAULT_SHALOM_PASSWORD,
          shalomApiKey: env.SHALOM_API_KEY || DEFAULT_API_KEY,
          whatsappInstance: tc?.copilot_sub_instance || 'tenant_Comikids',
          ownerPhone: tc?.copilot_owner_phone || '51927781412',
          autoScanEnabled,
        });
      }
    } catch (err) {
      console.warn('[SHALOM SCANNER 3H] Error cargando empresas API habilitadas:', err);
    }

    return result;
  }

  /**
   * Resuelve la instancia de WhatsApp de la empresa (Sub-QR),
   * bloqueando estrictamente el uso del Bot Maestro (+51 901 985 319 / main_bot / comikids_whatsapp).
   */
  public static async resolveEmpresaSenderInstance(preferredInstance?: string, preferredPhone?: string): Promise<string> {
    const DEFAULT_STORE_INSTANCE = preferredInstance || 'tenant_Comikids';
    try {
      const fetchRes = await axios.get(`${env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: env.EVOLUTION_API_KEY },
        timeout: 6000,
      });
      const instances = Array.isArray(fetchRes.data) ? fetchRes.data : [];

      const isMasterBot = (i: any) => {
        const name = String(i.name || '').toLowerCase();
        const jid = String(i.ownerJid || '');
        return (
          name === 'main_bot' ||
          name === 'comikids_whatsapp' ||
          name === String(env.EVOLUTION_INSTANCE_NAME || '').toLowerCase() ||
          jid.includes('901985319')
        );
      };

      const openSubInstances = instances.filter((i: any) => i.connectionStatus === 'open' && !isMasterBot(i));

      if (preferredInstance) {
        const prefLower = preferredInstance.toLowerCase();
        const exact = openSubInstances.find(
          (i: any) =>
            String(i.name || '').toLowerCase() === prefLower ||
            String(i.name || '').toLowerCase() === `tenant_${prefLower}`
        );
        if (exact) return exact.name;
      }

      if (preferredPhone) {
        const last9 = preferredPhone.replace(/\D/g, '').slice(-9);
        if (last9.length === 9) {
          const byPhone = openSubInstances.find((i: any) => String(i.ownerJid || '').includes(last9));
          if (byPhone) return byPhone.name;
        }
      }

      const comikidsStoreOpen = openSubInstances.find(
        (i: any) =>
          String(i.ownerJid || '').includes('927781412') ||
          String(i.name || '').toLowerCase().includes('tenant_comikids')
      );
      if (comikidsStoreOpen) return comikidsStoreOpen.name;

      if (openSubInstances.length > 0) return openSubInstances[0].name;
    } catch (err: any) {
      console.warn('[SHALOM SCANNER 3H] Error resolviendo instancia WhatsApp:', err?.message);
    }
    return DEFAULT_STORE_INSTANCE;
  }

  /**
   * Alias de compatibilidad
   */
  public static async resolveComikidsMainSenderInstance(): Promise<string> {
    return this.resolveEmpresaSenderInstance('tenant_Comikids', '51927781412');
  }

  /**
   * Limpia y formatea la dirección y nombre de agencia eliminando códigos internos técnicos
   */
  public static cleanAgencyDestinationText(destinoDetalle: string): string {
    if (!destinoDetalle) return 'Agencia Shalom Destino';
    return destinoDetalle
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
  }

  public static extractRecipientDni(destinoDetalle?: string, userDni?: string): string {
    if (destinoDetalle) {
      const matchLabel = destinoDetalle.match(
        /\b(?:DNI[\s\/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i
      );
      if (matchLabel && matchLabel[1] && !matchLabel[1].startsWith('usr-')) {
        const clean = matchLabel[1].replace(/\D/g, '').trim();
        if (clean.length >= 8 && !SHOP_DNIS.includes(clean)) return clean;
      }

      const match8 = destinoDetalle.match(/\b(\d{8})\b/);
      if (match8 && match8[1] && !SHOP_DNIS.includes(match8[1])) {
        return match8[1].trim();
      }
    }

    if (userDni) {
      const cleanUserDni = userDni.replace(/\D/g, '').trim();
      if (cleanUserDni.length >= 8 && !SHOP_DNIS.includes(cleanUserDni)) {
        return cleanUserDni;
      }
    }

    return '';
  }

  public static extractRecipientPhone(userPhone?: string, destinoDetalle?: string, shalomOrderPhone?: string | number): string {
    const candidates = [
      String(userPhone || ''),
      destinoDetalle ? (destinoDetalle.match(/(?:Tel|Cel|Whatsapp|Celular)[\s:]*([0-9]{9})/i)?.[1] || '') : '',
      String(shalomOrderPhone || ''),
    ];

    for (const cand of candidates) {
      const raw = cand.replace(/\D/g, '');
      if (raw.length >= 9) {
        const last9 = raw.slice(-9);
        if (last9.startsWith('9') && !SHOP_PHONES.includes(last9)) {
          return `51${last9}`;
        }
      }
    }
    return '';
  }

  public static extractNumericShipmentCode(guiaOrTracking: string): string {
    if (!guiaOrTracking) return '';
    if (guiaOrTracking.includes('-')) {
      const parts = guiaOrTracking.split('-');
      const lastPart = parts[parts.length - 1].replace(/\D/g, '');
      if (lastPart.length >= 4) return lastPart;
    }
    const digitsOnly = guiaOrTracking.replace(/\D/g, '');
    return digitsOnly || guiaOrTracking;
  }

  public static resolveShalomSecurityKey(orderShalomMatch: any, pedido?: Partial<Pedido>): string {
    if (pedido?.shalom_clave_recojo && pedido.shalom_clave_recojo.trim()) {
      return pedido.shalom_clave_recojo.trim().toUpperCase();
    }
    if (orderShalomMatch?.pickup_code && String(orderShalomMatch.pickup_code).trim().length === 4) {
      return String(orderShalomMatch.pickup_code).trim().toUpperCase();
    }
    return '0808';
  }

  /**
   * Texto simple, corto y amable que acompaña a la FOTO PRUEBA oficial de Shalom.
   * Agradece la preferencia hacia la empresa y desea que el pedido sea de su agrado.
   */
  public static buildArrivalWhatsAppMessage(params: {
    clientName: string;
    clientDni: string;
    agencyFormatted: string;
    numericShipmentNumber: string;
    orderCode?: string;
    securityKey: string;
    brandName: string;
    includePhotoNote?: boolean;
  }): string {
    const {
      clientName,
      clientDni,
      agencyFormatted,
      numericShipmentNumber,
      orderCode,
      securityKey,
      brandName,
      includePhotoNote = true,
    } = params;
    const firstName = (clientName || 'Cliente').trim();
    const orderLine = orderCode
      ? `📦 *Orden:* ${numericShipmentNumber}  •  *Código:* ${orderCode}`
      : `📦 *N° de Envío:* ${numericShipmentNumber}`;

    return [
      `¡Hola *${firstName}*! 📦✨`,
      ``,
      `Te avisamos de parte de *${brandName}* que tu pedido ya llegó a Shalom y está *LISTO PARA RECOGER* ✅`,
      ``,
      `📍 *Agencia:* ${agencyFormatted}`,
      orderLine,
      `🔑 *Clave de recojo:* *${securityKey}*`,
      ...(clientDni && clientDni !== 'S/DNI' ? [`🪪 *DNI:* ${clientDni}`] : []),
      ...(includePhotoNote
        ? [``, `Te adjuntamos la constancia de rastreo oficial de Shalom como prueba de llegada. 👆`]
        : [``, `🌐 *Rastreo oficial:* https://rastrea.shalom.pe`]),
      ``,
      `¡Muchas gracias por tu preferencia con *${brandName}*! 💖 Esperamos que tu pedido sea de tu total agrado. 🙏✨`,
    ].join('\n');
  }

  /**
   * Consulta rápida a Shalom Pro API: pedidos en tránsito por etapa (ej: stage=en_destino)
   */
  public static async fetchShalomOrdersByState(
    headers: Record<string, string>,
    state: 'pending' | 'in_transit' | 'delivered',
    stage?: 'en_origen' | 'en_transito' | 'en_reparto' | 'en_destino',
    maxPages: number = 3
  ): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    const perPage = 100;

    while (page <= maxPages) {
      try {
        const params: Record<string, any> = { state, page, per_page: perPage };
        if (stage) params.stage = stage;

        const res = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
          params,
          headers,
          timeout: 18000,
        });

        const list = res.data?.orders || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        if (!Array.isArray(list) || list.length === 0) break;

        all.push(...list);

        const lastPage = Number(res.data?.meta?.last_page || 1);
        if (page >= lastPage || list.length < perPage) break;
        page++;
        await sleep(800);
      } catch (err: any) {
        console.warn(`[SHALOM SCANNER 3H] Error listando state=${state} stage=${stage || '-'} p=${page}:`, err?.message);
        break;
      }
    }

    return all;
  }

  /**
   * Consulta tracking en lote (micro-lotes escalonados para evitar ráfagas 429)
   */
  public static async fetchTrackingBatch(
    headers: Record<string, string>,
    items: Array<{ custom_id: string; ose_id?: string; numero?: string; codigo?: string }>
  ): Promise<Map<string, { ok: boolean; status?: ShalomTrackingStatusObj; order?: any; error?: any }>> {
    const out = new Map<string, { ok: boolean; status?: ShalomTrackingStatusObj; order?: any; error?: any }>();
    if (!items || items.length === 0) return out;

    for (let i = 0; i < items.length; i += MICRO_BATCH_SIZE) {
      const chunk = items.slice(i, i + MICRO_BATCH_SIZE);
      if (i > 0) {
        // Pausa escalonada para NO escanear todos a la vez
        await sleep(MICRO_BATCH_DELAY_MS);
      }

      try {
        const res = await axios.post(
          `${SHALOM_BASE_URL}/v1/tracking/batch`,
          { items: chunk },
          {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            timeout: 25000,
          }
        );

        const results = Array.isArray(res.data?.results) ? res.data.results : [];
        for (const r of results) {
          if (r?.custom_id) {
            out.set(String(r.custom_id), {
              ok: Boolean(r.ok),
              status: r.tracking?.status,
              order: r.tracking?.order,
              error: r.error,
            });
          }
        }
      } catch (batchErr: any) {
        console.warn('[SHALOM SCANNER 3H] Batch tracking fallback individual:', batchErr?.response?.status || batchErr?.message);
        // Fallback suave 1x1 para este micro-lote
        for (const item of chunk) {
          try {
            const params: Record<string, string> = {};
            if (item.numero && item.codigo) {
              params.numero = item.numero;
              params.codigo = item.codigo;
            } else if (item.ose_id) {
              params.ose_id = item.ose_id;
            } else {
              continue;
            }
            const single = await axios.get(`${SHALOM_BASE_URL}/v1/tracking`, {
              params,
              headers,
              timeout: 15000,
            });
            out.set(item.custom_id, {
              ok: true,
              status: single.data?.status,
              order: single.data?.order,
            });
            await sleep(1200);
          } catch (singleErr: any) {
            out.set(item.custom_id, { ok: false, error: singleErr?.message });
          }
        }
      }
    }

    return out;
  }

  /**
   * Envía la notificación de "Listo para recoger" CON FOTO PRUEBA oficial a una clienta.
   * Reutilizado tanto por el escáner automático cada 3 horas como por el botón manual de Shalom Pro.
   */
  public static async sendPickupProofNotification(params: {
    empresaId: string;
    brandName: string;
    pedidoId?: string;
    trackingCode?: string;
    orderNumber: string;
    orderCode?: string;
    oseId?: string;
    clientName: string;
    clientDni: string;
    clientPhone: string;
    agencyName: string;
    agencyAddress?: string;
    pickupCode: string;
    status: ShalomTrackingStatusObj;
    preferredInstance?: string;
    preferredOwnerPhone?: string;
    markOrderNotifiedInDb?: boolean;
  }): Promise<{ success: boolean; sentWithPhoto: boolean; senderInstance: string; proofBase64?: string; error?: string }> {
    const cleanPhone = this.extractRecipientPhone(params.clientPhone);
    if (!cleanPhone) {
      return {
        success: false,
        sentWithPhoto: false,
        senderInstance: '',
        error: 'El pedido no tiene un número de celular válido de 9 dígitos para WhatsApp.',
      };
    }

    const agencyFormatted = this.cleanAgencyDestinationText(params.agencyName);
    const numericOrder = this.extractNumericShipmentCode(params.orderNumber) || params.orderNumber;
    const pickupPin = (params.pickupCode || '0808').trim().toUpperCase();

    const captionWithPhoto = this.buildArrivalWhatsAppMessage({
      clientName: params.clientName,
      clientDni: params.clientDni,
      agencyFormatted,
      numericShipmentNumber: numericOrder,
      orderCode: params.orderCode,
      securityKey: pickupPin,
      brandName: params.brandName,
      includePhotoNote: true,
    });

    const captionTextOnly = this.buildArrivalWhatsAppMessage({
      clientName: params.clientName,
      clientDni: params.clientDni,
      agencyFormatted,
      numericShipmentNumber: numericOrder,
      orderCode: params.orderCode,
      securityKey: pickupPin,
      brandName: params.brandName,
      includePhotoNote: false,
    });

    const proof = await ShalomProofImageService.generateProofPngBase64({
      brandName: params.brandName,
      clientName: params.clientName,
      clientDni: params.clientDni,
      agencyName: agencyFormatted,
      agencyAddress: params.agencyAddress,
      orderNumber: numericOrder,
      orderCode: params.orderCode,
      pickupCode: pickupPin,
      status: params.status,
    });

    const senderInstance = await this.resolveEmpresaSenderInstance(
      params.preferredInstance,
      params.preferredOwnerPhone
    );

    let sentWithPhoto = false;
    try {
      if (proof.mimeType === 'image/png' && proof.base64) {
        await EvolutionService.sendWhatsAppMedia(senderInstance, cleanPhone, proof.base64, {
          caption: captionWithPhoto,
          fileName: `Prueba_Recojo_Shalom_${numericOrder}.png`,
          mediaType: 'image',
          mimeType: 'image/png',
        });
        sentWithPhoto = true;
      } else {
        await EvolutionService.sendWhatsAppMessage(senderInstance, cleanPhone, captionTextOnly);
      }
    } catch (mediaErr: any) {
      console.warn('[SHALOM SCANNER 3H] Falló envío con imagen, intentando texto simple:', mediaErr?.message);
      await EvolutionService.sendWhatsAppMessage(senderInstance, cleanPhone, captionTextOnly);
      sentWithPhoto = false;
    }

    const notifiedAt = new Date().toISOString();

    // Persistir deduplicación en Redis (90 días) + historial por empresa
    try {
      if (params.pedidoId) {
        await redisClient.set(
          `shalom:pickup_notified:${params.pedidoId}`,
          JSON.stringify({
            notifiedAt,
            phone: cleanPhone,
            orderNumber: numericOrder,
            orderCode: params.orderCode,
            pickupPin,
            sentWithPhoto,
            senderInstance,
          }),
          'EX',
          86400 * 90
        );
      }

      const historyItem: NotificationHistoryItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pedidoId: params.pedidoId || `ose_${params.oseId || numericOrder}`,
        empresaId: params.empresaId,
        trackingCode: params.trackingCode || numericOrder,
        orderNumber: numericOrder,
        orderCode: params.orderCode,
        oseId: params.oseId,
        clientName: params.clientName,
        clientDni: params.clientDni,
        clientPhone: cleanPhone,
        agencyName: agencyFormatted,
        pickupCode: pickupPin,
        arrivedAt: params.status?.destino?.fecha,
        notifiedAt,
        sentWithPhoto,
        senderInstance,
        brandName: params.brandName,
        status: params.status,
      };

      const histKey = `shalom:scanner:history:${params.empresaId}`;
      await redisClient.lpush(histKey, JSON.stringify(historyItem));
      await redisClient.ltrim(histKey, 0, 59);
    } catch (redisErr) {
      console.warn('[SHALOM SCANNER 3H] Error guardando historial en Redis:', redisErr);
    }

    // Marcar persistencia en Supabase campos_personalizados (para sobrevivir reinicios de Redis)
    if (params.pedidoId && params.markOrderNotifiedInDb !== false) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('pedidos')
          .select('estado_envio, campos_personalizados')
          .eq('id', params.pedidoId)
          .maybeSingle();

        const currentCustom =
          existing?.campos_personalizados && typeof existing.campos_personalizados === 'object'
            ? existing.campos_personalizados
            : {};

        const updatePayload: Record<string, any> = {
          campos_personalizados: {
            ...currentCustom,
            _shalom_pickup_notified_at: notifiedAt,
            _shalom_live_stage: 'en_destino',
            _shalom_destino_fecha: params.status?.destino?.fecha || null,
            _shalom_codigo_orden: params.orderCode || currentCustom._shalom_codigo_orden || null,
          },
          updated_at: notifiedAt,
        };

        // Si estaba en_camino, promover a listo_para_recojo; si ya estaba en Entregados, respetar su carpeta
        if (existing?.estado_envio && existing.estado_envio !== 'entregado') {
          updatePayload.estado_envio = 'listo_para_recojo';
        }

        await supabaseAdmin.from('pedidos').update(updatePayload).eq('id', params.pedidoId);
      } catch (dbErr) {
        console.warn('[SHALOM SCANNER 3H] Error actualizando campos_personalizados en Supabase:', dbErr);
      }
    }

    return {
      success: true,
      sentWithPhoto,
      senderInstance,
      proofBase64: proof.base64,
    };
  }

  /**
   * Ejecuta el ciclo de escaneo escalonado (cada 3 horas o manual) SOLO para empresas con Shalom API habilitada.
   * Revisa pedidos entregados/despachados en los días posteriores, sin escanear todos a la vez.
   */
  public static async executeListenerCycle(
    forceManualRun: boolean = false,
    targetEmpresaId?: string
  ): Promise<ListenerExecutionReport> {
    if (this.isRunning) {
      console.log('[SHALOM SCANNER 3H] Ciclo anterior aún en ejecución, omitiendo...');
      return (
        (targetEmpresaId ? this.lastReportByEmpresa.get(targetEmpresaId) : null) ||
        this.lastReport || {
          timestamp: new Date().toISOString(),
          isFirstRun: false,
          mode: forceManualRun ? 'manual' : 'automatic_3h',
          empresaId: targetEmpresaId,
          totalShippedOrdersChecked: 0,
          newlyArrivedCount: 0,
          notifiedCount: 0,
          alreadyPickedUpCount: 0,
          baselineClassifiedCount: 0,
          deferredNightCount: 0,
          nextScheduledRun: this.nextRunTimestamp ? new Date(this.nextRunTimestamp).toISOString() : undefined,
          details: [],
          errors: ['Ya hay un escaneo en curso. Intenta en unos segundos.'],
        }
      );
    }

    this.isRunning = true;
    const mode: 'automatic_3h' | 'manual' = forceManualRun ? 'manual' : 'automatic_3h';
    const report: ListenerExecutionReport = {
      timestamp: new Date().toISOString(),
      isFirstRun: false,
      mode,
      empresaId: targetEmpresaId,
      totalShippedOrdersChecked: 0,
      newlyArrivedCount: 0,
      notifiedCount: 0,
      alreadyPickedUpCount: 0,
      baselineClassifiedCount: 0,
      deferredNightCount: 0,
      nextScheduledRun: this.nextRunTimestamp ? new Date(this.nextRunTimestamp).toISOString() : undefined,
      details: [],
      errors: [],
    };

    try {
      const apiEmpresas = await this.getApiEnabledEmpresas(targetEmpresaId);
      console.log(
        `🔍 [SHALOM SCANNER 3H] Iniciando escaneo (${mode}) para ${apiEmpresas.length} empresa(s) con Shalom API activa...`
      );

      if (apiEmpresas.length === 0) {
        console.log('[SHALOM SCANNER 3H] No hay empresas con modo API Shalom habilitado.');
        return report;
      }

      const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000).toISOString();
      const canSendWhatsAppNow = forceManualRun || isWithinRespectfulSendHours();

      for (const emp of apiEmpresas) {
        if (!forceManualRun && !emp.autoScanEnabled) {
          console.log(`[SHALOM SCANNER 3H] Auto-escaneo pausado para ${emp.brandName} (${emp.empresaId}), omitiendo.`);
          continue;
        }

        const headers: Record<string, string> = {
          'X-API-Key': emp.shalomApiKey,
          'X-Shalom-Email': emp.shalomEmail,
          'X-Shalom-Password': emp.shalomPassword,
        };

        // 1. Obtener pedidos Shalom entregados/en_camino de los últimos 14 días para esta empresa
        let query = supabaseAdmin
          .from('pedidos')
          .select(
            `id, empresa_id, codigo_seguimiento, usuario_id, detalles_bordado, metodo_envio_codigo,
             metodo_envio_nombre, destino_detalle, estado_produccion, estado_envio,
             shalom_ose_id, shalom_numero_guia, shalom_clave_recojo, registrado_shalom,
             campos_personalizados, created_at, updated_at`
          )
          .eq('metodo_envio_codigo', 'shalom')
          .in('estado_envio', ['entregado', 'en_camino', 'listo_para_recojo'])
          .gte('updated_at', cutoffDate)
          .order('updated_at', { ascending: false })
          .limit(250);

        if (emp.empresaId === 'empresa-master-comikids') {
          query = query.or('empresa_id.eq.empresa-master-comikids,empresa_id.is.null');
        } else {
          query = query.eq('empresa_id', emp.empresaId);
        }

        const { data: pedidosRaw, error: pErr } = await query;
        if (pErr) {
          report.errors.push(`Error Supabase (${emp.brandName}): ${pErr.message}`);
          continue;
        }

        const allEmpresaOrders = (pedidosRaw || []) as Pedido[];

        // Filtrar los ya notificados en BD (campos_personalizados) o que aún no cumplen margen mínimo en automático
        const candidateOrders: Pedido[] = [];
        for (const p of allEmpresaOrders) {
          const custom = (p.campos_personalizados && typeof p.campos_personalizados === 'object')
            ? p.campos_personalizados
            : {};

          if (custom._shalom_pickup_notified_at) continue;
          if (custom._shalom_live_stage === 'entregado_cliente') continue;

          // En modo automático, evitar consultar pedidos recién creados hace < 3 horas
          if (!forceManualRun) {
            const createdMs = new Date(p.created_at).getTime();
            if (!isNaN(createdMs) && Date.now() - createdMs < 3 * 60 * 60 * 1000) {
              continue;
            }
          }

          // Revisar Redis deduplicación antes de gastar cuota Shalom
          try {
            const alreadyInRedis = await redisClient.get(`shalom:pickup_notified:${p.id}`);
            if (alreadyInRedis) continue;
          } catch {}

          candidateOrders.push(p);
        }

        report.totalShippedOrdersChecked += candidateOrders.length;
        if (candidateOrders.length === 0) {
          console.log(`[SHALOM SCANNER 3H] ${emp.brandName}: 0 pedidos pendientes de aviso de recojo.`);
          continue;
        }

        // 2. Cargar usuarios de estos pedidos
        const userIds = Array.from(new Set(candidateOrders.map((p) => p.usuario_id).filter(Boolean)));
        const usersMap = new Map<string, Usuario>();
        if (userIds.length > 0) {
          const { data: usersData } = await supabaseAdmin
            .from('usuarios')
            .select('id, dni, nombre_completo, telefono_default, direccion_default, dni_default')
            .in('id', userIds);
          (usersData || []).forEach((u: any) => usersMap.set(u.id, u as Usuario));
        }

        // 3. Llamada inteligente (1 solo request) a Shalom Pro para obtener órdenes ya EN DESTINO + EN TRÁNSITO
        const [enDestinoShalomOrders, inTransitShalomOrders] = await Promise.all([
          this.fetchShalomOrdersByState(headers, 'in_transit', 'en_destino', 2),
          this.fetchShalomOrdersByState(headers, 'in_transit', undefined, 2),
        ]);

        const combinedShalomMap = new Map<string, any>();
        [...inTransitShalomOrders, ...enDestinoShalomOrders].forEach((o) => {
          if (o?.id) combinedShalomMap.set(String(o.id), o);
        });
        const shalomOrdersPool = Array.from(combinedShalomMap.values());
        const enDestinoIdSet = new Set(enDestinoShalomOrders.map((o) => String(o.id)));

        console.log(
          `[SHALOM SCANNER 3H] ${emp.brandName}: ${candidateOrders.length} pedidos locales | ${enDestinoShalomOrders.length} en agencia destino en Shalom Pro`
        );

        // 4. Emparejar cada pedido local con su orden en Shalom Pro y armar micro-lotes de tracking
        interface MatchedCandidate {
          pedido: Pedido;
          user?: Usuario;
          clientName: string;
          clientDni: string;
          clientPhone: string;
          shalomOrder: any | null;
          oseId?: string;
          guiaNumeric?: string;
          orderCode?: string;
          priorityEnDestino: boolean;
        }

        const matchedCandidates: MatchedCandidate[] = [];

        for (const p of candidateOrders) {
          const user = usersMap.get(p.usuario_id);
          const clientName = user?.nombre_completo || 'Cliente';
          const clientDni = this.extractRecipientDni(p.destino_detalle, user?.dni || user?.dni_default) || '';
          const cleanGuia = (p.shalom_numero_guia || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          const numericGuia = this.extractNumericShipmentCode(cleanGuia);
          const oseIdStr = p.shalom_ose_id ? String(p.shalom_ose_id).trim() : '';

          let shalomMatch: any = null;

          // Match por OSE ID
          if (oseIdStr && oseIdStr !== 'null' && oseIdStr !== 'undefined') {
            shalomMatch = shalomOrdersPool.find(
              (o) => String(o.id) === oseIdStr || String(o.internal_id) === oseIdStr
            );
          }

          // Match por Guía
          if (!shalomMatch && numericGuia && numericGuia.length >= 5) {
            shalomMatch = shalomOrdersPool.find((o) => {
              const gOnly = String(o.guia || '').replace(/\D/g, '');
              return gOnly && gOnly === numericGuia;
            });
          }

          // Match por DNI destinatario (tomando el más reciente dentro de los últimos 14 días)
          if (!shalomMatch && clientDni && clientDni.length >= 8) {
            const byDni = shalomOrdersPool.filter(
              (o) => String(o.receiver?.document || '').replace(/\D/g, '') === clientDni
            );
            if (byDni.length > 0) {
              byDni.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
              shalomMatch = byDni[0];
            }
          }

          const resolvedOseId = shalomMatch?.id ? String(shalomMatch.id) : oseIdStr || undefined;
          const resolvedGuia = shalomMatch?.guia
            ? String(shalomMatch.guia)
            : numericGuia || undefined;
          const resolvedCode = shalomMatch?.codigo
            ? String(shalomMatch.codigo)
            : (p.campos_personalizados as any)?._shalom_codigo_orden || undefined;

          // Solo podemos consultar tracking si tenemos ose_id O (guia + codigo)
          if (!resolvedOseId && !(resolvedGuia && resolvedCode)) {
            continue;
          }

          // Sincronizar metadatos faltantes en Supabase (ose_id / guía)
          if (shalomMatch && (!p.shalom_ose_id || !p.shalom_numero_guia)) {
            const fullGuia = `${shalomMatch.serie || 'V204'}-${shalomMatch.guia || shalomMatch.id}`;
            try {
              await supabaseAdmin
                .from('pedidos')
                .update({
                  shalom_ose_id: String(shalomMatch.id),
                  shalom_numero_guia: fullGuia,
                  registrado_shalom: true,
                })
                .eq('id', p.id);
              p.shalom_ose_id = String(shalomMatch.id);
              p.shalom_numero_guia = fullGuia;
            } catch {}
          }

          const clientPhone = this.extractRecipientPhone(
            user?.telefono_default,
            p.destino_detalle,
            shalomMatch?.receiver?.phone
          );

          matchedCandidates.push({
            pedido: p,
            user,
            clientName,
            clientDni: clientDni || String(shalomMatch?.receiver?.document || 'S/DNI'),
            clientPhone,
            shalomOrder: shalomMatch,
            oseId: resolvedOseId,
            guiaNumeric: resolvedGuia,
            orderCode: resolvedCode,
            priorityEnDestino: Boolean(shalomMatch?.id && enDestinoIdSet.has(String(shalomMatch.id))),
          });
        }

        // Priorizar primero los que Shalom ya reportó en_destino, y limitar a máx 35 pedidos por ciclo escalonado
        // para que nunca se sature la API (los demás se cubren en el siguiente ciclo de 3h)
        matchedCandidates.sort((a, b) => Number(b.priorityEnDestino) - Number(a.priorityEnDestino));
        const toVerifyNow = matchedCandidates.slice(0, 35);

        const batchRequestItems = toVerifyNow.map((c) => {
          if (c.guiaNumeric && c.orderCode) {
            return {
              custom_id: c.pedido.id,
              numero: c.guiaNumeric,
              codigo: c.orderCode,
            };
          }
          return {
            custom_id: c.pedido.id,
            ose_id: c.oseId!,
          };
        });

        // 5. Escaneo escalonado en micro-lotes de 5 con pausas de 4.5s (NO todos a la vez)
        const trackingMap = await this.fetchTrackingBatch(headers, batchRequestItems);

        // 6. Evaluar resultados y disparar WhatsApp con FOTO PRUEBA a los recién llegados a destino
        for (const item of toVerifyNow) {
          const track = trackingMap.get(item.pedido.id);
          const status = track?.status;
          const displayGuia =
            item.pedido.shalom_numero_guia ||
            (item.shalomOrder ? `${item.shalomOrder.serie || 'V204'}-${item.shalomOrder.guia}` : item.guiaNumeric || 'S/G');

          if (!track?.ok || !status) {
            continue;
          }

          // Caso A: El cliente YA recogió el paquete en Shalom -> marcar para no volver a escanear
          if (status.entregado?.fecha) {
            report.alreadyPickedUpCount++;
            try {
              const currentCustom =
                item.pedido.campos_personalizados && typeof item.pedido.campos_personalizados === 'object'
                  ? item.pedido.campos_personalizados
                  : {};
              await supabaseAdmin
                .from('pedidos')
                .update({
                  campos_personalizados: {
                    ...currentCustom,
                    _shalom_live_stage: 'entregado_cliente',
                    _shalom_entregado_fecha: status.entregado.fecha,
                  },
                })
                .eq('id', item.pedido.id);
            } catch {}

            report.details.push({
              orderId: item.pedido.id,
              empresaId: emp.empresaId,
              trackingCode: item.pedido.codigo_seguimiento,
              guia: displayGuia,
              orderCode: item.orderCode,
              oseId: item.oseId,
              clientName: item.clientName,
              clientPhone: item.clientPhone,
              action: 'ALREADY_PICKED_UP',
              details: `Ya recogido en agencia el ${status.entregado.fecha}.`,
            });
            continue;
          }

          // Caso B: LLEGÓ A AGENCIA DESTINO Y AÚN NO FUE RECOGIDO -> ¡LISTO PARA RECOGER!
          const arrivedDateStr = status.destino?.fecha;
          if (arrivedDateStr) {
            // En automático, solo notificar llegadas recientes (<= 5 días) para evitar alertas de paquetes viejos
            const arrivedMs = new Date(String(arrivedDateStr).replace(' ', 'T')).getTime();
            const maxAgeDays = forceManualRun ? 10 : 5;
            const isRecentArrival = isNaN(arrivedMs) || Date.now() - arrivedMs <= maxAgeDays * 86400 * 1000;

            if (!isRecentArrival) {
              continue;
            }

            report.newlyArrivedCount++;

            if (!canSendWhatsAppNow) {
              report.deferredNightCount++;
              report.details.push({
                orderId: item.pedido.id,
                empresaId: emp.empresaId,
                trackingCode: item.pedido.codigo_seguimiento,
                guia: displayGuia,
                orderCode: item.orderCode,
                oseId: item.oseId,
                clientName: item.clientName,
                clientPhone: item.clientPhone,
                arrivedAt: arrivedDateStr,
                action: 'DEFERRED_NIGHT_HOURS',
                details: 'Listo para recoger; aviso WhatsApp programado para horario diurno (07:00-22:00).',
              });
              continue;
            }

            if (!item.clientPhone) {
              report.details.push({
                orderId: item.pedido.id,
                empresaId: emp.empresaId,
                trackingCode: item.pedido.codigo_seguimiento,
                guia: displayGuia,
                orderCode: item.orderCode,
                oseId: item.oseId,
                clientName: item.clientName,
                clientPhone: '',
                arrivedAt: arrivedDateStr,
                action: 'SKIPPED_NO_PHONE',
                details: 'Pedido listo para recoger en Shalom pero sin número celular válido.',
              });
              continue;
            }

            const agencyName =
              item.shalomOrder?.destination?.name ||
              track.order?.destino?.nombre ||
              this.cleanAgencyDestinationText(item.pedido.destino_detalle);
            const agencyAddress = item.shalomOrder?.destination?.address || '';
            const securityKey = this.resolveShalomSecurityKey(item.shalomOrder, item.pedido);

            try {
              // Pausa humana escalonada entre mensajes WhatsApp (3.5s - 5s)
              if (report.notifiedCount > 0) {
                await sleep(3500 + Math.floor(Math.random() * 1500));
              }

              const sendRes = await this.sendPickupProofNotification({
                empresaId: emp.empresaId,
                brandName: emp.brandName,
                pedidoId: item.pedido.id,
                trackingCode: item.pedido.codigo_seguimiento,
                orderNumber: item.guiaNumeric || displayGuia,
                orderCode: item.orderCode || track.order?.codigo_orden,
                oseId: item.oseId,
                clientName: item.clientName,
                clientDni: item.clientDni,
                clientPhone: item.clientPhone,
                agencyName,
                agencyAddress,
                pickupCode: securityKey,
                status,
                preferredInstance: emp.whatsappInstance,
                preferredOwnerPhone: emp.ownerPhone,
                markOrderNotifiedInDb: true,
              });

              if (sendRes.success) {
                report.notifiedCount++;
                report.details.push({
                  orderId: item.pedido.id,
                  empresaId: emp.empresaId,
                  trackingCode: item.pedido.codigo_seguimiento,
                  guia: displayGuia,
                  orderCode: item.orderCode,
                  oseId: item.oseId,
                  clientName: item.clientName,
                  clientPhone: item.clientPhone,
                  agencyName,
                  arrivedAt: arrivedDateStr,
                  action: 'WHATSAPP_NOTIFIED',
                  details: `Enviado con ${sendRes.sentWithPhoto ? 'foto de prueba oficial' : 'texto'} vía ${sendRes.senderInstance}.`,
                });
              }
            } catch (sendErr: any) {
              report.errors.push(`WhatsApp ${item.clientName} (${item.clientPhone}): ${sendErr?.message}`);
            }
          } else {
            // Aún en tránsito / origen
            report.details.push({
              orderId: item.pedido.id,
              empresaId: emp.empresaId,
              trackingCode: item.pedido.codigo_seguimiento,
              guia: displayGuia,
              orderCode: item.orderCode,
              oseId: item.oseId,
              clientName: item.clientName,
              clientPhone: item.clientPhone,
              action: 'STILL_IN_TRANSIT',
              details: status.transito?.fecha
                ? `En tránsito desde ${status.transito.fecha}`
                : status.origen?.fecha
                ? `En agencia origen desde ${status.origen.fecha}`
                : 'Registrado en Shalom',
            });
          }
        }
      }

      // Persistir reporte por empresa escaneada para consulta instantánea en Shalom Pro
      for (const emp of apiEmpresas) {
        this.lastReportByEmpresa.set(emp.empresaId, report);
        try {
          await redisClient.set(
            `shalom:scanner:last_report:${emp.empresaId}`,
            JSON.stringify(report),
            'EX',
            86400 * 7
          );
        } catch {}
      }

      console.log(
        `[SHALOM SCANNER 3H] ✓ Ciclo completado (${mode}): ${report.totalShippedOrdersChecked} revisados | ${report.newlyArrivedCount} listos | ${report.notifiedCount} notificados con foto | ${report.alreadyPickedUpCount} ya recogidos.`
      );
    } catch (err: any) {
      console.error('[SHALOM SCANNER 3H FATAL ERROR]', err);
      report.errors.push(err?.message || 'Error desconocido en escáner 3h');
    } finally {
      this.isRunning = false;
      this.lastReport = report;
      if (targetEmpresaId) {
        this.lastReportByEmpresa.set(targetEmpresaId, report);
      }
      try {
        await redisClient.set(
          `shalom:scanner:last_report:${targetEmpresaId || 'global'}`,
          JSON.stringify(report),
          'EX',
          86400 * 7
        );
      } catch {}
    }

    return report;
  }

  /**
   * Inicia el programador automático cada 3 horas (no todos a la vez: escaneo escalonado en micro-lotes).
   */
  public static startListenerScheduler(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.nextRunTimestamp = Date.now() + 2 * 60 * 1000;
    console.log('⏰ [SHALOM SCANNER 3H] Programador activo: Escaneo escalonado automático cada 3 horas (solo empresas API).');

    // Primera ejecución suave 2 minutos tras arranque
    setTimeout(() => {
      this.nextRunTimestamp = Date.now() + SCAN_INTERVAL_MS;
      this.executeListenerCycle(false).catch((err) => console.error('[SHALOM SCANNER 3H STARTUP ERROR]', err));
    }, 2 * 60 * 1000);

    // Repetir automáticamente cada 3 horas
    this.intervalTimer = setInterval(() => {
      this.nextRunTimestamp = Date.now() + SCAN_INTERVAL_MS;
      this.executeListenerCycle(false).catch((err) => console.error('[SHALOM SCANNER 3H INTERVAL ERROR]', err));
    }, SCAN_INTERVAL_MS);
  }

  public static getLastReport(empresaId?: string): ListenerExecutionReport | null {
    if (empresaId && this.lastReportByEmpresa.has(empresaId)) {
      return this.lastReportByEmpresa.get(empresaId) || null;
    }
    return this.lastReport;
  }

  public static async getScannerStatusForEmpresa(empresaId: string) {
    let autoScanEnabled = true;
    let history: NotificationHistoryItem[] = [];
    let lastReport: ListenerExecutionReport | null = this.getLastReport(empresaId);

    try {
      const [toggleVal, rawHist, savedReport] = await Promise.all([
        redisClient.get(`shalom:scanner:enabled:${empresaId}`),
        redisClient.lrange(`shalom:scanner:history:${empresaId}`, 0, 29),
        !lastReport ? redisClient.get(`shalom:scanner:last_report:${empresaId}`) : Promise.resolve(null),
      ]);

      if (toggleVal === 'false' || toggleVal === '0') autoScanEnabled = false;
      history = (rawHist || [])
        .map((s) => {
          try {
            return JSON.parse(s) as NotificationHistoryItem;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as NotificationHistoryItem[];

      if (!lastReport && savedReport) {
        try {
          lastReport = JSON.parse(savedReport);
        } catch {}
      }
    } catch {}

    return {
      empresaId,
      autoScanEnabled,
      intervalHours: 3,
      microBatchSize: MICRO_BATCH_SIZE,
      isRunning: this.isRunning,
      nextScheduledRun: this.nextRunTimestamp ? new Date(this.nextRunTimestamp).toISOString() : null,
      lastReport,
      recentNotifications: history,
    };
  }

  public static async setAutoScanEnabled(empresaId: string, enabled: boolean): Promise<boolean> {
    await redisClient.set(`shalom:scanner:enabled:${empresaId}`, enabled ? 'true' : 'false');
    return enabled;
  }
}
