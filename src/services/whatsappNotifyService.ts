/**
 * whatsappNotifyService.ts
 * Servicio del FRONTEND que llama al endpoint serverless /api/notificar-whatsapp.
 *
 * Se dispara automáticamente desde OrderContext cuando se cambia el estado de un pedido.
 * Es fire-and-forget: los errores se loguean en consola pero NO interrumpen la UI.
 */

import { Pedido, EstadoEnvio, EstadoProduccion } from "../types/database.types";
import { resolverEstadoNotificable } from "../lib/whatsappMessages";

interface NotificarPayload {
  telefono: string;
  nombreCompleto: string;
  tipoEnvio: string;
  estadoEnvio: EstadoEnvio;
  estadoProduccion: EstadoProduccion;
  codigoSeguimiento?: string;
}

/**
 * Envía una notificación WhatsApp al cliente cuando cambia el estado de su pedido.
 * Es asíncrono y silencioso — nunca lanza excepciones hacia el llamador.
 */
async function notificarCambioEstado(payload: NotificarPayload): Promise<void> {
  // Verificar si el estado requiere notificación antes de llamar al servidor
  const estadoNotificable = resolverEstadoNotificable(
    payload.estadoEnvio,
    payload.estadoProduccion
  );

  if (!estadoNotificable) {
    // Estado RECIBIDO u otro no notificable — salir silenciosamente
    return;
  }

  if (!payload.telefono || payload.telefono.replace(/\D/g, "").length < 9) {
    console.warn("[whatsappNotify] Teléfono inválido, omitiendo notificación:", payload.telefono);
    return;
  }

  try {
    const res = await fetch("/api/notificar-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: payload.telefono,
        nombreCompleto: payload.nombreCompleto,
        tipoEnvio: payload.tipoEnvio,
        estadoEnvio: payload.estadoEnvio,
        estadoProduccion: payload.estadoProduccion,
        codigoSeguimiento: payload.codigoSeguimiento,
      }),
    });

    const data = await res.json();

    if (data.skipped) {
      // El servidor confirmó que no debe notificar
      return;
    }

    if (!res.ok) {
      console.warn("[whatsappNotify] El servidor rechazó la notificación:", data);
      return;
    }

    console.log(
      `[whatsappNotify] ✅ WhatsApp enviado | ${payload.codigoSeguimiento} | Estado: ${estadoNotificable}`
    );
  } catch (err) {
    // Nunca interrumpir la UI por un fallo de notificación
    console.warn("[whatsappNotify] Error de red (silenciado):", err);
  }
}

/**
 * Extrae los datos necesarios de un pedido y llama al notificador.
 * Fuente de verdad del teléfono: usuario.telefono_default.
 */
export async function notificarEstadoPedido(
  pedido: Pedido,
  estadoEnvio: EstadoEnvio,
  estadoProduccion: EstadoProduccion
): Promise<void> {
  const telefono = pedido.usuario?.telefono_default || "";
  const nombreCompleto = pedido.usuario?.nombre_completo || "Cliente";
  const tipoEnvio = pedido.metodo_envio_codigo || "shalom";
  const codigoSeguimiento = pedido.codigo_seguimiento;

  await notificarCambioEstado({
    telefono,
    nombreCompleto,
    tipoEnvio,
    estadoEnvio,
    estadoProduccion,
    codigoSeguimiento,
  });
}

/**
 * Notifica múltiples pedidos a la vez (útil para acciones en masa).
 * Ejecuta las llamadas en paralelo para mayor velocidad.
 */
export async function notificarEstadosPedidos(
  pedidos: Pedido[],
  estadoEnvio: EstadoEnvio,
  estadoProduccion: EstadoProduccion
): Promise<void> {
  await Promise.allSettled(
    pedidos.map((p) => notificarEstadoPedido(p, estadoEnvio, estadoProduccion))
  );
}
