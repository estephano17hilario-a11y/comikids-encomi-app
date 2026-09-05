import { Pedido } from '../types/database.types';

// Número fijo oficial de recepción
export const NUMERO_WHATSAPP_RECEPTOR = "51927781412";

export interface DatosComprobante {
  destinatario: string;
  telefonoCliente: string;
  documentoRecojo: string;
  correoCliente?: string;
  tipoEnvio: string;
  modalidadOlva?: 'agencia' | 'domicilio';
  destinoDetalle: string;
  codigoSeguimiento?: string;
  fechaDeseadaEnvio?: string;
  referencia?: string;
  montoTotal?: string | number;
  coordenadasMapsUrl?: string;
  remitenteNombre?: string;
  remitenteDni?: string;
  remitenteEmail?: string;
  remitenteCelular?: string;
  camposPersonalizados?: Record<string, any>;
  plantillaMensajeAgencia?: string;
}

// URL oficial del Funnel Interactivo Encomi
export const ENCOMI_FUNNEL_URL = "https://comikids-encomi-app.vercel.app/?funnel=encomi";
export const NUMERO_CONTACTO_ENCOMI = "+51 963097546";

/**
 * Detecta si el entorno actual es un dispositivo móvil (Android / iOS / etc.)
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Helper para obtener el día de la semana y fecha formateada en español
export const formatFechaConDia = (dateStr?: string): string => {
  if (!dateStr) return 'Programación estándar';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
      const diaSemana = dias[date.getDay()];
      const mesNombre = meses[date.getMonth()];
      return `${diaSemana}, ${day} ${mesNombre} ${year}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
};

/**
 * Helper inteligente para determinar si un campo personalizado es redundante o interno del sistema
 * para evitar duplicar información que ya aparece en la cabecera oficial del comprobante (DNI, Teléfono, Nombre, etc.)
 */
export const isIgnoredOrRedundantCustomField = (rawKey: string, val: any, datos: DatosComprobante): boolean => {
  if (!rawKey || val === undefined || val === null) return true;
  const strVal = String(val).trim();
  if (!strVal || strVal.toLowerCase() === 'undefined' || strVal.toLowerCase() === 'null') return true;

  const cleanKey = rawKey.trim().toLowerCase();

  // 1. Claves internas del sistema (c-shalom-dni, c-olva-dni, c-olva-dir, etc.)
  if (cleanKey.startsWith('c-') || cleanKey.startsWith('sys_') || cleanKey.startsWith('_') || cleanKey.startsWith('custom_')) {
    return true;
  }

  // 2. Normalización de nombre de campo (sin tildes, sin signos ni espacios)
  const normKey = cleanKey
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const redundantStandardKeys = new Set([
    'dni', 'ce', 'dnice', 'documento', 'doc', 'numdoc', 'numerodocumento', 'carnet', 'carnetdeextranjeria',
    'nombre', 'nombres', 'apellidos', 'nombrecompleto', 'nombresyapellidos', 'cliente', 'destinatario',
    'telefono', 'tel', 'celular', 'whatsapp', 'cel', 'celularwhatsapp', 'telefonowhatsapp',
    'correo', 'email', 'correoelectronico',
    'direccion', 'direccolva', 'direccionexacta', 'distrito', 'destino', 'agencia',
    'referencia', 'ref',
    'modalidad', 'metodo', 'metododeenvio', 'tipoenvio',
    'orden', 'codigo', 'codigodeseguimiento', 'tracking',
    'fecha', 'fechadeenvio', 'fechadeseada'
  ]);

  if (redundantStandardKeys.has(normKey)) return true;

  // 3. Comparación de valor contra datos estándar principales para evitar duplicados idénticos
  const docStd = (datos.documentoRecojo || '').trim();
  const phoneStd = (datos.telefonoCliente || '').replace(/\D/g, '');
  const valPhoneDigits = strVal.replace(/\D/g, '');
  const nameStd = (datos.destinatario || '').trim().toLowerCase();

  if (docStd && strVal === docStd) return true;
  if (phoneStd && valPhoneDigits.length >= 8 && (phoneStd.includes(valPhoneDigits) || valPhoneDigits.includes(phoneStd))) return true;
  if (nameStd && strVal.toLowerCase() === nameStd) return true;

  return false;
};

/**
 * Genera el texto formateado del Comprobante de Envío Oficial
 * Permite plantillas personalizadas por agencia (sin el bloque Encomi en edición, pero siempre presente en el mensaje final).
 */
export const buildWhatsAppComprobanteMessage = (datos: DatosComprobante): string => {
  const nombre = (datos.destinatario || "Cliente").trim();
  const telefono = (datos.telefonoCliente || "").replace(/\D/g, '') || "No especificado";
  const documento = (datos.documentoRecojo || "").trim() || "No especificado";
  const metodo = (datos.tipoEnvio || "Envío").trim();
  const destino = (datos.destinoDetalle || "Agencia Shalom").trim();
  const codigo = datos.codigoSeguimiento || "Vigente";
  const fechaFormateada = formatFechaConDia(datos.fechaDeseadaEnvio);

  const currentOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://comikids-encomi-app.vercel.app';
  const funnelShortUrl = `${currentOrigin}/encomi`;

  const lineaRef = datos.referencia ? `🏷️ *Ref:* ${datos.referencia.trim()}\n` : "";
  const lineaMaps = datos.coordenadasMapsUrl ? `🗺️ *Ubicación GPS:*\n${datos.coordenadasMapsUrl}\n` : "";
  const lineaCorreo = datos.correoCliente ? `📧 *Correo:* ${datos.correoCliente.trim()}\n` : "";

  // Campos adicionales dinámicos configurados para la agencia (filtrando cualquier clave técnica o duplicada)
  let lineasCamposExtra = '';
  if (datos.camposPersonalizados && Object.keys(datos.camposPersonalizados).length > 0) {
    const validExtra = Object.entries(datos.camposPersonalizados)
      .filter(([k, v]) => !isIgnoredOrRedundantCustomField(k, v, datos));

    if (validExtra.length > 0) {
      lineasCamposExtra = validExtra
        .map(([k, v]) => `📌 *${k}:* ${String(v).trim()}`)
        .join('\n') + '\n';
    }
  }

  const bloqueEncomi = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n¿Buscas que tu negocio sea 10x más rápido al entregar pedidos? Entonces buscas a Encomi 🚀\n👉 ${funnelShortUrl}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n¡Muchas gracias por tu preferencia! 💖✨🙏`;

  // Si la agencia tiene una plantilla personalizada configurada (sin el bloque Encomi):
  if (datos.plantillaMensajeAgencia && datos.plantillaMensajeAgencia.trim().length > 10) {
    let customBody = datos.plantillaMensajeAgencia
      .replace(/{cliente}/gi, nombre)
      .replace(/{nombre}/gi, nombre)
      .replace(/{telefono}/gi, `+51 ${telefono}`)
      .replace(/{celular}/gi, `+51 ${telefono}`)
      .replace(/{dni}/gi, documento)
      .replace(/{documento}/gi, documento)
      .replace(/{modalidad}/gi, metodo)
      .replace(/{metodo}/gi, metodo)
      .replace(/{destino}/gi, destino)
      .replace(/{orden}/gi, `#${codigo}`)
      .replace(/{codigo}/gi, codigo)
      .replace(/{fecha}/gi, fechaFormateada)
      .replace(/{correo}/gi, datos.correoCliente || '')
      .replace(/{referencia}/gi, datos.referencia || '')
      .replace(/{campos_adicionales}/gi, lineasCamposExtra.trim());

    // Reemplazo automático de variables de campos personalizados dinámicos: {Nombre del campo}
    const camposYaInsertados = new Set<string>();
    if (datos.camposPersonalizados) {
      Object.entries(datos.camposPersonalizados).forEach(([rawKey, val]) => {
        const strVal = val !== undefined && val !== null ? String(val).trim() : '';
        const escapedKey = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tokenRegex = new RegExp(`\\{${escapedKey}\\}`, 'gi');
        if (tokenRegex.test(customBody)) {
          customBody = customBody.replace(tokenRegex, strVal);
          camposYaInsertados.add(rawKey);
        }
      });
    }

    // Si hay campos válidos que el usuario no colocó manualmente en el texto con llaves, se agregan limpiamente
    let camposFaltantesTexto = '';
    if (datos.camposPersonalizados) {
      const faltantes = Object.entries(datos.camposPersonalizados)
        .filter(([k, v]) => !camposYaInsertados.has(k) && !isIgnoredOrRedundantCustomField(k, v, datos));
      if (faltantes.length > 0 && !datos.plantillaMensajeAgencia.includes('{campos_adicionales}')) {
        camposFaltantesTexto = '\n' + faltantes.map(([k, v]) => `📌 *${k}:* ${String(v).trim()}`).join('\n');
      }
    }

    return `${customBody.trim()}${camposFaltantesTexto}\n\n${bloqueEncomi}`;
  }

  // Plantilla estándar oficial
  return `✨ *COMPROBANTE OFICIAL DE ENVÍO* 📦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Orden:* #${codigo}
👤 *Cliente:* ${nombre}
🪪 *DNI / Doc:* ${documento}
📱 *WhatsApp:* +51 ${telefono}
${lineaCorreo}🚚 *Modalidad:* ${metodo}
📅 *Fecha de Envío:* ${fechaFormateada}

📍 *Agencia / Destino Oficial:*
${destino}
${lineaRef}${lineaMaps}${lineasCamposExtra}${bloqueEncomi}`;
};

/**
 * Genera la URL para abrir WhatsApp con el comprobante pre-cargado en la casilla de texto.
 * Si preferNative es true o está en móvil, devuelve el esquema nativo `whatsapp://send?phone=...&text=...`
 */
export const buildWhatsAppComprobanteUrl = (datos: DatosComprobante, preferNative: boolean = false): string => {
  const message = buildWhatsAppComprobanteMessage(datos);
  const textoCodificado = encodeURIComponent(message);
  
  if (preferNative || (typeof window !== 'undefined' && isMobileDevice())) {
    return `whatsapp://send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${textoCodificado}`;
  }
  return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${textoCodificado}`;
};

export const buildWhatsAppNativeUrl = (datos: DatosComprobante): string => {
  const message = buildWhatsAppComprobanteMessage(datos);
  return `whatsapp://send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${encodeURIComponent(message)}`;
};

export const buildWhatsAppWebUrl = (datos: DatosComprobante): string => {
  const message = buildWhatsAppComprobanteMessage(datos);
  return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${encodeURIComponent(message)}`;
};

/**
 * Abre la app de WhatsApp de forma nativa e inmediata con el comprobante en la casilla de texto.
 */
export const enviarComprobanteAWhatsapp = (datos: DatosComprobante): string => {
  const message = buildWhatsAppComprobanteMessage(datos);
  openWhatsAppChat(NUMERO_WHATSAPP_RECEPTOR, message);
  return buildWhatsAppComprobanteUrl(datos);
};

/**
 * Abre cualquier chat de WhatsApp enviando directamente a la app nativa en móviles
 * o a WhatsApp Web / API en navegadores de escritorio.
 */
export const openWhatsAppChat = (phone: string, text?: string): void => {
  if (typeof window === 'undefined') return;

  const cleanPhone = (phone || NUMERO_WHATSAPP_RECEPTOR).replace(/\D/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  const textParam = encodedText ? `&text=${encodedText}` : '';
  
  const nativeUrl = `whatsapp://send?phone=${cleanPhone}${textParam}`;
  const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}${textParam}`;

  if (isMobileDevice()) {
    // En móviles: Invocación directa del Intent nativo de la app de WhatsApp
    window.location.href = nativeUrl;
    
    // Fallback suave en caso de que no tenga la app instalada
    setTimeout(() => {
      if (document.hasFocus()) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 1400);
  } else {
    // En PC / Desktop: Abrir WhatsApp Web
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
};

export function getWhatsAppBusinessChatUrl(text?: string): string {
  if (!text) {
    return isMobileDevice() 
      ? `whatsapp://send?phone=${NUMERO_WHATSAPP_RECEPTOR}` 
      : `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}`;
  }
  const encoded = encodeURIComponent(text);
  return isMobileDevice()
    ? `whatsapp://send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${encoded}`
    : `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${encoded}`;
}

export function getWhatsAppEditOrderUrl(pedido: Pedido): string {
  const clientName = pedido.usuario?.nombre_completo || 'Cliente Encomi';
  const text = `¡Hola Encomi Envíos! 📦\nSoy *${clientName}*, deseo consultar sobre mi despacho *#${pedido.codigo_seguimiento}*.\n\n*Destino:* ${pedido.destino_detalle}\n\n¿Cuál es el estado de mi envío? ✨`;
  return getWhatsAppBusinessChatUrl(text);
}

export function getWhatsAppNotifyClientUrl(pedido: Pedido): string {
  const clientName = pedido.usuario?.nombre_completo || 'Cliente';
  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
  const text = `¡Hola ${clientName}! ✨ Te saluda *Encomi Envíos*.\n\nTu pedido *#${pedido.codigo_seguimiento}* ha sido rotulado para entrega por *${isShalom ? 'Agencia Shalom' : 'Motorizado Local'} (${pedido.destino_detalle})*.\n\n📦 *Destinatario:* ${clientName}\n\nTe adjuntaremos tu comprobante y foto en breve. ¡Muchas gracias por tu preferencia! ✨`;
  return getWhatsAppBusinessChatUrl(text);
}

// Número oficial de contacto directo Encomi para afiliaciones y alianzas
export const NUMERO_WHATSAPP_ENCOMI_DIRECTO = "51963097546";

export function getJoinEncomiWhatsAppUrl(): string {
  const text = "¡Hola! 👋 Vi la plataforma al registrar mi envío y deseo más información sobre Encomi Envíos para enviar 10 veces más rápido en mi negocio 🚀📦";
  const encoded = encodeURIComponent(text);
  return isMobileDevice()
    ? `whatsapp://send?phone=${NUMERO_WHATSAPP_ENCOMI_DIRECTO}&text=${encoded}`
    : `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_ENCOMI_DIRECTO}&text=${encoded}`;
}

export interface StatusNotifyParams {
  phone: string;
  clientName: string;
  orderCode: string;
  destination: string;
  statusName: string;
}

export function buildWhatsAppStatusNotifyUrl(params: StatusNotifyParams): string {
  const cleanPhone = (params.phone || '').replace(/\D/g, '');
  const targetPhone = cleanPhone ? (cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`) : NUMERO_WHATSAPP_RECEPTOR;
  const name = params.clientName || 'Cliente';
  const code = params.orderCode || 'Vigente';
  const dest = params.destination || 'Agencia de destino';
  const status = params.statusName || 'En proceso';

  let customNote = "Tu pedido está siendo preparado y empaquetado cuidadosamente en nuestro taller para su pronto despacho. ¡Te avisaremos apenas esté en camino! ✨";
  if (status.toLowerCase().includes('shalom') || status.toLowerCase().includes('ruta') || status.toLowerCase().includes('camino')) {
    customNote = "Tu paquete ya ha salido de almacén y está en traslado hacia la agencia/destino. Te compartiremos tu comprobante y guía en breve. 📦✨";
  } else if (status.toLowerCase().includes('entregado')) {
    customNote = "Tu pedido ha sido completado y entregado con éxito. ¡Esperamos que lo disfrutes al máximo! 💖✨";
  } else if (status.toLowerCase().includes('almacén') || status.toLowerCase().includes('almacen')) {
    customNote = "Tu pedido ha ingresado a nuestro almacén y se encuentra en cola para confección/preparación. ✨";
  }

  const message = 
`¡Hola ${name}! 👋✨ Te saluda ComiKids.

📦 *ACTUALIZACIÓN DE TU PEDIDO*
-----------------------------------
🔢 *Orden:* #${code}
📍 *Destino:* ${dest}
🏷️ *Nuevo Estado:* *${status}*
-----------------------------------
${customNote}

¡Gracias por tu confianza! 💖✨🙏`;

  const encoded = encodeURIComponent(message);
  return isMobileDevice()
    ? `whatsapp://send?phone=${targetPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encoded}`;
}


