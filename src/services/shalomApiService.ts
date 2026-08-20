import { Pedido, TallerConfig } from '../types/database.types';
import { extractShalomDni, extractShalomPhone, extractShalomDestino, extractShalomOrigen } from '../utils/shalomExcelExporter';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const SHALOM_API_KEY = import.meta.env.VITE_SHALOM_API_KEY || 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://89.117.73.97:3000').replace(/\/+$/, '');

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
  customerPhone?: string;
  customerName?: string;
  agencyName?: string;
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
      const response = await fetch(`${BACKEND_URL}/api/shalom/auth/test`, {
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
  public static buildOrderPayload(pedido: Pedido, tallerConfig: TallerConfig): ShalomOrderPayload {
    const dni = extractShalomDni(pedido) || '00000000';
    const phone = extractShalomPhone(pedido) || '999999999';
    const destino = extractShalomDestino(pedido.destino_detalle);
    const origen = extractShalomOrigen(tallerConfig);
    const clientName = pedido.usuario?.nombre_completo || 'CLIENTE';

    return {
      pedidoId: pedido.id,
      codigoSeguimiento: pedido.codigo_seguimiento,
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

      const response = await fetch(`${BACKEND_URL}/api/shalom/orders`, {
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
        const guideNumber = data.guide_number || data.numero_guia || `SH-${oseId}`;
        const trackingCode = data.tracking_code || data.codigo_rastreo || String(oseId);

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

      const errorMsg = resJson?.error || resJson?.message || 'Error desconocido al registrar en Shalom Pro';
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
      return {
        pedidoId: payload.pedidoId,
        codigoSeguimiento: payload.codigoSeguimiento,
        success: false,
        errorMessage: err?.message || 'Fallo de conexión al registrar con la API de Shalom',
        customerPhone: payload.destinatario.telefono,
        customerName: payload.destinatario.nombre,
        agencyName: payload.destinatario.agenciaDestino,
      };
    }
  }

  /**
   * Descarga el rótulo oficial en PDF generado por Shalom a través del backend proxy.
   */
  public static async downloadLabelPdf(
    oseId: string | number,
    auth: ShalomAuthCredentials,
    fileName: string = `Rotulo_Shalom_${oseId}.pdf`
  ): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/shalom/orders/${oseId}/label`, {
        method: 'GET',
        headers: {
          'X-API-Key': SHALOM_API_KEY,
          'X-Shalom-Email': auth.email.trim(),
          'X-Shalom-Password': auth.password || '',
        },
      });

      if (!response.ok) {
        throw new Error(`No se pudo obtener el PDF del rótulo (HTTP ${response.status})`);
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
            title: 'Rótulo Oficial Shalom',
            text: `Rótulo de Envío Shalom Orden #${oseId}`,
            url: savedFile.uri,
            dialogTitle: 'Compartir o Imprimir Rótulo Shalom',
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
      console.error('[SHALOM DOWNLOAD LABEL ERROR]', err);
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
    }>
  ): Promise<{ success: boolean; notifiedCount: number; errors: any[] }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tenant/sync-dispatch-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders: dispatchedOrders,
          labelName: 'Despachando en Shalom',
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
}
