import { Pedido, TallerConfig } from '../types/database.types';
import { cleanPhoneNumber } from '../utils/formatters';

export function getWhatsAppEditOrderUrl(pedido: Pedido, tallerConfig: TallerConfig): string {
  const number = cleanPhoneNumber(tallerConfig.whatsapp_pedidos || '51987654321');
  const clientName = pedido.usuario?.nombre_completo || 'Clienta Encomi';
  
  const text = `¡Hola Comikids! 📦\nSoy *${clientName}*, deseo consultar sobre mi despacho *#${pedido.codigo_seguimiento}*.\n\n*Detalle:* ${pedido.detalles_bordado}\n*Destino:* ${pedido.destino_detalle}\n\n¿Cuál es el estado de mi envío? ✨`;

  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function getWhatsAppNotifyClientUrl(pedido: Pedido, tallerConfig: TallerConfig): string {
  const number = cleanPhoneNumber(tallerConfig.whatsapp_pedidos || '51987654321');
  const clientName = pedido.usuario?.nombre_completo || 'Clienta';
  
  const text = `¡Hola ${clientName}! ✨ Te saluda el taller de *Comikids / Encomi*.\n\nTu pedido *#${pedido.codigo_seguimiento}* ha sido rotulado para la *Agencia Shalom (${pedido.destino_detalle})*.\n\n📦 *Consignatario:* ${clientName}\n🆔 *DNI:* ${pedido.usuario?.dni || '-'}\n\nTe adjuntaremos tu guía y foto en breve. ¡Muchas gracias por tu preferencia! 💖`;

  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
