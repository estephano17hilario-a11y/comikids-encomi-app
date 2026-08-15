import { Pedido } from '../types/database.types';

export const WHATSAPP_DIRECT_URL = 'https://wa.me/message/FSEGUIYKFKYKA1';

export function getWhatsAppBusinessChatUrl(text?: string): string {
  if (!text) return WHATSAPP_DIRECT_URL;
  return `${WHATSAPP_DIRECT_URL}?text=${encodeURIComponent(text)}`;
}

export function getWhatsAppEditOrderUrl(pedido: Pedido): string {
  const clientName = pedido.usuario?.nombre_completo || 'Clienta Encomi';
  
  const text = `¡Hola Comikids! 📦\nSoy *${clientName}*, deseo consultar sobre mi despacho *#${pedido.codigo_seguimiento}*.\n\n*Detalle:* ${pedido.detalles_bordado}\n*Destino:* ${pedido.destino_detalle}\n\n¿Cuál es el estado de mi envío? ✨`;

  return getWhatsAppBusinessChatUrl(text);
}

export function getWhatsAppNotifyClientUrl(pedido: Pedido): string {
  const clientName = pedido.usuario?.nombre_completo || 'Clienta';
  
  const text = `¡Hola ${clientName}! ✨ Te saluda el taller de *Comikids / Encomi*.\n\nTu pedido *#${pedido.codigo_seguimiento}* ha sido rotulado para la *Agencia Shalom (${pedido.destino_detalle})*.\n\n📦 *Consignatario:* ${clientName}\n🆔 *DNI:* ${pedido.usuario?.dni || '-'}\n\nTe adjuntaremos tu guía y foto en breve. ¡Muchas gracias por tu preferencia! 💖`;

  return getWhatsAppBusinessChatUrl(text);
}
