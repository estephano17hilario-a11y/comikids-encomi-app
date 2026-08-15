/**
 * api/notificar-whatsapp.ts
 * Vercel Serverless Function — envía un mensaje WhatsApp al cliente
 * cuando su pedido cambia de estado.
 *
 * Variables de entorno requeridas en Vercel:
 *   WHATSAPP_SERVER_URL  → URL base del gateway WA (ej. https://tu-gateway.com)
 *   WHATSAPP_API_KEY     → API key del gateway WA (ej. Evolution API, WA-Gateway, etc.)
 *
 * Endpoint: POST /api/notificar-whatsapp
 * Body JSON: { telefono, nombreCompleto, tipoEnvio, estado, codigoSeguimiento }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  formatearMensajeNotificacion,
  resolverEstadoNotificable,
  type TipoEnvio,
} from "../src/lib/whatsappMessages";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    telefono,
    nombreCompleto,
    tipoEnvio,
    estado,
    codigoSeguimiento,
    // También aceptamos estadoEnvio + estadoProduccion para que el contexto
    // pueda pasar los datos crudos y dejemos que el servidor resuelva
    estadoEnvio,
    estadoProduccion,
  } = req.body;

  // Resolver el estado notificable: puede venir ya resuelto (estado)
  // o desde los valores crudos (estadoEnvio + estadoProduccion)
  let estadoFinal = estado;
  if (!estadoFinal && estadoEnvio) {
    estadoFinal = resolverEstadoNotificable(estadoEnvio, estadoProduccion || "en_cola");
  }

  // Estado RECIBIDO (pendiente sin producción) → NO emite mensaje
  if (!estadoFinal) {
    return res.status(200).json({ skipped: true, msg: "Estado no requiere notificación" });
  }

  // Validar campos mínimos
  if (!telefono || !nombreCompleto || !tipoEnvio) {
    return res.status(400).json({ error: "Faltan campos requeridos: telefono, nombreCompleto, tipoEnvio" });
  }

  // Limpiar y normalizar número peruano
  const numeroLimpio = String(telefono).replace(/\D/g, "");
  const numeroDestino = numeroLimpio.startsWith("51")
    ? numeroLimpio
    : `51${numeroLimpio}`;

  // Validar que sea un número válido (9 dígitos después del código de país)
  if (numeroDestino.length < 11) {
    return res.status(400).json({ error: "Número de teléfono inválido" });
  }

  // Normalizar tipoEnvio
  const tipoEnvioNorm: TipoEnvio =
    String(tipoEnvio).toLowerCase().includes("shalom") ? "shalom" : "motorizado";

  // Generar el texto del mensaje
  const mensaje = formatearMensajeNotificacion({
    nombreCompleto: String(nombreCompleto),
    tipoEnvio: tipoEnvioNorm,
    estado: estadoFinal,
    codigoSeguimiento: codigoSeguimiento ? String(codigoSeguimiento) : undefined,
  });

  // Variables de entorno del gateway WhatsApp
  const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL;
  const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

  if (!WHATSAPP_SERVER_URL || !WHATSAPP_API_KEY) {
    console.error("[notificar-whatsapp] Variables de entorno WHATSAPP_SERVER_URL / WHATSAPP_API_KEY no configuradas.");
    return res.status(500).json({
      error: "Configuración del servidor de WhatsApp incompleta. Revisa las variables de entorno en Vercel.",
    });
  }

  try {
    const gatewayRes = await fetch(
      `${WHATSAPP_SERVER_URL}/message/sendText/default`,
      {
        method: "POST",
        headers: {
          apikey: WHATSAPP_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: numeroDestino,
          text: mensaje,
        }),
      }
    );

    const responseText = await gatewayRes.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!gatewayRes.ok) {
      console.error("[notificar-whatsapp] Gateway respondió con error:", gatewayRes.status, data);
      return res.status(502).json({
        error: "El gateway de WhatsApp respondió con un error",
        status: gatewayRes.status,
        data,
      });
    }

    console.log(`[notificar-whatsapp] ✅ Mensaje enviado a ${numeroDestino} | Estado: ${estadoFinal}`);
    return res.status(200).json({ ok: true, data, numeroDestino, estado: estadoFinal });
  } catch (err: any) {
    console.error("[notificar-whatsapp] Error de red al contactar el gateway:", err);
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}
