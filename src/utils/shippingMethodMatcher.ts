import { MetodoEnvio, Pedido } from '../types/database.types';

/**
 * Resuelve de forma exhaustiva y robusta la agencia / método de envío configurado
 * para un pedido en particular, evitando pérdidas de configuración por diferencias
 * entre ID, código, nombres o mayúsculas/minúsculas.
 */
export function resolveOrderShippingMethod(
  pedido: Pedido,
  methodsList?: MetodoEnvio[]
): MetodoEnvio | undefined {
  if (!methodsList || methodsList.length === 0) return undefined;

  const rawCode = (pedido.metodo_envio_codigo || '').trim();
  const rawName = (pedido.metodo_envio_nombre || '').trim();
  const rawDestino = (pedido.destino_detalle || '').trim();

  // 1. Coincidencia exacta por ID de método
  if (rawCode) {
    const byId = methodsList.find(m => m.id === rawCode);
    if (byId) return byId;
  }

  // 2. Coincidencia exacta por código (case-insensitive)
  if (rawCode) {
    const lowerCode = rawCode.toLowerCase();
    const byCode = methodsList.find(m => m.codigo && m.codigo.trim().toLowerCase() === lowerCode);
    if (byCode) return byCode;
  }

  // 3. Coincidencia exacta por nombre de la agencia
  if (rawName) {
    const lowerName = rawName.toLowerCase();
    const byName = methodsList.find(m => m.nombre && m.nombre.trim().toLowerCase() === lowerName);
    if (byName) return byName;
  }

  // 4. Coincidencia parcial por nombre
  if (rawName) {
    const lowerName = rawName.toLowerCase();
    const byPartialName = methodsList.find(m => {
      const mName = (m.nombre || '').toLowerCase();
      return mName.includes(lowerName) || lowerName.includes(mName);
    });
    if (byPartialName) return byPartialName;
  }

  // 5. Deducción por palabras clave en destino o código
  const combinedContext = `${rawCode} ${rawName} ${rawDestino}`.toLowerCase();

  // Caso Shalom
  if (combinedContext.includes('shalom')) {
    const shalomMethod = methodsList.find(
      m => m.codigo === 'shalom' || m.tipo_formulario === 'shalom' || m.id === 'met-shalom' || m.nombre.toLowerCase().includes('shalom')
    );
    if (shalomMethod) return shalomMethod;
  }

  // Caso Olva Courier
  if (combinedContext.includes('olva')) {
    const olvaMethod = methodsList.find(
      m => m.codigo === 'olva' || m.tipo_formulario === 'olva' || m.id === 'met-olva' || m.nombre.toLowerCase().includes('olva')
    );
    if (olvaMethod) return olvaMethod;
  }

  // Caso Motorizado Local / Delivery
  if (
    combinedContext.includes('motorizado') ||
    combinedContext.includes('moto') ||
    combinedContext.includes('delivery') ||
    combinedContext.includes('domicilio')
  ) {
    const motoMethod = methodsList.find(
      m => m.codigo === 'motorizado' || m.tipo_formulario === 'mapa_direccion' || m.id === 'met-motorizado' || m.nombre.toLowerCase().includes('motorizado')
    );
    if (motoMethod) return motoMethod;
  }

  // 6. Si no hubo match específico, retornar el método activo predeterminado o el primero
  return methodsList.find(m => m.activo) || methodsList[0];
}
