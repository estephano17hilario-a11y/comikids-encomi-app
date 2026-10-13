import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { useFeedback } from '../../context/FeedbackContext';
import { EditOrderModal } from './EditOrderModal';

import { BulkPrintModal } from './BulkPrintModal';
import { ShalomLabelModal } from './ShalomLabelModal';
import { ShalomRegisterModal } from './ShalomRegisterModal';
import { ShalomDeliveryModal } from './ShalomDeliveryModal';
import { OrderStatusNotifyModal } from './OrderStatusNotifyModal';

import {
  CheckSquare,
  Trash2,
  Printer,
  Edit3,
  Truck,
  Search,
  CheckCircle2,
  ExternalLink,
  MapPin,
  AlertTriangle,
  MoveRight,
  X,
  Building2,
  RefreshCw,
  Calendar,
  MessageCircle,
  ArrowRight,
  Clock,
  Flame,
  PackageCheck,
  Boxes,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Users,
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';
import { resolveShalomAgencyDetails } from '../../utils/shalomAgencyResolver';
import { formatFechaConDia } from '../../services/whatsappService';

// Helper exhaustivo para extraer número celular de la clienta
export const getCleanClientPhone = (order: Pedido): string => {
  let phone = order.usuario?.telefono_default || '';
  if (!phone && order.usuario?.dni && order.usuario.dni.length === 9 && order.usuario.dni.startsWith('9')) {
    phone = order.usuario.dni;
  }
  if (!phone && order.destino_detalle) {
    const match = order.destino_detalle.match(/(?:Tel|Cel|WhatsApp|Telefono|Celular)[\s:]*([0-9]{9})/i);
    if (match && match[1]) phone = match[1];
  }
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
};

// ---------------------------------------------------------------------------
// Flujo de trabajo: En almacén → Alistando → Despachado → Entregado
// ---------------------------------------------------------------------------
type Stage = 'almacen' | 'alistando' | 'despachando' | 'entregado';
type StatusFilter = 'all' | 'almacen' | 'alistando' | 'dejando_shalom' | 'entregado';
type QuickFilter = 'none' | 'hoy' | 'atrasados' | 'duplicados' | 'entregados_hoy';
type SortMode = 'fecha_envio' | 'recientes' | 'antiguos';

const PAGE_SIZE = 24;

const getStage = (order: Pedido): Stage => {
  if (order.estado_envio === 'entregado') return 'entregado';
  if (
    order.estado_envio === 'en_camino' ||
    order.estado_envio === 'listo_para_recojo' ||
    (order.estado_produccion === 'completado' && order.estado_envio === 'pendiente')
  ) return 'despachando';
  if (order.estado_produccion === 'bordando') return 'alistando';
  return 'almacen';
};

const NEXT_STEP: Record<Exclude<Stage, 'entregado'>, { label: string; envio: EstadoEnvio; prod: EstadoProduccion; className: string }> = {
  almacen: {
    label: 'Empezar a alistar',
    envio: 'pendiente',
    prod: 'bordando',
    className: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30',
  },
  alistando: {
    label: 'Marcar como despachado',
    envio: 'en_camino',
    prod: 'completado',
    className: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
  },
  despachando: {
    label: 'Marcar como entregado',
    envio: 'entregado',
    prod: 'completado',
    className: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30',
  },
};

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Normaliza cualquier fecha (ISO o YYYY-MM-DD) a YYYY-MM-DD local
const getOrderDateOnly = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    return toLocalDate(d);
  } catch {
    return String(dateStr).slice(0, 10);
  }
};

const daysBetween = (fromYmd: string, toYmd: string): number => {
  const [y1, m1, d1] = fromYmd.split('-').map(Number);
  const [y2, m2, d2] = toYmd.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
};

const isShalomOrder = (o: Pedido) => o.metodo_envio_codigo === 'shalom' || Boolean(o.destino_detalle?.toLowerCase().includes('shalom'));
const isOlvaOrder = (o: Pedido) => o.metodo_envio_codigo === 'olva' || Boolean(o.destino_detalle?.toLowerCase().includes('olva'));
const isMotoOrder = (o: Pedido) => o.metodo_envio_codigo === 'motorizado' || Boolean(o.destino_detalle?.toLowerCase().includes('motorizado'));

const getDeliveryDate = (o: Pedido) => getOrderDateOnly((o as any).campos_personalizados?.fecha_entrega || o.updated_at);

// Documento de la clienta (DNI/CE), también extraído del texto del destino si hace falta
const getOrderDni = (order: Pedido): string => {
  let dni = order.usuario?.dni || order.usuario?.dni_default || '';
  if (!dni || dni.startsWith('usr-') || dni === '00000000' || dni === 'NCIADOS') {
    const matchDoc = String(order.destino_detalle || '').match(/\b(?:DNI[\s\/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i);
    const docCandidate = matchDoc && matchDoc[1] ? matchDoc[1].trim() : '';
    dni = (docCandidate && !docCandidate.startsWith('usr-') && docCandidate.toUpperCase() !== 'NCIADOS' && docCandidate.replace(/\D/g, '').length >= 6) ? docCandidate : '';
  }
  return dni;
};

// Llave única de la clienta: se usa para detectar pedidos repetidos
const getClientKey = (order: Pedido): string => {
  const dni = getOrderDni(order).trim();
  const key = (
    dni ||
    getCleanClientPhone(order) ||
    order.usuario?.nombre_completo?.trim().toLowerCase() ||
    ''
  );
  if (!key || key === 'cliente' || key === '00000000' || key.toLowerCase() === 'encomi envíos') return '';
  return key;
};

// "mar 13 oct" — fecha corta sin la etiqueta relativa (la urgencia ya dice Hoy/Mañana)
const formatShortDate = (ymd?: string): string => {
  const clean = getOrderDateOnly(ymd);
  if (!clean) return '';
  const [y, m, d] = clean.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  return `${dias[date.getDay()]} ${d} ${meses[m - 1]}`;
};

const formatOrderTime = (isoString?: string): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const OrdersSmartManager: React.FC = () => {
  const {
    pedidos,
    shippingMethods,
    tallerConfig,
    updateMultipleEstados,
    deleteMultiplePedidos,
    deletePedido,
    updatePedido,
    updateEstadoEnvio,
    updateEstadoProduccion,
    refreshData,
  } = useOrders();
  const { toast, confirm } = useFeedback();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      toast('Pedidos actualizados', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Búsqueda, filtros y orden
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [transportFilter, setTransportFilter] = useState<'all' | 'shalom' | 'motorizado' | 'olva'>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none');
  const [sortMode, setSortMode] = useState<SortMode>('fecha_envio');
  const [showDateTools, setShowDateTools] = useState(false);
  const [isTrackingSyncing, setIsTrackingSyncing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const today = toLocalDate(new Date());

  // Clasificación por Fechas: 'none' | 'registrado' | 'programado' | 'entregado'
  const [dateFilterType, setDateFilterType] = useState<'none' | 'registrado' | 'programado' | 'entregado'>('none');
  const [dateFilterValue, setDateFilterValue] = useState<string>(today);

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDateFilterValue(toLocalDate(d));
  };

  // Conteos dinámicos para la fecha seleccionada en dateFilterValue
  const dateCounts = useMemo(() => {
    if (!dateFilterValue) return { registrados: 0, programados: 0, entregados: 0 };
    let registrados = 0;
    let programados = 0;
    let entregados = 0;
    for (const p of pedidos) {
      if (getOrderDateOnly(p.created_at) === dateFilterValue) registrados++;
      if (getOrderDateOnly(p.fecha_limite) === dateFilterValue) programados++;
      if (
        p.estado_envio === 'entregado' &&
        (getOrderDateOnly((p as any).campos_personalizados?.fecha_entrega) === dateFilterValue ||
          getOrderDateOnly(p.updated_at) === dateFilterValue)
      ) entregados++;
    }
    return { registrados, programados, entregados };
  }, [pedidos, dateFilterValue]);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionMode = selectedIds.length > 0;

  // Modales
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<Pedido | null>(null);
  const [showShalomRegister, setShowShalomRegister] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeTargetOrder, setSwipeTargetOrder] = useState<Pedido | null>(null);
  const [deliveryTargetOrders, setDeliveryTargetOrders] = useState<Pedido[] | null>(null);
  const [notifyModalData, setNotifyModalData] = useState<{
    orders: Pedido[];
    statusName: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // Helper para nombre legible del estado
  const getStatusLabel = (envio: EstadoEnvio, prod?: EstadoProduccion): string => {
    if (envio === 'entregado') return 'Entregado';
    if (envio === 'listo_para_recojo') return 'Listo para Recoger en Agencia';
    if (envio === 'en_camino' || (prod === 'completado' && envio === 'pendiente')) return 'Dejando en Shalom / En Ruta';
    if (prod === 'bordando') return 'Alistándolo';
    return 'En Almacén';
  };

  const wasEdited = (createdAt?: string, updatedAt?: string): boolean => {
    if (!createdAt || !updatedAt) return false;
    const t1 = new Date(createdAt).getTime();
    const t2 = new Date(updatedAt).getTime();
    return Math.abs(t2 - t1) > 60000;
  };

  // Detección de pedidos simultáneos de la misma clienta (misma llave en pedido y tarjeta)
  const duplicateOrdersMap = useMemo(() => {
    const map = new Map<string, { count: number; orderIds: string[]; clientName: string }>();
    for (const order of pedidos) {
      if (order.estado_envio === 'entregado') continue;
      const key = getClientKey(order);
      if (!key) continue;
      const item = map.get(key) || { count: 0, orderIds: [], clientName: order.usuario?.nombre_completo || 'Cliente' };
      item.count += 1;
      item.orderIds.push(order.id);
      map.set(key, item);
    }
    return map;
  }, [pedidos]);

  const duplicateClientsCount = useMemo(() => {
    let count = 0;
    for (const [, info] of duplicateOrdersMap.entries()) {
      if (info.count >= 2) count++;
    }
    return count;
  }, [duplicateOrdersMap]);

  // Indicadores del día (lo primero que un dueño necesita ver)
  const kpis = useMemo(() => {
    let hoy = 0;
    let atrasados = 0;
    let entregadosHoy = 0;
    for (const p of pedidos) {
      if (p.estado_envio === 'entregado') {
        if (getDeliveryDate(p) === today) entregadosHoy++;
        continue;
      }
      const f = getOrderDateOnly(p.fecha_limite);
      if (!f) continue;
      if (f === today) hoy++;
      else if (f < today) atrasados++;
    }
    return { hoy, atrasados, entregadosHoy };
  }, [pedidos, today]);

  const matchesSearch = (order: Pedido, query: string): boolean => {
    if (!query) return true;
    const cleanPhone = getCleanClientPhone(order);
    const queryDigits = query.replace(/\D/g, '');
    return Boolean(
      order.codigo_seguimiento.toLowerCase().includes(query) ||
      order.destino_detalle.toLowerCase().includes(query) ||
      (order.usuario?.nombre_completo && order.usuario.nombre_completo.toLowerCase().includes(query)) ||
      (order.usuario?.dni && order.usuario.dni.toLowerCase().includes(query)) ||
      (order.usuario?.telefono_default && order.usuario.telefono_default.includes(query)) ||
      (cleanPhone && queryDigits && cleanPhone.includes(queryDigits)) ||
      (order.observaciones_cliente && order.observaciones_cliente.toLowerCase().includes(query)) ||
      (order.shalom_clave_recojo && order.shalom_clave_recojo.toLowerCase().includes(query)) ||
      (order.shalom_numero_guia && order.shalom_numero_guia.toLowerCase().includes(query))
    );
  };

  const matchesTransport = (order: Pedido): boolean => {
    if (transportFilter === 'all') return true;
    if (transportFilter === 'shalom') return isShalomOrder(order);
    if (transportFilter === 'olva') return isOlvaOrder(order);
    return isMotoOrder(order);
  };

  // Pedidos filtrados y ordenados
  const filteredOrders = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    const list = pedidos.filter(order => {
      if (!matchesSearch(order, query)) return false;
      if (!matchesTransport(order)) return false;

      // Atajos de indicadores (tienen prioridad sobre las pestañas de estado)
      if (quickFilter !== 'none') {
        const f = getOrderDateOnly(order.fecha_limite);
        if (quickFilter === 'entregados_hoy') return order.estado_envio === 'entregado' && getDeliveryDate(order) === today;
        if (order.estado_envio === 'entregado') return false;
        if (quickFilter === 'hoy') return f === today;
        if (quickFilter === 'atrasados') return Boolean(f) && f < today;
        if (quickFilter === 'duplicados') {
          const key = getClientKey(order);
          return Boolean(key && (duplicateOrdersMap.get(key)?.count || 0) >= 2);
        }
      }

      // Clasificación por Fecha
      if (dateFilterType !== 'none' && dateFilterValue) {
        if (dateFilterType === 'registrado') {
          if (getOrderDateOnly(order.created_at) !== dateFilterValue) return false;
        } else if (dateFilterType === 'programado') {
          if (getOrderDateOnly(order.fecha_limite) !== dateFilterValue) return false;
        } else if (dateFilterType === 'entregado') {
          if (order.estado_envio !== 'entregado') return false;
          if (getDeliveryDate(order) !== dateFilterValue) return false;
        }
      }

      if (dateFilterType === 'entregado') {
        if (statusFilter !== 'all' && statusFilter !== 'entregado') return false;
        return order.estado_envio === 'entregado';
      }

      const stage = getStage(order);
      if (statusFilter === 'almacen') return stage === 'almacen';
      if (statusFilter === 'alistando') return stage === 'alistando';
      if (statusFilter === 'dejando_shalom') return stage === 'despachando';
      if (statusFilter === 'entregado') return stage === 'entregado';

      if (dateFilterType === 'registrado' || dateFilterType === 'programado') return true;

      // Vista "Activos": todo lo vigente excepto lo ya entregado
      return order.estado_envio !== 'entregado';
    });

    const byDate = (o: Pedido) => getOrderDateOnly(o.fecha_limite) || '9999-99-99';
    const byCreated = (o: Pedido) => new Date(o.created_at).getTime() || 0;
    if (quickFilter === 'duplicados') {
      list.sort((a, b) => getClientKey(a).localeCompare(getClientKey(b)) || byCreated(b) - byCreated(a));
    } else if (sortMode === 'fecha_envio') {
      list.sort((a, b) => byDate(a).localeCompare(byDate(b)) || byCreated(a) - byCreated(b));
    } else if (sortMode === 'recientes') {
      list.sort((a, b) => byCreated(b) - byCreated(a));
    } else {
      list.sort((a, b) => byCreated(a) - byCreated(b));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, searchTerm, statusFilter, transportFilter, dateFilterType, dateFilterValue, quickFilter, sortMode, duplicateOrdersMap, today]);

  // Al cambiar filtros se vuelve a la primera página
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, statusFilter, transportFilter, dateFilterType, dateFilterValue, quickFilter, sortMode]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);

  // Selección
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedIds.includes(o.id));
  const selectAll = () => {
    if (allFilteredSelected) setSelectedIds([]);
    else setSelectedIds(filteredOrders.map(o => o.id));
  };

  const clearSelection = () => setSelectedIds([]);

  // Atajos de teclado: "/" busca, "Esc" limpia la selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && !typing && document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length === 0) {
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cambio masivo de estado
  const handleMassStatusUpdate = async (envio: EstadoEnvio, prod?: EstadoProduccion) => {
    if (selectedIds.length === 0) return;
    const affectedOrders = pedidos.filter(p => selectedIds.includes(p.id));
    const statusName = getStatusLabel(envio, prod);

    // Si se marca como Entregado y hay pedidos de Shalom, abrir ShalomDeliveryModal
    // para buscar el voucher oficial y enviar la clave y PDF por WhatsApp
    if (envio === 'entregado') {
      const shalomOrders = affectedOrders.filter(isShalomOrder);
      if (shalomOrders.length > 0) {
        setDeliveryTargetOrders(shalomOrders);
        return;
      }
    }

    setIsProcessing(true);
    try {
      await updateMultipleEstados(selectedIds, envio, prod);
      clearSelection();
      toast(`${affectedOrders.length} ${affectedOrders.length === 1 ? 'pedido movido' : 'pedidos movidos'} a "${statusName}"`);
      if (affectedOrders.length > 0) {
        setNotifyModalData({ orders: affectedOrders, statusName });
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo actualizar el estado. Intenta de nuevo.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      const n = selectedIds.length;
      await deleteMultiplePedidos(selectedIds);
      clearSelection();
      setShowDeleteConfirm(false);
      toast(`${n} ${n === 1 ? 'pedido eliminado' : 'pedidos eliminados'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleOrderMove = async (orderId: string, envio: EstadoEnvio, prod?: EstadoProduccion) => {
    const targetOrder = pedidos.find(p => p.id === orderId);
    const statusName = getStatusLabel(envio, prod);

    // Entregado + Shalom → flujo oficial con voucher
    if (envio === 'entregado' && targetOrder && isShalomOrder(targetOrder)) {
      setSwipeTargetOrder(null);
      setDeliveryTargetOrders([targetOrder]);
      return;
    }

    setBusyOrderId(orderId);
    try {
      if (prod) await updateEstadoProduccion(orderId, prod);
      await updateEstadoEnvio(orderId, envio);
      setSwipeTargetOrder(null);
      if (targetOrder) {
        setNotifyModalData({ orders: [targetOrder], statusName });
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo cambiar el estado. Intenta de nuevo.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleDeleteSingle = async (order: Pedido) => {
    const ok = await confirm({
      title: `¿Eliminar el pedido #${order.codigo_seguimiento}?`,
      message: `${order.usuario?.nombre_completo || 'Cliente'} • Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    await deletePedido(order.id);
    toast('Pedido eliminado');
  };

  const handleUnlinkShalom = async (order: Pedido) => {
    const ok = await confirm({
      title: '¿Desvincular el despacho de Shalom?',
      message: 'Se borrará la guía y la clave de este pedido para que puedas registrarlo de nuevo o ingresar otra guía.',
      confirmLabel: 'Desvincular',
      tone: 'danger',
    });
    if (!ok) return;
    await updatePedido(order.id, {
      registrado_shalom: false,
      shalom_ose_id: null,
      shalom_numero_guia: null,
      shalom_clave_recojo: null,
    });
    toast('Guía de Shalom desvinculada', 'info');
  };

  const selectedOrders = pedidos.filter(p => selectedIds.includes(p.id));
  const selectedShalomOrders = useMemo(() => selectedOrders.filter(isShalomOrder), [selectedOrders]);

  // Al terminar de imprimir rótulos se marcan como rotulados
  const handleBulkPrintComplete = async (orderIds: string[]) => {
    for (const id of orderIds) {
      await updatePedido(id, { rotulado: true });
    }
  };

  // Forzar sincronización del listener de tracking de Shalom
  const handleSyncShalomTracking = async () => {
    setIsTrackingSyncing(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/shalom/listener/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFirstRun: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (data?.success) {
        toast(
          `Shalom verificado: ${data.report?.totalShippedOrdersChecked || 0} paquetes, ${data.report?.newlyArrivedCount || 0} nuevos en destino, ${data.report?.notifiedCount || 0} avisos enviados`,
          'success'
        );
      } else {
        toast(data?.error || 'Sincronización completada.', 'info');
      }
    } catch (err) {
      console.error('Error sincronizando tracking:', err);
      toast('No se pudo consultar el seguimiento de Shalom.', 'error');
    } finally {
      setIsTrackingSyncing(false);
    }
  };

  // Contadores para pestañas y filtros
  const counts = useMemo(() => {
    const c = { all: 0, almacen: 0, alistando: 0, dejando_shalom: 0, entregado: 0, shalom: 0, olva: 0, motorizado: 0 };
    for (const p of pedidos) {
      const stage = getStage(p);
      if (stage === 'entregado') {
        c.entregado++;
        continue;
      }
      c.all++;
      if (stage === 'almacen') c.almacen++;
      if (stage === 'alistando') c.alistando++;
      if (stage === 'despachando') c.dejando_shalom++;
      if (isShalomOrder(p)) c.shalom++;
      if (isOlvaOrder(p)) c.olva++;
      if (isMotoOrder(p)) c.motorizado++;
    }
    return c;
  }, [pedidos]);

  const hasActiveFilters = Boolean(searchTerm) || statusFilter !== 'all' || transportFilter !== 'all' || dateFilterType !== 'none' || quickFilter !== 'none';
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTransportFilter('all');
    setDateFilterType('none');
    setQuickFilter('none');
  };

  const applyQuickFilter = (qf: QuickFilter) => {
    setQuickFilter(prev => (prev === qf ? 'none' : qf));
    setStatusFilter('all');
    setDateFilterType('none');
  };

  // -------------------------------------------------------------------------
  // Tarjeta de pedido
  // -------------------------------------------------------------------------
  const renderStageBadge = (order: Pedido) => {
    const stage = getStage(order);
    const isOlva = isOlvaOrder(order);
    const isMoto = order.metodo_envio_codigo === 'motorizado';
    if (stage === 'entregado') {
      return { text: isOlva ? 'Entregado a Olva' : isMoto ? 'Entregado' : 'Entregado a Shalom', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: '✓' };
    }
    if (order.estado_envio === 'listo_para_recojo') {
      return { text: 'Listo para recoger', cls: 'bg-teal-500/20 text-teal-200 border-teal-500/40', icon: '🏢' };
    }
    if (stage === 'despachando') {
      return { text: isOlva ? 'Dejando en Olva' : isMoto ? 'En ruta' : 'Dejando en Shalom', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: isMoto ? '🛵' : '🚚' };
    }
    if (stage === 'alistando') {
      return { text: 'Alistando', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: '🪡' };
    }
    return { text: 'En almacén', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: '🏬' };
  };

  const renderUrgency = (order: Pedido) => {
    const f = getOrderDateOnly(order.fecha_limite);
    if (!f) return { label: 'Sin fecha de envío', cls: 'bg-white/5 text-slate-400 border-white/10' };
    if (order.estado_envio === 'entregado') return { label: `Envío ${formatShortDate(order.fecha_limite)}`, cls: 'bg-white/5 text-slate-300 border-white/10' };
    const diff = daysBetween(today, f);
    if (diff < 0) {
      const n = Math.abs(diff);
      return { label: `Atrasado ${n} ${n === 1 ? 'día' : 'días'} • ${formatShortDate(order.fecha_limite)}`, cls: 'bg-rose-500/15 text-rose-200 border-rose-500/40' };
    }
    if (diff === 0) return { label: `Sale HOY • ${formatShortDate(order.fecha_limite)}`, cls: 'bg-amber-500/15 text-amber-200 border-amber-500/40' };
    if (diff === 1) return { label: `Mañana • ${formatShortDate(order.fecha_limite)}`, cls: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30' };
    return { label: `Sale ${formatShortDate(order.fecha_limite)} • en ${diff} días`, cls: 'bg-white/5 text-slate-200 border-white/10' };
  };

  const renderOrderCard = (order: Pedido) => {
    const isSelected = selectedIds.includes(order.id);
    const dni = getOrderDni(order);
    const key = getClientKey(order);
    const dupInfo = key ? duplicateOrdersMap.get(key) : null;
    const isDuplicate = Boolean(dupInfo && dupInfo.count >= 2);
    const isReadyForPickup = order.estado_envio === 'listo_para_recojo';
    const isShalom = isShalomOrder(order);
    const isOlva = isOlvaOrder(order);
    const isMoto = isMotoOrder(order);
    const stage = getStage(order);
    const next = stage !== 'entregado' ? NEXT_STEP[stage] : null;
    const isBusy = busyOrderId === order.id;

    const matchedMethod = (shippingMethods || []).find(m =>
      m.codigo === order.metodo_envio_codigo ||
      m.id === order.metodo_envio_codigo ||
      (order.metodo_envio_nombre && m.nombre.toLowerCase() === order.metodo_envio_nombre.toLowerCase())
    );

    let agencyColor = matchedMethod?.color_borde;
    if (!agencyColor) {
      if (isShalom) agencyColor = '#ef4444';
      else if (isMoto) agencyColor = '#3b82f6';
      else if (isOlva) agencyColor = '#f59e0b';
      else agencyColor = '#06b6d4';
    }

    const agencyBadgeLabel = isShalom
      ? 'Shalom'
      : isMoto
      ? 'Motorizado'
      : isOlva
      ? 'Olva'
      : (matchedMethod?.nombre || order.metodo_envio_nombre || 'Agencia');

    const clientPhone = getCleanClientPhone(order);
    const clientName = order.usuario?.nombre_completo || 'Cliente';
    const badge = renderStageBadge(order);
    const urgency = renderUrgency(order);

    return (
      <article
        key={order.id}
        onClick={selectionMode ? () => toggleSelect(order.id) : undefined}
        aria-label={`Pedido ${order.codigo_seguimiento} de ${clientName}`}
        style={{ borderLeftColor: agencyColor }}
        className={`relative flex flex-col rounded-3xl border border-l-4 backdrop-blur-xl transition-all ${
          selectionMode ? 'cursor-pointer select-none' : ''
        } ${
          isSelected
            ? 'bg-cyan-950/50 border-cyan-400 ring-2 ring-cyan-400/60'
            : isReadyForPickup
            ? 'bg-teal-950/30 border-white/10 hover:border-white/20'
            : 'bg-slate-950/50 border-white/10 hover:border-white/20'
        }`}
      >
        <div className="p-4 space-y-3 flex-1">
          {/* Fila superior: selección, código y agencia */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(order.id);
                }}
                aria-pressed={isSelected}
                aria-label={isSelected ? 'Quitar de la selección' : 'Seleccionar pedido'}
                className="-m-1.5 p-1.5 shrink-0"
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors border-2 ${
                  isSelected ? 'bg-cyan-400 border-cyan-400 text-slate-950' : 'border-slate-600 bg-slate-900 text-transparent hover:border-cyan-400'
                }`}>
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              </button>
              <span className="font-mono text-xs font-bold text-slate-300 tracking-wider truncate">
                #{order.codigo_seguimiento}
              </span>
            </div>

            <span
              className="px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wide border shrink-0"
              style={{
                backgroundColor: `${agencyColor}1f`,
                borderColor: `${agencyColor}55`,
                color: agencyColor === '#ffffff' ? '#ffffff' : agencyColor,
              }}
            >
              {agencyBadgeLabel}
            </span>
          </div>

          {/* Clienta */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[15px] font-black text-white tracking-tight truncate">{clientName}</h4>
              {dni && (
                <span className="text-[11px] font-mono text-slate-400 shrink-0">DNI {dni}</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
              <span className="text-xs font-mono font-semibold text-slate-300 truncate">
                {clientPhone ? `+51 ${clientPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}` : 'Sin teléfono'}
              </span>
              {clientPhone ? (
                <a
                  href={`https://wa.me/51${clientPhone}?text=${encodeURIComponent(`¡Hola ${clientName}! Te escribimos de ${tallerConfig?.nombre_taller || 'Encomi Envíos'} respecto a tu pedido #${order.codigo_seguimiento}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95 transition-all shrink-0"
                  title={`Escribir a ${clientName} por WhatsApp`}
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPedido(order)}
                  className="min-h-9 px-3 rounded-xl border border-dashed border-white/20 text-xs font-bold text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50"
                >
                  + Agregar teléfono
                </button>
              )}
            </div>
          </div>

          {/* Fecha de envío con urgencia */}
          <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border ${urgency.cls}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 shrink-0 opacity-80" />
              <span className="text-xs font-bold truncate">{urgency.label}</span>
            </div>
            {stage !== 'entregado' && (
              <label className="relative shrink-0 inline-flex items-center gap-1 text-[11px] font-bold opacity-80 hover:opacity-100 cursor-pointer">
                <span className="underline underline-offset-2">Cambiar</span>
                <input
                  type="date"
                  aria-label="Cambiar fecha de envío"
                  value={getOrderDateOnly(order.fecha_limite)}
                  onChange={async (e) => {
                    const newDate = e.target.value;
                    if (newDate) {
                      await updatePedido(order.id, { fecha_limite: newDate });
                      toast(`Fecha de envío cambiada a ${formatFechaConDia(newDate)}`, 'info');
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Destino */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-slate-300 break-words line-clamp-3" title={order.destino_detalle}>
              {order.destino_detalle}
            </p>
          </div>

          {/* Agencia destino Shalom y guía */}
          {isShalom && (() => {
            const agencyInfo = resolveShalomAgencyDetails(order.destino_detalle);
            return (
              <div className="space-y-1.5">
                {!agencyInfo.isVerified ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPedido(order);
                    }}
                    className="w-full flex items-center gap-1.5 text-left text-xs text-amber-100 bg-amber-500/15 px-3 py-2 rounded-xl border border-amber-500/40"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><strong>Agencia Shalom no reconocida.</strong> Toca para corregir el destino antes de registrar.</span>
                  </button>
                ) : (
                <div className="flex items-center gap-1.5 text-xs text-rose-200 bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-500/25">
                  <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Agencia: <strong className="text-white">{agencyInfo.officialDestination}</strong></span>
                  {agencyInfo.code && (
                    <span className="text-[10px] font-mono text-rose-200 bg-rose-900/60 px-1.5 rounded-md font-black shrink-0">
                      {agencyInfo.code}
                    </span>
                  )}
                </div>
                )}

                {order.registrado_shalom && (
                  <div className="flex items-center justify-between gap-2 text-xs text-emerald-200 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {order.shalom_numero_guia || order.shalom_ose_id ? (
                          <>Guía: <strong className="text-white">{order.shalom_numero_guia || `OSE #${order.shalom_ose_id}`}</strong></>
                        ) : (
                          <span className="text-amber-300">Registrado (sin guía)</span>
                        )}
                      </span>
                      {order.shalom_clave_recojo && (
                        <span className="text-[11px] font-mono text-amber-200 bg-amber-950/70 px-1.5 rounded-md border border-amber-500/30 shrink-0">
                          Clave {order.shalom_clave_recojo}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkShalom(order)}
                      className="p-1 -m-1 rounded-lg text-slate-400 hover:text-rose-400 shrink-0"
                      title="Desvincular guía para registrar de nuevo"
                      aria-label="Desvincular guía de Shalom"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {isReadyForPickup && (
            <div className="px-3 py-2 rounded-2xl bg-teal-950/60 border border-teal-500/40 text-teal-100 text-xs">
              <strong className="block text-teal-300">🏢 Llegó a la agencia de destino</strong>
              <span className="font-mono text-[11px] text-teal-200/80">
                N° envío {order.shalom_numero_guia?.replace(/\D/g, '') || order.codigo_seguimiento}
                {order.shalom_clave_recojo ? ` • Clave ${order.shalom_clave_recojo}` : ''}
              </span>
            </div>
          )}

          {/* Datos adicionales de la agencia */}
          {order.campos_personalizados && Object.keys(order.campos_personalizados).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(order.campos_personalizados)
                .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
                .map(([label, val]) => (
                  <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-[11px]">
                    <span className="text-slate-400">{label}:</span>
                    <strong className="text-white">{String(val)}</strong>
                  </span>
                ))}
            </div>
          )}

          {order.observaciones_cliente && (
            <p className="text-xs text-slate-300 bg-white/5 px-3 py-2 rounded-xl break-words">
              <span className="text-slate-500 font-bold">Nota: </span>{order.observaciones_cliente}
            </p>
          )}

          {order.latitud && order.longitud && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${order.latitud},${order.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Ver ubicación en Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Indicadores: rotulado, registro Shalom, duplicado */}
          <div className="flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => updatePedido(order.id, { rotulado: !order.rotulado })}
              aria-pressed={Boolean(order.rotulado)}
              className={`min-h-8 px-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                order.rotulado
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-transparent text-slate-400 border-dashed border-white/15 hover:text-slate-200'
              }`}
              title={order.rotulado ? 'Rotulado (toca para quitar)' : 'Marcar como rotulado'}
            >
              {order.rotulado ? <Check className="w-3.5 h-3.5" /> : <span>+</span>}
              <span>Rotulado</span>
            </button>

            {isShalom && (
              <button
                type="button"
                onClick={() => updatePedido(order.id, { registrado_shalom: !order.registrado_shalom })}
                aria-pressed={Boolean(order.registrado_shalom)}
                className={`min-h-8 px-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                  order.registrado_shalom
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-transparent text-slate-400 border-dashed border-white/15 hover:text-slate-200'
                }`}
                title={order.registrado_shalom ? 'Registrado en Shalom (toca para quitar)' : 'Marcar como registrado en Shalom'}
              >
                {order.registrado_shalom ? <Check className="w-3.5 h-3.5" /> : <span>+</span>}
                <span>Registrado en Shalom</span>
              </button>
            )}

            {isDuplicate && (
              <button
                type="button"
                onClick={() => applyQuickFilter('duplicados')}
                className="min-h-8 px-2.5 rounded-xl text-[11px] font-bold border bg-amber-500/15 text-amber-200 border-amber-500/40 flex items-center gap-1"
                title="Esta clienta tiene otros pedidos activos: revisa si se pueden juntar en un solo envío"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{dupInfo?.count} pedidos activos</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Creado {formatOrderTime(order.created_at)}
            {wasEdited(order.created_at, order.updated_at) && <> • Editado {formatOrderTime(order.updated_at)}</>}
          </p>
        </div>

        {/* Pie: estado + acciones */}
        <div className="px-4 pb-4 pt-3 border-t border-white/8 space-y-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSwipeTargetOrder(order)}
              className={`min-h-9 px-3 rounded-xl text-xs font-black border flex items-center gap-1.5 hover:brightness-125 transition-all ${badge.cls}`}
              title="Cambiar estado"
            >
              <span>{badge.icon}</span>
              <span>{badge.text}</span>
              <ArrowUpDown className="w-3 h-3 opacity-60" />
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedLabelOrder(order)}
                className="min-h-9 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                title="Ver e imprimir rótulo"
              >
                <Printer className="w-4 h-4 text-cyan-300" />
                <span className="hidden min-[400px]:inline">Rótulo</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingPedido(order)}
                className="min-h-9 min-w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center justify-center"
                title="Editar pedido"
                aria-label="Editar pedido"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(order)}
                className="min-h-9 min-w-9 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 flex items-center justify-center"
                title="Eliminar pedido"
                aria-label="Eliminar pedido"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {next && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSingleOrderMove(order.id, next.envio, next.prod)}
              className={`w-full min-h-11 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 ${next.className}`}
            >
              {isBusy ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{stage === 'alistando' && isMoto ? 'Enviar con motorizado' : next.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </article>
    );
  };

  const isAnyModalOpen = Boolean(
    showShalomRegister ||
    showBulkPrint ||
    selectedLabelOrder ||
    editingPedido ||
    showDeleteConfirm ||
    notifyModalData ||
    deliveryTargetOrders ||
    swipeTargetOrder ||
    isProcessing
  );

  // Ocultar dock y encabezado del panel mientras hay un modal abierto
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('has-active-modal');
      document.body.classList.add('hide-admin-dock');
    } else {
      document.body.classList.remove('has-active-modal');
      document.body.classList.remove('hide-admin-dock');
    }
    return () => {
      document.body.classList.remove('has-active-modal');
      document.body.classList.remove('hide-admin-dock');
    };
  }, [isAnyModalOpen]);

  // Con pedidos seleccionados, la barra de acciones ocupa el lugar del dock inferior
  useEffect(() => {
    document.body.classList.toggle('has-order-selection', selectionMode);
    return () => document.body.classList.remove('has-order-selection');
  }, [selectionMode]);

  const statusTabs: { id: StatusFilter; label: string; count: number; active: string }[] = [
    { id: 'all', label: 'Activos', count: counts.all, active: 'bg-cyan-500 text-slate-950' },
    { id: 'almacen', label: 'En almacén', count: counts.almacen, active: 'bg-amber-500 text-slate-950' },
    { id: 'alistando', label: 'Alistando', count: counts.alistando, active: 'bg-purple-600 text-white' },
    { id: 'dejando_shalom', label: 'Despachados', count: counts.dejando_shalom, active: 'bg-blue-600 text-white' },
    { id: 'entregado', label: 'Entregados', count: counts.entregado, active: 'bg-emerald-500 text-slate-950' },
  ];

  const transportChips: { id: 'all' | 'shalom' | 'olva' | 'motorizado'; label: string; count: number; active: string }[] = [
    { id: 'all', label: 'Todas', count: counts.all, active: 'bg-white/15 text-white border-white/30' },
    { id: 'shalom', label: 'Shalom', count: counts.shalom, active: 'bg-red-500/20 text-red-200 border-red-500/50' },
    { id: 'olva', label: 'Olva', count: counts.olva, active: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50' },
    { id: 'motorizado', label: 'Motorizado', count: counts.motorizado, active: 'bg-blue-500/20 text-blue-200 border-blue-500/50' },
  ];

  const kpiCards: { id: QuickFilter; label: string; value: number; hint: string; icon: React.ElementType; tone: string; activeTone: string }[] = [
    { id: 'hoy', label: 'Salen hoy', value: kpis.hoy, hint: 'Programados para hoy', icon: Clock, tone: 'text-amber-300', activeTone: 'border-amber-400 bg-amber-500/15' },
    { id: 'atrasados', label: 'Atrasados', value: kpis.atrasados, hint: 'Pasó su fecha de envío', icon: Flame, tone: kpis.atrasados > 0 ? 'text-rose-300' : 'text-slate-400', activeTone: 'border-rose-400 bg-rose-500/15' },
    { id: 'none', label: 'Por alistar', value: counts.almacen, hint: 'En almacén', icon: Boxes, tone: 'text-cyan-300', activeTone: 'border-cyan-400 bg-cyan-500/15' },
    { id: 'entregados_hoy', label: 'Entregados hoy', value: kpis.entregadosHoy, hint: 'Cerrados hoy', icon: PackageCheck, tone: 'text-emerald-300', activeTone: 'border-emerald-400 bg-emerald-500/15' },
  ];

  return (
    <div className="space-y-4 animate-fadeIn pb-32">

      {/* Barra de acciones en lote: abajo, al alcance del pulgar (reemplaza al dock mientras hay selección) */}
      {selectionMode && !isAnyModalOpen && createPortal(
        <div className="fixed bottom-safe left-0 right-0 mx-auto z-[9990] w-[calc(100%-1rem)] max-w-4xl animate-slideUp print:hidden admin-mass-action-bar" data-no-print="true">
          <div className="rounded-3xl bg-slate-900/95 border-2 border-cyan-500/60 backdrop-blur-3xl shadow-2xl shadow-black/60 p-2 sm:p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="min-w-8 h-8 px-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-sm flex items-center justify-center">
                  {selectedIds.length}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={selectAll}
                  className="min-h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-bold"
                >
                  {allFilteredSelected ? 'Quitar todos' : `Todos (${filteredOrders.length})`}
                </button>
                <button
                  onClick={clearSelection}
                  className="min-h-9 min-w-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
                  aria-label="Cancelar selección"
                  title="Cancelar selección (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('pendiente', 'bordando')}
                className="shrink-0 min-h-11 px-3.5 rounded-2xl bg-purple-600/25 hover:bg-purple-600 text-purple-100 border border-purple-500/40 text-xs font-black flex items-center gap-1.5"
              >
                🪡 Alistando
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('en_camino', 'completado')}
                className="shrink-0 min-h-11 px-3.5 rounded-2xl bg-blue-600/25 hover:bg-blue-600 text-blue-100 border border-blue-500/40 text-xs font-black flex items-center gap-1.5"
              >
                🚚 Despachado
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('entregado', 'completado')}
                className="shrink-0 min-h-11 px-3.5 rounded-2xl bg-emerald-600/25 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5"
              >
                ✓ Entregado
              </button>
              <span className="w-px h-7 bg-white/10 shrink-0 mx-0.5" aria-hidden="true" />
              <button
                disabled={isProcessing}
                onClick={() => {
                  if (selectedShalomOrders.length === 0) {
                    toast('Ninguno de los seleccionados es envío por Shalom.', 'warning');
                    return;
                  }
                  setShowShalomRegister(true);
                }}
                className="shrink-0 min-h-11 px-3.5 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                <Truck className="w-4 h-4" />
                Registrar en Shalom{selectedShalomOrders.length > 0 ? ` (${selectedShalomOrders.length})` : ''}
              </button>
              <button
                disabled={isProcessing}
                onClick={() => setShowBulkPrint(true)}
                className="shrink-0 min-h-11 px-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/15 text-xs font-black flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Rótulos ({selectedOrders.length})
              </button>
              <button
                disabled={isProcessing}
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 min-h-11 min-w-11 rounded-2xl bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 flex items-center justify-center"
                aria-label="Eliminar seleccionados"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Indicadores del día */}
      <section aria-label="Resumen del día" className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {kpiCards.map(card => {
          const isActive = card.id === 'none' ? statusFilter === 'almacen' && quickFilter === 'none' : quickFilter === card.id;
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                if (card.id === 'none') {
                  setQuickFilter('none');
                  setDateFilterType('none');
                  setStatusFilter(prev => (prev === 'almacen' ? 'all' : 'almacen'));
                } else {
                  applyQuickFilter(card.id);
                }
              }}
              aria-pressed={isActive}
              className={`text-left px-3 py-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all active:scale-[0.98] ${
                isActive ? card.activeTone : 'border-white/10 bg-slate-950/50 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.tone}`} />
              </div>
              <div className={`text-2xl sm:text-3xl font-black sm:mt-1 leading-tight ${card.tone}`}>{card.value}</div>
              <div className="hidden sm:block text-[11px] text-slate-500 mt-0.5 truncate">{card.hint}</div>
            </button>
          );
        })}
      </section>

      {/* Búsqueda y filtros */}
      <section className="glass-panel p-3 sm:p-4 rounded-3xl border border-white/10 space-y-3 shadow-xl">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, DNI, celular, código o guía"
              aria-label="Buscar pedidos"
              className="w-full min-h-11 pl-10 pr-10 bg-slate-950/60 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white"
                aria-label="Borrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-white/15 text-[10px] font-mono text-slate-500">/</kbd>
            )}
          </div>

          <label className="relative flex-1 sm:flex-none" title="Ordenar pedidos">
            <span className="sr-only">Ordenar</span>
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="appearance-none w-full min-h-11 pl-9 pr-3 bg-slate-950/60 border border-white/10 rounded-2xl text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="fecha_envio">Ordenar: fecha de envío</option>
              <option value="recientes">Ordenar: más recientes</option>
              <option value="antiguos">Ordenar: más antiguos</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </label>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Actualizar pedidos"
            aria-label="Actualizar pedidos"
            className="shrink-0 min-h-11 min-w-11 bg-slate-950/60 hover:bg-slate-900 text-slate-300 hover:text-white border border-white/10 rounded-2xl flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Pestañas del flujo de trabajo */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Estado del pedido">
          {statusTabs.map(tab => {
            const isActive = statusFilter === tab.id && quickFilter === 'none';
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setQuickFilter('none');
                }}
                className={`shrink-0 min-h-10 px-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  isActive ? `${tab.active} shadow-md` : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`min-w-5 px-1.5 rounded-full text-[11px] font-black ${isActive ? 'bg-black/20' : 'bg-white/10 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Agencia + herramientas de fecha */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 max-w-full">
            {transportChips.map(chip => {
              const isActive = transportFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setTransportFilter(chip.id)}
                  aria-pressed={isActive}
                  className={`shrink-0 min-h-9 px-3 rounded-xl text-xs font-bold border transition-all ${
                    isActive ? chip.active : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {chip.label} <span className="opacity-70">({chip.count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {statusFilter === 'entregado' && (
              <button
                onClick={handleSyncShalomTracking}
                disabled={isTrackingSyncing}
                className="min-h-9 px-3 rounded-xl bg-teal-600/20 hover:bg-teal-600/40 text-teal-200 border border-teal-500/40 text-xs font-bold flex items-center gap-1.5"
                title="Consultar a Shalom si algún paquete ya llegó a destino"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTrackingSyncing ? 'animate-spin' : ''}`} />
                <span>{isTrackingSyncing ? 'Verificando…' : 'Rastrear Shalom'}</span>
              </button>
            )}
            <button
              onClick={() => setShowDateTools(v => !v)}
              aria-expanded={showDateTools}
              className={`min-h-9 px-3 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                showDateTools || dateFilterType !== 'none'
                  ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtrar por fecha</span>
              {dateFilterType !== 'none' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Panel de fechas (plegable) */}
        {(showDateTools || dateFilterType !== 'none') && (
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2.5 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'none' as const, label: 'Sin filtro' },
                { id: 'registrado' as const, label: `Registrados (${dateCounts.registrados})` },
                { id: 'programado' as const, label: `Programados (${dateCounts.programados})` },
                { id: 'entregado' as const, label: `Entregados (${dateCounts.entregados})` },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setDateFilterType(opt.id);
                    setQuickFilter('none');
                  }}
                  aria-pressed={dateFilterType === opt.id}
                  className={`min-h-9 px-3 rounded-xl text-xs font-bold transition-all ${
                    dateFilterType === opt.id ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Ayer', offset: -1 },
                { label: 'Hoy', offset: 0 },
                { label: 'Mañana', offset: 1 },
              ].map(q => (
                <button
                  key={q.label}
                  onClick={() => setQuickDate(q.offset)}
                  className="min-h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200"
                >
                  {q.label}
                </button>
              ))}
              <input
                type="date"
                value={dateFilterValue}
                onChange={(e) => setDateFilterValue(e.target.value)}
                aria-label="Fecha a consultar"
                className="min-h-9 px-3 bg-slate-900 border border-cyan-500/40 rounded-xl text-xs font-mono font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        )}

        {/* Resumen de filtros activos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Mostrando <strong className="text-white">{filteredOrders.length}</strong> {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
              {quickFilter === 'hoy' && ' que salen hoy'}
              {quickFilter === 'atrasados' && ' atrasados'}
              {quickFilter === 'entregados_hoy' && ' entregados hoy'}
              {quickFilter === 'duplicados' && ' de clientas con varios pedidos activos'}
              {dateFilterType !== 'none' && ` ${dateFilterType === 'registrado' ? 'registrados el' : dateFilterType === 'programado' ? 'programados para el' : 'entregados el'} ${formatFechaConDia(dateFilterValue)}`}
            </span>
            <button onClick={resetFilters} className="min-h-8 px-2.5 rounded-lg text-cyan-300 hover:text-white hover:bg-white/5 font-bold">
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      {/* Aviso de clientas con pedidos simultáneos (oportunidad de juntar envíos) */}
      {duplicateClientsCount > 0 && quickFilter !== 'duplicados' && (
        <div className="p-3 sm:p-4 rounded-3xl bg-amber-500/10 border border-amber-500/35 text-amber-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <strong className="text-sm font-black block">
                {duplicateClientsCount} {duplicateClientsCount === 1 ? 'clienta tiene' : 'clientas tienen'} varios pedidos activos
              </strong>
              <p className="text-xs text-amber-200/80">Júntalos en un solo paquete y ahorra un flete.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => applyQuickFilter('duplicados')}
            className="min-h-10 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
          >
            Revisar
          </button>
        </div>
      )}

      {/* Encabezado de lista + selección */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-black text-white">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
        </h2>
        {filteredOrders.length > 0 && (
          <button
            onClick={selectAll}
            className="min-h-9 px-3 rounded-xl text-xs font-bold text-cyan-300 hover:bg-white/5 flex items-center gap-1.5"
          >
            <CheckSquare className="w-4 h-4" />
            {allFilteredSelected ? 'Quitar selección' : 'Seleccionar todos'}
          </button>
        )}
      </div>

      {/* Lista */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-10 text-center rounded-3xl border border-white/10 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-2xl">
            {hasActiveFilters ? '🔍' : '🎉'}
          </div>
          <h3 className="text-base font-black text-white">
            {hasActiveFilters ? 'No hay pedidos con estos filtros' : '¡Todo despachado!'}
          </h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Prueba con otra búsqueda o limpia los filtros.'
              : 'No tienes pedidos pendientes. Los nuevos aparecerán aquí al instante.'}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="min-h-10 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-black">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {visibleOrders.map(order => renderOrderCard(order))}
          </div>
          {filteredOrders.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="min-h-11 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white"
              >
                Ver más ({filteredOrders.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* Cambio de estado manual */}
      {swipeTargetOrder && createPortal(
        <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn" data-no-print="true" onClick={() => setSwipeTargetOrder(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-status-title"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 sm:p-6 space-y-4 shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 id="move-status-title" className="text-base font-black text-white">Cambiar estado</h3>
                <p className="text-xs text-slate-400 font-mono">#{swipeTargetOrder.codigo_seguimiento} • {swipeTargetOrder.usuario?.nombre_completo || 'Cliente'}</p>
              </div>
              <button onClick={() => setSwipeTargetOrder(null)} className="min-w-10 min-h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {([
                { stage: 'almacen', envio: 'pendiente', prod: 'en_cola', icon: '🏬', title: 'En almacén', desc: 'Recibido, en cola para alistar', cls: 'bg-slate-800/80 border-white/10' },
                { stage: 'alistando', envio: 'pendiente', prod: 'bordando', icon: '🪡', title: 'Alistando', desc: 'Empaquetando y rotulando', cls: 'bg-purple-950/40 border-purple-500/30' },
                { stage: 'despachando', envio: 'en_camino', prod: 'completado', icon: '🚚', title: 'Despachado', desc: 'Dejado en la agencia o en ruta', cls: 'bg-blue-950/40 border-blue-500/30' },
                { stage: 'entregado', envio: 'entregado', prod: 'completado', icon: '✅', title: 'Entregado', desc: 'Proceso completado', cls: 'bg-emerald-950/40 border-emerald-500/30' },
              ] as const).map(opt => {
                const isCurrent = getStage(swipeTargetOrder) === opt.stage;
                return (
                  <button
                    key={opt.stage}
                    type="button"
                    disabled={busyOrderId === swipeTargetOrder.id}
                    onClick={() => handleSingleOrderMove(swipeTargetOrder.id, opt.envio, opt.prod)}
                    className={`w-full min-h-14 p-3.5 rounded-2xl border text-left flex items-center justify-between group transition-all hover:brightness-125 ${opt.cls} ${isCurrent ? 'ring-2 ring-cyan-400' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <strong className="text-sm font-black text-white block">{opt.title}</strong>
                        <span className="text-xs text-slate-400">{opt.desc}</span>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-[11px] font-black text-cyan-300">Actual</span>
                    ) : (
                      <MoveRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Asistente de registro en Shalom */}
      {showShalomRegister && (
        <ShalomRegisterModal
          pedidos={selectedShalomOrders}
          totalSelectedCount={selectedOrders.length}
          tallerConfig={tallerConfig}
          onClose={() => setShowShalomRegister(false)}
          onRegistered={async (results) => {
            for (const r of results) {
              // SEGURIDAD CRÍTICA: SOLO actualizar pedidos que realmente tengan OSE ID o Guía oficial emitida por Shalom
              if (!r.oseId && (!r.guideNumber || r.guideNumber.startsWith('SH-') || r.guideNumber === 'S/G')) {
                console.warn(`[ON REGISTERED SKIP] Pedido ${r.pedidoId} no fue emitido en Shalom (sin OSE ID/Guía oficial). No se modifica en base de datos.`);
                continue;
              }

              const currentOrder = pedidos.find(p => p.id === r.pedidoId);
              let newDestino = currentOrder?.destino_detalle || '';
              if (r.dni && r.dni.toUpperCase() !== 'NCIADOS' && r.dni.replace(/\D/g, '').length >= 6 && !newDestino.includes(r.dni)) {
                if (newDestino.includes('(DNI')) {
                  newDestino = newDestino.replace(/\(DNI[^)]*\)/gi, `(DNI: ${r.dni})`);
                } else {
                  newDestino = `${newDestino} (DNI: ${r.dni})`.trim();
                }
              }

              // Si ya estaba completado en producción pasa a en_camino, sino mantiene su estado de producción actual
              const nextEnvio = currentOrder?.estado_produccion === 'completado' ? 'en_camino' : (currentOrder?.estado_envio || 'pendiente');

              await updatePedido(r.pedidoId, {
                registrado_shalom: true,
                rotulado: true,
                estado_envio: nextEnvio,
                shalom_ose_id: r.oseId ? String(r.oseId) : null,
                shalom_numero_guia: r.guideNumber || null,
                shalom_clave_recojo: r.pickupCode || null,
                destino_detalle: newDestino || undefined,
                usuario: currentOrder?.usuario ? {
                  ...currentOrder.usuario,
                  dni: (r.dni && r.dni !== 'NCIADOS') ? r.dni : (currentOrder.usuario.dni || ''),
                  telefono_default: r.phone || currentOrder.usuario.telefono_default || '',
                  nombre_completo: r.name || currentOrder.usuario.nombre_completo || '',
                } : undefined,
              });
            }
          }}
        />
      )}

      {/* Impresión de rótulos en lote */}
      {showBulkPrint && (
        <BulkPrintModal
          pedidos={selectedOrders.length > 0 ? selectedOrders : filteredOrders}
          tallerConfig={tallerConfig}
          onClose={() => setShowBulkPrint(false)}
          onPrintComplete={handleBulkPrintComplete}
        />
      )}

      {/* Rótulo individual */}
      {selectedLabelOrder && (
        <ShalomLabelModal
          pedido={selectedLabelOrder}
          tallerConfig={tallerConfig}
          onClose={() => setSelectedLabelOrder(null)}
        />
      )}

      {/* Edición de pedido */}
      {editingPedido && (
        <EditOrderModal
          pedido={editingPedido}
          onClose={() => setEditingPedido(null)}
          onSave={async (id, updates) => {
            await updatePedido(id, updates);
            setEditingPedido(null);
            toast('Cambios guardados');
          }}
        />
      )}

      {/* Confirmación de borrado en lote */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn" data-no-print="true" onClick={() => setShowDeleteConfirm(false)}>
          <div role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 text-center shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">
              ¿Eliminar {selectedIds.length} {selectedIds.length === 1 ? 'pedido' : 'pedidos'}?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Esta acción no se puede deshacer. Los pedidos se borrarán de forma permanente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="flex-1 min-h-11 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-600/30 disabled:opacity-60"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Aviso por WhatsApp tras cambio de estado */}
      {notifyModalData && (
        <OrderStatusNotifyModal
          orders={notifyModalData.orders}
          statusName={notifyModalData.statusName}
          onClose={() => setNotifyModalData(null)}
        />
      )}

      {/* Entrega oficial Shalom (voucher + clave) */}
      {deliveryTargetOrders && (
        <ShalomDeliveryModal
          isOpen={Boolean(deliveryTargetOrders)}
          orders={deliveryTargetOrders}
          tallerConfig={tallerConfig}
          onClose={() => setDeliveryTargetOrders(null)}
          onOrdersDelivered={async (deliveredIds, updatedMeta) => {
            for (const id of deliveredIds) {
              const meta = updatedMeta?.[id];
              const isRealGuia = meta?.guia && meta.guia !== 'S/G' && !meta.guia.startsWith('SH-');
              await updatePedido(id, {
                estado_envio: 'entregado',
                registrado_shalom: true,
                ...(isRealGuia ? { shalom_numero_guia: meta.guia } : {}),
                ...(meta?.pickupCode ? { shalom_clave_recojo: meta.pickupCode } : {}),
                ...(meta?.oseId ? { shalom_ose_id: meta.oseId } : {}),
              });
            }
            clearSelection();
            setDeliveryTargetOrders(null);
            toast(`${deliveredIds.length} ${deliveredIds.length === 1 ? 'pedido entregado' : 'pedidos entregados'}`);
          }}
        />
      )}
    </div>
  );
};
