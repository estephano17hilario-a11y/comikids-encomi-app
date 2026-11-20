import { EstadoEnvio, EstadoProduccion, Pedido } from '../types/database.types';

export type TipoMovimiento =
  | 'nuevo_pedido'
  | 'edicion'
  | 'mover_carpeta'
  | 'rotulado'
  | 'registro_shalom'
  | 'entrega_bot'
  | 'eliminacion'
  | 'reversion';

export type OrigenMovimiento = 'admin' | 'cliente' | 'bot' | 'sistema';

export interface PedidoSnapshot {
  id: string;
  codigo_seguimiento: string;
  cliente_nombre: string;
  cliente_dni?: string;
  cliente_telefono?: string;
  destino_detalle?: string;
  metodo_envio_codigo?: string;
  metodo_envio_nombre?: string;
  estado_envio: EstadoEnvio;
  estado_produccion: EstadoProduccion;
  rotulado?: boolean;
  registrado_shalom?: boolean;
  shalom_ose_id?: string | null;
  shalom_numero_guia?: string | null;
  shalom_clave_recojo?: string | null;
  fecha_limite?: string | null;
  observaciones_cliente?: string;
  detalles_bordado?: string;
  full_order?: Pedido;
}

export interface PedidoMovimientoItem {
  pedido_id: string;
  codigo_seguimiento: string;
  cliente_nombre: string;
  metodo_envio?: string;
  antes?: Partial<PedidoSnapshot>;
  despues?: Partial<PedidoSnapshot>;
  cambios_legibles: string[];
  revertido?: boolean;
}

export interface MovimientoHistorial {
  id: string;
  empresa_id: string;
  tipo: TipoMovimiento;
  titulo: string;
  detalle?: string;
  origen: OrigenMovimiento;
  created_at: string;
  pedidos_afectados: PedidoMovimientoItem[];
  revertido?: boolean;
  revertido_at?: string;
  puede_revertir: boolean;
  /** True si proviene de inferencia automática desde pedidos en la BD (ej. entrante desde otro dispositivo) */
  es_sintetico?: boolean;
}

const STORAGE_PREFIX = 'incomi_activity_log_v1';
const MAX_LOGS = 250;
export const ACTIVITY_LOG_EVENT = 'incomi_activity_log_updated';

export const getCarpetaLabel = (envio?: EstadoEnvio, prod?: EstadoProduccion): string => {
  if (envio === 'entregado') return 'Entregados';
  if (envio === 'listo_para_recojo') return 'Listo para recoger';
  if (envio === 'en_camino' || (prod === 'completado' && envio === 'pendiente')) return 'Despachados';
  if (prod === 'bordando') return 'Alistando';
  return 'En almacén';
};

export const buildOrderSnapshot = (order: Pedido, includeFullOrder = false): PedidoSnapshot => ({
  id: order.id,
  codigo_seguimiento: order.codigo_seguimiento || order.id,
  cliente_nombre: order.usuario?.nombre_completo || 'Cliente',
  cliente_dni: order.usuario?.dni || order.usuario?.dni_default || '',
  cliente_telefono: order.usuario?.telefono_default || '',
  destino_detalle: order.destino_detalle || '',
  metodo_envio_codigo: order.metodo_envio_codigo || '',
  metodo_envio_nombre: order.metodo_envio_nombre || '',
  estado_envio: order.estado_envio,
  estado_produccion: order.estado_produccion,
  rotulado: Boolean(order.rotulado),
  registrado_shalom: Boolean(order.registrado_shalom),
  shalom_ose_id: order.shalom_ose_id ?? null,
  shalom_numero_guia: order.shalom_numero_guia ?? null,
  shalom_clave_recojo: order.shalom_clave_recojo ?? null,
  fecha_limite: order.fecha_limite ?? null,
  observaciones_cliente: order.observaciones_cliente || '',
  detalles_bordado: order.detalles_bordado || '',
  ...(includeFullOrder ? { full_order: order } : {}),
});

export const computeOrderChanges = (
  antes: Partial<PedidoSnapshot>,
  despues: Partial<PedidoSnapshot>
): string[] => {
  const changes: string[] = [];

  const carpetaAntes = getCarpetaLabel(antes.estado_envio, antes.estado_produccion);
  const carpetaDespues = getCarpetaLabel(despues.estado_envio, despues.estado_produccion);
  if (
    (despues.estado_envio !== undefined || despues.estado_produccion !== undefined) &&
    carpetaAntes !== carpetaDespues
  ) {
    changes.push(`Carpeta: ${carpetaAntes} → ${carpetaDespues}`);
  }

  if (despues.rotulado !== undefined && Boolean(antes.rotulado) !== Boolean(despues.rotulado)) {
    changes.push(despues.rotulado ? 'Rotulado: Sí' : 'Rotulado: Quitado');
  }

  if (
    despues.registrado_shalom !== undefined &&
    Boolean(antes.registrado_shalom) !== Boolean(despues.registrado_shalom)
  ) {
    changes.push(
      despues.registrado_shalom
        ? `Registrado Shalom${despues.shalom_numero_guia ? ` (${despues.shalom_numero_guia})` : ''}`
        : 'Shalom desvinculado'
    );
  } else if (
    despues.shalom_numero_guia !== undefined &&
    antes.shalom_numero_guia !== despues.shalom_numero_guia &&
    despues.shalom_numero_guia
  ) {
    changes.push(`Guía Shalom: ${despues.shalom_numero_guia}`);
  }

  if (
    despues.shalom_clave_recojo !== undefined &&
    (antes.shalom_clave_recojo || '') !== (despues.shalom_clave_recojo || '') &&
    despues.shalom_clave_recojo
  ) {
    changes.push(`Clave recojo: ${despues.shalom_clave_recojo}`);
  }

  if (
    despues.fecha_limite !== undefined &&
    (antes.fecha_limite || '') !== (despues.fecha_limite || '')
  ) {
    changes.push(
      `Fecha envío: ${antes.fecha_limite || 'Sin fecha'} → ${despues.fecha_limite || 'Sin fecha'}`
    );
  }

  if (
    despues.destino_detalle !== undefined &&
    (antes.destino_detalle || '').trim() !== (despues.destino_detalle || '').trim()
  ) {
    changes.push('Destino actualizado');
  }

  if (
    despues.cliente_nombre !== undefined &&
    (antes.cliente_nombre || '').trim() !== (despues.cliente_nombre || '').trim()
  ) {
    changes.push(`Cliente: ${antes.cliente_nombre || '—'} → ${despues.cliente_nombre}`);
  }

  if (
    despues.cliente_telefono !== undefined &&
    (antes.cliente_telefono || '').trim() !== (despues.cliente_telefono || '').trim()
  ) {
    changes.push(`Teléfono actualizado`);
  }

  if (
    despues.cliente_dni !== undefined &&
    (antes.cliente_dni || '').trim() !== (despues.cliente_dni || '').trim()
  ) {
    changes.push(`DNI: ${despues.cliente_dni || '—'}`);
  }

  if (
    despues.observaciones_cliente !== undefined &&
    (antes.observaciones_cliente || '').trim() !== (despues.observaciones_cliente || '').trim()
  ) {
    changes.push('Nota editada');
  }

  if (
    despues.metodo_envio_codigo !== undefined &&
    (antes.metodo_envio_codigo || '') !== (despues.metodo_envio_codigo || '')
  ) {
    changes.push(`Agencia: ${despues.metodo_envio_nombre || despues.metodo_envio_codigo}`);
  }

  return changes;
};

const getStorageKey = (empresaId?: string): string => {
  const safeId = empresaId && empresaId !== 'empresa-master-comikids' ? empresaId : 'master';
  return `${STORAGE_PREFIX}_${safeId}`;
};

const emitUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACTIVITY_LOG_EVENT));
  }
};

class ActivityLogService {
  getMovimientos(empresaId?: string): MovimientoHistorial[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(getStorageKey(empresaId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveMovimientos(empresaId: string | undefined, list: MovimientoHistorial[]) {
    if (typeof window === 'undefined') return;
    const key = getStorageKey(empresaId);
    let trimmed = list.slice(0, MAX_LOGS);
    try {
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch {
      // Si se llena el almacenamiento, recortar snapshots pesados antiguos y reintentar
      trimmed = trimmed.slice(0, 120).map((m, idx) =>
        idx > 25
          ? {
              ...m,
              pedidos_afectados: m.pedidos_afectados.map(it => ({
                ...it,
                antes: it.antes ? { ...it.antes, full_order: undefined } : undefined,
                despues: it.despues ? { ...it.despues, full_order: undefined } : undefined,
              })),
            }
          : m
      );
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        // Ignorar si el navegador bloquea storage
      }
    }
    emitUpdate();
  }

  recordMovimiento(
    empresaId: string | undefined,
    entry: Omit<MovimientoHistorial, 'id' | 'empresa_id' | 'created_at'> & {
      id?: string;
      created_at?: string;
    }
  ): MovimientoHistorial {
    const resolvedEmpresa = empresaId || 'empresa-master-comikids';
    const created: MovimientoHistorial = {
      id: entry.id || `mov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      empresa_id: resolvedEmpresa,
      created_at: entry.created_at || new Date().toISOString(),
      ...entry,
    };

    const existing = this.getMovimientos(resolvedEmpresa);
    const updated = [created, ...existing.filter(m => m.id !== created.id)];
    this.saveMovimientos(resolvedEmpresa, updated);
    return created;
  }

  markRevertido(empresaId: string | undefined, movimientoId: string, singlePedidoId?: string) {
    const list = this.getMovimientos(empresaId);
    const now = new Date().toISOString();
    const updated = list.map(m => {
      if (m.id !== movimientoId) return m;
      if (singlePedidoId) {
        const items = m.pedidos_afectados.map(it =>
          it.pedido_id === singlePedidoId ? { ...it, revertido: true } : it
        );
        const allReverted = items.every(it => it.revertido);
        return {
          ...m,
          pedidos_afectados: items,
          revertido: allReverted,
          revertido_at: allReverted ? now : m.revertido_at,
        };
      }
      return {
        ...m,
        revertido: true,
        revertido_at: now,
        pedidos_afectados: m.pedidos_afectados.map(it => ({ ...it, revertido: true })),
      };
    });
    this.saveMovimientos(empresaId, updated);
  }

  clearMovimientos(empresaId?: string) {
    this.saveMovimientos(empresaId, []);
  }

  /**
   * Construye el feed unificado combinando los movimientos registrados localmente
   * con los pedidos entrantes/editados recientes que llegaron desde clientes o el bot.
   */
  buildUnifiedHistory(empresaId: string | undefined, pedidos: Pedido[]): MovimientoHistorial[] {
    const localLogs = this.getMovimientos(empresaId);
    const resolvedEmpresa = empresaId || 'empresa-master-comikids';

    // Identificar qué pedidos ya tienen un evento 'nuevo_pedido' registrado localmente
    const loggedNewIds = new Set<string>();
    const loggedOrderIdsWithActivity = new Set<string>();
    for (const m of localLogs) {
      for (const item of m.pedidos_afectados) {
        loggedOrderIdsWithActivity.add(item.pedido_id);
        if (m.tipo === 'nuevo_pedido') {
          loggedNewIds.add(item.pedido_id);
        }
      }
    }

    // Agregar entrantes recientes (últimos 14 días, máximo 80) que llegaron de clientes/bot/otro dispositivo
    const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const syntheticEntries: MovimientoHistorial[] = [];

    const recentOrders = [...pedidos]
      .filter(p => {
        const ts = new Date(p.created_at).getTime();
        return !isNaN(ts) && ts >= cutoffMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 80);

    for (const order of recentOrders) {
      if (!loggedNewIds.has(order.id)) {
        const isBotOrigin = Boolean(
          (order.campos_personalizados as any)?.origen === 'whatsapp_bot' ||
          String(order.detalles_bordado || '').toLowerCase().includes('bot') ||
          String(order.observaciones_cliente || '').toLowerCase().includes('bot')
        );
        const clientName = order.usuario?.nombre_completo || 'Cliente';
        syntheticEntries.push({
          id: `syn-new-${order.id}`,
          empresa_id: resolvedEmpresa,
          tipo: 'nuevo_pedido',
          titulo: `Nuevo pedido entrante #${order.codigo_seguimiento}`,
          detalle: `${clientName} • ${order.metodo_envio_nombre || order.metodo_envio_codigo || 'Envío'}`,
          origen: isBotOrigin ? 'bot' : 'cliente',
          created_at: order.created_at,
          puede_revertir: false,
          es_sintetico: true,
          pedidos_afectados: [
            {
              pedido_id: order.id,
              codigo_seguimiento: order.codigo_seguimiento,
              cliente_nombre: clientName,
              metodo_envio: order.metodo_envio_nombre || order.metodo_envio_codigo,
              despues: buildOrderSnapshot(order),
              cambios_legibles: [
                `Entró en ${getCarpetaLabel(order.estado_envio, order.estado_produccion)}`,
                order.fecha_limite ? `Envío: ${order.fecha_limite}` : 'Sin fecha programada',
              ],
            },
          ],
        });
      }

      // Si el pedido fue editado en otro dispositivo y no hay log local para ese pedido
      if (order.updated_at && !loggedOrderIdsWithActivity.has(order.id)) {
        const createdTs = new Date(order.created_at).getTime();
        const updatedTs = new Date(order.updated_at).getTime();
        if (!isNaN(createdTs) && !isNaN(updatedTs) && updatedTs - createdTs > 120000) {
          const clientName = order.usuario?.nombre_completo || 'Cliente';
          syntheticEntries.push({
            id: `syn-upd-${order.id}`,
            empresa_id: resolvedEmpresa,
            tipo: 'edicion',
            titulo: `Pedido actualizado #${order.codigo_seguimiento}`,
            detalle: `${clientName} • Actualizado externamente`,
            origen: 'sistema',
            created_at: order.updated_at,
            puede_revertir: false,
            es_sintetico: true,
            pedidos_afectados: [
              {
                pedido_id: order.id,
                codigo_seguimiento: order.codigo_seguimiento,
                cliente_nombre: clientName,
                metodo_envio: order.metodo_envio_nombre || order.metodo_envio_codigo,
                despues: buildOrderSnapshot(order),
                cambios_legibles: [
                  `Carpeta actual: ${getCarpetaLabel(order.estado_envio, order.estado_produccion)}`,
                  ...(order.rotulado ? ['Rotulado: Sí'] : []),
                  ...(order.registrado_shalom ? ['Registrado Shalom'] : []),
                ],
              },
            ],
          });
        }
      }
    }

    return [...localLogs, ...syntheticEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

export const activityLogService = new ActivityLogService();
