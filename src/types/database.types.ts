export type UserRole = 'client' | 'empresa' | 'matrix';
export type EstadoProduccion = 'en_cola' | 'bordando' | 'completado';
export type EstadoEnvio = 'pendiente' | 'en_camino' | 'listo_para_recojo' | 'entregado';
export type TipoFormularioEnvio = 'shalom' | 'mapa_direccion' | 'texto_simple' | 'olva';

export interface AccesoHistorialItem {
  id: string;
  fecha: string;
  userAgent?: string;
  ip?: string;
  exitoso: boolean;
}

export interface EmpresaSeccionesActivas {
  pedidos: boolean;
  agendas: boolean;
  estadisticas: boolean;
  inventario: boolean;
  encomi_ai: boolean;
  hitos: boolean;
  ajustes: boolean;
}

export interface EmpresaConfig {
  shalom_modo: 'api' | 'excel'; // 'api' (automático Pro) o 'excel' (solo exportar/cargar Excel)
  vps_whatsapp_entregado: boolean; // Enviar "entregado" mediante un click en el sistema de vps de whatsapp
  secciones_activas: EmpresaSeccionesActivas;
  desactivar_yape?: boolean; // Desactivar interfaz y métricas de Yape para cuentas de empresa
  
  // Credenciales técnicas exclusivas que solo Matrix puede configurar
  shalom_email?: string;
  shalom_password?: string;
  vps_server_url?: string;
  vps_instance_name?: string;
  vps_api_key?: string;
}

export interface EmpresaAccount {
  id: string;
  nombre: string;
  numero_entrada: string;
  password_hash: string;
  activo: boolean;
  telefono_contacto?: string;
  sub_instance?: string;
  logo_url?: string;
  tema_fondo?: string;
  created_at: string;
  ultimo_acceso?: string;
  total_ingresos: number;
  historial_accesos: AccesoHistorialItem[];
  config?: EmpresaConfig;
}

export interface Usuario {
  id: string;
  dni: string;
  nombre_completo: string;
  email?: string;
  email_default?: string;
  tiktok_usuario?: string;
  edad?: number;
  genero?: 'masculino' | 'femenino' | 'otro';
  motivo_compra?: 'uso_personal' | 'emprender' | 'empresa';
  telefono_default?: string;
  dni_default?: string;
  distrito_default?: string;
  direccion_default?: string;
  referencia_default?: string;
  olva_modalidad_default?: 'agencia' | 'domicilio';
  datos_adicionales_completados?: boolean;
  password_hash: string;
  rol: UserRole;
  avatar_url: string;
  puntos_xp: number;
  nivel: number;
  created_at: string;
}

export interface CampoPersonalizadoAgencia {
  id: string;
  label: string;
  placeholder?: string;
  tipo: 'texto' | 'telefono' | 'numero' | 'textarea';
  requerido: boolean;
  mostrar_en_rotulado: boolean;
  mostrar_en_comprobante: boolean;
  sistema?: boolean; // Protegido contra eliminación (ej. DNI, teléfono en agencias base)
}

export interface MetodoEnvio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  icono: string;
  foto_url?: string; // Logo / Foto de la agencia (preset o personalizada)
  tipo_formulario: TipoFormularioEnvio | 'personalizado';
  activo: boolean;
  orden: number;
  es_sistema?: boolean; // TRUE para Shalom y Olva (no se pueden borrar ni alterar campos base)
  campos_personalizados?: CampoPersonalizadoAgencia[];
  mensaje_comprobacion?: string; // Plantilla editable por agencia sin el pie de Encomi
  config_rotulado?: {
    incluir_campos_personalizados?: boolean;
    campos_visibles?: string[]; // IDs de los campos personalizados que irán en el rótulo
    
    // Bloque Remitente (Quien envía)
    incluir_remitente?: boolean;
    mostrar_remitente_nombre?: boolean;
    mostrar_remitente_ruc_dni?: boolean;
    mostrar_remitente_telefono?: boolean;
    mostrar_remitente_origen?: boolean;
    
    // Bloque Destinatario (Quien recibe)
    incluir_destinatario?: boolean;
    mostrar_cliente_nombre?: boolean;
    mostrar_cliente_dni?: boolean;
    mostrar_cliente_telefono?: boolean;
    mostrar_cliente_destino?: boolean;
    mostrar_observaciones?: boolean;
    
    // Extras de Rótulo
    mostrar_barcode?: boolean;
    mostrar_fecha_sello?: boolean;
  };
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
  rotulado?: boolean;
  registrado_shalom?: boolean;
  shalom_ose_id?: string | null;
  shalom_numero_guia?: string | null;
  shalom_clave_recojo?: string | null;
  campos_personalizados?: Record<string, any>;
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

export interface HorarioDiaDespacho {
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  activo: boolean;
  hora_corte: string;
  mensaje_personalizado?: string;
}

export interface TallerConfig {
  nombre_taller: string;
  ruc_dni: string;
  celular_taller: string;
  whatsapp_pedidos: string;
  direccion_taller: string;
  ciudad_origen: string;
  remitente_email?: string;
  remitente_dni?: string;
  remitente_celular?: string;
  agencia_shalom_origen?: string;
  anuncio_publico_clientes?: string;
  shalom_email?: string;
  shalom_password?: string;
  copilot_password?: string;
  copilot_sub_instance?: string;
  copilot_owner_phone?: string;
  hora_corte_envio_hoy?: string;
  dias_despacho_activos?: string[];
  despacho_domingo_habilitado?: boolean;
  mensaje_corte_personalizado?: string;
  horarios_por_dia?: Record<string, HorarioDiaDespacho>;
  logo_url?: string; // Foto de perfil / Logo oficial de la empresa
  tema_fondo?: string; // ID del tema futurista seleccionado
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

export interface OlvaAgency {
  id: number | string;
  code?: string | null;
  departamento: string;
  provincia: string;
  distrito: string;
  department?: string;
  province?: string;
  district?: string;
  ubigeo?: string | null;
  nombre: string;
  name?: string;
  full_name?: string;
  direccion: string;
  address?: string;
  telefono?: string | null;
  phone?: string | null;
  horario?: string | null;
  schedule?: string | null;
  tipo?: string;
  type?: string;
  partner?: boolean;
  is_partner?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number;
  is_active?: boolean;
  updated_at?: string;
  full_display_name?: string;
}

export interface OlvaAgencyDB {
  id: number;
  code: string | null;
  name: string;
  full_name: string;
  department: string;
  province: string;
  district: string;
  ubigeo: string | null;
  address: string;
  phone: string | null;
  schedule: string | null;
  tipo: string;
  is_partner: boolean;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  distance_meters?: number;
  updated_at?: string;
}

export interface Colaborador {
  id: string;
  nombre: string;
  rol: 'administrador' | 'embalaje' | 'atencion' | 'motorizado';
  telefono?: string;
  email?: string;
  activo: boolean;
  created_at: string;
}

export interface CompanyAchievement {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  meta_pedidos: number;
  icono: string;
  recompensa_xp: number;
  unlocked: boolean;
  unlocked_at?: string;
}

export interface MotorizadoDistrictConfig {
  id: string;
  distrito: string;
  zona: 'lima_centro' | 'lima_norte' | 'lima_sur' | 'lima_este' | 'callao';
  tiempo_estimado_horas: number;
  tarifa_sugerida: number;
  activo: boolean;
}

export interface CompanyFinancialSummary {
  total_pedidos: number;
  pedidos_entregados: number;
  pedidos_en_curso: number;
  pedidos_shalom: number;
  pedidos_motorizado: number;
  clientes_activos: number;
  tasa_entrega_porcentaje: number;
  tiempo_promedio_despacho_horas: number;
}
