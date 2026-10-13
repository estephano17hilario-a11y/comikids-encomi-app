import {
  MetodoEnvio,
  CampoPersonalizadoAgencia,
  TallerConfig,
  Pedido,
  DiaSemana,
  HorarioDia,
  BloqueRotuladoPersonalizado,
} from '../../../types/database.types';

// ---------------------------------------------------------------------------
// Mensaje de WhatsApp (comprobante)
// ---------------------------------------------------------------------------
export const RECEIPT_DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export const DEFAULT_INICIO_RECEIPT = (nombreAgencia: string) =>
  `✨ *COMPROBANTE DE ENVÍO - ${nombreAgencia ? nombreAgencia.toUpperCase() : 'AGENCIA'}* 📦\n¡Hola! Tu pedido ha sido registrado con éxito.`;

export const DEFAULT_FIN_RECEIPT = () =>
  `¡Muchas gracias por tu compra! Recuerda acudir con tu DNI físico para recoger tu paquete. 💖✨🙏`;

export const construirMensajeComprobacion = (inicio: string, fin: string, nombreAgencia: string) => {
  const header = inicio.trim() || DEFAULT_INICIO_RECEIPT(nombreAgencia);
  const footer = fin.trim();
  return `${header}
${RECEIPT_DIVIDER}
🏷️ *Orden:* {orden}
👤 *Cliente:* {cliente}
🪪 *DNI / Doc:* {dni}
📱 *WhatsApp:* {telefono}
🚚 *Modalidad:* {modalidad}
📅 *Fecha de Envío:* {fecha}

📍 *Destino Oficial:*
{destino}
{campos_adicionales}${footer ? `\n\n${footer}` : ''}`;
};

export const parsearMensajeComprobante = (mensajeCompleto?: string, nombreAgencia: string = '') => {
  const defaultInicio = DEFAULT_INICIO_RECEIPT(nombreAgencia);
  const defaultFin = DEFAULT_FIN_RECEIPT();

  if (!mensajeCompleto || !mensajeCompleto.trim()) {
    return { inicio: defaultInicio, fin: defaultFin };
  }

  if (mensajeCompleto.includes(RECEIPT_DIVIDER)) {
    const parts = mensajeCompleto.split(RECEIPT_DIVIDER);
    const inicio = parts[0]?.trim() || defaultInicio;
    const resto = parts.slice(1).join(RECEIPT_DIVIDER);

    let fin = '';
    if (resto.includes('{campos_adicionales}')) {
      fin = resto.substring(resto.indexOf('{campos_adicionales}') + '{campos_adicionales}'.length).trim();
    } else if (resto.includes('{destino}')) {
      fin = resto.substring(resto.indexOf('{destino}') + '{destino}'.length).trim();
    }
    return { inicio, fin: fin || defaultFin };
  }

  return { inicio: mensajeCompleto.trim(), fin: defaultFin };
};

export const SALUDO_SUGERENCIAS = (nombre: string) => [
  {
    label: 'Saludo cordial',
    text: `✨ *COMPROBANTE DE ENVÍO - ${(nombre || 'AGENCIA').toUpperCase()}* 📦\n¡Hola {cliente}! Tu pedido fue registrado exitosamente.`,
  },
  {
    label: 'Comprobante oficial',
    text: `📦 *COMPROBANTE OFICIAL DE ENTREGA* 🚚\n¡Estimada clienta! Aquí tienes los datos de tu envío:`,
  },
  {
    label: 'Corto y simple',
    text: `¡Hola {cliente}! 💖 Tu pedido {orden} ya está registrado.`,
  },
];

export const DESPEDIDA_SUGERENCIAS = [
  { label: 'Recordar DNI', text: `¡Muchas gracias por tu compra! Recuerda acudir con tu DNI físico para recoger tu paquete. 💖✨🙏` },
  { label: 'Agradecimiento', text: `¡Gracias por tu preferencia! Estaremos atentos a cualquier consulta por este chat. ¡Que tengas un excelente día! 🌸✨` },
  { label: 'Aviso de seguimiento', text: `Te avisaremos por aquí cuando tu paquete esté en camino. 🚚💨` },
];

// Variables que el sistema reemplaza solas al enviar el mensaje (ver whatsappService)
export const VARIABLES_MENSAJE = [
  { token: '{cliente}', label: 'Nombre de la clienta', ejemplo: 'María Quispe' },
  { token: '{orden}', label: 'Código del pedido', ejemplo: '#ENC4821' },
  { token: '{fecha}', label: 'Fecha de envío', ejemplo: 'Miércoles, 14 Oct 2026' },
  { token: '{destino}', label: 'Destino', ejemplo: 'Agencia Arequipa Cercado' },
];

// ---------------------------------------------------------------------------
// Borrador editable de una agencia (todo el editor trabaja sobre este objeto)
// ---------------------------------------------------------------------------
// Solo hay 2 diseños: a color (clásico) y blanco y negro (ahorra tinta)
export type EstiloRotulo = 'estandar_oficial' | 'eco_ink_saving';

export interface RotuloDraft {
  orientacion: 'horizontal' | 'vertical';
  estilo: EstiloRotulo;
  mostrar_logo_empresa: boolean;
  mostrar_logo_agencia: boolean;
  subtitulo_cabecera: string;
  mostrar_barcode: boolean;
  mostrar_tracking: boolean;
  mostrar_destino: boolean;
  titulo_destino: string;
  incluir_destinatario: boolean;
  titulo_destinatario: string;
  mostrar_badge_modalidad: boolean;
  texto_badge_modalidad: string;
  mostrar_cliente_nombre: boolean;
  titulo_cliente_nombre: string;
  mostrar_cliente_dni: boolean;
  titulo_cliente_dni: string;
  tamano_dni: 'normal' | 'grande' | 'gigante';
  mostrar_cliente_telefono: boolean;
  titulo_cliente_telefono: string;
  incluir_remitente: boolean;
  titulo_remitente: string;
  mostrar_remitente_nombre: boolean;
  mostrar_remitente_ruc_dni: boolean;
  mostrar_remitente_telefono: boolean;
  mostrar_remitente_origen: boolean;
  usar_remitente_personalizado: boolean;
  rem_nombre: string;
  rem_ruc_dni: string;
  rem_celular: string;
  rem_direccion: string;
  rem_observaciones: string;
  etiquetas_campos: Record<string, string>;
  bloques: BloqueRotuladoPersonalizado[];
  mostrar_fecha_sello: boolean;
  texto_sello_personalizado: string;
}

export interface AgencyDraft {
  nombre: string;
  descripcion: string;
  icono: string;
  foto_url: string;
  color: string;
  campos: CampoPersonalizadoAgencia[];
  mensajeInicio: string;
  mensajeFin: string;
  modoHorario: 'predeterminado' | 'personalizado';
  dias: DiaSemana[]; // [] = todos los días
  modalidadHorario: 'uno_para_todos' | 'individual_por_dia';
  horarioGlobal: HorarioDia;
  horariosPorDia: Partial<Record<DiaSemana, HorarioDia>>;
  mensajesPorDia: Partial<Record<DiaSemana, string>>;
  ocultarSiNoDisponible: boolean;
  restringirFecha: boolean;
  mensajeDisponibilidad: string;
  rotulo: RotuloDraft;
}

export const defaultColorFor = (codigo?: string) =>
  codigo === 'shalom' ? '#ef4444' : codigo === 'motorizado' ? '#3b82f6' : codigo === 'olva' ? '#f59e0b' : '#06b6d4';

export const draftFromMethod = (m: MetodoEnvio, taller: TallerConfig): AgencyDraft => {
  const parsed = parsearMensajeComprobante(m.mensaje_comprobacion, m.nombre);
  const disp = m.disponibilidad;
  const cfg = m.config_rotulado;
  const rem = cfg?.remitente_personalizado;

  return {
    nombre: m.nombre,
    descripcion: m.descripcion || '',
    icono: m.icono || 'Truck',
    foto_url: m.foto_url || '',
    color: m.color_borde || defaultColorFor(m.codigo),
    campos: m.campos_personalizados ? m.campos_personalizados.map(c => ({ ...c })) : [],
    mensajeInicio: m.mensaje_inicio_comprobante?.trim() || parsed.inicio,
    mensajeFin: m.mensaje_fin_comprobante?.trim() || parsed.fin,
    modoHorario: disp?.modo_horario || (disp?.dias_semana && disp.dias_semana.length > 0 ? 'personalizado' : 'predeterminado'),
    dias: disp?.dias_semana || [],
    modalidadHorario: disp?.modalidad_horario || 'uno_para_todos',
    horarioGlobal: disp?.horario_global || { es_24_horas: true, hora_inicio: '08:30', hora_fin: '18:30' },
    horariosPorDia: disp?.horarios_por_dia || {},
    mensajesPorDia: disp?.mensajes_por_dia || {},
    ocultarSiNoDisponible: Boolean(disp?.ocultar_si_no_disponible),
    restringirFecha: disp?.restringir_fecha_envio !== false,
    mensajeDisponibilidad: disp?.mensaje_disponibilidad || '',
    rotulo: {
      orientacion: 'vertical', // el rótulo siempre se imprime parado
      // Por defecto blanco y negro; solo es a color si la agencia lo eligió
      estilo: cfg?.estilo_rotulo && cfg.estilo_rotulo !== 'eco_ink_saving' ? 'estandar_oficial' : 'eco_ink_saving',
      mostrar_logo_empresa: cfg?.mostrar_logo_empresa !== false,
      mostrar_logo_agencia: cfg?.mostrar_logo_agencia !== false,
      subtitulo_cabecera: cfg?.subtitulo_cabecera || '',
      mostrar_barcode: cfg?.mostrar_barcode !== false,
      mostrar_tracking: cfg?.mostrar_tracking !== false,
      mostrar_destino: cfg?.mostrar_destino !== false,
      titulo_destino: cfg?.titulo_destino || '',
      incluir_destinatario: true,
      titulo_destinatario: cfg?.titulo_destinatario || '',
      mostrar_badge_modalidad: cfg?.mostrar_badge_modalidad !== false,
      texto_badge_modalidad: cfg?.texto_badge_modalidad || '',
      mostrar_cliente_nombre: cfg?.mostrar_cliente_nombre !== false,
      titulo_cliente_nombre: cfg?.titulo_cliente_nombre || '',
      mostrar_cliente_dni: cfg?.mostrar_cliente_dni !== false,
      titulo_cliente_dni: cfg?.titulo_cliente_dni || '',
      tamano_dni: cfg?.tamano_dni || 'gigante',
      mostrar_cliente_telefono: cfg?.mostrar_cliente_telefono !== false,
      titulo_cliente_telefono: cfg?.titulo_cliente_telefono || '',
      incluir_remitente: cfg?.incluir_remitente === true,
      titulo_remitente: cfg?.titulo_remitente || '',
      // El remitente se pone solo si se prende al menos uno de sus datos
      mostrar_remitente_nombre: cfg?.incluir_remitente === true && cfg?.mostrar_remitente_nombre !== false,
      mostrar_remitente_ruc_dni: cfg?.incluir_remitente === true && cfg?.mostrar_remitente_ruc_dni !== false,
      mostrar_remitente_telefono: cfg?.incluir_remitente === true && cfg?.mostrar_remitente_telefono !== false,
      mostrar_remitente_origen: cfg?.incluir_remitente === true && cfg?.mostrar_remitente_origen !== false,
      usar_remitente_personalizado: Boolean(rem?.usar_personalizado),
      rem_nombre: rem?.nombre || taller.remitente_default?.nombre || taller.nombre_taller || '',
      rem_ruc_dni: rem?.ruc_dni || taller.remitente_default?.ruc_dni || taller.remitente_dni || taller.ruc_dni || '',
      rem_celular: rem?.celular || taller.remitente_default?.celular || taller.remitente_celular || taller.celular_taller || '',
      rem_direccion: rem?.direccion || taller.remitente_default?.direccion || taller.direccion_taller || '',
      rem_observaciones: rem?.observaciones || '',
      etiquetas_campos: { ...(cfg?.etiquetas_campos || {}) },
      bloques: (cfg?.bloques_personalizados || []).map(b => ({ ...b })),
      mostrar_fecha_sello: cfg?.mostrar_fecha_sello !== false,
      texto_sello_personalizado: cfg?.texto_sello_personalizado || '',
    },
  };
};

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

const disponibilidadFromDraft = (d: AgencyDraft) => ({
  modo_horario: d.modoHorario,
  dias_semana: d.modoHorario === 'personalizado' ? (d.dias.length > 0 ? d.dias : undefined) : undefined,
  modalidad_horario: d.modalidadHorario,
  horario_global: d.horarioGlobal,
  horarios_por_dia: d.modalidadHorario === 'individual_por_dia' ? d.horariosPorDia : undefined,
  mensajes_por_dia: d.modoHorario === 'personalizado' ? d.mensajesPorDia : undefined,
  ocultar_si_no_disponible: d.ocultarSiNoDisponible,
  restringir_fecha_envio: d.restringirFecha,
  mensaje_disponibilidad: opt(d.mensajeDisponibilidad),
});

const rotuloFromDraft = (d: AgencyDraft) => {
  const r = d.rotulo;
  return {
    orientacion: 'vertical' as const,
    estilo_rotulo: r.estilo,
    mostrar_logo_empresa: r.mostrar_logo_empresa,
    mostrar_logo_agencia: r.mostrar_logo_agencia,
    subtitulo_cabecera: opt(r.subtitulo_cabecera),
    mostrar_barcode: r.mostrar_barcode,
    mostrar_tracking: r.mostrar_tracking,
    mostrar_destino: r.mostrar_destino,
    titulo_destino: opt(r.titulo_destino),
    incluir_destinatario: r.incluir_destinatario,
    titulo_destinatario: opt(r.titulo_destinatario),
    mostrar_badge_modalidad: r.mostrar_badge_modalidad,
    texto_badge_modalidad: opt(r.texto_badge_modalidad),
    mostrar_cliente_nombre: r.mostrar_cliente_nombre,
    titulo_cliente_nombre: opt(r.titulo_cliente_nombre),
    mostrar_cliente_dni: r.mostrar_cliente_dni,
    titulo_cliente_dni: opt(r.titulo_cliente_dni),
    tamano_dni: r.tamano_dni,
    mostrar_cliente_telefono: r.mostrar_cliente_telefono,
    titulo_cliente_telefono: opt(r.titulo_cliente_telefono),
    incluir_campos_personalizados: true,
    campos_visibles: d.campos.filter(c => c.mostrar_en_rotulado).map(c => c.id),
    etiquetas_campos: r.etiquetas_campos,
    bloques_personalizados: r.bloques,
    incluir_remitente: r.mostrar_remitente_nombre || r.mostrar_remitente_ruc_dni || r.mostrar_remitente_telefono || r.mostrar_remitente_origen,
    titulo_remitente: opt(r.titulo_remitente),
    mostrar_remitente_nombre: r.mostrar_remitente_nombre,
    mostrar_remitente_ruc_dni: r.mostrar_remitente_ruc_dni,
    mostrar_remitente_telefono: r.mostrar_remitente_telefono,
    mostrar_remitente_origen: r.mostrar_remitente_origen,
    remitente_personalizado: {
      usar_personalizado: r.usar_remitente_personalizado,
      nombre: opt(r.rem_nombre),
      ruc_dni: opt(r.rem_ruc_dni),
      celular: opt(r.rem_celular),
      direccion: opt(r.rem_direccion),
      observaciones: opt(r.rem_observaciones),
    },
    mostrar_fecha_sello: r.mostrar_fecha_sello,
    texto_sello_personalizado: opt(r.texto_sello_personalizado),
  };
};

// Cambios a guardar. Se fusiona con lo existente para no perder opciones que el editor no muestra.
export const buildMethodUpdates = (d: AgencyDraft, base: MetodoEnvio): Partial<MetodoEnvio> => {
  const nombre = d.nombre.trim() || base.nombre;
  return {
    nombre,
    descripcion: d.descripcion.trim(),
    icono: d.icono,
    foto_url: d.foto_url.trim() || undefined,
    color_borde: d.color,
    campos_personalizados: d.campos,
    mensaje_comprobacion: construirMensajeComprobacion(d.mensajeInicio, d.mensajeFin, nombre),
    mensaje_inicio_comprobante: opt(d.mensajeInicio),
    mensaje_fin_comprobante: opt(d.mensajeFin),
    disponibilidad: { ...(base.disponibilidad || {}), ...disponibilidadFromDraft(d) },
    config_rotulado: { ...(base.config_rotulado || {}), ...rotuloFromDraft(d) },
  };
};

// Agencia "en vivo" para las vistas previas mientras se edita
export const buildLiveMethod = (d: AgencyDraft, base: MetodoEnvio): MetodoEnvio => ({
  ...base,
  ...buildMethodUpdates(d, base),
  nombre: d.nombre || base.nombre || 'Agencia',
  activo: true,
});

export const newAgencyMethod = (nombre: string, foto_url: string, color: string, orden: number): Omit<MetodoEnvio, 'id'> => {
  const stamp = Date.now().toString(36);
  return {
    codigo: 'agencia_' + stamp,
    nombre,
    descripcion: 'Servicio de entrega y despacho',
    icono: 'Truck',
    foto_url: foto_url || undefined,
    tipo_formulario: 'personalizado',
    color_borde: color,
    activo: true,
    orden,
    es_sistema: false,
    campos_personalizados: [
      { id: 'c-nom-' + stamp, label: 'Nombres y Apellidos de quien recibe', placeholder: 'Ej: María Ramos', tipo: 'texto', requerido: true, mostrar_en_rotulado: true, mostrar_en_comprobante: true, sistema: false },
      { id: 'c-tel-' + stamp, label: 'Teléfono de contacto / WhatsApp', placeholder: '9 dígitos', tipo: 'telefono', requerido: true, mostrar_en_rotulado: true, mostrar_en_comprobante: true, sistema: false },
      { id: 'c-dir-' + stamp, label: 'Dirección o Agencia de Destino', placeholder: 'Indica la sede o dirección', tipo: 'texto', requerido: true, mostrar_en_rotulado: true, mostrar_en_comprobante: true, sistema: false },
    ],
    mensaje_comprobacion: construirMensajeComprobacion(DEFAULT_INICIO_RECEIPT(nombre), DEFAULT_FIN_RECEIPT(), nombre),
    mensaje_inicio_comprobante: DEFAULT_INICIO_RECEIPT(nombre),
    mensaje_fin_comprobante: DEFAULT_FIN_RECEIPT(),
    config_rotulado: {
      incluir_campos_personalizados: true,
      campos_visibles: [],
      orientacion: 'vertical',
      estilo_rotulo: 'eco_ink_saving',
      incluir_remitente: false,
      mostrar_remitente_nombre: true,
      mostrar_remitente_ruc_dni: true,
      mostrar_remitente_telefono: true,
      mostrar_remitente_origen: true,
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

// ---------------------------------------------------------------------------
// Atajos del rótulo
// ---------------------------------------------------------------------------
export type RotuloPreset = 'completo' | 'solo_destinatario';

export const ROTULO_PRESETS: { id: RotuloPreset; emoji: string; title: string; desc: string; sale: string[]; noSale: string[]; recomendado?: boolean }[] = [
  {
    id: 'solo_destinatario',
    emoji: '👤',
    title: 'Solo los datos de tu clienta',
    desc: 'Lo más usado. La agencia ve a quién entregar y a dónde. Tus datos NO se imprimen.',
    sale: ['Nombre, DNI y celular de tu clienta', 'A dónde va el paquete', 'Código de barras'],
    noSale: ['Tus datos (remitente)'],
    recomendado: true,
  },
  {
    id: 'completo',
    emoji: '📦',
    title: 'Completo',
    desc: 'Todo lo de tu clienta y además TUS datos, por si la agencia necesita llamarte o devolverte el paquete.',
    sale: ['Todo lo de tu clienta', 'Tus datos: nombre, DNI/RUC, celular y dirección', 'Código de barras y número del pedido'],
    noSale: [],
  },
];

export const applyRotuloPreset = (r: RotuloDraft, preset: RotuloPreset): RotuloDraft => {
  if (preset === 'completo') {
    return {
      ...r,
      incluir_remitente: true,
      mostrar_remitente_nombre: true,
      mostrar_remitente_ruc_dni: true,
      mostrar_remitente_telefono: true,
      mostrar_remitente_origen: true,
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: true,
      mostrar_destino: true,
      mostrar_barcode: true,
      mostrar_tracking: true,
      tamano_dni: 'gigante',
    };
  }
  if (preset === 'solo_destinatario') {
    return {
      ...r,
      incluir_remitente: false,
      mostrar_remitente_nombre: false,
      mostrar_remitente_ruc_dni: false,
      mostrar_remitente_telefono: false,
      mostrar_remitente_origen: false,
      incluir_destinatario: true,
      mostrar_cliente_nombre: true,
      mostrar_cliente_dni: true,
      mostrar_cliente_telefono: true,
      mostrar_destino: true,
      mostrar_barcode: true,
      tamano_dni: 'gigante',
    };
  }
  return r;
};

export const AVISO_PLANTILLAS: { emoji: string; label: string; bloque: Omit<BloqueRotuladoPersonalizado, 'id'> }[] = [
  { emoji: '💰', label: 'Flete en destino', bloque: { titulo: '💰 FLETE PAGO DESTINO', contenido: 'La clienta paga el envío al recoger.', tipo: 'flete', posicion: 'medio' } },
  { emoji: '⭐', label: 'Prioritario', bloque: { titulo: '⭐ ENVÍO PRIORITARIO', contenido: 'Despachar con prioridad.', tipo: 'destacado', posicion: 'arriba' } },
  { emoji: '↕️', label: 'No voltear', bloque: { titulo: '↕️ ESTE LADO ARRIBA', contenido: 'No voltear la caja.', tipo: 'aviso', posicion: 'abajo' } },
];

export const BLOQUE_TIPOS: { id: BloqueRotuladoPersonalizado['tipo']; label: string; swatch: string }[] = [
  { id: 'aviso', label: 'Amarillo (importante)', swatch: 'bg-amber-400' },
  { id: 'flete', label: 'Rojo (pago / flete)', swatch: 'bg-rose-500' },
  { id: 'destacado', label: 'Morado (prioridad)', swatch: 'bg-purple-500' },
  { id: 'nota', label: 'Gris (nota simple)', swatch: 'bg-slate-400' },
];

// ---------------------------------------------------------------------------
// Pedido de ejemplo para la vista previa del rótulo
// ---------------------------------------------------------------------------
export const buildMockPedido = (d: AgencyDraft, base: MetodoEnvio): Pedido => {
  const isEchado = false; // el rótulo siempre es parado
  return {
    id: 'ped-live-demo',
    codigo_seguimiento: isEchado ? 'BYT-2026-5328' : 'ENCOMI-9428',
    usuario_id: 'usr-demo',
    usuario: {
      id: 'usr-demo',
      dni: isEchado ? '986 669 388' : '72384910',
      nombre_completo: isEchado ? 'SILVANA VILLAVICENCIO' : 'MARÍA FERNANDA QUISPE RAMOS',
      email_default: 'cliente@ejemplo.com',
      telefono_default: isEchado ? '986669388' : '987654321',
      password_hash: '',
      rol: 'client',
      avatar_url: '',
      puntos_xp: 0,
      nivel: 1,
      created_at: new Date().toISOString(),
    },
    detalles_bordado: 'Paquete de muestra para verificación de rotulado',
    metodo_envio_codigo: base.codigo,
    metodo_envio_nombre: d.nombre || base.nombre,
    destino_detalle: isEchado
      ? 'Lima (Cercado) • Calle Angel Valenzuela 693 seccion 1, Lima (Ref: Interseccion av alborada con av bertello)'
      : base.codigo === 'shalom'
      ? 'AGENCIA SHALOM - AV. MÉXICO 120, LA VICTORIA, LIMA'
      : base.codigo === 'olva'
      ? 'SEDE OLVA COURIER - AV. LARCO 345, MIRAFLORES, LIMA'
      : 'AV. PRINCIPAL 456, INT. 201, SAN ISIDRO, LIMA',
    estado_produccion: 'completado',
    estado_envio: 'pendiente',
    campos_personalizados: d.campos.reduce((acc, c) => {
      const lbl = c.label.toLowerCase();
      if (c.id.includes('dni') || lbl.includes('dni')) acc[c.id] = isEchado ? '986 669 388' : '72384910';
      else if (c.id.includes('tel') || lbl.includes('tel')) acc[c.id] = isEchado ? '986669388' : '987654321';
      else if (c.id.includes('dir') || lbl.includes('dir')) acc[c.id] = 'Calle Angel Valenzuela 693';
      else acc[c.id] = c.placeholder || 'Dato de prueba';
      return acc;
    }, {} as Record<string, string>),
    created_at: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Logos y colores
// ---------------------------------------------------------------------------
export const LOGO_PRESETS = [
  { label: 'Shalom', url: '/Shalom-Courier-Logo.webp' },
  { label: 'Olva Courier', url: '/Olva-Courier-Logo.svg' },
  { label: 'Motorizado', url: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
  { label: 'Encomi', url: 'https://cdn-icons-png.flaticon.com/512/7542/7542670.png' },
  { label: 'Transportes Flores', url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=120&auto=format&fit=crop&q=60' },
  { label: 'Marvisur', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=120&auto=format&fit=crop&q=60' },
  { label: 'Carhua', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=120&auto=format&fit=crop&q=60' },
];

export const COLOR_PRESETS = [
  { name: 'Rojo', hex: '#ef4444' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Amarillo', hex: '#f59e0b' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Celeste', hex: '#06b6d4' },
  { name: 'Morado', hex: '#a855f7' },
  { name: 'Rosado', hex: '#ec4899' },
  { name: 'Naranja', hex: '#f97316' },
];

export const CAMPO_PLANTILLAS: { emoji: string; label: string; tipo: CampoPersonalizadoAgencia['tipo']; placeholder: string }[] = [
  { emoji: '🎵', label: 'Usuario de TikTok', tipo: 'texto', placeholder: 'Ej: @maria.tiendita' },
  { emoji: '🎨', label: 'Color de la prenda', tipo: 'texto', placeholder: 'Ej: Rosado' },
  { emoji: '📏', label: 'Talla', tipo: 'texto', placeholder: 'Ej: M' },
  { emoji: '🧭', label: 'Referencia de la dirección', tipo: 'textarea', placeholder: 'Ej: Frente al parque' },
  { emoji: '✉️', label: 'Correo electrónico', tipo: 'texto', placeholder: 'Ej: maria@gmail.com' },
];

export const CAMPO_TIPOS: { id: CampoPersonalizadoAgencia['tipo']; emoji: string; title: string; desc: string }[] = [
  { id: 'texto', emoji: '🔤', title: 'Texto corto', desc: 'Una palabra o frase' },
  { id: 'numero', emoji: '🔢', title: 'Número', desc: 'DNI, cantidad, código' },
  { id: 'telefono', emoji: '📱', title: 'Celular', desc: 'Número de 9 dígitos' },
  { id: 'textarea', emoji: '📝', title: 'Texto largo', desc: 'Referencia o detalle' },
];

// Props comunes de cada paso del editor
export interface StepProps {
  draft: AgencyDraft;
  update: (patch: Partial<AgencyDraft>) => void;
  updateRotulo: (patch: Partial<RotuloDraft>) => void;
  base: MetodoEnvio;
  taller: TallerConfig;
  accent: string; // color del paso actual
  openPreview: () => void; // abre la vista previa (útil en celular)
  highlight: (key: string) => void; // resalta algo en la vista previa (ej. "campo:<id>")
}
