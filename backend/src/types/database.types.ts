export type UserRole = 'client' | 'empresa';
export type EstadoProduccion = 'en_cola' | 'bordando' | 'completado';
export type EstadoEnvio = 'pendiente' | 'en_camino' | 'listo_para_recojo' | 'entregado';

export interface ShalomAgency {
  id: number | string;
  code?: string | null;
  departamento: string;
  provincia: string;
  distrito: string;
  department?: string;
  province?: string;
  district?: string;
  ubigeo?: string | null;
  dep_id?: number | null;
  prov_id?: number | null;
  dist_id?: number | null;
  nombre: string;
  name?: string;
  full_name?: string;
  direccion: string;
  address?: string;
  phone?: string | null;
  telefono?: string | null;
  schedule?: string | null;
  horario?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
  is_active?: boolean;
  updated_at?: string;
  full_display_name?: string;
}

export interface Usuario {
  id: string;
  dni: string;
  nombre_completo: string;
  telefono_default?: string;
  dni_default?: string;
  direccion_default?: string;
  referencia_default?: string;
  rol: string;
  created_at?: string;
}

export interface Pedido {
  id: string;
  codigo_seguimiento: string;
  usuario_id: string;
  usuario?: Usuario;
  detalles_bordado?: string;
  metodo_envio_codigo: string;
  metodo_envio_nombre?: string;
  destino_detalle: string;
  estado_produccion: EstadoProduccion;
  estado_envio: EstadoEnvio;
  observaciones_cliente?: string;
  fecha_limite?: string;
  shalom_ose_id?: string | null;
  shalom_numero_guia?: string | null;
  shalom_clave_recojo?: string | null;
  created_at: string;
  updated_at?: string;
}
