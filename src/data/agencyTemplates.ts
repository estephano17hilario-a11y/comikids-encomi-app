import { MetodoEnvio, CampoPersonalizadoAgencia, TallerConfig } from '../types/database.types';
import {
  construirMensajeComprobacion,
  DEFAULT_INICIO_RECEIPT,
  DEFAULT_FIN_RECEIPT,
} from '../components/admin/agencies/agencyDraft';

/**
 * Plantillas de las agencias de paquetería más usadas en el Perú.
 * Cada plantilla trae lo que normalmente pide la agencia al REMITENTE (tú) y al
 * DESTINATARIO (tu clienta) para que al agregarla ya quede lista, sin configurar nada.
 *
 * Importante: son los datos habituales del servicio. Cada agencia puede cambiar sus
 * requisitos, por eso en pantalla se avisa "confirma con tu agencia".
 */

export type TemplateKind = 'bus' | 'courier' | 'correo' | 'domicilio';

export interface TemplateReq {
  label: string;
  /** Emoji corto para reconocerlo de un vistazo */
  emoji: string;
  obligatorio: boolean;
  /** Si es un dato que la clienta debe escribir y el formulario NO lo pide por su cuenta */
  campo?: { tipo: CampoPersonalizadoAgencia['tipo']; placeholder: string; id: string };
}

export interface AgencyTemplate {
  id: string;
  nombre: string;
  /** Una línea: para qué sirve / cómo se recoge */
  resumen: string;
  kind: TemplateKind;
  logo: string;
  /** Fondo del recuadro del logo (algunos logos son claros y necesitan fondo oscuro) */
  logoBg: string;
  color: string;
  /** Si ya existe como agencia oficial del sistema */
  sistema?: 'shalom' | 'olva';
  remitente: TemplateReq[];
  destinatario: TemplateReq[];
  /** Cómo recoge la clienta su paquete */
  recojo: string;
  /** Quién paga el flete */
  pago: string;
  notas: string[];
  web?: string;
}

const R = (label: string, emoji: string, obligatorio = true, campo?: TemplateReq['campo']): TemplateReq => ({ label, emoji, obligatorio, campo });

// Datos que el formulario de la clienta ya pide solos en cualquier agencia
const D_NOMBRE = R('Nombres y apellidos', '👤');
const D_CELULAR = R('Celular / WhatsApp', '📱');
const D_DNI = R('DNI o CE de quien recoge', '🪪', true, { tipo: 'numero', placeholder: '8 dígitos', id: 'dni' });

const S_NOMBRE = R('Nombre o razón social', '👤');
const S_DOC = R('DNI o RUC', '🪪');
const S_CEL = R('Celular', '📱');
const S_DIR = R('Dirección de origen', '📍', false);

export const AGENCY_TEMPLATES: AgencyTemplate[] = [
  {
    id: 'shalom',
    nombre: 'Shalom',
    resumen: 'Envíos a agencias Shalom de todo el Perú',
    kind: 'courier',
    logo: '/Shalom-Courier-Logo.webp',
    logoBg: '#ffffff',
    color: '#ef4444',
    sistema: 'shalom',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, R('DNI o CE de quien recoge', '🪪'), R('Agencia Shalom de destino', '📍')],
    recojo: 'En la agencia destino con DNI y clave de recojo',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Ya viene lista con la lista oficial de agencias Shalom.'],
  },
  {
    id: 'olva',
    nombre: 'Olva Courier',
    resumen: 'Envíos a agencia o a domicilio en todo el Perú',
    kind: 'courier',
    logo: '/Olva-Courier-Logo.svg',
    logoBg: '#FFDE00',
    color: '#f59e0b',
    sistema: 'olva',
    remitente: [S_NOMBRE, S_DOC, S_CEL, S_DIR],
    destinatario: [D_NOMBRE, R('DNI o CE', '🪪'), D_CELULAR, R('Correo electrónico', '✉️', false), R('Agencia Olva o dirección a domicilio', '📍')],
    recojo: 'En agencia Olva con DNI, o entrega a domicilio',
    pago: 'Flete pagado en origen',
    notas: ['Ya viene lista con la lista oficial de agencias Olva.'],
    web: 'olvacourier.com',
  },
  {
    id: 'marvisur',
    nombre: 'Marvisur',
    resumen: 'Encomiendas por bus a todo el sur y centro del país',
    kind: 'bus',
    logo: '/logos/marvisur.svg',
    logoBg: '#0f766e',
    color: '#0f766e',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, D_DNI, D_CELULAR, R('Ciudad / local de destino', '📍')],
    recojo: 'En el local de destino con DNI',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Se entrega en el local de la agencia, no a domicilio.'],
  },
  {
    id: 'flores',
    nombre: 'Transportes Flores',
    resumen: 'Encomiendas por bus a Arequipa, sur y norte',
    kind: 'bus',
    logo: '/logos/flores.svg',
    logoBg: '#b91c1c',
    color: '#b91c1c',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, D_DNI, D_CELULAR, R('Ciudad / terminal de destino', '📍')],
    recojo: 'En el terminal de destino con DNI',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Se entrega en el terminal de la agencia, no a domicilio.'],
  },
  {
    id: 'cruzdelsur',
    nombre: 'Cruz del Sur Cargo',
    resumen: 'Encomiendas asegurados por bus a todo el Perú',
    kind: 'bus',
    logo: '/logos/cruzdelsur.webp',
    logoBg: '#0b2a5b',
    color: '#eab308',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, D_DNI, D_CELULAR, R('Sede de destino', '📍')],
    recojo: 'En la sede de destino con DNI',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Todos los envíos van asegurados.', 'Te dan un número de control de 9 dígitos para rastrear.'],
    web: 'cruzdelsur.com.pe',
  },
  {
    id: 'serpost',
    nombre: 'Serpost',
    resumen: 'El correo oficial del Perú: entrega a domicilio',
    kind: 'correo',
    logo: '/logos/serpost.png',
    logoBg: '#ffffff',
    color: '#1d4ed8',
    remitente: [S_NOMBRE, S_DOC, R('Dirección completa', '📍'), S_CEL],
    destinatario: [
      D_NOMBRE,
      D_CELULAR,
      R('Dirección completa', '📍'),
      R('Distrito, provincia y departamento', '🗺️', true, { tipo: 'texto', placeholder: 'Ej: Miraflores, Lima, Lima', id: 'ubicacion' }),
      R('Código postal', '📮', false, { tipo: 'numero', placeholder: 'Ej: 15074', id: 'postal' }),
    ],
    recojo: 'Entrega a domicilio por el cartero',
    pago: 'Pagado en origen',
    notas: ['Al registrar el envío se presenta el DNI del remitente.', 'Nacional económico: 7 a 10 días hábiles aprox.'],
    web: 'serpost.com.pe',
  },
  {
    id: 'civa',
    nombre: 'Civa Cargo',
    resumen: 'Encomiendas por bus a todo el Perú',
    kind: 'bus',
    logo: '/logos/civa.svg',
    logoBg: '#ffffff',
    color: '#dc2626',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, D_DNI, D_CELULAR, R('Ciudad / terminal de destino', '📍')],
    recojo: 'En el terminal de destino con DNI',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Se entrega en el terminal de la agencia, no a domicilio.'],
    web: 'civa.com.pe',
  },
  {
    id: 'urbano',
    nombre: 'Urbano Express',
    resumen: 'Courier con entrega a domicilio en Lima y provincias',
    kind: 'domicilio',
    logo: '/logos/urbano.svg',
    logoBg: '#ffffff',
    color: '#7c3aed',
    remitente: [S_NOMBRE, S_DOC, S_CEL, R('Dirección de recojo', '📍')],
    destinatario: [
      D_NOMBRE,
      D_CELULAR,
      R('Dirección de entrega', '📍'),
      R('Distrito', '🗺️', true, { tipo: 'texto', placeholder: 'Ej: San Borja', id: 'distrito' }),
      R('Referencia de la casa', '🧭', false, { tipo: 'textarea', placeholder: 'Ej: Frente al parque, reja negra', id: 'ref' }),
    ],
    recojo: 'Entrega a domicilio',
    pago: 'Pagado en origen',
    notas: ['Ideal para tiendas online: recogen en tu local.'],
    web: 'urbano.com.pe',
  },
  {
    id: 'dhl',
    nombre: 'DHL Express',
    resumen: 'Envíos urgentes a domicilio, nacional e internacional',
    kind: 'domicilio',
    logo: '/logos/dhl.svg',
    logoBg: '#FFCC00',
    color: '#d40511',
    remitente: [S_NOMBRE, S_CEL, R('Dirección completa', '📍'), R('Correo electrónico', '✉️', false)],
    destinatario: [
      D_NOMBRE,
      D_CELULAR,
      R('Dirección completa', '📍'),
      R('Distrito y ciudad', '🗺️', true, { tipo: 'texto', placeholder: 'Ej: Surco, Lima', id: 'ciudad' }),
      R('Correo electrónico', '✉️', false, { tipo: 'texto', placeholder: 'Ej: maria@gmail.com', id: 'correo' }),
      R('Referencia de la casa', '🧭', false, { tipo: 'textarea', placeholder: 'Ej: Edificio azul, piso 3', id: 'ref' }),
    ],
    recojo: 'Entrega a domicilio',
    pago: 'Pagado en origen',
    notas: ['Para envíos al exterior se pide además descripción y valor del contenido.'],
    web: 'dhl.com/pe',
  },
  {
    id: 'movilbus',
    nombre: 'Movil Bus Cargo',
    resumen: 'Encomiendas por bus al norte y oriente del país',
    kind: 'bus',
    logo: '/logos/movilbus.png',
    logoBg: '#ffffff',
    color: '#0ea5e9',
    remitente: [S_NOMBRE, S_DOC, S_CEL],
    destinatario: [D_NOMBRE, D_DNI, D_CELULAR, R('Ciudad / terminal de destino', '📍')],
    recojo: 'En el terminal de destino con DNI',
    pago: 'Flete pagado en origen o por pagar en destino',
    notas: ['Se entrega en el terminal de la agencia, no a domicilio.'],
    web: 'movilbus.pe',
  },
];

export const KIND_LABEL: Record<TemplateKind, string> = {
  bus: '🚌 Por bus',
  courier: '📦 Courier',
  correo: '✉️ Correo',
  domicilio: '🏠 A domicilio',
};

/** Color de fondo con el que se ve bien cada logo conocido (los claros necesitan fondo oscuro) */
export const logoBgFor = (src: string): string => AGENCY_TEMPLATES.find(t => t.logo === src)?.logoBg || '#ffffff';

/** ¿Esta plantilla ya existe en las agencias de la empresa? */
export const findExistingForTemplate = (t: AgencyTemplate, methods: MetodoEnvio[]): MetodoEnvio | undefined =>
  methods.find(m => m.plantilla_id === t.id || (t.sistema && (m.codigo === t.sistema || m.tipo_formulario === t.sistema)));

const slug = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Convierte una plantilla en una agencia lista para guardar */
export const templateToMethod = (t: AgencyTemplate, taller: TallerConfig, orden: number): Omit<MetodoEnvio, 'id'> => {
  const stamp = slug();
  const campos: CampoPersonalizadoAgencia[] = [];
  const vistos = new Set<string>();
  for (const req of t.destinatario) {
    if (!req.campo || vistos.has(req.campo.id)) continue;
    vistos.add(req.campo.id);
    campos.push({
      id: `c-${req.campo.id}-${stamp}`,
      label: req.label,
      placeholder: req.campo.placeholder,
      tipo: req.campo.tipo,
      requerido: req.obligatorio,
      mostrar_en_rotulado: true,
      mostrar_en_comprobante: true,
      sistema: false,
    });
  }

  const pideRemitente = t.remitente.length > 0;
  const tiene = (txt: string) => t.remitente.some(r => r.label.toLowerCase().includes(txt));

  return {
    codigo: `${t.id}_${stamp}`,
    plantilla_id: t.id,
    nombre: t.nombre,
    descripcion: t.resumen,
    icono: 'Truck',
    foto_url: t.logo,
    tipo_formulario: 'personalizado',
    color_borde: t.color,
    activo: true,
    orden,
    es_sistema: false,
    requisitos: {
      remitente: t.remitente.map(r => ({ label: r.label, emoji: r.emoji, obligatorio: r.obligatorio })),
      destinatario: t.destinatario.map(r => ({ label: r.label, emoji: r.emoji, obligatorio: r.obligatorio })),
      recojo: t.recojo,
      pago: t.pago,
      notas: t.notas,
    },
    campos_personalizados: campos,
    mensaje_comprobacion: construirMensajeComprobacion(DEFAULT_INICIO_RECEIPT(t.nombre), DEFAULT_FIN_RECEIPT(), t.nombre),
    mensaje_inicio_comprobante: DEFAULT_INICIO_RECEIPT(t.nombre),
    mensaje_fin_comprobante: DEFAULT_FIN_RECEIPT(),
    config_rotulado: {
      incluir_campos_personalizados: true,
      campos_visibles: campos.map(c => c.id),
      orientacion: 'vertical',
      estilo_rotulo: 'eco_ink_saving',
      // Si la agencia pide datos del remitente, salen en el rótulo con los datos de tu negocio
      incluir_remitente: pideRemitente,
      mostrar_remitente_nombre: tiene('nombre'),
      mostrar_remitente_ruc_dni: tiene('dni') || tiene('ruc'),
      mostrar_remitente_telefono: tiene('celular'),
      mostrar_remitente_origen: tiene('dirección') || tiene('direccion'),
      remitente_personalizado: {
        usar_personalizado: false,
        nombre: taller.remitente_default?.nombre || taller.nombre_taller || undefined,
        ruc_dni: taller.remitente_default?.ruc_dni || taller.remitente_dni || taller.ruc_dni || undefined,
        celular: taller.remitente_default?.celular || taller.remitente_celular || taller.celular_taller || undefined,
        direccion: taller.remitente_default?.direccion || taller.direccion_taller || undefined,
      },
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: true,
      mostrar_cliente_destino: true,
      mostrar_barcode: true,
      mostrar_fecha_sello: true,
    },
  };
};
