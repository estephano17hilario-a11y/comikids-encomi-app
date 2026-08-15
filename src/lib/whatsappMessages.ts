/**
 * whatsappMessages.ts
 * Templates de mensajes WhatsApp para notificaciones automáticas de estado de pedidos.
 * Regla de negocio: Estado RECIBIDO/pendiente nunca emite mensaje.
 */

export type TipoEnvio = "shalom" | "motorizado";

/**
 * Estados que SIVEN una notificación al cliente.
 * "RECIBIDO" (pendiente) está explícitamente excluido.
 */
export type EstadoNotificable = "ALISTANDO" | "EN_RUTA" | "ENTREGADO";

/**
 * Mapeo de estados internos del sistema (EstadoEnvio / EstadoProduccion)
 * hacia los estados notificables de WhatsApp.
 *
 * Reglas:
 *   - estado_produccion === 'bordando'  → ALISTANDO
 *   - estado_envio     === 'en_camino'  → EN_RUTA
 *   - estado_envio     === 'entregado'  → ENTREGADO
 *   - estado_envio     === 'pendiente'  → null (NO notificar)
 */
export function resolverEstadoNotificable(
  estadoEnvio: string,
  estadoProduccion: string
): EstadoNotificable | null {
  if (estadoEnvio === "entregado") return "ENTREGADO";
  if (estadoEnvio === "en_camino") return "EN_RUTA";
  if (estadoProduccion === "bordando" && estadoEnvio === "pendiente") return "ALISTANDO";
  // pendiente + en_cola = RECIBIDO → NO notificar
  return null;
}

interface PlantillaConfig {
  label: string;
  desc: string;
}

const PLANTILLAS: Record<EstadoNotificable, Record<TipoEnvio, PlantillaConfig>> = {
  ALISTANDO: {
    shalom: {
      label: "Alistándolo 📦",
      desc: "Tu paquete ya se encuentra en mesa de empaque siendo preparado para su despacho a la agencia Shalom.",
    },
    motorizado: {
      label: "Alistándolo 📦",
      desc: "Tu paquete ya se encuentra en mesa de empaque siendo preparado para la salida del motorizado.",
    },
  },
  EN_RUTA: {
    shalom: {
      label: "Despachado en Agencia Shalom 🏢🚚",
      desc: "Tu pedido ya fue entregado en la agencia Shalom. En breve se generará tu guía de rastreo.",
    },
    motorizado: {
      label: "En ruta de entrega 🛵💨",
      desc: "¡El motorizado ya tiene tu paquete en mano y va en camino a tu dirección!",
    },
  },
  ENTREGADO: {
    shalom: {
      label: "Entregado 🎉✅",
      desc: "Tu paquete figura como entregado con éxito en la agencia Shalom. ¡Ya puedes recogerlo! Muchas gracias por tu confianza. 💖",
    },
    motorizado: {
      label: "Entregado 🎉✅",
      desc: "El motorizado ha completado la entrega de tu pedido exitosamente. ¡Que lo disfrutes! 🎉",
    },
  },
};

/**
 * Genera el texto completo del mensaje WhatsApp para notificar un cambio de estado.
 */
export function formatearMensajeNotificacion(params: {
  nombreCompleto: string;
  tipoEnvio: TipoEnvio;
  estado: EstadoNotificable;
  codigoSeguimiento?: string;
}): string {
  const { nombreCompleto, tipoEnvio, estado, codigoSeguimiento } = params;

  // Extraer solo el primer nombre y capitalizarlo correctamente
  const primerNombreRaw = (nombreCompleto || "Cliente").trim().split(/\s+/)[0];
  const primerNombre =
    primerNombreRaw.charAt(0).toUpperCase() + primerNombreRaw.slice(1).toLowerCase();

  const lineaCodigo = codigoSeguimiento
    ? `📦 *Pedido:* #${codigoSeguimiento}\n`
    : "";

  const config = PLANTILLAS[estado][tipoEnvio];

  return (
    `¡Hola ${primerNombre}! 👋✨\n\n` +
    `Actualización de tu pedido *ComiKids*:\n` +
    `-----------------------------------\n` +
    `${lineaCodigo}` +
    `📌 *Estado:* ${config.label}\n\n` +
    `${config.desc}\n` +
    `-----------------------------------\n` +
    `Si tienes alguna duda con tu entrega, escríbenos por aquí. 💖`
  );
}
