import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { EstadoEnvio, EstadoProduccion, Pedido } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import {
  activityLogService,
  ACTIVITY_LOG_EVENT,
  MovimientoHistorial,
  PedidoMovimientoItem,
  TipoMovimiento,
  getCarpetaLabel,
  buildOrderSnapshot,
} from '../../services/activityLogService';
import {
  History,
  X,
  Search,
  RotateCcw,
  Edit3,
  FolderInput,
  Inbox,
  Printer,
  Truck,
  Bot,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Undo2,
  Sparkles,
} from 'lucide-react';

interface MovementsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditOrder: (order: Pedido) => void;
}

type HistoryFilter =
  | 'all'
  | 'nuevo_pedido'
  | 'mover_carpeta'
  | 'edicion'
  | 'rotulado'
  | 'shalom_bot'
  | 'eliminacion';

const TYPE_META: Record<
  TipoMovimiento,
  { label: string; icon: React.ElementType; badgeCls: string; dotCls: string }
> = {
  nuevo_pedido: {
    label: 'Nuevo entrante',
    icon: Inbox,
    badgeCls: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
    dotCls: 'bg-cyan-400',
  },
  mover_carpeta: {
    label: 'Movimiento',
    icon: FolderInput,
    badgeCls: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
    dotCls: 'bg-blue-400',
  },
  edicion: {
    label: 'Edición',
    icon: Edit3,
    badgeCls: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    dotCls: 'bg-amber-400',
  },
  rotulado: {
    label: 'Rótulo',
    icon: Printer,
    badgeCls: 'bg-purple-500/20 text-purple-200 border-purple-500/40',
    dotCls: 'bg-purple-400',
  },
  registro_shalom: {
    label: 'Shalom Pro',
    icon: Truck,
    badgeCls: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    dotCls: 'bg-indigo-400',
  },
  entrega_bot: {
    label: 'Entrega / Bot',
    icon: Bot,
    badgeCls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    dotCls: 'bg-emerald-400',
  },
  eliminacion: {
    label: 'Eliminado',
    icon: Trash2,
    badgeCls: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    dotCls: 'bg-rose-400',
  },
  reversion: {
    label: 'Revertido',
    icon: Undo2,
    badgeCls: 'bg-slate-600/30 text-slate-200 border-slate-500/40',
    dotCls: 'bg-slate-400',
  },
};

const QUICK_FOLDERS: { label: string; emoji: string; envio: EstadoEnvio; prod: EstadoProduccion }[] = [
  { label: 'Almacén', emoji: '🏬', envio: 'pendiente', prod: 'en_cola' },
  { label: 'Alistando', emoji: '🪡', envio: 'pendiente', prod: 'bordando' },
  { label: 'Despachados', emoji: '🚚', envio: 'en_camino', prod: 'completado' },
  { label: 'Entregados', emoji: '✅', envio: 'entregado', prod: 'completado' },
];

const formatDayGroup = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Reciente';
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Ayer';
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatRelativeTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  const hhmm = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (diffMin < 1) return `ahora · ${hhmm}`;
  if (diffMin < 60) return `hace ${diffMin} min · ${hhmm}`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h · ${hhmm}`;
  return hhmm;
};

export const MovementsHistoryModal: React.FC<MovementsHistoryModalProps> = ({
  isOpen,
  onClose,
  onEditOrder,
}) => {
  const { pedidos, updatePedido, restorePedido } = useOrders();
  const { currentEmpresa } = useAuth();
  const { toast, confirm } = useFeedback();
  const empresaId = currentEmpresa?.id || 'empresa-master-comikids';

  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [movingOrderKey, setMovingOrderKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const onUpdate = () => setTick(t => t + 1);
    window.addEventListener(ACTIVITY_LOG_EVENT, onUpdate);
    return () => window.removeEventListener(ACTIVITY_LOG_EVENT, onUpdate);
  }, []);

  const allMovements = useMemo(() => {
    void tick;
    return activityLogService.buildUnifiedHistory(empresaId, pedidos);
  }, [empresaId, pedidos, tick]);

  const pedidosById = useMemo(() => {
    const m = new Map<string, Pedido>();
    for (const p of pedidos) m.set(p.id, p);
    return m;
  }, [pedidos]);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMovements.filter(mov => {
      if (filter === 'shalom_bot') {
        if (mov.tipo !== 'registro_shalom' && mov.tipo !== 'entrega_bot') return false;
      } else if (filter !== 'all' && mov.tipo !== filter) {
        return false;
      }
      if (!q) return true;
      if (mov.titulo.toLowerCase().includes(q)) return true;
      if (mov.detalle && mov.detalle.toLowerCase().includes(q)) return true;
      return mov.pedidos_afectados.some(
        it =>
          it.codigo_seguimiento.toLowerCase().includes(q) ||
          it.cliente_nombre.toLowerCase().includes(q) ||
          it.cambios_legibles.some(c => c.toLowerCase().includes(q))
      );
    });
  }, [allMovements, filter, search]);

  const groupedByDay = useMemo(() => {
    const groups: { day: string; items: MovimientoHistorial[] }[] = [];
    for (const mov of filteredMovements) {
      const day = formatDayGroup(mov.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.items.push(mov);
      } else {
        groups.push({ day, items: [mov] });
      }
    }
    return groups;
  }, [filteredMovements]);

  const counts = useMemo(() => {
    const c = {
      all: allMovements.length,
      nuevo_pedido: 0,
      mover_carpeta: 0,
      edicion: 0,
      rotulado: 0,
      shalom_bot: 0,
      eliminacion: 0,
    };
    for (const m of allMovements) {
      if (m.tipo === 'nuevo_pedido') c.nuevo_pedido++;
      else if (m.tipo === 'mover_carpeta') c.mover_carpeta++;
      else if (m.tipo === 'edicion') c.edicion++;
      else if (m.tipo === 'rotulado') c.rotulado++;
      else if (m.tipo === 'registro_shalom' || m.tipo === 'entrega_bot') c.shalom_bot++;
      else if (m.tipo === 'eliminacion') c.eliminacion++;
    }
    return c;
  }, [allMovements]);

  if (!isOpen) return null;

  // Revertir un solo pedido de un movimiento
  const revertSingleItem = async (mov: MovimientoHistorial, item: PedidoMovimientoItem) => {
    if (!item.antes) {
      toast('Este registro no tiene estado anterior guardado para revertir.', 'warning');
      return;
    }

    setBusyId(`${mov.id}:${item.pedido_id}`);
    try {
      if (mov.tipo === 'eliminacion') {
        if (!item.antes.full_order) {
          toast('No se encontró la copia completa para restaurar este pedido.', 'error');
          return;
        }
        await restorePedido(item.antes.full_order);
        activityLogService.markRevertido(empresaId, mov.id, item.pedido_id);
        activityLogService.recordMovimiento(empresaId, {
          tipo: 'reversion',
          titulo: `Restauraste pedido #${item.codigo_seguimiento}`,
          detalle: `${item.cliente_nombre} • Restaurado desde el historial`,
          origen: 'admin',
          puede_revertir: false,
          pedidos_afectados: [
            {
              pedido_id: item.pedido_id,
              codigo_seguimiento: item.codigo_seguimiento,
              cliente_nombre: item.cliente_nombre,
              cambios_legibles: ['Pedido restaurado'],
            },
          ],
        });
        toast(`Pedido #${item.codigo_seguimiento} restaurado`, 'success');
        return;
      }

      const currentOrder = pedidosById.get(item.pedido_id);
      if (!currentOrder) {
        toast('Ese pedido ya no existe en tu lista actual.', 'warning');
        return;
      }

      const before = item.antes;
      const patch: Partial<Pedido> = {};
      if (before.estado_envio !== undefined) patch.estado_envio = before.estado_envio;
      if (before.estado_produccion !== undefined) patch.estado_produccion = before.estado_produccion;
      if (before.rotulado !== undefined) patch.rotulado = before.rotulado;
      if (before.registrado_shalom !== undefined) patch.registrado_shalom = before.registrado_shalom;
      if (before.shalom_ose_id !== undefined) patch.shalom_ose_id = before.shalom_ose_id;
      if (before.shalom_numero_guia !== undefined) patch.shalom_numero_guia = before.shalom_numero_guia;
      if (before.shalom_clave_recojo !== undefined) patch.shalom_clave_recojo = before.shalom_clave_recojo;
      if (before.fecha_limite !== undefined) patch.fecha_limite = (before.fecha_limite || null) as any;
      if (before.destino_detalle !== undefined) patch.destino_detalle = before.destino_detalle;
      if (before.observaciones_cliente !== undefined) patch.observaciones_cliente = before.observaciones_cliente;
      if (before.detalles_bordado !== undefined) patch.detalles_bordado = before.detalles_bordado;
      if (before.metodo_envio_codigo) patch.metodo_envio_codigo = before.metodo_envio_codigo;
      if (before.metodo_envio_nombre) patch.metodo_envio_nombre = before.metodo_envio_nombre;
      if (currentOrder.usuario && (before.cliente_nombre || before.cliente_dni || before.cliente_telefono)) {
        patch.usuario = {
          ...currentOrder.usuario,
          ...(before.cliente_nombre ? { nombre_completo: before.cliente_nombre } : {}),
          ...(before.cliente_dni ? { dni: before.cliente_dni } : {}),
          ...(before.cliente_telefono ? { telefono_default: before.cliente_telefono } : {}),
        };
      }

      const currentSnap = buildOrderSnapshot(currentOrder);
      await updatePedido(item.pedido_id, patch, { skipLog: true });
      activityLogService.markRevertido(empresaId, mov.id, item.pedido_id);
      activityLogService.recordMovimiento(empresaId, {
        tipo: 'reversion',
        titulo: `Revertiste #${item.codigo_seguimiento}`,
        detalle: `Volvió a su estado anterior (${getCarpetaLabel(before.estado_envio, before.estado_produccion)})`,
        origen: 'admin',
        puede_revertir: true,
        pedidos_afectados: [
          {
            pedido_id: item.pedido_id,
            codigo_seguimiento: item.codigo_seguimiento,
            cliente_nombre: item.cliente_nombre,
            antes: currentSnap,
            despues: before,
            cambios_legibles: [`Revertido: ${mov.titulo}`],
          },
        ],
      });
      toast(`Pedido #${item.codigo_seguimiento} revertido`, 'success');
    } catch (err) {
      console.error(err);
      toast('No se pudo revertir el cambio.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Revertir TODOS los pedidos de un movimiento
  const revertWholeMovement = async (mov: MovimientoHistorial) => {
    const revertible = mov.pedidos_afectados.filter(it => it.antes && !it.revertido);
    if (revertible.length === 0) {
      toast('No hay cambios pendientes de revertir en este movimiento.', 'info');
      return;
    }

    if (revertible.length > 1) {
      const ok = await confirm({
        title: `¿Revertir "${mov.titulo}"?`,
        message: `Se devolverán ${revertible.length} pedidos a su estado anterior.`,
        confirmLabel: 'Sí, revertir todo',
      });
      if (!ok) return;
    }

    setBusyId(mov.id);
    let restoredCount = 0;
    try {
      for (const item of revertible) {
        if (!item.antes) continue;
        if (mov.tipo === 'eliminacion') {
          if (item.antes.full_order) {
            await restorePedido(item.antes.full_order);
            restoredCount++;
          }
          continue;
        }
        const currentOrder = pedidosById.get(item.pedido_id);
        if (!currentOrder) continue;
        const before = item.antes;
        const patch: Partial<Pedido> = {};
        if (before.estado_envio !== undefined) patch.estado_envio = before.estado_envio;
        if (before.estado_produccion !== undefined) patch.estado_produccion = before.estado_produccion;
        if (before.rotulado !== undefined) patch.rotulado = before.rotulado;
        if (before.registrado_shalom !== undefined) patch.registrado_shalom = before.registrado_shalom;
        if (before.shalom_ose_id !== undefined) patch.shalom_ose_id = before.shalom_ose_id;
        if (before.shalom_numero_guia !== undefined) patch.shalom_numero_guia = before.shalom_numero_guia;
        if (before.shalom_clave_recojo !== undefined) patch.shalom_clave_recojo = before.shalom_clave_recojo;
        if (before.fecha_limite !== undefined) patch.fecha_limite = (before.fecha_limite || null) as any;
        if (before.destino_detalle !== undefined) patch.destino_detalle = before.destino_detalle;
        if (before.observaciones_cliente !== undefined) patch.observaciones_cliente = before.observaciones_cliente;
        if (before.detalles_bordado !== undefined) patch.detalles_bordado = before.detalles_bordado;
        if (currentOrder.usuario && (before.cliente_nombre || before.cliente_dni || before.cliente_telefono)) {
          patch.usuario = {
            ...currentOrder.usuario,
            ...(before.cliente_nombre ? { nombre_completo: before.cliente_nombre } : {}),
            ...(before.cliente_dni ? { dni: before.cliente_dni } : {}),
            ...(before.cliente_telefono ? { telefono_default: before.cliente_telefono } : {}),
          };
        }
        await updatePedido(item.pedido_id, patch, { skipLog: true });
        restoredCount++;
      }

      activityLogService.markRevertido(empresaId, mov.id);
      if (restoredCount > 0) {
        activityLogService.recordMovimiento(empresaId, {
          tipo: 'reversion',
          titulo: `Revertiste: ${mov.titulo}`,
          detalle: `${restoredCount} ${restoredCount === 1 ? 'pedido devuelto' : 'pedidos devueltos'} a su estado previo`,
          origen: 'admin',
          puede_revertir: false,
          pedidos_afectados: revertible.map(it => ({
            pedido_id: it.pedido_id,
            codigo_seguimiento: it.codigo_seguimiento,
            cliente_nombre: it.cliente_nombre,
            despues: it.antes,
            cambios_legibles: ['Revertido a estado anterior'],
          })),
        });
        toast(
          `${restoredCount} ${restoredCount === 1 ? 'pedido revertido' : 'pedidos revertidos'} correctamente`,
          'success'
        );
      } else {
        toast('Ninguno de esos pedidos se encontró activo para revertir.', 'warning');
      }
    } catch (err) {
      console.error(err);
      toast('Error al revertir el movimiento.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickMoveFromHistory = async (
    order: Pedido,
    envio: EstadoEnvio,
    prod: EstadoProduccion
  ) => {
    setBusyId(`move:${order.id}`);
    try {
      await updatePedido(order.id, { estado_envio: envio, estado_produccion: prod });
      setMovingOrderKey(null);
      toast(`#${order.codigo_seguimiento} movido a ${getCarpetaLabel(envio, prod)}`, 'success');
    } finally {
      setBusyId(null);
    }
  };

  const filterChips: { id: HistoryFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'nuevo_pedido', label: '📥 Entrantes', count: counts.nuevo_pedido },
    { id: 'mover_carpeta', label: '📁 Carpetas', count: counts.mover_carpeta },
    { id: 'edicion', label: '✏️ Ediciones', count: counts.edicion },
    { id: 'rotulado', label: '🏷️ Rótulos', count: counts.rotulado },
    { id: 'shalom_bot', label: '🚛 Shalom / Bot', count: counts.shalom_bot },
    { id: 'eliminacion', label: '🗑️ Eliminados', count: counts.eliminacion },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
      data-no-print="true"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Historial de movimientos"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl h-[93dvh] max-h-[93dvh] sm:h-[88vh] rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-scaleUp"
      >
        {/* Cabecera */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-slate-900 via-cyan-950/50 to-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Historial de Movimientos
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Entrantes, cambios, rótulos y envíos — toca para editar o revertir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-10 min-h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Cerrar historial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador y filtros */}
        <div className="px-3.5 sm:px-5 py-3 border-b border-white/10 bg-slate-950/60 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por clienta, código #CMD, acción..."
              className="w-full min-h-10 pl-10 pr-9 rounded-xl bg-slate-900 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {filterChips.map(chip => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`shrink-0 min-h-8 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                    active
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline de movimientos */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-5 custom-scrollbar overscroll-contain">
          {groupedByDay.length === 0 ? (
            <div className="py-16 text-center space-y-2.5">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-cyan-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black text-white">Sin movimientos aquí todavía</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Cada pedido nuevo, edición, rótulo, movimiento de carpeta o entrega por bot quedará registrado aquí.
              </p>
            </div>
          ) : (
            groupedByDay.map(group => (
              <div key={group.day} className="space-y-2.5">
                <div className="sticky top-0 z-10 flex items-center gap-2 py-1 bg-slate-900/95 backdrop-blur-md">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                    {group.day}
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold">
                    {group.items.length} {group.items.length === 1 ? 'movimiento' : 'movimientos'}
                  </span>
                </div>

                {group.items.map(mov => {
                  const meta = TYPE_META[mov.tipo] || TYPE_META.edicion;
                  const Icon = meta.icon;
                  const isExpanded =
                    expandedIds[mov.id] !== undefined
                      ? expandedIds[mov.id]
                      : mov.pedidos_afectados.length <= 2;
                  const hasRevertible =
                    mov.puede_revertir &&
                    !mov.revertido &&
                    mov.pedidos_afectados.some(it => Boolean(it.antes) && !it.revertido);

                  return (
                    <div
                      key={mov.id}
                      className={`rounded-2xl border p-3 sm:p-3.5 space-y-2.5 transition-all ${
                        mov.revertido
                          ? 'bg-slate-950/40 border-white/5 opacity-75'
                          : 'bg-slate-950/75 border-white/10'
                      }`}
                    >
                      {/* Cabecera del movimiento */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.badgeCls}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.badgeCls}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {formatRelativeTime(mov.created_at)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                                {mov.origen === 'admin'
                                  ? 'Tú'
                                  : mov.origen === 'bot'
                                  ? 'Bot WA'
                                  : mov.origen === 'cliente'
                                  ? 'Clienta'
                                  : 'Sistema'}
                              </span>
                              {mov.revertido && (
                                <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Revertido
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-black text-white mt-1 leading-snug">
                              {mov.titulo}
                            </h4>
                            {mov.detalle && (
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                {mov.detalle}
                              </p>
                            )}
                          </div>
                        </div>

                        {hasRevertible && (
                          <button
                            type="button"
                            disabled={busyId === mov.id}
                            onClick={() => revertWholeMovement(mov)}
                            className="shrink-0 min-h-8 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-200 border border-amber-500/40 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                            title="Deshacer este movimiento y volver al estado anterior"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{mov.tipo === 'eliminacion' ? 'Restaurar' : 'Revertir'}</span>
                          </button>
                        )}
                      </div>

                      {/* Toggle para lotes grandes */}
                      {mov.pedidos_afectados.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIds(prev => ({ ...prev, [mov.id]: !isExpanded }))
                          }
                          className="w-full py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-cyan-300 flex items-center justify-between cursor-pointer"
                        >
                          <span>
                            {isExpanded ? 'Ocultar' : 'Ver'} los {mov.pedidos_afectados.length} pedidos
                            afectados
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Pedidos afectados interactivos */}
                      {isExpanded && mov.pedidos_afectados.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {mov.pedidos_afectados.map(item => {
                            const liveOrder = pedidosById.get(item.pedido_id);
                            const rowKey = `${mov.id}:${item.pedido_id}`;
                            const isMovingThis = movingOrderKey === rowKey;
                            const canRevertItem =
                              mov.puede_revertir && Boolean(item.antes) && !item.revertido;

                            return (
                              <div
                                key={rowKey}
                                className="rounded-xl bg-slate-900/90 border border-white/8 p-2.5 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-mono text-[11px] font-black text-cyan-300">
                                        #{item.codigo_seguimiento}
                                      </span>
                                      <span className="text-xs font-bold text-white truncate">
                                        {item.cliente_nombre}
                                      </span>
                                      {liveOrder ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                                          Ahora: {getCarpetaLabel(liveOrder.estado_envio, liveOrder.estado_produccion)}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                          Eliminado
                                        </span>
                                      )}
                                    </div>

                                    {item.cambios_legibles.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.cambios_legibles.map((c, ci) => (
                                          <span
                                            key={ci}
                                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10"
                                          >
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Acciones directas por pedido */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {liveOrder && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMovingOrderKey(isMovingThis ? null : rowKey)
                                          }
                                          className={`min-h-8 px-2 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
                                            isMovingThis
                                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                          }`}
                                          title="Mover este pedido a otra carpeta"
                                        >
                                          <FolderInput className="w-3.5 h-3.5" />
                                          <span>Mover</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            onEditOrder(liveOrder);
                                          }}
                                          className="min-h-8 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                          title="Editar este pedido"
                                        >
                                          <Edit3 className="w-3.5 h-3.5 text-cyan-300" />
                                          <span>Editar</span>
                                        </button>
                                      </>
                                    )}

                                    {canRevertItem && mov.pedidos_afectados.length > 1 && (
                                      <button
                                        type="button"
                                        disabled={busyId === rowKey}
                                        onClick={() => revertSingleItem(mov, item)}
                                        className="min-h-8 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-200 border border-amber-500/35 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        title="Revertir solo este pedido"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>{mov.tipo === 'eliminacion' ? 'Restaurar' : 'Revertir'}</span>
                                      </button>
                                    )}

                                    {item.revertido && mov.pedidos_afectados.length > 1 && (
                                      <span className="text-[10px] font-bold text-emerald-300 px-1.5">
                                        ✓ Revertido
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Selector rápido inline de carpeta */}
                                {isMovingThis && liveOrder && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                                    <span className="text-[10px] font-bold text-slate-400 mr-1">
                                      Mover a:
                                    </span>
                                    {QUICK_FOLDERS.map(f => (
                                      <button
                                        key={f.label}
                                        type="button"
                                        disabled={busyId === `move:${liveOrder.id}`}
                                        onClick={() =>
                                          handleQuickMoveFromHistory(liveOrder, f.envio, f.prod)
                                        }
                                        className="min-h-7 px-2.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-400/50 border border-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                                      >
                                        {f.emoji} {f.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-between gap-2 shrink-0 pb-safe">
          <span className="text-[11px] text-slate-400">
            {filteredMovements.length} {filteredMovements.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
          >
            Cerrar historial
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
