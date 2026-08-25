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
}

// URL oficial del Funnel Interactivo Encomi
export const ENCOMI_FUNNEL_URL = "https://comikids-encomi-app.vercel.app/?funnel=encomi";
export const NUMERO_CONTACTO_ENCOMI = "+51 963097546";

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

// Paso 2 y 3: Generador de texto dinámico y apertura del enlace oficial de WhatsApp
export const buildWhatsAppComprobanteUrl = (datos: DatosComprobante): string => {
  // 1. Extracción dinámica de variables con valores limpios
  const nombre = (datos.destinatario || "Cliente").trim();
  const telefono = (datos.telefonoCliente || "").replace(/\D/g, '') || "No especificado";
  const documento = (datos.documentoRecojo || "").trim() || "No especificado";
  const metodo = (datos.tipoEnvio || "Envío").trim();
  const destino = (datos.destinoDetalle || "Agencia Shalom").trim();
  const codigo = datos.codigoSeguimiento || "Vigente";
  const fechaFormateada = formatFechaConDia(datos.fechaDeseadaEnvio);

  // Enlace dinámico y súper corto del Funnel
  const currentOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://comikids-encomi-app.vercel.app';
  const funnelShortUrl = `${currentOrigin}/encomi`;

  const lineaRef = datos.referencia ? `🏷️ *Ref:* ${datos.referencia.trim()}\n` : "";
  const lineaMaps = datos.coordenadasMapsUrl ? `🗺️ *Ubicación GPS:*\n${datos.coordenadasMapsUrl}\n` : "";
  const lineaCorreo = datos.correoCliente ? `📧 *Correo:* ${datos.correoCliente.trim()}\n` : "";

  // 2. Construcción del mensaje estructurado, ultra compacto y ordenado
  const cuerpoMensaje = 
`✨ *COMPROBANTE OFICIAL DE ENVÍO - COMIKIDS* 📦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Orden:* #${codigo}
👤 *Cliente:* ${nombre}
🪪 *DNI / Doc:* ${documento}
📱 *WhatsApp:* +51 ${telefono}
${lineaCorreo}🚚 *Modalidad:* ${metodo}
📅 *Fecha de Envío:* ${fechaFormateada}

📍 *Agencia / Destino Oficial:*
${destino}
${lineaRef}${lineaMaps}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¿Buscas que tu negocio sea 10x más rápido al entregar pedidos? Entonces buscas a Encomi 🚀
👉 ${funnelShortUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡Muchas gracias por tu preferencia! 💖✨🙏`;

  // 3. Codificación con encodeURIComponent
  const textoCodificado = encodeURIComponent(cuerpoMensaje);
  return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${textoCodificado}`;
};


export const enviarComprobanteAWhatsapp = (datos: DatosComprobante): string => {
  const enlaceFinal = buildWhatsAppComprobanteUrl(datos);
  if (typeof window !== 'undefined') {
    window.open(enlaceFinal, '_blank', 'noopener,noreferrer');
  }
  return enlaceFinal;
};

export function getWhatsAppBusinessChatUrl(text?: string): string {
  if (!text) {
    return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}`;
  }
  return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_RECEPTOR}&text=${encodeURIComponent(text)}`;
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
  return `https://api.whatsapp.com/send?phone=${NUMERO_WHATSAPP_ENCOMI_DIRECTO}&text=${encodeURIComponent(text)}`;
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

  return `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`;
}

