import { Pedido, TallerConfig } from '../types/database.types';
import { extractShalomDni, extractShalomPhone, extractShalomDestino, extractShalomOrigen } from '../utils/shalomExcelExporter';
import { getApiBaseUrl } from '../config/api';
import { validateShalomPdfContent } from '../utils/shalomPdfValidator';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const SHALOM_API_KEY = import.meta.env.VITE_SHALOM_API_KEY || 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';

export interface ShalomAuthCredentials {

  email: string;
  password?: string;
  sessionToken?: string;
}

export interface ShalomOrderPayload {
  pedidoId: string;
  codigoSeguimiento: string;
  remitente: {
    nombre: string;
    documento: string;
    telefono: string;
    agenciaOrigen: string;
  };
  destinatario: {
    nombre: string;
    documento: string;
    telefono: string;
    agenciaDestino: string;
    direccionFisica?: string;
  };
  paquete: {
    descripcion: string;
    cantidadBultos: number;
    tipoEnvio: 'PAGADO' | 'PAGO EN DESTINO';
  };
  pickup_code?: string;
}

export interface ShalomDispatchResult {
  pedidoId: string;
  codigoSeguimiento: string;
  success: boolean;
  oseId?: string | number;
  guideNumber?: string;
  trackingCode?: string;
  errorMessage?: string;
  labelPdfBase64?: string;
  pdfBase64?: string;
  customerPhone?: string;

  customerName?: string;
  agencyName?: string;
  pickupCode?: string;
}

export class ShalomApiService {
  /**
   * Prueba las credenciales de Shalom Pro a través del backend proxy (evita bloqueos de CORS en navegadores).
   */
  public static async testShalomAuth(credentials: ShalomAuthCredentials): Promise<{ valid: boolean; message: string; sessionToken?: string }> {
    if (!credentials.email || !credentials.password) {
      return { valid: false, message: 'Ingresa tu correo y contraseña de Shalom Pro.' };
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/shalom/auth/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email.trim(),
          password: credentials.password,
          apiKey: SHALOM_API_KEY,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.valid) {
        return {
          valid: true,
          message: data.message || `Conexión exitosa con Shalom Pro (${credentials.email})`,
          sessionToken: data?.data?.session_token || data?.data?.token,
        };
      }

      return {
        valid: false,
        message: data?.message || 'Credenciales de Shalom Pro no válidas.',
      };
    } catch (err: any) {
      console.warn('[SHALOM PROXY AUTH WARN]', err);
      return {
        valid: false,
        message: 'No se pudo conectar con el servidor de autenticación. Verifica tu conexión.',
      };
    }
  }

  /**
   * Prepara el payload estandarizado para un pedido individual.
   */
  public static buildOrderPayload(pedido: Pedido, tallerConfig: TallerConfig, pickupCode: string = '0808'): ShalomOrderPayload {
    const dni = extractShalomDni(pedido) || '00000000';
    const phone = extractShalomPhone(pedido) || '999999999';
    const destino = extractShalomDestino(pedido.destino_detalle);
    const origen = extractShalomOrigen(tallerConfig);
    const clientName = pedido.usuario?.nombre_completo || 'CLIENTE';

    return {
      pedidoId: pedido.id,
      codigoSeguimiento: pedido.codigo_seguimiento,
      pickup_code: pickupCode,
      remitente: {
        nombre: tallerConfig.nombre_taller || 'ENCOMI TALLER',
        documento: tallerConfig.ruc_dni || '20000000001',
        telefono: tallerConfig.celular_taller || '999999999',
        agenciaOrigen: origen,
      },
      destinatario: {
        nombre: clientName,
        documento: dni,
        telefono: phone,
        agenciaDestino: destino,
        direccionFisica: pedido.destino_detalle,
      },
      paquete: {
        descripcion: pedido.detalles_bordado || 'PRENDAS DE TEXTIL / ENCOMIENDA',
        cantidadBultos: 1,
        tipoEnvio: 'PAGADO',
      },
    };
  }

  /**
   * Registra una orden de envío en Shalom Pro vía API a través del proxy del backend (Anti-CORS).
   */
  public static async registerOrder(
    payload: ShalomOrderPayload,
    auth: ShalomAuthCredentials
  ): Promise<ShalomDispatchResult> {
    try {
      const orderBody = {
        pickup_code: payload.pickup_code || '0808',
        sender: {
          name: payload.remitente.nombre,
          document_number: payload.remitente.documento,
          phone: payload.remitente.telefono,
          origin_agency: payload.remitente.agenciaOrigen,
        },
        receiver: {
          name: payload.destinatario.nombre,
          document_number: payload.destinatario.documento,
          phone: payload.destinatario.telefono,
          destination_agency: payload.destinatario.agenciaDestino,
          address: payload.destinatario.direccionFisica,
        },
        package: {
          description: payload.paquete.descripcion,
          pieces: payload.paquete.cantidadBultos,
          payment_type: payload.paquete.tipoEnvio,
          internal_code: payload.codigoSeguimiento,
        },
      };


      const response = await fetch(`${getApiBaseUrl()}/shalom/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: orderBody,
          auth: {
            email: auth.email.trim(),
            password: auth.password,
            apiKey: SHALOM_API_KEY,
          },
        }),
      });

      const resJson = await response.json().catch(() => ({}));

      if (response.ok && resJson.success && resJson.data) {
        const data = resJson.data;
        const oseId = data.ose_id || data.id;
        const guideNumber = data.guia ? `${data.serie ? data.serie + '-' : ''}${data.guia}` : (data.guide_number || data.numero_guia || `SH-${oseId}`);
        const trackingCode = data.codigo || data.tracking_code || data.codigo_rastreo || String(oseId);


        return {
          pedidoId: payload.pedidoId,
          codigoSeguimiento: payload.codigoSeguimiento,
          success: true,
          oseId,
          guideNumber,
          trackingCode,
          customerPhone: payload.destinatario.telefono,
          customerName: payload.destinatario.nombre,
          agencyName: payload.destinatario.agenciaDestino,
        };
      }

      const rawError = resJson?.error || resJson?.message || 'Error al registrar en Shalom Pro';
      const errorMsg = typeof rawError === 'string' ? rawError : (rawError?.message || JSON.stringify(rawError));
      return {
        pedidoId: payload.pedidoId,
        codigoSeguimiento: payload.codigoSeguimiento,
        success: false,
        errorMessage: errorMsg,
        customerPhone: payload.destinatario.telefono,
        customerName: payload.destinatario.nombre,
        agencyName: payload.destinatario.agenciaDestino,
      };
    } catch (err: any) {
      const catchError = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Fallo de conexión al registrar con la API de Shalom';
      const safeCatchError = typeof catchError === 'string' ? catchError : JSON.stringify(catchError);
      return {
        pedidoId: payload.pedidoId,
        codigoSeguimiento: payload.codigoSeguimiento,
        success: false,
        errorMessage: safeCatchError,
        customerPhone: payload.destinatario.telefono,
        customerName: payload.destinatario.nombre,
        agencyName: payload.destinatario.agenciaDestino,
      };
    }

  }

  /**
   * Descarga el Ticket Oficial POS con QR generado por Shalom a través del backend proxy.
   */
  public static async downloadLabelPdf(
    oseId: string | number,
    auth: ShalomAuthCredentials,
    fileName: string = `Ticket_Shalom_${oseId}.pdf`
  ): Promise<void> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/shalom/orders/${oseId}/voucher`, {
        method: 'GET',
        headers: {
          'X-API-Key': SHALOM_API_KEY,
          'X-Shalom-Email': auth.email.trim(),
          'X-Shalom-Password': auth.password || '',
        },
      });

      if (!response.ok) {
        throw new Error(`No se pudo obtener el PDF del ticket (HTTP ${response.status})`);
      }

      const blob = await response.blob();

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          await Share.share({
            title: 'Ticket Oficial Shalom con QR',
            text: `Ticket de Envío Shalom Orden #${oseId}`,
            url: savedFile.uri,
            dialogTitle: 'Compartir o Imprimir Ticket Shalom',
          });
        };
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('[SHALOM DOWNLOAD TICKET ERROR]', err);
      throw err;
    }
  }

  /**
   * Notifica a las clientas y actualiza sus etiquetas en WhatsApp Business tras el despacho.
   */
  public static async syncDispatchedWhatsApp(
    dispatchedOrders: Array<{
      phone: string;
      customerName: string;
      trackingCode: string;
      guideNumber: string;
      agencyName: string;
      orderCode: string;
      pdfBase64?: string;
      fileName?: string;
      pickupCode?: string;
    }>,
    pickupCode: string = '0808'
  ): Promise<{ success: boolean; notifiedCount: number; errors: any[] }> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/tenant/sync-dispatch-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: dispatchedOrders,
          labelName: 'Despachando en Shalom',
          pickupCode,
        }),
      });


      const data = await response.json();
      return {
        success: response.ok,
        notifiedCount: data.notifiedCount || dispatchedOrders.length,
        errors: data.errors || [],
      };
    } catch (err: any) {
      console.error('[WHATSAPP DISPATCH SYNC ERROR]', err);
      return {
        success: false,
        notifiedCount: 0,
        errors: [err.message],
      };
    }
  }

  /**
   * Envía los Tickets Oficiales POS de Shalom por WhatsApp a cada clienta al confirmar entrega.
   */
  public static async sendDeliveryVouchers(
    dispatchedOrders: Array<{
      phone: string;
      customerName: string;
      trackingCode: string;
      guideNumber: string;
      agencyName: string;
      orderCode?: string;
      pdfBase64?: string;
      fileName?: string;
      pickupCode?: string;
      dni?: string;
    }>,
    pickupCode: string = '0808'
  ): Promise<{ success: boolean; deliveredCount?: number; notifiedCount?: number; errors?: any[]; results?: any[] }> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/tenant/send-delivery-vouchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: dispatchedOrders,
          pickupCode,
        }),
      });

      const data = await response.json();
      return {
        success: response.ok,
        deliveredCount: data.deliveredCount || data.notifiedCount || dispatchedOrders.length,
        notifiedCount: data.deliveredCount || data.notifiedCount || dispatchedOrders.length,
        errors: data.errors || [],
        results: data.results || [],
      };
    } catch (err: any) {
      console.error('[WHATSAPP DELIVERY VOUCHERS ERROR]', err);
      return {
        success: false,
        deliveredCount: 0,
        notifiedCount: 0,
        errors: [err.message],
        results: [],
      };
    }
  }

  /**
   * Obtiene el Ticket Oficial POS (con Código QR y Precios Actualizados) en Base64.
   */
  public static async fetchLabelPdfBase64(
    oseId: number | string,
    auth?: ShalomAuthCredentials,
    clientContext?: { dni?: string; phone?: string; name?: string; guia?: string },
    onMetadata?: (meta: { pickupCode?: string; guia?: string }) => void
  ): Promise<string | null> {
    return this.fetchVoucherPdfBase64(oseId, auth, clientContext, onMetadata);
  }


  /**
   * Obtiene el PDF del Ticket Oficial / Voucher (Formato Físico POS con QR) en Base64.
   */
  public static async fetchVoucherPdfBase64(
    oseId: number | string,
    auth?: ShalomAuthCredentials,
    clientContext?: { dni?: string; phone?: string; name?: string; guia?: string },
    onMetadata?: (meta: { pickupCode?: string; guia?: string }) => void
  ): Promise<string | null> {
    try {
      const headers: Record<string, string> = {
        'X-API-Key': SHALOM_API_KEY,
      };
      if (auth?.email) headers['X-Shalom-Email'] = auth.email.trim();
      if (auth?.password) headers['X-Shalom-Password'] = auth.password;

      const qParams = new URLSearchParams();
      if (clientContext?.dni) qParams.set('dni', clientContext.dni);
      if (clientContext?.phone) qParams.set('phone', clientContext.phone);
      if (clientContext?.name) qParams.set('name', clientContext.name);
      if (clientContext?.guia) qParams.set('guia', clientContext.guia);
      const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

      const response = await fetch(`${getApiBaseUrl()}/shalom/orders/${encodeURIComponent(String(oseId))}/voucher${qStr}`, {
        headers,
      });

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf') && !contentType.includes('image/') && !contentType.includes('octet-stream')) {
        return null;
      }

      const livePin = response.headers.get('x-shalom-pickup-code') || response.headers.get('X-Shalom-Pickup-Code');
      const liveGuia = response.headers.get('x-shalom-guia') || response.headers.get('X-Shalom-Guia');
      const returnedDni = response.headers.get('x-shalom-receiver-dni') || response.headers.get('X-Shalom-Receiver-Dni');

      // Validar DNI con header de seguridad
      if (clientContext?.dni && clientContext.dni.length >= 6 && returnedDni && returnedDni !== 'DNI') {
        const cleanReqDni = clientContext.dni.replace(/\D/g, '');
        const cleanDoc = returnedDni.replace(/\D/g, '');
        if (cleanReqDni && cleanDoc && cleanReqDni !== cleanDoc) {
          console.warn(`[SHALOM SECURITY LOCK] Rechazado comprobante de otra clienta. DNI Solicitado: ${cleanReqDni} vs DNI Comprobante: ${cleanDoc}`);
          return null;
        }
      }

      if (onMetadata && (livePin || liveGuia)) {
        onMetadata({ pickupCode: livePin || undefined, guia: liveGuia || undefined });
      }

      const blob = await response.blob();
      if (!blob || blob.size < 200) return null;

      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const data = result.includes('base64,') ? result.split('base64,')[1] : result;
          if (data && (data.startsWith('JVBERi') || data.startsWith('/9j/') || data.startsWith('iVBOR') || data.startsWith('UklGR'))) {
            resolve(data);
          } else {
            resolve('');
          }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });

      if (!base64Data) return null;

      // Validación de contenido de stream PDF a nivel bancario
      if (clientContext) {
        const validation = validateShalomPdfContent(base64Data, clientContext);
        if (!validation.isValid) {
          console.warn(`[SHALOM SECURITY LOCK] Validación de stream fallida: ${validation.reason}`);
          return null;
        }
      }

      return base64Data;
    } catch {
      return null;
    }
  }


  /**
   * Descarga el PDF del Ticket Shalom Oficial (formato físico de agencia con QR).
   */
  public static async downloadVoucherPdf(
    oseId: number | string,
    auth: ShalomAuthCredentials,
    fileName: string = `Ticket_Shalom_${oseId}.pdf`,
    clientContext?: { dni?: string; phone?: string; name?: string; guia?: string }
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'X-API-Key': SHALOM_API_KEY,
      };
      if (auth?.email) headers['X-Shalom-Email'] = auth.email.trim();
      if (auth?.password) headers['X-Shalom-Password'] = auth.password;

      const qParams = new URLSearchParams();
      if (clientContext?.dni) qParams.set('dni', clientContext.dni);
      if (clientContext?.phone) qParams.set('phone', clientContext.phone);
      if (clientContext?.name) qParams.set('name', clientContext.name);
      if (clientContext?.guia) qParams.set('guia', clientContext.guia);
      const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

      const response = await fetch(`${getApiBaseUrl()}/shalom/orders/${encodeURIComponent(String(oseId))}/voucher${qStr}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`No se pudo obtener el PDF del ticket (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      if (!blob || blob.size < 100) {
        throw new Error('El PDF recibido está vacío');
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[SHALOM DOWNLOAD VOUCHER ERROR]', err);
      throw err;
    }
  }
}



