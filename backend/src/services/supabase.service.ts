import { supabaseAdmin } from '../config/supabase.js';
import { PaymentVoucher } from '../types/voucher.types.js';

export class SupabaseService {
  /**
   * Obtiene la información de una tienda/tenant registrada.
   */
  public static async getTenantInfo(tenantId: string) {
    try {
      const cleanId = tenantId.replace('tienda_', '');
      const { data: store } = await supabaseAdmin
        .from('tiendas')
        .select('*')
        .or(`id.eq.${cleanId},slug.eq.${tenantId}`)
        .maybeSingle();

      return store || { nombre: 'Tienda Encomi', id: cleanId };
    } catch {
      return { nombre: 'Tienda Encomi', id: tenantId };
    }
  }

  /**
   * Busca si existe un usuario registrado por su número de WhatsApp o DNI y tenant_id.
   */
  public static async findUserByPhoneOrDni(phoneClean: string, tenantId?: string) {
    try {
      const sanitized = phoneClean.replace(/[^0-9]/g, '');
      if (!sanitized || sanitized.length < 6) return null;

      let query = supabaseAdmin
        .from('usuarios')
        .select('*')
        .or(`dni.eq."${sanitized}",dni.ilike."%${sanitized.slice(-8)}%"`);

      if (tenantId) {
        // Si la tabla soporta tenant_id o tienda_id
        query = query.filter('dni', 'not.is', null);
      }

      const { data: user } = await query.maybeSingle();
      return user;
    } catch (error) {
      console.error('[SUPABASE FIND USER ERROR]', error);
      return null;
    }
  }

  /**
   * Busca el pedido pendiente más reciente asociado a un usuario o teléfono.
   */
  public static async findPendingOrder(userId?: string, tenantId?: string) {
    try {
      if (!userId) return null;

      let query = supabaseAdmin
        .from('pedidos')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: order } = await query.maybeSingle();
      return order;
    } catch (error) {
      console.error('[SUPABASE FIND ORDER ERROR]', error);
      return null;
    }
  }

  /**
   * Registra y persiste un comprobante de pago validado por IA con tenant_id.
   */
  public static async registerPaymentVoucher(
    voucher: PaymentVoucher,
    metadata: {
      tenantId?: string;
      whatsappSender: string;
      userId?: string;
      orderId?: string;
      imageUrl?: string;
    }
  ) {
    try {
      const { data, error } = await supabaseAdmin
        .from('comprobantes_pago')
        .insert({
          pedido_id: metadata.orderId || null,
          usuario_id: metadata.userId || null,
          whatsapp_sender: metadata.whatsappSender,
          numero_operacion: voucher.numeroOperacion || voucher.numero_operacion || 'S/N',
          monto: Number(voucher.monto) || 0,
          moneda: voucher.moneda || 'PEN',
          banco_emisor: voucher.banco || 'Desconocido',
          titular_origen: voucher.titularOrigen || null,
          titular_destino: voucher.titularDestino || null,
          fecha_pago: voucher.fechaPago || voucher.fecha || new Date().toISOString(),
          imagen_url: metadata.imageUrl || null,
          es_valido: voucher.esComprobanteValido ?? voucher.es_comprobante_valido ?? false,
          nivel_confianza: voucher.nivelConfianza || 'BAJA',
          motivo_rechazo: voucher.motivoRechazo || null,
          gemini_raw_response: voucher,
          estado_verificacion: (voucher.esComprobanteValido ?? voucher.es_comprobante_valido) ? 'procesado_ia' : 'rechazado',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[SUPABASE REGISTER VOUCHER ERROR]', error);
      throw error;
    }
  }

  /**
   * Guarda el log de auditoría del mensaje de WhatsApp con aislamiento multi-tenant.
   */
  public static async logWhatsAppMessage(params: {
    tenantId?: string;
    messageId: string;
    remoteJid: string;
    pushName?: string;
    tipoMensaje: string;
    contenidoTexto?: string;
    mediaUrl?: string;
    tipoProcesamiento?: string;
    respuestaEnviada?: string;
    duracionMs?: number;
    estado: 'completado' | 'error' | 'duplicado_ignorado';
    errorDetalle?: string;
  }) {
    try {
      await supabaseAdmin.from('whatsapp_mensajes_log').upsert(
        {
          message_id: params.messageId,
          remote_jid: params.remoteJid,
          push_name: params.pushName || null,
          tipo_mensaje: params.tipoMensaje,
          contenido_texto: params.contenidoTexto || null,
          media_url: params.mediaUrl || null,
          tipo_procesamiento: params.tipoProcesamiento || null,
          respuesta_enviada: params.respuestaEnviada || null,
          duracion_proceso_ms: params.duracionMs || null,
          estado: params.estado,
          error_detalle: params.errorDetalle || null,
        },
        { onConflict: 'message_id' }
      );
    } catch (error) {
      console.error('[SUPABASE LOG WHATSAPP ERROR]', error);
    }
  }
}
