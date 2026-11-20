import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { EditOrderModal } from './EditOrderModal';
import { getVisibleCustomFields } from '../../utils/customFields';

import { BulkPrintModal } from './BulkPrintModal';
import { ShalomLabelModal } from './ShalomLabelModal';
import { ShalomRegisterModal } from './ShalomRegisterModal';
import {
  ShalomDeliveryModal,
  DeliveryCompletionResult,
  DeliveryFolderChoice,
} from './ShalomDeliveryModal';
import { OrderStatusNotifyModal } from './OrderStatusNotifyModal';
import { MovementsHistoryModal } from './MovementsHistoryModal';
import {
  activityLogService,
  ACTIVITY_LOG_EVENT,
  buildOrderSnapshot,
  getCarpetaLabel,
} from '../../services/activityLogService';

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
  SlidersHorizontal,
  Check,
  Users,
  FolderInput,
  History,
  Tag,
  ShieldCheck,
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
// Flujo de trabajo (Carpetas): Almacén → Alistando → Despachados → Entregados
// ---------------------------------------------------------------------------
type Stage = 'almacen' | 'alistando' | 'despachando' | 'entregado';
type StatusFilter = 'all' | 'almacen' | 'alistando' | 'dejando_shalom' | 'entregado';
type PrepFilter = 'all' | 'sin_rotular' | 'rotulados' | 'sin_registrar' | 'registrados';
type QuickFilter = 'none' | 'hoy' | 'atrasados' | 'duplicados';
type SortMode = 'fecha_envio' | 'recientes' | 'antiguos';

const PAGE_SIZE = 24;

const getStage = (order: Pedido): Stage => {
  if (order.estado_envio === 'entregado') return 'entregado';
  if (
    order.estado_envio === 'en_camino' ||
    order.estado_envio === 'listo_para_recojo' ||
    (order.estado_produccion === 'completado' && order.estado_envio === 'pendiente')
  ) {
    return 'despachando';
  }
  if (order.estado_produccion === 'bordando') return 'alistando';
  return 'almacen';
};

const FOLDER_DEFS: {
  stage: Stage;
  envio: EstadoEnvio;
  prod: EstadoProduccion;
  icon: string;
  title: string;
  desc: string;
  cls: string;
}[] = [
  {
    stage: 'almacen',
    envio: 'pendiente',
    prod: 'en_cola',
    icon: '🏬',
    title: 'En almacén',
    desc: 'Recibido, pendiente de alistar',
    cls: 'bg-amber-950/35 border-amber-500/35',
  },
  {
    stage: 'alistando',
    envio: 'pendiente',
    prod: 'bordando',
    icon: '🪡',
    title: 'Alistando',
    desc: 'Empaquetando y rotulando',
    cls: 'bg-purple-950/35 border-purple-500/35',
  },
  {
    stage: 'despachando',
    envio: 'en_camino',
    prod: 'completado',
    icon: '🚚',
    title: 'Despachados',
    desc: 'Dejado en agencia o en ruta',
    cls: 'bg-blue-950/35 border-blue-500/35',
  },
  {
    stage: 'entregado',
    envio: 'entregado',
    prod: 'completado',
    icon: '✅',
    title: 'Entregados',
    desc: 'Revisar guía / enviar PDF y cerrar',
    cls: 'bg-emerald-950/35 border-emerald-500/35',
  },
];

const folderChoiceToEstados = (
  folder: Exclude<DeliveryFolderChoice, 'keep'>
): { envio: EstadoEnvio; prod: EstadoProduccion } => {
  if (folder === 'entregado') return { envio: 'entregado', prod: 'completado' };
  if (folder === 'despachando') return { envio: 'en_camino', prod: 'completado' };
  if (folder === 'alistando') return { envio: 'pendiente', prod: 'bordando' };
  return { envio: 'pendiente', prod: 'en_cola' };
};

const NEXT_STEP: Record<
  Exclude<Stage, 'entregado'>,
  { label: string; envio: EstadoEnvio; prod: EstadoProduccion; className: string }
> = {
  almacen: {
    label: 'Empezar a alistar',
    envio: 'pendiente',
    prod: 'bordando',
    className: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25',
  },
  alistando: {
    label: 'Pasar a Despachados',
    envio: 'en_camino',
    prod: 'completado',
    className: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25',
  },
  despachando: {
    label: 'Entregar y revisar envío',
    envio: 'entregado',
    prod: 'completado',
    className: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25',
  },
};

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const isShalomOrder = (o: Pedido) =>
  o.metodo_envio_codigo === 'shalom' || Boolean(o.destino_detalle?.toLowerCase().includes('shalom'));
const isOlvaOrder = (o: Pedido) =>
  o.metodo_envio_codigo === 'olva' || Boolean(o.destino_detalle?.toLowerCase().includes('olva'));
const isMotoOrder = (o: Pedido) =>
  o.metodo_envio_codigo === 'motorizado' || Boolean(o.destino_detalle?.toLowerCase().includes('motorizado'));

const getDeliveryDate = (o: Pedido) =>
  getOrderDateOnly((o as any).campos_personalizados?.fecha_entrega || o.updated_at);

const getOrderDni = (order: Pedido): string => {
  let dni = order.usuario?.dni || order.usuario?.dni_default || '';
  if (!dni || dni.startsWith('usr-') || dni === '00000000' || dni === 'NCIADOS') {
    const matchDoc = String(order.destino_detalle || '').match(
      /\b(?:DNI[\s/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i
    );
    const docCandidate = matchDoc && matchDoc[1] ? matchDoc[1].trim() : '';
    dni =
      docCandidate &&
      !docCandidate.startsWith('usr-') &&
      docCandidate.toUpperCase() !== 'NCIADOS' &&
      docCandidate.replace(/\D/g, '').length >= 6
        ? docCandidate
        : '';
  }
  return dni;
};

const getClientKey = (order: Pedido): string => {
  const dni = getOrderDni(order).trim();
  const key =
    dni ||
    getCleanClientPhone(order) ||
    order.usuario?.nombre_completo?.trim().toLowerCase() ||
    '';
  if (!key || key === 'cliente' || key === '00000000' || key.toLowerCase() === 'encomi envíos') return '';
  return key;
};

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
    refreshData,
  } = useOrders();
  const { currentEmpresa } = useAuth();
  const { toast, confirm } = useFeedback();
  const empresaId = currentEmpresa?.id || 'empresa-master-comikids';

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

  // Filtros simplificados y claros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [transportFilter, setTransportFilter] = useState<'all' | 'shalom' | 'motorizado' | 'olva'>('all');
  const [prepFilter, setPrepFilter] = useState<PrepFilter>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none');
  const [sortMode, setSortMode] = useState<SortMode>('fecha_envio');
  const [dateFilterType, setDateFilterType] = useState<'none' | 'registrado' | 'programado' | 'entregado'>('none');
  const [dateFilterValue, setDateFilterValue] = useState<string>(() => toLocalDate(new Date()));

  // Paneles y modales
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBulkMoveSheet, setShowBulkMoveSheet] = useState(false);
  const [isTrackingSyncing, setIsTrackingSyncing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Contador de movimientos de hoy para badge del botón Historial
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => {
    const onLog = () => setHistoryTick(t => t + 1);
    window.addEventListener(ACTIVITY_LOG_EVENT, onLog);
    return () => window.removeEventListener(ACTIVITY_LOG_EVENT, onLog);
  }, []);

  const today = toLocalDate(new Date());
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDate(d);
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDate(d);
  }, []);
  const dayAfterTomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toLocalDate(d);
  }, []);

  const todayHistoryCount = useMemo(() => {
    void historyTick;
    const all = activityLogService.buildUnifiedHistory(empresaId, pedidos);
    return all.filter(m => getOrderDateOnly(m.created_at) === today).length;
  }, [empresaId, pedidos, today, historyTick]);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionMode = selectedIds.length > 0;

  // Modales operativos
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<Pedido | null>(null);
  const [shalomRegisterOrders, setShalomRegisterOrders] = useState<Pedido[] | null>(null);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeTargetOrder, setSwipeTargetOrder] = useState<Pedido | null>(null);
  const [deliveryTargetOrders, setDeliveryTargetOrders] = useState<Pedido[] | null>(null);
  const [notifyModalData, setNotifyModalData] = useState<{
    orders: Pedido[];
    statusName: string;
  } | null>(null);
  const [changeDateOrder, setChangeDateOrder] = useState<Pedido | null>(null);
  const [changeDateCustomValue, setChangeDateCustomValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const getStatusLabel = (envio: EstadoEnvio, prod?: EstadoProduccion): string => {
    if (envio === 'entregado') return 'Entregados';
    if (envio === 'listo_para_recojo') return 'Listo para recoger';
    if (envio === 'en_camino' || (prod === 'completado' && envio === 'pendiente')) return 'Despachados';
    if (prod === 'bordando') return 'Alistando';
    return 'En almacén';
  };

  const wasEdited = (createdAt?: string, updatedAt?: string): boolean => {
    if (!createdAt || !updatedAt) return false;
    return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 60000;
  };

  // Pedidos repetidos de la misma clienta
  const duplicateOrdersMap = useMemo(() => {
    const map = new Map<string, { count: number; orderIds: string[]; clientName: string }>();
    for (const order of pedidos) {
      if (order.estado_envio === 'entregado') continue;
      const key = getClientKey(order);
      if (!key) continue;
      const item = map.get(key) || {
        count: 0,
        orderIds: [],
        clientName: order.usuario?.nombre_completo || 'Cliente',
      };
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

  // Contadores globales rápidos
  const counts = useMemo(() => {
    const c = {
      all: 0,
      almacen: 0,
      alistando: 0,
      dejando_shalom: 0,
      entregado: 0,
      shalom: 0,
      olva: 0,
      motorizado: 0,
      hoy: 0,
      atrasados: 0,
      sinRotular: 0,
      sinRegistrar: 0,
    };
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
      if (isShalomOrder(p)) {
        c.shalom++;
        if (!p.registrado_shalom) c.sinRegistrar++;
      }
      if (isOlvaOrder(p)) c.olva++;
      if (isMotoOrder(p)) c.motorizado++;
      if (!p.rotulado) c.sinRotular++;
      const f = getOrderDateOnly(p.fecha_limite);
      if (f === today) c.hoy++;
      else if (f && f < today) c.atrasados++;
    }
    return c;
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

  const matchesPrep = (order: Pedido): boolean => {
    if (prepFilter === 'all') return true;
    if (prepFilter === 'sin_rotular') return !order.rotulado;
    if (prepFilter === 'rotulados') return Boolean(order.rotulado);
    if (prepFilter === 'sin_registrar') return isShalomOrder(order) && !order.registrado_shalom;
    return isShalomOrder(order) && Boolean(order.registrado_shalom);
  };

  // Pedidos filtrados y ordenados
  const filteredOrders = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    const list = pedidos.filter(order => {
      if (!matchesSearch(order, query)) return false;
      if (!matchesTransport(order)) return false;
      if (!matchesPrep(order)) return false;

      // Atajos rápidos
      if (quickFilter !== 'none') {
        if (order.estado_envio === 'entregado') return false;
        const f = getOrderDateOnly(order.fecha_limite);
        if (quickFilter === 'hoy') return f === today;
        if (quickFilter === 'atrasados') return Boolean(f) && f < today;
        if (quickFilter === 'duplicados') {
          const key = getClientKey(order);
          return Boolean(key && (duplicateOrdersMap.get(key)?.count || 0) >= 2);
        }
      }

      // Filtro por fecha
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
  }, [
    pedidos,
    searchTerm,
    statusFilter,
    transportFilter,
    prepFilter,
    dateFilterType,
    dateFilterValue,
    quickFilter,
    sortMode,
    duplicateOrdersMap,
    today,
  ]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, statusFilter, transportFilter, prepFilter, dateFilterType, dateFilterValue, quickFilter, sortMode]);

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

  // Atajos de teclado
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

  // Cambio masivo de carpeta
  const handleMassStatusUpdate = async (envio: EstadoEnvio, prod?: EstadoProduccion) => {
    if (selectedIds.length === 0) return;
    const affectedOrders = pedidos.filter(p => selectedIds.includes(p.id));
    const statusName = getStatusLabel(envio, prod);

    // Al elegir Entregados: abrir siempre el Revisor & Bot de Entrega para revisar quién tiene envío en Shalom Pro / API
    if (envio === 'entregado') {
      const hasShalom = affectedOrders.some(isShalomOrder);
      if (hasShalom) {
        setShowBulkMoveSheet(false);
        setDeliveryTargetOrders(affectedOrders);
        return;
      }
    }

    setIsProcessing(true);
    setShowBulkMoveSheet(false);
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
      toast(`${n} ${n === 1 ? 'pedido eliminado' : 'pedidos eliminados'} (puedes restaurarlo en Historial)`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleOrderMove = async (orderId: string, envio: EstadoEnvio, prod?: EstadoProduccion) => {
    const targetOrder = pedidos.find(p => p.id === orderId);
    const statusName = getStatusLabel(envio, prod);

    // Entregado + Shalom → abrir Revisor oficial Shalom Pro & Bot
    if (envio === 'entregado' && targetOrder && isShalomOrder(targetOrder)) {
      setSwipeTargetOrder(null);
      setDeliveryTargetOrders([targetOrder]);
      return;
    }

    setBusyOrderId(orderId);
    try {
      // Un solo updatePedido para generar UN solo registro limpio en el historial
      await updatePedido(orderId, {
        estado_envio: envio,
        ...(prod ? { estado_produccion: prod } : {}),
      });
      setSwipeTargetOrder(null);
      toast(`#${targetOrder?.codigo_seguimiento || ''} movido a ${statusName}`);
      if (targetOrder) {
        setNotifyModalData({ orders: [targetOrder], statusName });
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo cambiar la carpeta. Intenta de nuevo.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  // Callback completo del modal de Entrega & Revisión Shalom/Bot
  const handleDeliveryComplete = async (result: DeliveryCompletionResult) => {
    const historyItems: Array<{
      pedido_id: string;
      codigo_seguimiento: string;
      cliente_nombre: string;
      metodo_envio?: string;
      antes?: ReturnType<typeof buildOrderSnapshot>;
      despues?: ReturnType<typeof buildOrderSnapshot>;
      cambios_legibles: string[];
    }> = [];

    const nowDate = toLocalDate(new Date());

    // 1. Los enviados por Bot se mueven automáticamente a Entregados
    for (const id of result.botSentIds) {
      const orig = pedidos.find(p => p.id === id);
      if (!orig) continue;
      const meta = result.updatedMeta[id];
      const isRealGuia = meta?.guia && meta.guia !== 'S/G' && !meta.guia.startsWith('SH-');
      const updates: Partial<Pedido> = {
        estado_envio: 'entregado',
        estado_produccion: 'completado',
        ...(meta?.verifiedInShalom || isRealGuia ? { registrado_shalom: true } : {}),
        ...(isRealGuia ? { shalom_numero_guia: meta!.guia } : {}),
        ...(meta?.pickupCode ? { shalom_clave_recojo: meta.pickupCode } : {}),
        ...(meta?.oseId ? { shalom_ose_id: meta.oseId } : {}),
        campos_personalizados: {
          ...(orig.campos_personalizados || {}),
          fecha_entrega: nowDate,
        },
      };

      const antes = buildOrderSnapshot(orig);
      await updatePedido(id, updates, { skipLog: true });
      const despues = buildOrderSnapshot({ ...orig, ...updates });

      historyItems.push({
        pedido_id: orig.id,
        codigo_seguimiento: orig.codigo_seguimiento,
        cliente_nombre: antes.cliente_nombre,
        metodo_envio: orig.metodo_envio_nombre || orig.metodo_envio_codigo,
        antes,
        despues,
        cambios_legibles: [
          'Bot WA enviado',
          `Carpeta: ${getCarpetaLabel(orig.estado_envio, orig.estado_produccion)} → Entregados`,
          ...(isRealGuia ? [`Guía: ${meta!.guia}`] : []),
        ],
      });
    }

    // 2. Los demás movidos según la elección del usuario
    for (const move of result.otherMoves) {
      const orig = pedidos.find(p => p.id === move.orderId);
      if (!orig) continue;
      const meta = result.updatedMeta[move.orderId];
      const isRealGuia = meta?.guia && meta.guia !== 'S/G' && !meta.guia.startsWith('SH-');
      const { envio, prod } = folderChoiceToEstados(move.targetFolder);
      const targetLabel = getCarpetaLabel(envio, prod);

      const updates: Partial<Pedido> = {
        estado_envio: envio,
        estado_produccion: prod,
        ...(meta?.verifiedInShalom || isRealGuia ? { registrado_shalom: true } : {}),
        ...(isRealGuia ? { shalom_numero_guia: meta!.guia } : {}),
        ...(meta?.pickupCode ? { shalom_clave_recojo: meta.pickupCode } : {}),
        ...(meta?.oseId ? { shalom_ose_id: meta.oseId } : {}),
        ...(envio === 'entregado'
          ? {
              campos_personalizados: {
                ...(orig.campos_personalizados || {}),
                fecha_entrega: nowDate,
              },
            }
          : {}),
      };

      const antes = buildOrderSnapshot(orig);
      await updatePedido(move.orderId, updates, { skipLog: true });
      const despues = buildOrderSnapshot({ ...orig, ...updates });

      historyItems.push({
        pedido_id: orig.id,
        codigo_seguimiento: orig.codigo_seguimiento,
        cliente_nombre: antes.cliente_nombre,
        metodo_envio: orig.metodo_envio_nombre || orig.metodo_envio_codigo,
        antes,
        despues,
        cambios_legibles: [
          'Sin bot',
          `Carpeta: ${getCarpetaLabel(orig.estado_envio, orig.estado_produccion)} → ${targetLabel}`,
        ],
      });
    }

    // Guardar UN solo movimiento claro y revertible en el Historial
    if (historyItems.length > 0) {
      activityLogService.recordMovimiento(empresaId, {
        tipo: result.botSentIds.length > 0 ? 'entrega_bot' : 'mover_carpeta',
        titulo:
          result.botSentIds.length > 0
            ? `Entrega con Bot (${result.botSentIds.length} enviado${result.botSentIds.length === 1 ? '' : 's'})`
            : `Moviste ${historyItems.length} ${historyItems.length === 1 ? 'pedido' : 'pedidos'} en revisión de entrega`,
        detalle: result.summaryText,
        origen: 'admin',
        puede_revertir: true,
        pedidos_afectados: historyItems,
      });
    }

    clearSelection();
    toast(result.summaryText || 'Entrega procesada', 'success');
  };

  const handleSaveOrderDate = async (orderId: string, newDate: string | null) => {
    setIsProcessing(true);
    try {
      await updatePedido(orderId, { fecha_limite: (newDate ? newDate : null) as any });
      setChangeDateOrder(null);
      toast(
        newDate ? `Fecha de envío cambiada a ${formatFechaConDia(newDate)}` : 'Fecha programada eliminada',
        'info'
      );
    } catch (err: any) {
      toast(err?.message || 'Error al actualizar fecha', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSingle = async (order: Pedido) => {
    const ok = await confirm({
      title: `¿Eliminar el pedido #${order.codigo_seguimiento}?`,
      message: `${order.usuario?.nombre_completo || 'Cliente'} • Podrás restaurarlo desde el Historial si lo necesitas.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    await deletePedido(order.id);
    toast('Pedido eliminado (restaurable en Historial)');
  };

  const handleUnlinkShalom = async (order: Pedido) => {
    const ok = await confirm({
      title: '¿Desvincular el despacho de Shalom?',
      message: 'Se borrará la guía y la clave de este pedido para que puedas registrarlo de nuevo.',
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

  // Al terminar de imprimir rótulos en lote: marcar rotulado + guardar 1 registro en historial
  const handleBulkPrintComplete = async (orderIds: string[]) => {
    const affected: Pedido[] = [];
    const items = [];
    for (const id of orderIds) {
      const orig = pedidos.find(p => p.id === id);
      if (!orig) continue;
      affected.push(orig);
      const antes = buildOrderSnapshot(orig);
      await updatePedido(id, { rotulado: true }, { skipLog: true });
      const despues = buildOrderSnapshot({ ...orig, rotulado: true });
      items.push({
        pedido_id: orig.id,
        codigo_seguimiento: orig.codigo_seguimiento,
        cliente_nombre: antes.cliente_nombre,
        metodo_envio: orig.metodo_envio_nombre || orig.metodo_envio_codigo,
        antes,
        despues,
        cambios_legibles: ['Rotulado: Sí (impresión de rótulo)'],
      });
    }
    if (items.length > 0) {
      activityLogService.recordMovimiento(empresaId, {
        tipo: 'rotulado',
        titulo:
          items.length === 1
            ? `Rotulaste #${items[0].codigo_seguimiento}`
            : `Rotulaste ${items.length} paquetes`,
        detalle: `Impresión de rótulos (${affected.length})`,
        origen: 'admin',
        puede_revertir: true,
        pedidos_afectados: items,
      });
      toast(`${items.length} ${items.length === 1 ? 'paquete marcado' : 'paquetes marcados'} como rotulados`);
    }
  };

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
          `Shalom verificado: ${data.report?.totalShippedOrdersChecked || 0} paquetes, ${data.report?.newlyArrivedCount || 0} nuevos en destino`,
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

  // Conteo de filtros activos dentro del panel "Filtros"
  const activeDrawerFiltersCount =
    (transportFilter !== 'all' ? 1 : 0) +
    (prepFilter !== 'all' ? 1 : 0) +
    (dateFilterType !== 'none' ? 1 : 0) +
    (sortMode !== 'fecha_envio' ? 1 : 0);

  const hasAnyFilter =
    Boolean(searchTerm) ||
    statusFilter !== 'all' ||
    transportFilter !== 'all' ||
    prepFilter !== 'all' ||
    dateFilterType !== 'none' ||
    quickFilter !== 'none';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTransportFilter('all');
    setPrepFilter('all');
    setDateFilterType('none');
    setQuickFilter('none');
    setSortMode('fecha_envio');
  };

  const applyQuickFilter = (qf: QuickFilter) => {
    setQuickFilter(prev => (prev === qf ? 'none' : qf));
    setStatusFilter('all');
    setDateFilterType('none');
  };

  const selectQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const targetDate = toLocalDate(d);
    if (dateFilterType !== 'none' && dateFilterValue === targetDate) {
      setDateFilterType('none');
    } else {
      setDateFilterValue(targetDate);
      if (dateFilterType === 'none') setDateFilterType('programado');
      setQuickFilter('none');
    }
  };

  // -------------------------------------------------------------------------
  // Tarjeta de pedido: Súper clara para celular, estado de rótulo y registro imposible de confundir
  // -------------------------------------------------------------------------
  const renderStageBadge = (order: Pedido) => {
    const stage = getStage(order);
    const isOlva = isOlvaOrder(order);
    const isMoto = order.metodo_envio_codigo === 'motorizado';
    if (stage === 'entregado') {
      return { text: 'Entregado', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40', icon: '✅' };
    }
    if (order.estado_envio === 'listo_para_recojo') {
      return { text: 'En agencia', cls: 'bg-teal-500/20 text-teal-200 border-teal-500/40', icon: '🏢' };
    }
    if (stage === 'despachando') {
      return {
        text: isMoto ? 'En ruta' : isOlva ? 'En Olva' : 'Despachado',
        cls: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
        icon: isMoto ? '🛵' : '🚚',
      };
    }
    if (stage === 'alistando') {
      return { text: 'Alistando', cls: 'bg-purple-500/20 text-purple-200 border-purple-500/40', icon: '🪡' };
    }
    return { text: 'Almacén', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40', icon: '🏬' };
  };

  const renderUrgency = (order: Pedido) => {
    const f = getOrderDateOnly(order.fecha_limite);
    if (!f) return { label: 'Sin fecha de envío', cls: 'bg-white/5 text-slate-400 border-white/10' };
    if (order.estado_envio === 'entregado') {
      return { label: `Envío ${formatShortDate(order.fecha_limite)}`, cls: 'bg-white/5 text-slate-300 border-white/10' };
    }
    const diff = daysBetween(today, f);
    if (diff < 0) {
      const n = Math.abs(diff);
      return {
        label: `Atrasado ${n}d · ${formatShortDate(order.fecha_limite)}`,
        cls: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
      };
    }
    if (diff === 0) {
      return {
        label: `Sale HOY · ${formatShortDate(order.fecha_limite)}`,
        cls: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
      };
    }
    if (diff === 1) {
      return {
        label: `Mañana · ${formatShortDate(order.fecha_limite)}`,
        cls: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/30',
      };
    }
    return {
      label: `${formatShortDate(order.fecha_limite)} (en ${diff}d)`,
      cls: 'bg-white/5 text-slate-200 border-white/10',
    };
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
    const isRotulado = Boolean(order.rotulado);
    const isRegistrado = Boolean(order.registrado_shalom);
    const hasShalomGuide = Boolean(
      order.shalom_numero_guia && order.shalom_numero_guia !== 'S/G' && !order.shalom_numero_guia.startsWith('SH-')
    );
    const isFullyPrepared = isRotulado && (!isShalom || isRegistrado);

    const matchedMethod = (shippingMethods || []).find(
      m =>
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
      : matchedMethod?.nombre || order.metodo_envio_nombre || 'Agencia';

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
        className={`relative flex flex-col rounded-3xl border border-l-4 backdrop-blur-xl transition-all overflow-hidden ${
          selectionMode ? 'cursor-pointer select-none' : ''
        } ${
          isSelected
            ? 'bg-cyan-950/55 border-cyan-400 ring-2 ring-cyan-400/70'
            : isFullyPrepared && stage !== 'entregado'
            ? 'bg-emerald-950/20 border-emerald-500/35'
            : isReadyForPickup
            ? 'bg-teal-950/30 border-teal-500/30'
            : 'bg-slate-950/60 border-white/10 hover:border-white/20'
        }`}
      >
        <div className="p-3.5 sm:p-4 space-y-2.5 flex-1">
          {/* FILA 1: Checkbox + Código + Agencia + Carpeta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  toggleSelect(order.id);
                }}
                aria-pressed={isSelected}
                aria-label={isSelected ? 'Quitar selección' : 'Seleccionar pedido'}
                className="-m-1.5 p-1.5 shrink-0 cursor-pointer"
              >
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors border-2 ${
                    isSelected
                      ? 'bg-cyan-400 border-cyan-400 text-slate-950'
                      : 'border-slate-600 bg-slate-900 text-transparent hover:border-cyan-400'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              </button>
              <span className="font-mono text-xs font-black text-slate-200 truncate">
                #{order.codigo_seguimiento}
              </span>
              <span
                className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border shrink-0"
                style={{
                  backgroundColor: `${agencyColor}20`,
                  borderColor: `${agencyColor}55`,
                  color: agencyColor === '#ffffff' ? '#ffffff' : agencyColor,
                }}
              >
                {agencyBadgeLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setSwipeTargetOrder(order);
              }}
              className={`min-h-7 px-2.5 rounded-xl text-[11px] font-black border flex items-center gap-1 shrink-0 cursor-pointer hover:brightness-125 ${badge.cls}`}
              title="Toca para mover de carpeta"
            >
              <span>{badge.icon}</span>
              <span>{badge.text}</span>
            </button>
          </div>

          {/* FILA 2: ESTADO DE ROTULADO Y REGISTRADO (IMPOSIBLE DE NO VER EN CELULAR) */}
          <div
            className={`grid gap-1.5 ${isShalom ? 'grid-cols-2' : 'grid-cols-1'}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => updatePedido(order.id, { rotulado: !isRotulado })}
              aria-pressed={isRotulado}
              className={`min-h-9 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isRotulado
                  ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200 shadow-sm shadow-cyan-500/15'
                  : 'bg-slate-900/70 border-dashed border-amber-400/45 text-amber-200/90 hover:bg-amber-500/10'
              }`}
              title={isRotulado ? 'Ya rotulado (toca para desmarcar)' : 'Toca para marcar como rotulado'}
            >
              {isRotulado ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span>ROTULADO</span>
                </>
              ) : (
                <>
                  <Tag className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>SIN ROTULAR</span>
                </>
              )}
            </button>

            {isShalom && (
              <button
                type="button"
                onClick={() => {
                  if (!isRegistrado) {
                    setShalomRegisterOrders([order]);
                  } else {
                    updatePedido(order.id, { registrado_shalom: false });
                  }
                }}
                aria-pressed={isRegistrado}
                className={`min-h-9 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isRegistrado
                    ? hasShalomGuide || order.shalom_ose_id
                      ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200 shadow-sm shadow-emerald-500/15'
                      : 'bg-indigo-500/20 border-indigo-400/70 text-indigo-200'
                    : 'bg-slate-900/70 border-dashed border-rose-400/45 text-rose-200/90 hover:bg-rose-500/10'
                }`}
                title={
                  isRegistrado
                    ? 'Registrado en Shalom (toca para desmarcar)'
                    : 'Sin registrar en Shalom — toca para registrar ahora'
                }
              >
                {isRegistrado ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>REGISTRADO</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    <span>SIN REGISTRAR</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* FILA 3: CLIENTA + TELÉFONO + WHATSAPP */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[15px] font-black text-white tracking-tight truncate">{clientName}</h4>
              {dni && <span className="text-[11px] font-mono text-slate-400 shrink-0">DNI {dni}</span>}
            </div>

            <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
              <span className="text-xs font-mono font-semibold text-slate-300 truncate">
                {clientPhone ? `+51 ${clientPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}` : 'Sin celular'}
              </span>
              {clientPhone ? (
                <a
                  href={`https://wa.me/51${clientPhone}?text=${encodeURIComponent(
                    `¡Hola ${clientName}! Te escribimos de ${
                      tallerConfig?.nombre_taller || 'Encomi Envíos'
                    } respecto a tu pedido #${order.codigo_seguimiento}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black active:scale-95 transition-all shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPedido(order)}
                  className="min-h-8 px-2.5 rounded-xl border border-dashed border-white/20 text-[11px] font-bold text-slate-300 hover:text-cyan-300 cursor-pointer"
                >
                  + Celular
                </button>
              )}
            </div>
          </div>

          {/* FILA 4: FECHA DE ENVÍO */}
          <div
            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${urgency.cls}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 shrink-0 opacity-85" />
              <span className="text-xs font-bold truncate">{urgency.label}</span>
            </div>
            {stage !== 'entregado' && (
              <button
                type="button"
                onClick={() => {
                  setChangeDateOrder(order);
                  setChangeDateCustomValue(getOrderDateOnly(order.fecha_limite) || today);
                }}
                className="shrink-0 px-2 py-0.5 rounded-lg bg-black/25 hover:bg-black/45 text-[11px] font-bold border border-white/10 cursor-pointer"
              >
                Cambiar
              </button>
            )}
          </div>

          {/* FILA 5: DESTINO + AGENCIA SHALOM + GUÍA */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-xs leading-snug text-slate-300 break-words line-clamp-2" title={order.destino_detalle}>
                {order.destino_detalle}
              </p>
            </div>

            {isShalom &&
              (() => {
                const agencyInfo = resolveShalomAgencyDetails(order.destino_detalle);
                return (
                  <div className="space-y-1.5">
                    {!agencyInfo.isVerified ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingPedido(order);
                        }}
                        className="w-full flex items-center gap-1.5 text-left text-[11px] text-amber-100 bg-amber-500/15 px-2.5 py-1.5 rounded-xl border border-amber-500/40 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          <strong>Agencia no reconocida.</strong> Toca para corregir.
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-200 bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-500/25">
                        <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-white">{agencyInfo.officialDestination}</strong>
                        </span>
                        {agencyInfo.code && (
                          <span className="text-[10px] font-mono text-rose-200 bg-rose-900/60 px-1.5 rounded font-black shrink-0 ml-auto">
                            {agencyInfo.code}
                          </span>
                        )}
                      </div>
                    )}

                    {isRegistrado && (
                      <div
                        className="flex items-center justify-between gap-2 text-[11px] text-emerald-200 bg-emerald-950/50 px-2.5 py-1.5 rounded-xl border border-emerald-500/35"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">
                            {order.shalom_numero_guia || order.shalom_ose_id ? (
                              <>
                                Guía:{' '}
                                <strong className="text-white font-mono">
                                  {order.shalom_numero_guia || `OSE #${order.shalom_ose_id}`}
                                </strong>
                              </>
                            ) : (
                              <span className="text-amber-300">Registrado (sin guía aún)</span>
                            )}
                          </span>
                          {order.shalom_clave_recojo && (
                            <span className="text-[10px] font-mono font-black text-amber-200 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/35 shrink-0">
                              PIN {order.shalom_clave_recojo}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlinkShalom(order)}
                          className="p-1 -m-1 rounded-lg text-slate-400 hover:text-rose-400 shrink-0 cursor-pointer"
                          title="Desvincular guía Shalom"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {isReadyForPickup && (
            <div className="px-2.5 py-1.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-teal-100 text-xs">
              <strong className="text-teal-300">🏢 Llegó a agencia destino</strong>
              <span className="block font-mono text-[11px] text-teal-200/80">
                Envío {order.shalom_numero_guia?.replace(/\D/g, '') || order.codigo_seguimiento}
                {order.shalom_clave_recojo ? ` · Clave ${order.shalom_clave_recojo}` : ''}
              </span>
            </div>
          )}

          {/* Campos extra y notas */}
          {(() => {
            const visibleExtras = getVisibleCustomFields(order.campos_personalizados, matchedMethod, {
              dni,
              phone: clientPhone,
              name: clientName,
              destination: order.destino_detalle,
            });
            if (visibleExtras.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1">
                {visibleExtras.map(field => (
                  <span
                    key={field.key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-[11px]"
                  >
                    <span className="text-slate-400">{field.label}:</span>
                    <strong className="text-white">{field.value}</strong>
                  </span>
                ))}
              </div>
            );
          })()}

          {order.observaciones_cliente && (
            <p className="text-xs text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-xl break-words">
              <span className="text-slate-400 font-bold">Nota: </span>
              {order.observaciones_cliente}
            </p>
          )}

          {order.latitud && order.longitud && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${order.latitud},${order.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Ver mapa</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {isDuplicate && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                applyQuickFilter('duplicados');
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Esta clienta tiene {dupInfo?.count} pedidos activos (ver todos)</span>
            </button>
          )}

          <p className="text-[10.5px] text-slate-500">
            Creado {formatOrderTime(order.created_at)}
            {wasEdited(order.created_at, order.updated_at) && <> · Editado {formatOrderTime(order.updated_at)}</>}
          </p>
        </div>

        {/* PIE DE TARJETA: Acciones directas claras + Botón principal */}
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-white/8 bg-slate-950/40 space-y-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSwipeTargetOrder(order)}
              className="flex-1 min-h-9 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              title="Mover de carpeta"
            >
              <FolderInput className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Mover</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLabelOrder(order)}
              className="flex-1 min-h-9 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              title="Imprimir rótulo"
            >
              <Printer className="w-3.5 h-3.5 text-purple-300 shrink-0" />
              <span>Rótulo</span>
            </button>

            {isShalom && (
              <button
                type="button"
                onClick={() => setShalomRegisterOrders([order])}
                className={`flex-1 min-h-9 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  isRegistrado
                    ? 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-200'
                    : 'bg-blue-600/20 hover:bg-blue-600/35 border-blue-500/40 text-blue-200'
                }`}
                title="Registrar en Shalom Pro"
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Shalom</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditingPedido(order)}
              className="min-h-9 min-w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
              title="Editar pedido"
              aria-label="Editar pedido"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleDeleteSingle(order)}
              className="min-h-9 min-w-9 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
              title="Eliminar pedido"
              aria-label="Eliminar pedido"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {next && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleSingleOrderMove(order.id, next.envio, next.prod)}
              className={`w-full min-h-10 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer ${next.className}`}
            >
              {isBusy ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {stage === 'alistando' && isMoto
                      ? 'Enviar con motorizado'
                      : stage === 'despachando' && !isShalom
                      ? 'Marcar como Entregado'
                      : next.label}
                  </span>
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
    shalomRegisterOrders ||
      showBulkPrint ||
      selectedLabelOrder ||
      editingPedido ||
      showDeleteConfirm ||
      notifyModalData ||
      deliveryTargetOrders ||
      swipeTargetOrder ||
      changeDateOrder ||
      showFiltersSheet ||
      showHistoryModal ||
      showBulkMoveSheet ||
      isProcessing
  );

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

  useEffect(() => {
    document.body.classList.toggle('has-order-selection', selectionMode);
    return () => document.body.classList.remove('has-order-selection');
  }, [selectionMode]);

  const statusTabs: { id: StatusFilter; emoji: string; label: string; count: number; active: string }[] = [
    { id: 'all', emoji: '📦', label: 'Activos', count: counts.all, active: 'bg-cyan-500 text-slate-950' },
    { id: 'almacen', emoji: '🏬', label: 'Almacén', count: counts.almacen, active: 'bg-amber-500 text-slate-950' },
    { id: 'alistando', emoji: '🪡', label: 'Alistando', count: counts.alistando, active: 'bg-purple-600 text-white' },
    { id: 'dejando_shalom', emoji: '🚚', label: 'Despachados', count: counts.dejando_shalom, active: 'bg-blue-600 text-white' },
    { id: 'entregado', emoji: '✅', label: 'Entregados', count: counts.entregado, active: 'bg-emerald-500 text-slate-950' },
  ];

  return (
    <div className="space-y-3 animate-fadeIn pb-32">
      {/* BARRA DE ACCIONES EN LOTE (Compacta en 2 filas: 100% visible en celulares sin perder botones) */}
      {selectionMode &&
        !isAnyModalOpen &&
        createPortal(
          <div
            className="fixed bottom-safe left-0 right-0 mx-auto z-[9990] w-[calc(100%-0.75rem)] max-w-3xl animate-slideUp print:hidden admin-mass-action-bar"
            data-no-print="true"
          >
            <div className="rounded-3xl bg-slate-900/95 border-2 border-cyan-500/60 backdrop-blur-3xl shadow-2xl shadow-black/70 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="min-w-7 h-7 px-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center">
                    {selectedIds.length}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white truncate">
                    {selectedIds.length === 1 ? 'paquete seleccionado' : 'paquetes seleccionados'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="min-h-8 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-bold cursor-pointer"
                  >
                    {allFilteredSelected ? 'Quitar todos' : `Todos (${filteredOrders.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="min-h-8 min-w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                    aria-label="Cancelar selección"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowBulkMoveSheet(true)}
                  className="min-h-12 px-1.5 rounded-2xl bg-white/8 hover:bg-white/15 text-white border border-white/15 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black cursor-pointer"
                >
                  <FolderInput className="w-4 h-4 text-cyan-300" />
                  <span>Mover</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleMassStatusUpdate('entregado', 'completado')}
                  className="min-h-12 px-1.5 rounded-2xl bg-emerald-500/25 hover:bg-emerald-500 text-emerald-100 hover:text-slate-950 border border-emerald-500/50 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Entregar</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (selectedShalomOrders.length === 0) {
                      toast('Ninguno de los seleccionados es de Shalom.', 'warning');
                      return;
                    }
                    setShalomRegisterOrders(selectedShalomOrders);
                  }}
                  className="min-h-12 px-1.5 rounded-2xl bg-indigo-600/35 hover:bg-indigo-600 text-indigo-100 border border-indigo-400/50 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Shalom{selectedShalomOrders.length > 0 ? ` (${selectedShalomOrders.length})` : ''}</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowBulkPrint(true)}
                  className="min-h-12 px-1.5 rounded-2xl bg-purple-600/25 hover:bg-purple-600 text-purple-100 border border-purple-500/40 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Rotular</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="min-h-12 px-1.5 rounded-2xl bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Borrar</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 1. CARPETAS PRINCIPALES (Lo primero y más claro en celular) */}
      <section className="glass-panel p-2.5 sm:p-3.5 rounded-3xl border border-white/10 space-y-2.5 shadow-xl">
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5"
          role="tablist"
          aria-label="Carpetas de paquetes"
        >
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
                className={`shrink-0 min-h-10 px-3 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive ? `${tab.active} shadow-md` : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span
                  className={`min-w-5 px-1.5 rounded-full text-[11px] font-black ${
                    isActive ? 'bg-black/20' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. BARRA ÚNICA: BUSCADOR + FILTROS + HISTORIAL + REFRESCAR */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar clienta, DNI, celular o guía..."
              aria-label="Buscar pedidos"
              className="w-full min-h-10 pl-9 pr-8 bg-slate-950/70 border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersSheet(true)}
            className={`shrink-0 min-h-10 px-3 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              activeDrawerFiltersCount > 0
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60'
                : 'bg-slate-950/70 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
            title="Filtrar por agencia, fecha, rotulado o registro"
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="hidden min-[380px]:inline">Filtros</span>
            {activeDrawerFiltersCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {activeDrawerFiltersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="shrink-0 min-h-10 px-3 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-400/35 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
            title="Ver historial de movimientos, entrantes, ediciones y revertir"
          >
            <History className="w-4 h-4 text-indigo-300" />
            <span className="hidden sm:inline">Historial</span>
            {todayHistoryCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-indigo-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {todayHistoryCount > 99 ? '99+' : todayHistoryCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Actualizar pedidos"
            aria-label="Actualizar pedidos"
            className="shrink-0 min-h-10 min-w-10 bg-slate-950/70 hover:bg-slate-900 text-slate-300 hover:text-white border border-white/10 rounded-2xl flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 3. ATAJOS RÁPIDOS (Una sola línea limpia y tocable con el pulgar) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
          <button
            type="button"
            onClick={() => applyQuickFilter('hoy')}
            className={`shrink-0 min-h-8 px-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
              quickFilter === 'hoy'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-white/5 text-amber-200 border-white/10 hover:bg-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Hoy ({counts.hoy})</span>
          </button>

          {counts.atrasados > 0 && (
            <button
              type="button"
              onClick={() => applyQuickFilter('atrasados')}
              className={`shrink-0 min-h-8 px-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
                quickFilter === 'atrasados'
                  ? 'bg-rose-500 text-white border-rose-400 font-black'
                  : 'bg-rose-500/15 text-rose-200 border-rose-500/35 hover:bg-rose-500/25'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Atrasados ({counts.atrasados})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPrepFilter(p => (p === 'sin_rotular' ? 'all' : 'sin_rotular'))}
            className={`shrink-0 min-h-8 px-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
              prepFilter === 'sin_rotular'
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sin rotular ({counts.sinRotular})</span>
          </button>

          <button
            type="button"
            onClick={() => setPrepFilter(p => (p === 'sin_registrar' ? 'all' : 'sin_registrar'))}
            className={`shrink-0 min-h-8 px-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
              prepFilter === 'sin_registrar'
                ? 'bg-indigo-500 text-white border-indigo-400 font-black'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sin registrar ({counts.sinRegistrar})</span>
          </button>

          {duplicateClientsCount > 0 && (
            <button
              type="button"
              onClick={() => applyQuickFilter('duplicados')}
              className={`shrink-0 min-h-8 px-2.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
                quickFilter === 'duplicados'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                  : 'bg-amber-500/15 text-amber-200 border-amber-500/35 hover:bg-amber-500/25'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Repetidos ({duplicateClientsCount})</span>
            </button>
          )}

          {statusFilter === 'entregado' && (
            <button
              type="button"
              onClick={handleSyncShalomTracking}
              disabled={isTrackingSyncing}
              className="shrink-0 min-h-8 px-2.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/35 text-teal-200 border border-teal-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTrackingSyncing ? 'animate-spin' : ''}`} />
              <span>{isTrackingSyncing ? 'Rastreando…' : 'Rastrear Shalom'}</span>
            </button>
          )}
        </div>

        {/* Chips de filtros activos (para saber siempre exactamente qué vista está activa) */}
        {hasAnyFilter && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/8 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
              {transportFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTransportFilter('all')}
                  className="px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  Agencia: {transportFilter} <X className="w-3 h-3" />
                </button>
              )}
              {prepFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setPrepFilter('all')}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  {prepFilter === 'sin_rotular'
                    ? 'Sin rotular'
                    : prepFilter === 'rotulados'
                    ? 'Ya rotulados'
                    : prepFilter === 'sin_registrar'
                    ? 'Sin registrar'
                    : 'Ya registrados'}{' '}
                  <X className="w-3 h-3" />
                </button>
              )}
              {dateFilterType !== 'none' && (
                <button
                  type="button"
                  onClick={() => setDateFilterType('none')}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  {dateFilterType === 'programado'
                    ? 'Envío'
                    : dateFilterType === 'registrado'
                    ? 'Creado'
                    : 'Entregado'}{' '}
                  {formatShortDate(dateFilterValue)} <X className="w-3 h-3" />
                </button>
              )}
              {quickFilter !== 'none' && (
                <button
                  type="button"
                  onClick={() => setQuickFilter('none')}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  {quickFilter === 'hoy'
                    ? 'Salen hoy'
                    : quickFilter === 'atrasados'
                    ? 'Atrasados'
                    : 'Clientas repetidas'}{' '}
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-cyan-300 hover:text-white font-black cursor-pointer shrink-0"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </section>

      {/* Encabezado de lista + Seleccionar todos */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs sm:text-sm font-black text-white">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'paquete' : 'paquetes'}
        </h2>
        {filteredOrders.length > 0 && (
          <button
            type="button"
            onClick={selectAll}
            className="min-h-8 px-2.5 rounded-xl text-xs font-bold text-cyan-300 hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            {allFilteredSelected ? 'Quitar selección' : 'Seleccionar todos'}
          </button>
        )}
      </div>

      {/* Lista de paquetes */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-8 text-center rounded-3xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-2xl">
            {hasAnyFilter ? '🔍' : '🎉'}
          </div>
          <h3 className="text-base font-black text-white">
            {hasAnyFilter ? 'No hay paquetes con estos filtros' : '¡Todo al día!'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            {hasAnyFilter
              ? 'Prueba limpiando los filtros o cambiando de carpeta.'
              : 'No tienes paquetes pendientes en esta carpeta.'}
          </p>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-10 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleOrders.map(order => renderOrderCard(order))}
          </div>
          {filteredOrders.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="min-h-11 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-bold text-white cursor-pointer"
              >
                Ver más ({filteredOrders.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* SHEET DE FILTROS SIMPLIFICADOS (Fácil, limpio y perfecto en celular) */}
      {showFiltersSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            data-no-print="true"
            onClick={() => setShowFiltersSheet(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filtros de paquetes"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/35 shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-scaleUp"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-black text-white">Filtrar vista</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFiltersSheet(false)}
                  className="min-w-9 min-h-9 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {/* 1. Agencia */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                    1. Agencia de envío
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'all' as const, label: `Todas (${counts.all})` },
                      { id: 'shalom' as const, label: `Shalom (${counts.shalom})` },
                      { id: 'olva' as const, label: `Olva (${counts.olva})` },
                      { id: 'motorizado' as const, label: `Motorizado (${counts.motorizado})` },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTransportFilter(opt.id)}
                        className={`min-h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          transportFilter === opt.id
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                            : 'bg-slate-950/70 text-slate-300 border-white/10 hover:bg-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Estado de Rótulo y Registro */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                    2. Rótulo y Registro Shalom
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'all' as const, label: 'Todos' },
                      { id: 'sin_rotular' as const, label: '⬜ Sin rotular' },
                      { id: 'rotulados' as const, label: '✅ Ya rotulados' },
                      { id: 'sin_registrar' as const, label: '⬜ Sin registrar Shalom' },
                      { id: 'registrados' as const, label: '✅ Registrados Shalom' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrepFilter(opt.id)}
                        className={`min-h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          prepFilter === opt.id
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                            : 'bg-slate-950/70 text-slate-300 border-white/10 hover:bg-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Día */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                    3. Día de envío
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDateFilterType('none')}
                      className={`min-h-10 rounded-xl border text-xs font-bold cursor-pointer ${
                        dateFilterType === 'none'
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                          : 'bg-slate-950/70 text-slate-300 border-white/10'
                      }`}
                    >
                      Todos
                    </button>
                    {[
                      { label: 'Ayer', offset: -1, date: yesterday },
                      { label: 'Hoy', offset: 0, date: today },
                      { label: 'Mañana', offset: 1, date: tomorrow },
                    ].map(d => {
                      const active = dateFilterType !== 'none' && dateFilterValue === d.date;
                      return (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() => selectQuickDate(d.offset)}
                          className={`min-h-10 rounded-xl border text-xs font-bold cursor-pointer ${
                            active
                              ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                              : 'bg-slate-950/70 text-slate-300 border-white/10'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="date"
                      value={dateFilterValue}
                      onChange={e => {
                        if (!e.target.value) return;
                        setDateFilterValue(e.target.value);
                        if (dateFilterType === 'none') setDateFilterType('programado');
                        setQuickFilter('none');
                      }}
                      className="flex-1 min-h-10 px-3 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                    />
                    {dateFilterType !== 'none' && (
                      <select
                        value={dateFilterType}
                        onChange={e => setDateFilterType(e.target.value as any)}
                        className="min-h-10 px-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold text-white"
                      >
                        <option value="programado">Por fecha envío</option>
                        <option value="registrado">Por fecha creado</option>
                        <option value="entregado">Por fecha entrega</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* 4. Orden */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                    4. Ordenar paquetes
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'fecha_envio' as const, label: 'Fecha envío' },
                      { id: 'recientes' as const, label: 'Más nuevos' },
                      { id: 'antiguos' as const, label: 'Más antiguos' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortMode(opt.id)}
                        className={`min-h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                          sortMode === opt.id
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                            : 'bg-slate-950/70 text-slate-300 border-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-slate-950/90 flex items-center gap-2 shrink-0 pb-safe">
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setShowFiltersSheet(false);
                  }}
                  className="min-h-11 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setShowFiltersSheet(false)}
                  className="flex-1 min-h-11 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-black cursor-pointer"
                >
                  Ver {filteredOrders.length} {filteredOrders.length === 1 ? 'paquete' : 'paquetes'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MOVER CARPETA INDIVIDUAL */}
      {swipeTargetOrder &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            data-no-print="true"
            onClick={() => setSwipeTargetOrder(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="move-status-title"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 space-y-4 shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="move-status-title" className="text-base font-black text-white">
                    Mover a carpeta
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    #{swipeTargetOrder.codigo_seguimiento} · {swipeTargetOrder.usuario?.nombre_completo || 'Cliente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSwipeTargetOrder(null)}
                  className="min-w-10 min-h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {FOLDER_DEFS.map(opt => {
                  const isCurrent = getStage(swipeTargetOrder) === opt.stage;
                  return (
                    <button
                      key={opt.stage}
                      type="button"
                      disabled={busyOrderId === swipeTargetOrder.id}
                      onClick={() => handleSingleOrderMove(swipeTargetOrder.id, opt.envio, opt.prod)}
                      className={`w-full min-h-14 p-3.5 rounded-2xl border text-left flex items-center justify-between group transition-all hover:brightness-125 cursor-pointer ${
                        opt.cls
                      } ${isCurrent ? 'ring-2 ring-cyan-400' : ''}`}
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
                        <MoveRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MOVER CARPETA EN LOTE */}
      {showBulkMoveSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            data-no-print="true"
            onClick={() => setShowBulkMoveSheet(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 space-y-4 shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white">
                    Mover {selectedIds.length} {selectedIds.length === 1 ? 'paquete' : 'paquetes'}
                  </h3>
                  <p className="text-xs text-slate-400">Elige la carpeta de destino</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkMoveSheet(false)}
                  className="min-w-10 min-h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {FOLDER_DEFS.map(opt => (
                  <button
                    key={opt.stage}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleMassStatusUpdate(opt.envio, opt.prod)}
                    className={`w-full min-h-14 p-3.5 rounded-2xl border text-left flex items-center justify-between group transition-all hover:brightness-125 cursor-pointer ${opt.cls}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{opt.icon}</span>
                      <div>
                        <strong className="text-sm font-black text-white block">{opt.title}</strong>
                        <span className="text-xs text-slate-400">{opt.desc}</span>
                      </div>
                    </div>
                    <MoveRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* HISTORIAL DE MOVIMIENTOS */}
      <MovementsHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onEditOrder={order => {
          setShowHistoryModal(false);
          setEditingPedido(order);
        }}
      />

      {/* ASISTENTE DE REGISTRO EN SHALOM (Funciona tanto para 1 pedido como para lote) */}
      {shalomRegisterOrders && (
        <ShalomRegisterModal
          pedidos={shalomRegisterOrders}
          totalSelectedCount={shalomRegisterOrders.length}
          tallerConfig={tallerConfig}
          onClose={() => setShalomRegisterOrders(null)}
          onRegistered={async results => {
            const logItems = [];
            for (const r of results) {
              if (!r.oseId && (!r.guideNumber || r.guideNumber.startsWith('SH-') || r.guideNumber === 'S/G')) {
                continue;
              }
              const currentOrder = pedidos.find(p => p.id === r.pedidoId);
              if (!currentOrder) continue;
              let newDestino = currentOrder.destino_detalle || '';
              if (
                r.dni &&
                r.dni.toUpperCase() !== 'NCIADOS' &&
                r.dni.replace(/\D/g, '').length >= 6 &&
                !newDestino.includes(r.dni)
              ) {
                if (newDestino.includes('(DNI')) {
                  newDestino = newDestino.replace(/\(DNI[^)]*\)/gi, `(DNI: ${r.dni})`);
                } else {
                  newDestino = `${newDestino} (DNI: ${r.dni})`.trim();
                }
              }

              const nextEnvio =
                currentOrder.estado_produccion === 'completado'
                  ? 'en_camino'
                  : currentOrder.estado_envio || 'pendiente';

              const updates: Partial<Pedido> = {
                registrado_shalom: true,
                rotulado: true,
                estado_envio: nextEnvio,
                shalom_ose_id: r.oseId ? String(r.oseId) : null,
                shalom_numero_guia: r.guideNumber || null,
                shalom_clave_recojo: r.pickupCode || null,
                destino_detalle: newDestino || undefined,
                usuario: currentOrder.usuario
                  ? {
                      ...currentOrder.usuario,
                      dni: r.dni && r.dni !== 'NCIADOS' ? r.dni : currentOrder.usuario.dni || '',
                      telefono_default: r.phone || currentOrder.usuario.telefono_default || '',
                      nombre_completo: r.name || currentOrder.usuario.nombre_completo || '',
                    }
                  : undefined,
              };

              const antes = buildOrderSnapshot(currentOrder);
              await updatePedido(r.pedidoId, updates, { skipLog: true });
              const despues = buildOrderSnapshot({ ...currentOrder, ...updates });
              logItems.push({
                pedido_id: currentOrder.id,
                codigo_seguimiento: currentOrder.codigo_seguimiento,
                cliente_nombre: despues.cliente_nombre,
                metodo_envio: 'Shalom',
                antes,
                despues,
                cambios_legibles: [
                  `Registrado en Shalom Pro${r.guideNumber ? ` (${r.guideNumber})` : r.oseId ? ` (OSE #${r.oseId})` : ''}`,
                  ...(r.pickupCode ? [`Clave: ${r.pickupCode}`] : []),
                  'Rotulado: Sí',
                ],
              });
            }

            if (logItems.length > 0) {
              activityLogService.recordMovimiento(empresaId, {
                tipo: 'registro_shalom',
                titulo:
                  logItems.length === 1
                    ? `Registraste #${logItems[0].codigo_seguimiento} en Shalom Pro`
                    : `Registraste ${logItems.length} paquetes en Shalom Pro`,
                detalle: 'Registro oficial API + marcado como rotulado',
                origen: 'admin',
                puede_revertir: true,
                pedidos_afectados: logItems,
              });
            }
          }}
        />
      )}

      {/* IMPRESIÓN DE RÓTULOS EN LOTE */}
      {showBulkPrint && (
        <BulkPrintModal
          pedidos={selectedOrders.length > 0 ? selectedOrders : filteredOrders}
          tallerConfig={tallerConfig}
          onClose={() => setShowBulkPrint(false)}
          onPrintComplete={handleBulkPrintComplete}
        />
      )}

      {/* RÓTULO INDIVIDUAL (al imprimir marca automáticamente rotulado + historial) */}
      {selectedLabelOrder && (
        <ShalomLabelModal
          pedido={selectedLabelOrder}
          tallerConfig={tallerConfig}
          onClose={() => setSelectedLabelOrder(null)}
          onPrinted={async pedidoId => {
            if (!selectedLabelOrder.rotulado) {
              await updatePedido(pedidoId, { rotulado: true });
              toast(`#${selectedLabelOrder.codigo_seguimiento} marcado como rotulado`, 'success');
            }
          }}
        />
      )}

      {/* EDICIÓN DE PEDIDO */}
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

      {/* CONFIRMACIÓN DE BORRADO EN LOTE */}
      {showDeleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            data-no-print="true"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 text-center shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">
                ¿Eliminar {selectedIds.length} {selectedIds.length === 1 ? 'pedido' : 'pedidos'}?
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Podrás restaurarlos más adelante desde el Historial de Movimientos si cambias de opinión.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isProcessing}
                  className="flex-1 min-h-11 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-600/30 disabled:opacity-60 cursor-pointer"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* AVISO WHATSAPP TRAS CAMBIO DE ESTADO */}
      {notifyModalData && (
        <OrderStatusNotifyModal
          orders={notifyModalData.orders}
          statusName={notifyModalData.statusName}
          onClose={() => setNotifyModalData(null)}
        />
      )}

      {/* ENTREGA INTELIGENTE + REVISIÓN SHALOM PRO + OPCIONES BOT Y CARPETAS */}
      {deliveryTargetOrders && (
        <ShalomDeliveryModal
          isOpen={Boolean(deliveryTargetOrders)}
          orders={deliveryTargetOrders}
          tallerConfig={tallerConfig}
          onClose={() => setDeliveryTargetOrders(null)}
          onDeliveryComplete={handleDeliveryComplete}
        />
      )}

      {/* CAMBIAR FECHA DE ENVÍO */}
      {changeDateOrder &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            data-no-print="true"
            onClick={() => setChangeDateOrder(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-date-title"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-cyan-500/30 p-5 sm:p-6 space-y-4 shadow-2xl animate-slideUp sm:animate-scaleUp pb-safe text-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 id="change-date-title" className="text-base font-black text-white truncate">
                      Cambiar fecha de envío
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      #{changeDateOrder.codigo_seguimiento} · {changeDateOrder.usuario?.nombre_completo || 'Cliente'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChangeDateOrder(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Hoy', date: today, hint: formatShortDate(today) },
                  { label: 'Mañana', date: tomorrow, hint: formatShortDate(tomorrow) },
                  { label: 'Pasado', date: dayAfterTomorrow, hint: formatShortDate(dayAfterTomorrow) },
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSaveOrderDate(changeDateOrder.id, item.date)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-center transition-all cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-xs font-black text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.hint}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={changeDateCustomValue}
                  onChange={e => setChangeDateCustomValue(e.target.value)}
                  className="flex-1 min-h-11 px-3 bg-slate-950 border border-white/15 focus:border-cyan-400 rounded-xl text-sm font-bold text-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!changeDateCustomValue || isProcessing}
                  onClick={() => handleSaveOrderDate(changeDateOrder.id, changeDateCustomValue)}
                  className="min-h-11 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs disabled:opacity-50 cursor-pointer"
                >
                  Guardar
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                {changeDateOrder.fecha_limite ? (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSaveOrderDate(changeDateOrder.id, null)}
                    className="text-xs font-bold text-rose-400 hover:underline cursor-pointer"
                  >
                    Quitar fecha
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setChangeDateOrder(null)}
                  className="min-h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
