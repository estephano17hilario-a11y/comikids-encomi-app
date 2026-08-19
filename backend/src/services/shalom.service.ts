import axios from 'axios';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

export interface ShalomTrackingResult {
  guiaNumero: string;
  estado: string;
  origen: string;
  destino: string;
  fechaEnvio?: string;
  fechaEntregaEstimada?: string;
  destinatario?: string;
}

export class ShalomService {
  /**
   * Consulta el estado de una guía de remisión / envío de Shalom.
   */
  public static async trackShipment(trackingCode: string): Promise<ShalomTrackingResult | null> {
    try {
      if (!env.SHALOM_API_URL || !env.SHALOM_CLIENT_ID) {
        // Fallback: Consultar en la base de datos de Supabase si el pedido está registrado
        const { data: pedido } = await supabaseAdmin
          .from('pedidos')
          .select('codigo_seguimiento, estado_envio, destino_detalle, created_at')
          .eq('codigo_seguimiento', trackingCode.trim().toUpperCase())
          .single();

        if (pedido) {
          return {
            guiaNumero: pedido.codigo_seguimiento,
            estado: pedido.estado_envio.toUpperCase(),
            origen: 'LIMA (TALLER COMIKIDS)',
            destino: pedido.destino_detalle,
            fechaEnvio: pedido.created_at,
          };
        }
        return null;
      }

      // Consulta a la API oficial de Shalom
      const response = await axios.get(`${env.SHALOM_API_URL}/v1/tracking/${trackingCode}`, {
        headers: {
          'X-Client-Id': env.SHALOM_CLIENT_ID,
          'X-Client-Secret': env.SHALOM_CLIENT_SECRET,
        },
        timeout: 8000,
      });

      if (response.data) {
        return {
          guiaNumero: response.data.guia || trackingCode,
          estado: response.data.estado || 'EN RUTA',
          origen: response.data.origen || 'LIMA',
          destino: response.data.destino || 'AGENCIA DESTINO',
          fechaEnvio: response.data.fecha_emision,
          fechaEntregaEstimada: response.data.fecha_estimada,
        };
      }

      return null;
    } catch (error) {
      console.error('[SHALOM TRACKING ERROR]', error);
      return null;
    }
  }

  /**
   * Busca agencias Shalom cercanas a un distrito o ciudad.
   */
  public static async searchAgencies(query: string): Promise<string[]> {
    try {
      const { data: agencies, error } = await supabaseAdmin
        .from('shalom_agencies')
        .select('name, department, province, district, address')
        .or(`name.ilike.%${query}%,district.ilike.%${query}%,province.ilike.%${query}%`)
        .limit(3);

      if (error || !agencies || agencies.length === 0) {
        return [];
      }

      return agencies.map(
        (a) => `📍 *${a.name}* (${a.district}, ${a.department})\nDirección: ${a.address}`
      );
    } catch (error) {
      console.error('[SHALOM AGENCIES SEARCH ERROR]', error);
      return [];
    }
  }
}
