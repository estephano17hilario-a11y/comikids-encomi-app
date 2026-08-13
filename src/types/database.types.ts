export type UserRole = 'client' | 'empresa';
export type EstadoProduccion = 'en_cola' | 'bordando' | 'completado';
export type EstadoEnvio = 'pendiente' | 'en_camino' | 'entregado';
export type TipoFormularioEnvio = 'shalom' | 'mapa_direccion' | 'texto_simple';

export interface Usuario {
  id: string;
  dni: string;
  nombre_completo: string;
  edad?: number;
  password_hash: string;
  rol: UserRole;
  avatar_url: string;
  puntos_xp: number;
  nivel: number;
  created_at: string;
}

export interface MetodoEnvio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  icono: string;
  tipo_formulario: TipoFormularioEnvio;
  activo: boolean;
  orden: number;
}

export interface Pedido {
  id: string;
  codigo_seguimiento: string;
  usuario_id: string;
  usuario?: Usuario;
  detalles_bordado: string;
  foto_referencia_url?: string;
  metodo_envio_codigo: string;
  metodo_envio_nombre: string;
  destino_detalle: string;
  latitud?: number;
  longitud?: number;
  estado_produccion: EstadoProduccion;
  estado_envio: EstadoEnvio;
  observaciones_cliente?: string;
  fecha_limite?: string;
  created_at: string;
  updated_at?: string;
}

export interface LogroUsuario {
  id: string;
  usuario_id: string;
  codigo_logro: string;
  titulo: string;
  descripcion: string;
  icono: string;
  puntos_xp_ganados: number;
  unlocked_at: string;
}

export interface TallerConfig {
  nombre_taller: string;
  ruc_dni: string;
  celular_taller: string;
  whatsapp_pedidos: string;
  direccion_taller: string;
  ciudad_origen: string;
}

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
  telefono?: string | null;
  phone?: string | null;
  horario?: string | null;
  schedule?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
  is_active?: boolean;
  updated_at?: string;
  full_display_name?: string;
}

export interface ShalomAgencyDB {
  id: number;
  code: string | null;
  name: string;
  full_name: string;
  department: string;
  province: string;
  district: string;
  ubigeo: string | null;
  dep_id: number | null;
  prov_id: number | null;
  dist_id: number | null;
  address: string;
  phone: string | null;
  schedule: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  distance_meters?: number;
  updated_at?: string;
}


