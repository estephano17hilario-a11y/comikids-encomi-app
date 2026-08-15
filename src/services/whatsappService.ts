import { Pedido } from '../types/database.types';

// Número fijo oficial de recepción
export const NUMERO_WHATSAPP_RECEPTOR = "51927781412";

// Paso 1: Estructura estándar para cualquier tipo de comprobante
export interface DatosComprobante {
  destinatario: string;
  telefonoCliente: string;
  documentoRecojo: string;
  tipoEnvio: string;
  destinoDetalle: string;
  codigoSeguimiento?: string;
  referencia?: string;
  montoTotal?: string | number;
  coordenadasMapsUrl?: string;
}

// Paso 2 y 3: Generador de texto dinámico y apertura del enlace oficial de WhatsApp
export const buildWhatsAppComprobanteUrl = (datos: DatosComprobante): string => {
  // 1. Extracción dinámica de variables con valores por defecto
  const nombre = datos.destinatario || "No especificado";
  const telefono = datos.telefonoCliente || "No especificado";
  const documento = datos.documentoRecojo || "No especificado";
  const metodo = datos.tipoEnvio || "No especificado";
  const destino = datos.destinoDetalle || "No especificado";

  // Campos condicionales
  const lineaCodigo = datos.codigoSeguimiento ? `📦 *Código / Orden:* #${datos.codigoSeguimiento}\n` : "";
  const lineaReferencia = datos.referencia ? `🏷️ *Referencia:* ${datos.referencia}\n` : "";
  const lineaMonto = datos.montoTotal ? `💰 *Monto Total:* S/ ${datos.montoTotal}\n` : "";
  const lineaMaps = datos.coordenadasMapsUrl ? `🗺️ *Ubicación en Google Maps:*\n${datos.coordenadasMapsUrl}\n` : "";

  // 2. Construcción del mensaje con Template Literals y Emojis
  const cuerpoMensaje = 
`Hola Somos ComiKids aqui dejo mi comprobante de pedido: 📦✨

-----------------------------------
${lineaCodigo}👤 *Destinatario:* ${nombre}
📱 *WhatsApp:* ${telefono}
🪪 *DNI / CE Recojo:* ${documento}
🚚 *Tipo de Envío:* ${metodo}
${lineaMonto}
📍 *Destino / Agencia:*
${destino}
${lineaReferencia}${lineaMaps}-----------------------------------
Gracias por la confianza 💖✨🙏`;

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

