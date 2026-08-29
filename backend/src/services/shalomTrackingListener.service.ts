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
    action: 'BASELINE_SILENT_UPDATE' | 'WHATSAPP_NOTIFIED' | 'ALREADY_NOTIFIED' | 'STILL_IN_TRANSIT';
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
    // Si la API de Shalom retorna el código alfabético de la boleta (ej: "3NWW", "HNTW")
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

      // 1. Verificar si es la PRIMERA VEZ (Baseline Inicial sin spam)
      const baselineKey = 'shalom:listener:baseline_initialized_v2';
      const baselineVal = await redisClient.get(baselineKey);
      const isFirstRun = forceFirstRunCheck || !baselineVal;
      report.isFirstRun = isFirstRun;

      // 2. Obtener pedidos Shalom activos en Supabase
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

      // Obtener usuarios vinculados
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

      // 3. Consultar órdenes recientes de Shalom Pro API
      const credentials = await this.getShalomCredentials();
      const headers = {
        'X-API-Key': credentials.apiKey,
        'X-Shalom-Email': credentials.email,
      };
      if (credentials.password) {
        (headers as any)['X-Shalom-Password'] = credentials.password;
      }

      let shalomApiOrders: any[] = [];
      try {
        const res = await axios.get(`${SHALOM_BASE_URL}/v1/orders`, {
          params: { per_page: 100, page: 1 },
          headers,
          timeout: 15000,
        });
        shalomApiOrders = res.data?.orders || res.data?.data || [];
      } catch (apiErr: any) {
        console.warn('[SHALOM LISTENER API WARN]', apiErr?.response?.data || apiErr.message);
        report.errors.push(`Error consultando Shalom API: ${apiErr.message}`);
      }

      // Helper para buscar coincidencia en Shalom API
      const findShalomApiMatch = (p: Pedido) => {
        const cleanGuia = (p.shalom_numero_guia || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        const oseIdStr = String(p.shalom_ose_id || '');
        const user = usersMap.get(p.usuario_id);
        const userDni = (user?.dni || user?.dni_default || '').replace(/\D/g, '');

        return shalomApiOrders.find((o: any) => {
          if (oseIdStr && String(o.id) === oseIdStr) return true;
          if (cleanGuia && (String(o.guia).toUpperCase() === cleanGuia || `${o.serie || ''}${o.guia || ''}`.toUpperCase() === cleanGuia)) return true;
          if (userDni && userDni.length >= 8 && String(o.receiver?.document || o.receiver?.document_number || '').replace(/\D/g, '') === userDni) return true;
          return false;
        });
      };

      // 4. Evaluar cada pedido
      for (const p of activeOrders) {
        const user = usersMap.get(p.usuario_id);
        const clientName = user?.nombre_completo || 'Clienta';
        const clientDni = user?.dni || user?.dni_default || 'S/DNI';
        const rawPhone = (user?.telefono_default || '').replace(/\D/g, '');
        const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;

        const shalomMatch = findShalomApiMatch(p);

        // Detectar si el paquete ya llegó a destino / desembarcado / listo para recojo
        // En Shalom: status >= 2, delivered === true, o estado textual 'desembarcado'/'agencia'
        const isArrivedAtDestination = Boolean(
          shalomMatch && (
            shalomMatch.delivered === true ||
            Number(shalomMatch.status || 0) >= 2 ||
            (shalomMatch.status_name && /desembarcado|agencia|recojo|entreg/i.test(String(shalomMatch.status_name))) ||
            (shalomMatch.items && shalomMatch.items.some((i: any) => Number(i.status || 0) >= 2))
          )
        );

        const notificationKey = `shalom:pickup_notified:${p.id}`;
        const alreadyNotified = await redisClient.get(notificationKey);

        if (isArrivedAtDestination) {
          if (isFirstRun) {
            // =========================================================================
            // REGLA DE PRIMERA VEZ (BASELINE SILENCIOSO):
            // Clasificar de inmediato a "listo_para_recojo", pero SIN enviar WhatsApp!
            // =========================================================================
            if (p.estado_envio !== 'listo_para_recojo') {
              await supabaseAdmin.from('pedidos').update({
                estado_envio: 'listo_para_recojo',
                updated_at: new Date().toISOString()
              }).eq('id', p.id);
            }
            await redisClient.set(notificationKey, 'BASELINE_SILENT', 'EX', 86400 * 90);
            report.baselineClassifiedCount++;
            report.details.push({
              orderId: p.id,
              trackingCode: p.codigo_seguimiento,
              guia: p.shalom_numero_guia || shalomMatch?.guia || 'S/G',
              clientName,
              clientPhone: cleanPhone,
              action: 'BASELINE_SILENT_UPDATE'
            });
          } else if (!alreadyNotified) {
            // =========================================================================
            // SIGUIENTES EJECUCIONES: Disparar WhatsApp y mover a Listo para Recojo!
            // =========================================================================
            const cleanAgencyFormatted = this.cleanAgencyDestinationText(p.destino_detalle);
            const rawGuia = p.shalom_numero_guia || shalomMatch?.guia || p.codigo_seguimiento;
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

            // Enviar mensaje por WhatsApp si tiene teléfono válido
            let sentSuccess = false;
            if (cleanPhone && cleanPhone.length >= 9) {
              try {
                const masterInstance = env.EVOLUTION_INSTANCE_NAME || 'comikids_whatsapp';
                const remoteJid = `${cleanPhone}@s.whatsapp.net`;
                await EvolutionService.sendWhatsAppMessage(masterInstance, remoteJid, whatsappMessage);
                sentSuccess = true;
                console.log(`[SHALOM LISTENER] ✅ WhatsApp de aviso enviado con éxito a ${clientName} (+${cleanPhone}) para pedido #${p.codigo_seguimiento}`);
              } catch (msgErr: any) {
                console.error(`[SHALOM LISTENER ERROR] Error enviando WhatsApp a ${cleanPhone}:`, msgErr?.message);
                report.errors.push(`Error WhatsApp ${cleanPhone}: ${msgErr?.message}`);
              }
            }

            // Actualizar estado en Supabase
            await supabaseAdmin.from('pedidos').update({
              estado_envio: 'listo_para_recojo',
              updated_at: new Date().toISOString()
            }).eq('id', p.id);

            // Marcar como notificado en Redis (90 días de retención)
            await redisClient.set(notificationKey, JSON.stringify({
              timestamp: new Date().toISOString(),
              phone: cleanPhone,
              sentSuccess
            }), 'EX', 86400 * 90);

            report.newlyArrivedCount++;
            if (sentSuccess) report.notifiedCount++;

            report.details.push({
              orderId: p.id,
              trackingCode: p.codigo_seguimiento,
              guia: p.shalom_numero_guia || shalomMatch?.guia || 'S/G',
              clientName,
              clientPhone: cleanPhone,
              action: 'WHATSAPP_NOTIFIED'
            });
          } else {
            // Ya fue notificado previamente
            report.details.push({
              orderId: p.id,
              trackingCode: p.codigo_seguimiento,
              guia: p.shalom_numero_guia || shalomMatch?.guia || 'S/G',
              clientName,
              clientPhone: cleanPhone,
              action: 'ALREADY_NOTIFIED'
            });
          }
        } else {
          // Aún en camino
          report.details.push({
            orderId: p.id,
            trackingCode: p.codigo_seguimiento,
            guia: p.shalom_numero_guia || shalomMatch?.guia || 'S/G',
            clientName,
            clientPhone: cleanPhone,
            action: 'STILL_IN_TRANSIT'
          });
        }
      }

      // Marcar baseline como inicializado tras la primera pasada exitosa
      if (isFirstRun) {
        await redisClient.set(baselineKey, 'true');
        console.log(`[SHALOM LISTENER BASELINE] ✅ Baseline inicializado exitosamente (${report.baselineClassifiedCount} pedidos clasificados sin spam).`);
      }

      console.log(`[SHALOM LISTENER] ✓ Ciclo completado: ${report.totalShippedOrdersChecked} verificados | ${report.newlyArrivedCount} nuevos arribos | ${report.notifiedCount} notificados | ${report.baselineClassifiedCount} en baseline inicial.`);
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
