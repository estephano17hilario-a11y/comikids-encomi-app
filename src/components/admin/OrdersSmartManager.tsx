import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { EditOrderModal } from './EditOrderModal';

import { BulkPrintModal } from './BulkPrintModal';
import { ShalomLabelModal } from './ShalomLabelModal';
import { ShalomRegisterModal } from './ShalomRegisterModal';
import { ShalomDeliveryModal } from './ShalomDeliveryModal';
import { OrderStatusNotifyModal } from './OrderStatusNotifyModal';
import { downloadShalomExcel } from '../../utils/shalomExcelExporter';



import {
  CheckSquare,
  Square,
  Trash2,
  Printer,
  Edit3,
  Truck,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Filter,
  Sparkles,
  AlertTriangle,
  MoveRight,
  X,
  FileSpreadsheet,
  Tag,
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';
import { resolveShalomAgencyDetails, extractShalomDestino } from '../../utils/shalomAgencyResolver';
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

export const OrdersSmartManager: React.FC = () => {
  const {
    pedidos,
    tallerConfig,
    updateMultipleEstados,
    deleteMultiplePedidos,
    deletePedido,
    updatePedido,
    updateEstadoEnvio,
    updateEstadoProduccion,
  } = useOrders();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'almacen' | 'alistando' | 'dejando_shalom' | 'entregado'>('all');
  const [transportFilter, setTransportFilter] = useState<'all' | 'shalom' | 'motorizado' | 'olva'>('all');
  const [isEnRutaOpen, setIsEnRutaOpen] = useState(false);
  const [isListoRecojoOpen, setIsListoRecojoOpen] = useState(false);
  const [isYaRecogidosOpen, setIsYaRecogidosOpen] = useState(false);
  const [isTrackingSyncing, setIsTrackingSyncing] = useState(false);

  // Multi-select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
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


  // Helper para nombre legible del estado
  const getStatusLabel = (envio: EstadoEnvio, prod?: EstadoProduccion): string => {
    if (envio === 'entregado') return 'Entregado';
    if (envio === 'listo_para_recojo') return 'Listo para Recoger en Agencia';
    if (envio === 'en_camino' || (prod === 'completado' && envio === 'pendiente')) return 'Dejando en Shalom / En Ruta';
    if (prod === 'bordando') return 'Alistándolo';
    return 'En Almacén';
  };

  // Helper para formato de fecha y hora exacta
  const formatOrderTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const wasEdited = (createdAt?: string, updatedAt?: string): boolean => {
    if (!createdAt || !updatedAt) return false;
    try {
      const t1 = new Date(createdAt).getTime();
      const t2 = new Date(updatedAt).getTime();
      return Math.abs(t2 - t1) > 60000;
    } catch {
      return false;
    }
  };

  // Detección inteligente de pedidos duplicados o simultáneos por la misma clienta
  const duplicateOrdersMap = useMemo(() => {
    const map = new Map<string, { count: number; orderIds: string[]; clientName: string }>();

    for (const order of pedidos) {
      if (order.estado_envio === 'entregado') continue;

      const rawKey = (
        order.usuario?.dni?.trim() ||
        order.usuario?.telefono_default?.trim() ||
        order.usuario?.nombre_completo?.trim().toLowerCase() ||
        ''
      );

      if (!rawKey || rawKey === 'cliente' || rawKey === '00000000' || rawKey.toLowerCase() === 'encomi envíos') continue;

      if (!map.has(rawKey)) {
        map.set(rawKey, {
          count: 0,
          orderIds: [],
          clientName: order.usuario?.nombre_completo || 'Cliente',
        });
      }

      const item = map.get(rawKey)!;
      item.count += 1;
      item.orderIds.push(order.id);
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

  // Swipe detection touch state - track BOTH axes to avoid false positives during scroll
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  // Track if finger moved too much to be a tap (for card onClick)
  const didMoveEnoughToScroll = useRef<boolean>(false);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return pedidos.filter(order => {
      // Search term
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        order.codigo_seguimiento.toLowerCase().includes(query) ||
        order.destino_detalle.toLowerCase().includes(query) ||
        (order.usuario?.nombre_completo && order.usuario.nombre_completo.toLowerCase().includes(query)) ||
        (order.usuario?.dni && order.usuario.dni.toLowerCase().includes(query)) ||
        (order.observaciones_cliente && order.observaciones_cliente.toLowerCase().includes(query));

      if (!matchSearch) return false;

      // Transport
      if (transportFilter !== 'all' && order.metodo_envio_codigo !== transportFilter) {
        return false;
      }

      // Status
      if (statusFilter === 'almacen') return (order.estado_produccion === 'en_cola' || (!order.estado_produccion && order.estado_envio === 'pendiente')) && (order.estado_envio as string) !== 'entregado';
      if (statusFilter === 'alistando') return order.estado_produccion === 'bordando' && (order.estado_envio as string) !== 'entregado';
      if (statusFilter === 'dejando_shalom') return ((order.estado_produccion === 'completado' && (order.estado_envio as string) !== 'entregado') || order.estado_envio === 'en_camino') && (order.estado_envio as string) !== 'entregado';
      if (statusFilter === 'entregado') return order.estado_envio === 'entregado' || order.estado_envio === 'listo_para_recojo' || order.estado_envio === 'en_camino';

      // Vista "Todos": Todos los pedidos vigentes EXCEPTO los que ya fueron entregados
      return (order.estado_envio as string) !== 'entregado';
    });
  }, [pedidos, searchTerm, statusFilter, transportFilter]);


  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Mass status updates
  const handleMassStatusUpdate = async (envio: EstadoEnvio, prod?: EstadoProduccion) => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    const affectedOrders = pedidos.filter(p => selectedIds.includes(p.id));
    const statusName = getStatusLabel(envio, prod);

    // Si se pasa a entregado y hay pedidos Shalom, abrir consola de Guías de Remisión Shalom
    if (envio === 'entregado') {
      const shalomOrders = affectedOrders.filter(
        p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom') || (p as any).registrado_shalom
      );
      if (shalomOrders.length > 0) {
        setDeliveryTargetOrders(shalomOrders);
        setIsProcessing(false);
        return;
      }
    }

    try {
      await updateMultipleEstados(selectedIds, envio, prod);
      clearSelection();
      if (affectedOrders.length > 0) {
        setNotifyModalData({
          orders: affectedOrders,
          statusName,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Mass delete
  const handleConfirmDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await deleteMultiplePedidos(selectedIds);
      clearSelection();
      setShowDeleteConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Swipe handlers for moving status
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
    didMoveEnoughToScroll.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
    const dx = Math.abs(touchEndX.current - touchStartX.current);
    const dy = Math.abs(touchEndY.current - touchStartY.current);
    // Mark as scroll if moved more than 10px in any direction
    if (dx > 10 || dy > 10) {
      didMoveEnoughToScroll.current = true;
    }
  };

  const handleTouchEnd = (order: Pedido) => {
    const dx = touchStartX.current - touchEndX.current;
    const dy = Math.abs(touchStartY.current - touchEndY.current);
    // Only trigger swipe if: horizontal movement > 80px AND horizontal dominates over vertical
    if (Math.abs(dx) > 80 && Math.abs(dx) > dy * 1.5) {
      setSwipeTargetOrder(order);
    }
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  // Card tap handler: only toggle selection if the finger did NOT scroll significantly
  const handleCardTap = (id: string) => {
    if (!didMoveEnoughToScroll.current) {
      toggleSelect(id);
    }
  };

  const handleSingleOrderMove = async (orderId: string, envio: EstadoEnvio, prod?: EstadoProduccion) => {
    setIsProcessing(true);
    const targetOrder = pedidos.find(p => p.id === orderId);
    const statusName = getStatusLabel(envio, prod);

    // Si se pasa a entregado y es un pedido Shalom, abrir consola de Guías de Remisión
    if (envio === 'entregado' && targetOrder) {
      const isShalom = targetOrder.metodo_envio_codigo === 'shalom' || targetOrder.destino_detalle?.toLowerCase().includes('shalom') || (targetOrder as any).registrado_shalom;
      if (isShalom) {
        setDeliveryTargetOrders([targetOrder]);
        setSwipeTargetOrder(null);
        setIsProcessing(false);
        return;
      }
    }

    try {
      if (prod) await updateEstadoProduccion(orderId, prod);
      await updateEstadoEnvio(orderId, envio);
      setSwipeTargetOrder(null);
      if (targetOrder) {
        setNotifyModalData({
          orders: [targetOrder],
          statusName,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };


  const selectedOrders = pedidos.filter(p => selectedIds.includes(p.id));
  
  // Filtrar exclusivamente los pedidos con método Shalom (destildando motorizados)
  const selectedShalomOrders = useMemo(() => {
    return selectedOrders.filter(
      p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')
    );
  }, [selectedOrders]);

  // Handler para exportar Excel oficial masivo de Shalom (exportación manual / física)
  const handleRegisterShalomExcel = async () => {
    if (selectedShalomOrders.length === 0) return;
    setIsProcessing(true);
    try {
      downloadShalomExcel(selectedShalomOrders, tallerConfig);
      for (const order of selectedShalomOrders) {
        await updatePedido(order.id, { rotulado: true });
      }
    } catch (err) {
      console.error('Error al exportar plantilla masiva de Shalom:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler cuando se completa la impresion de rotulos
  const handleBulkPrintComplete = async (orderIds: string[]) => {
    for (const id of orderIds) {
      await updatePedido(id, { rotulado: true });
    }
  };

  // Handler para forzar sincronización del Listener de Tracking de Shalom
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
        alert(`Sincronización Shalom 24/7 completada:\n• ${data.report?.totalShippedOrdersChecked || 0} paquetes verificados\n• ${data.report?.newlyArrivedCount || 0} nuevos en destino\n• ${data.report?.notifiedCount || 0} avisos enviados por WhatsApp`);
      } else {
        alert(data?.error || 'Sincronización completada.');
      }
    } catch (err: any) {
      console.error('Error sincronizando tracking:', err);
      alert('Error consultando el listener de Shalom.');
    } finally {
      setIsTrackingSyncing(false);
    }
  };

  // Contadores dinámicos calculados en tiempo real para las 5 pestañas principales
  const counts = useMemo(() => {
    return {
      all: pedidos.filter(p => p.estado_envio !== 'entregado').length,
      almacen: pedidos.filter(p => (p.estado_produccion === 'en_cola' || (!p.estado_produccion && p.estado_envio === 'pendiente')) && p.estado_envio !== 'entregado').length,
      alistando: pedidos.filter(p => p.estado_produccion === 'bordando' && p.estado_envio !== 'entregado').length,
      dejando_shalom: pedidos.filter(p => ((p.estado_produccion === 'completado' && (p.estado_envio as string) !== 'entregado') || p.estado_envio === 'en_camino') && (p.estado_envio as string) !== 'entregado').length,
      entregado: pedidos.filter(p => p.estado_envio === 'entregado' || p.estado_envio === 'listo_para_recojo' || p.estado_envio === 'en_camino').length,
      shalom: pedidos.filter(p => (p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')) && p.estado_envio !== 'entregado').length,
      olva: pedidos.filter(p => (p.metodo_envio_codigo === 'olva' || p.destino_detalle?.toLowerCase().includes('olva')) && p.estado_envio !== 'entregado').length,
      motorizado: pedidos.filter(p => (p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')) && p.estado_envio !== 'entregado').length,
    };
  }, [pedidos]);

  // Subgrupos de pedidos para la vista de "Entregado" (3 subcarpetas)
  const enRutaOrders = useMemo(() => {
    return filteredOrders.filter(
      o => o.estado_envio === 'en_camino' || (o.estado_produccion === 'completado' && o.estado_envio === 'pendiente')
    );
  }, [filteredOrders]);

  const listosParaRecogerOrders = useMemo(() => {
    return filteredOrders.filter(o => o.estado_envio === 'listo_para_recojo');
  }, [filteredOrders]);

  const yaRecogidosOrders = useMemo(() => {
    return filteredOrders.filter(
      o => o.estado_envio === 'entregado'
    );
  }, [filteredOrders]);

  const renderOrderCard = (order: Pedido) => {
    const isSelected = selectedIds.includes(order.id);
    let dni = order.usuario?.dni || order.usuario?.dni_default || '';

    if (!dni || dni.startsWith('usr-') || dni === '00000000' || dni === 'NCIADOS') {
      const matchDoc = String(order.destino_detalle || '').match(/\b(?:DNI[\s\/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i);
      const docCandidate = matchDoc && matchDoc[1] ? matchDoc[1].trim() : '';
      dni = (docCandidate && !docCandidate.startsWith('usr-') && docCandidate.toUpperCase() !== 'NCIADOS' && docCandidate.replace(/\D/g, '').length >= 6) ? docCandidate : '';
    }

    const rawKey = (
      (dni && !dni.startsWith('usr-') ? dni.trim() : '') ||
      order.usuario?.telefono_default?.trim() ||
      order.usuario?.nombre_completo?.trim().toLowerCase() ||
      ''
    );

    const dupInfo = rawKey ? duplicateOrdersMap.get(rawKey) : null;
    const isDuplicateOrSimultaneous = Boolean(dupInfo && dupInfo.count >= 2);
    const isReadyForPickup = order.estado_envio === 'listo_para_recojo';

    return (
      <div
        key={order.id}
        onClick={() => handleCardTap(order.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => handleTouchEnd(order)}
        className={`p-4 sm:p-5 rounded-3xl border transition-all space-y-3 cursor-pointer select-none relative ${
          isSelected
            ? 'bg-cyan-950/40 border-cyan-400/80 shadow-lg shadow-cyan-500/10'
            : isReadyForPickup
            ? 'bg-linear-to-b from-teal-950/40 via-slate-900/90 to-slate-900 border-teal-500/50 hover:border-teal-400 shadow-md shadow-teal-500/10'
            : isDuplicateOrSimultaneous
            ? 'bg-slate-900/90 border-amber-500/50 hover:border-amber-400 shadow-md shadow-amber-500/5'
            : 'bg-slate-900/80 border-white/10 hover:border-white/20 hover:bg-slate-900/95 shadow-md'
        }`}
      >
        
        {/* Top Row: Checkbox, Code & Method Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelect(order.id);
              }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                isSelected ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 border border-slate-700 text-transparent'
              }`}
            >
              ✓
            </button>
            
            <span className="font-mono text-xs font-black text-white tracking-wider">
              #{order.codigo_seguimiento}
            </span>
          </div>

          {(() => {
            const isOlva = order.metodo_envio_codigo === 'olva' || order.destino_detalle?.toLowerCase().includes('olva');
            const isShalom = order.metodo_envio_codigo === 'shalom' || order.destino_detalle?.toLowerCase().includes('shalom');
            return (
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isOlva
                  ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30'
                  : isShalom
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}>
                {isOlva ? '🏢 Olva' : isShalom ? '📦 Shalom' : '🛵 Motorizado'}
              </span>
            );
          })()}
        </div>

        {/* Insignia de Pedido Duplicado / Simultáneo */}
        {isDuplicateOrSimultaneous && (
          <div className="p-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-pulse">
            <div className="flex items-center gap-1.5 font-bold truncate">
              <span>⚠️</span>
              <span className="truncate">¡{dupInfo?.count} pedidos simultáneos activos!</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm(order.usuario?.nombre_completo || order.usuario?.dni || '');
              }}
              className="px-2 py-0.5 rounded-lg bg-amber-500/40 hover:bg-amber-500/60 text-white font-black text-[10px] transition-colors shrink-0"
            >
              Ver
            </button>
          </div>
        )}

        {/* Client Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white tracking-tight truncate">
              {order.usuario?.nombre_completo || 'Cliente'}
            </h4>
            {dni && !dni.startsWith('usr-') && (
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                {dni}
              </span>
            )}
          </div>

          {/* Teléfono de la Clienta y Botón Directo a WhatsApp */}
          {(() => {
            const clientPhone = getCleanClientPhone(order);
            const clientName = order.usuario?.nombre_completo || 'Cliente';
            return (
              <div className="flex items-center justify-between gap-2 py-0.5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    📱 {clientPhone ? `+51 ${clientPhone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}` : 'Sin teléfono'}
                  </span>
                </div>

                {clientPhone ? (
                  <a
                    href={`https://wa.me/51${clientPhone}?text=${encodeURIComponent(`¡Hola ${clientName}! Te escribimos de Encomi / ComiKids respecto a tu pedido #${order.codigo_seguimiento}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[11px] font-black shadow-xs shadow-emerald-950/50 active:scale-95 transition-all shrink-0 cursor-pointer"
                    title={`Abrir chat de WhatsApp con ${clientName} (${clientPhone})`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-current" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPedido(order);
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    + Agregar Teléfono
                  </button>
                )}
              </div>
            );
          })()}

          {/* Fecha Deseada de Envío Elegida por la Clienta (Visualización y Edición Rápida en Sistema) */}
          <div className="p-2 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-2 shadow-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 text-xs text-cyan-200">
              <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="leading-tight">
                <span className="text-[10px] uppercase font-black text-cyan-400 block tracking-wider">
                  Fecha Envío Cliente:
                </span>
                <span className="text-xs font-black text-white">
                  {formatFechaConDia(order.fecha_limite)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] text-slate-400 font-bold hidden sm:inline" title="Cambiar fecha elegida en el sistema">
                Cambiar:
              </label>
              <input
                type="date"
                value={order.fecha_limite || ''}
                onChange={async (e) => {
                  e.stopPropagation();
                  const newDate = e.target.value;
                  if (newDate) {
                    await updatePedido(order.id, { fecha_limite: newDate });
                  }
                }}
                className="px-2 py-1 bg-slate-900 border border-cyan-500/40 rounded-xl text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-300 cursor-pointer shadow-inner"
                title="Cambiar fecha elegida para este envío en el sistema"
              />
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-xs text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px] text-slate-300 break-words">
              {order.destino_detalle}
            </p>
          </div>

          {/* Insignia Canónica Oficial de la Agencia de Destino */}
          {(() => {
            const isShalomOrder = order.metodo_envio_codigo === 'shalom' || order.destino_detalle?.toLowerCase().includes('shalom');
            if (isShalomOrder) {
              const agencyInfo = resolveShalomAgencyDetails(order.destino_detalle);
              return (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300 bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-500/30 shadow-xs">
                    <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">Agencia Destino: <strong className="text-white font-black">{agencyInfo.officialDestination}</strong></span>
                    {agencyInfo.code && (
                      <span className="text-[10px] font-mono text-rose-200 bg-rose-900/70 px-1.5 py-0.2 rounded-md border border-rose-500/40 font-black shrink-0">
                        {agencyInfo.code}
                      </span>
                    )}
                  </div>

                  {/* Confirmación de registro vía API con guía y botón para desvincular */}
                  {order.registrado_shalom && (
                    <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-500/40">
                      <div className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {order.shalom_numero_guia || order.shalom_ose_id ? (
                            <>Despachado API: <strong>{order.shalom_numero_guia || `OSE #${order.shalom_ose_id}`}</strong></>
                          ) : (
                            <span className="text-amber-300 font-semibold">Marcado para Shalom (Sin Guía API)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {order.shalom_clave_recojo && (
                          <span className="text-[9px] font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded-md border border-amber-500/30 shrink-0">
                            PIN: {order.shalom_clave_recojo}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('¿Desvincular despacho de Shalom de este pedido para volver a registrarlo o ingresar otra guía?')) {
                              await updatePedido(order.id, {
                                registrado_shalom: false,
                                shalom_ose_id: null,
                                shalom_numero_guia: null,
                                shalom_clave_recojo: null,
                              });
                            }
                          }}
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 p-0.5 rounded transition-colors text-[9px] cursor-pointer"
                          title="Desvincular guía para registrar de nuevo"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Insignia de Arribo a Agencia Destino */}
          {isReadyForPickup && (
            <div className="p-2.5 rounded-2xl bg-teal-950/60 border border-teal-500/40 text-teal-200 text-xs flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">🏢</span>
                <div className="truncate">
                  <span className="text-[11px] font-black text-teal-300 block">¡Arribó a Agencia Destino!</span>
                  <span className="text-[10px] text-teal-200/80 font-mono">
                    N° Envío: {order.shalom_numero_guia?.replace(/\D/g, '') || order.codigo_seguimiento} {order.shalom_clave_recojo ? `| Clave: ${order.shalom_clave_recojo}` : ''}
                  </span>
                </div>
              </div>
              <span className="text-[9px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-lg font-black border border-teal-500/30 shrink-0">
                En Agencia ✓
              </span>
            </div>
          )}

          {order.observaciones_cliente && (
            <p className="text-[10px] text-slate-400 italic bg-white/5 p-1.5 rounded-lg break-words">
              Ref: {order.observaciones_cliente}
            </p>
          )}
        </div>

        {/* Google Maps External URL (if Motorizado coordinates available) */}
        {order.latitud && order.longitud && (
          <div className="pt-1">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${order.latitud},${order.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>📍 Ver ubicación exacta en Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Timestamps: Creación y Última Edición */}
        <div className="pt-1.5 border-t border-white/6 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1 text-slate-300">
            <span>🕒</span>
            <span>Creado: <strong>{formatOrderTime(order.created_at)}</strong></span>
          </div>
          {wasEdited(order.created_at, order.updated_at) && (
            <div className="flex items-center gap-1 text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded-md border border-cyan-500/30" title={`Última edición: ${formatOrderTime(order.updated_at)}`}>
              <span>✏️</span>
              <span>Editado: <strong>{formatOrderTime(order.updated_at)}</strong></span>
            </div>
          )}
        </div>

        {/* Status Badges & Quick Action Pills */}
        <div className="pt-2 border-t border-white/8 flex flex-wrap items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Indicator & Swipe Hint */}
            <button
              type="button"
              onClick={() => setSwipeTargetOrder(order)}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              title="Clic o desliza para cambiar estado"
            >
              {(() => {
                const isOlva = order.metodo_envio_codigo === 'olva' || order.destino_detalle?.toLowerCase().includes('olva');
                if (order.estado_envio === 'entregado') {
                  return (
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {isOlva ? '✓ Entregado a Olva' : order.metodo_envio_codigo === 'motorizado' ? '✓ Entregado' : '✓ Entregado a Shalom'}
                    </span>
                  );
                }
                if (order.estado_envio === 'listo_para_recojo') {
                  return (
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-teal-500/25 text-teal-200 border border-teal-500/40 flex items-center gap-1 shadow-sm">
                      <span>🏢</span>
                      <span>Listo para Recoger</span>
                    </span>
                  );
                }
                if (order.estado_envio === 'en_camino' || (order.estado_produccion === 'completado' && order.estado_envio === 'pendiente')) {
                  return (
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {isOlva ? '🚚 Dejando en Olva' : order.metodo_envio_codigo === 'motorizado' ? '🛵 En Ruta' : '🚚 Dejando en Shalom'}
                    </span>
                  );
                }
                if (order.estado_produccion === 'bordando') {
                  return (
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      🪡 Alistándolo
                    </span>
                  );
                }
                return (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    🏬 En Almacén
                  </span>
                );
              })()}
            </button>

            {/* Botón Ver/Imprimir Rótulo Individual */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLabelOrder(order);
              }}
              className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-500/35 text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
              title="Ver e imprimir rótulo individual"
            >
              <Printer className="w-3 h-3 text-cyan-300" />
              <span>Rótulo</span>
            </button>

            {/* Checkbox / Estado Rotulado */}
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await updatePedido(order.id, { rotulado: !order.rotulado });
              }}
              className={`px-2 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                order.rotulado
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-sm'
                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300 hover:bg-white/10'
              }`}
              title={order.rotulado ? 'Marcado como Rotulado (Clic para quitar)' : 'Clic para marcar como Rotulado'}
            >
              <span>{order.rotulado ? '✓ Rotulado' : '+ Marcar'}</span>
            </button>

            {/* Etiqueta Registrado en Shalom (Toggleable) */}
            {(order.metodo_envio_codigo === 'shalom' || order.destino_detalle?.toLowerCase().includes('shalom')) && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  await updatePedido(order.id, { registrado_shalom: !order.registrado_shalom });
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                  order.registrado_shalom
                    ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/35 shadow-sm'
                    : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300 hover:bg-white/10'
                }`}
                title={order.registrado_shalom ? 'Registrado en Shalom (Clic para quitar)' : 'Clic para marcar como Registrado en Shalom'}
              >
                <span>📑</span>
                <span>{order.registrado_shalom ? 'Shalom Reg. ✓' : '+ Reg. Shalom'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditingPedido(order)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Editar datos del pedido"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Editar</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (confirm(`¿Eliminar el pedido ${order.codigo_seguimiento}?`)) {
                  await deletePedido(order.id);
                }
              }}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
              title="Eliminar pedido"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
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

  // Sincronizar clase global en el body para ocultar el dock inferior del AdminPortal al abrir modales
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('has-active-modal');
    } else {
      document.body.classList.remove('has-active-modal');
    }
    return () => {
      document.body.classList.remove('has-active-modal');
    };
  }, [isAnyModalOpen]);

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
      
      {/* --- TOP FLOATING ACTION BAR FOR MASS ACTIONS (ITEM 7: OCULTO CUANDO HAY MODALES ACTIVOS) --- */}
      {selectedIds.length > 0 && !isAnyModalOpen && createPortal(
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-9990 w-11/12 max-w-3xl animate-slideDown print:hidden admin-mass-action-bar" data-no-print="true">
          <div className="p-3.5 sm:p-4 rounded-3xl bg-slate-900/95 border-2 border-cyan-500/70 backdrop-blur-3xl shadow-2xl shadow-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
            
            {/* Counter */}
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-cyan-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md">
                {selectedIds.length}
              </span>
              <div>
                <strong className="text-xs font-black text-white block">
                  {selectedIds.length} {selectedIds.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
                </strong>
                <button
                  onClick={clearSelection}
                  className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/25 hover:bg-rose-500 active:scale-95 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-black cursor-pointer transition-all shadow-sm"
                >
                  <X className="w-3 h-3 stroke-[3]" />
                  <span>Deseleccionar Todo</span>
                </button>
              </div>
            </div>

            {/* Mass Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              
              {/* Mover a Alistándolo */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('pendiente', 'bordando')}
                className="py-2 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600 active:scale-95 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Marcar seleccionados como Alistándolo"
              >
                <span>🪡</span>
                <span>Alistándolo</span>
              </button>

              {/* Mover a Dejando en Shalom */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('en_camino', 'completado')}
                className="py-2 px-3 rounded-xl bg-blue-600/30 hover:bg-blue-600 active:scale-95 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Marcar seleccionados como Dejando en Shalom / En Ruta"
              >
                <span>🚚</span>
                <span>Dejando en Shalom</span>
              </button>

              {/* Mover a Entregado */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('entregado', 'completado')}
                className="py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 active:scale-95 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Marcar seleccionados como Entregado"
              >
                <span>✓</span>
                <span>Entregado</span>
              </button>

              {/* Descargar Excel Plantilla Oficial Shalom con validaciones */}
              <button
                disabled={isProcessing}
                onClick={() => {
                  if (selectedShalomOrders.length === 0) {
                    alert('Los pedidos seleccionados son de Motorizado. Selecciona al menos un pedido con envío por Agencia Shalom.');
                    return;
                  }
                  setShowShalomRegister(true);
                }}
                className="py-2 px-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                title="Abrir asistente de registro oficial en Shalom con validaciones"
              >
                <Truck className="w-3.5 h-3.5 text-cyan-300" />
                <span>Registrar Shalom (1-Clic)</span>
              </button>

              {/* Imprimir en Lote */}
              <button
                disabled={isProcessing}
                onClick={() => setShowBulkPrint(true)}
                className="py-2 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600 active:scale-95 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Imprimir Rótulos A4 de todos los seleccionados (Shalom y Motorizado)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Rótulos ({selectedOrders.length})</span>
              </button>

              {/* Eliminar en Masa */}
              <button
                disabled={isProcessing}
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2 px-3 rounded-xl bg-rose-600/30 hover:bg-rose-600 active:scale-95 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Eliminar pedidos seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Header & Search Bar Compacto */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-3xl border border-white/10 space-y-3 shadow-xl">
        
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg sm:text-xl">📋</span>
            <h2 className="text-base sm:text-lg font-black text-white truncate">
              Gestor Inteligente de Pedidos & Envíos
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
              {filteredOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Sincronizar Shalom 24/7: solo visible en la pestaña Enviado */}
            {statusFilter === 'entregado' && (
              <button
                onClick={handleSyncShalomTracking}
                disabled={isTrackingSyncing}
                className="py-1.5 px-3 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 active:scale-95 text-teal-200 hover:text-white border border-teal-500/40 text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
                title="Consultar en vivo a la API de Shalom si algún paquete ya desembarcó en destino"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-300 ${isTrackingSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isTrackingSyncing ? 'Verificando Shalom...' : 'Sincronizar Shalom 24/7'}</span>
                <span className="sm:hidden">{isTrackingSyncing ? '...' : 'Shalom 24/7'}</span>
              </button>
            )}

            {/* Botón Inteligente y Ultra-Notorio de Selección en Masa */}
            <button
              onClick={selectAll}
              className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all cursor-pointer shadow-md active:scale-95 ${
                selectedIds.length > 0
                  ? 'bg-linear-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-amber-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-cyan-400 border-cyan-500/30'
              }`}
              title="Seleccionar o deseleccionar pedidos"
            >
              {selectedIds.length > 0 ? (
                <X className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <CheckSquare className="w-3.5 h-3.5" />
              )}
              <span>
                {selectedIds.length === filteredOrders.length && filteredOrders.length > 0
                  ? `✕ Deseleccionar (${selectedIds.length})`
                  : selectedIds.length > 0
                  ? `✕ Deseleccionar (${selectedIds.length}/${filteredOrders.length})`
                  : `Seleccionar Todo (${filteredOrders.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar & Filters Compactos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          
          <div className="relative col-span-1 sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, cliente, DNI o agencia..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status Tabs con nombre Enviado */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Todos ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('almacen')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'almacen' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              En Almacén ({counts.almacen})
            </button>
            <button
              onClick={() => setStatusFilter('alistando')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'alistando' ? 'bg-purple-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Alistándolo ({counts.alistando})
            </button>
            <button
              onClick={() => setStatusFilter('dejando_shalom')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'dejando_shalom' ? 'bg-blue-500 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Despachando ({counts.dejando_shalom})
            </button>
            <button
              onClick={() => setStatusFilter('entregado')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'entregado' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Enviado ({counts.entregado})
            </button>
          </div>

          {/* Transport Method Filter con conteos entre paréntesis */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px] font-bold overflow-x-auto">
            <button
              onClick={() => setTransportFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${transportFilter === 'all' ? 'bg-white/15 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Todos ({counts.all})
            </button>
            <button
              onClick={() => setTransportFilter('shalom')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${transportFilter === 'shalom' ? 'bg-rose-500/25 border border-rose-500/40 text-rose-300 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span>📦</span>
              <span>Shalom ({counts.shalom})</span>
            </button>
            <button
              onClick={() => setTransportFilter('olva')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${transportFilter === 'olva' ? 'bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span>🏢</span>
              <span>Olva ({counts.olva})</span>
            </button>
            <button
              onClick={() => setTransportFilter('motorizado')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${transportFilter === 'motorizado' ? 'bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span>🛵</span>
              <span>Motorizado ({counts.motorizado})</span>
            </button>
          </div>

        </div>

      </div>

      {/* Alerta de Pedidos Duplicados / Simultáneos por la misma Clienta */}
      {duplicateClientsCount > 0 && (
        <div className="p-3.5 sm:p-4 rounded-3xl bg-linear-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/45 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-500/10 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/25 border border-amber-500/45 text-amber-300 flex items-center justify-center text-xl font-bold shrink-0">
              ⚠️
            </div>
            <div>
              <strong className="text-xs sm:text-sm font-black text-amber-200 block">
                ¡Atención! Se detectaron {duplicateClientsCount} clientas con pedidos simultáneos o duplicados
              </strong>
              <p className="text-[11px] text-amber-300/80">
                Revisa las órdenes marcadas con la insignia de alerta para confirmar si corresponden a pedidos combinados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const firstDup = Array.from(duplicateOrdersMap.values()).find(v => v.count >= 2);
                if (firstDup) setSearchTerm(firstDup.clientName);
              }}
              className="py-2 px-3.5 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 active:scale-95 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
            >
              🔍 Filtrar Duplicados
            </button>
          </div>
        </div>
      )}

      {/* --- CARDS LIST VIEW --- */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 mx-auto text-xl">
            📦
          </div>
          <h3 className="text-base font-black text-white">No se encontraron pedidos</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || transportFilter !== 'all'
              ? 'Prueba ajustando los filtros de búsqueda o transporte.'
              : 'No hay pedidos registrados en esta sección.'}
          </p>
        </div>
      ) : statusFilter === 'entregado' ? (
        /* ========================================================================= */
        /* VISTA DE "ENTREGADO" CON LAS 3 SUBCARPETAS (EN RUTA / LISTO / RECOGIDO)  */
        /* ========================================================================= */
        <div className="space-y-6">

          {/* GRID DE 2 COLUMNAS PARA: 1. EN RUTA y 2. LISTOS PARA RECOGER EN SHALOM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

            {/* SUBCARPETA 1: EN RUTA / EN TRÁNSITO */}
            <div className="rounded-3xl bg-linear-to-b from-blue-950/30 via-slate-900/60 to-slate-900/90 border-2 border-blue-500/40 p-4 sm:p-5 space-y-4 shadow-xl shadow-blue-950/20 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center text-xl font-bold">
                    🚚
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-white">
                        En Ruta / En Tránsito
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Viajando ({enRutaOrders.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-200/70">
                      Paquetes despachados que aún no llegan a destino.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEnRutaOpen(!isEnRutaOpen)}
                    className="py-1.5 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 active:scale-95 text-blue-200 font-bold text-xs border border-blue-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {isEnRutaOpen ? <ChevronDown className="w-4 h-4 text-blue-300" /> : <ChevronRight className="w-4 h-4 text-blue-300" />}
                    <span>{isEnRutaOpen ? 'Ocultar' : 'Mostrar'}</span>
                    <span className="font-mono bg-blue-950 px-1.5 py-0.2 rounded text-[10px] text-blue-300 font-black">({enRutaOrders.length})</span>
                  </button>
                </div>
              </div>

              {isEnRutaOpen && (
                enRutaOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 italic text-center">No hay paquetes en ruta actualmente.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 animate-fadeIn">
                    {enRutaOrders.map(order => renderOrderCard(order))}
                  </div>
                )
              )}
            </div>

            {/* SUBCARPETA 2: LISTOS PARA RECOGER EN SHALOM */}
            <div className="rounded-3xl bg-linear-to-b from-teal-950/30 via-slate-900/60 to-slate-900/90 border-2 border-teal-500/40 p-4 sm:p-5 space-y-4 shadow-xl shadow-teal-950/20 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-teal-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center text-xl font-bold">
                    🏢
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-white">
                        Listos para Recoger en Shalom
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/40">
                        Desembarcados ({listosParaRecogerOrders.length})
                      </span>
                    </div>
                    <p className="text-[11px] text-teal-200/70">
                      Confirmados en agencia destino. Con clave de recojo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsListoRecojoOpen(!isListoRecojoOpen)}
                    className="py-1.5 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/35 active:scale-95 text-teal-200 font-bold text-xs border border-teal-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {isListoRecojoOpen ? <ChevronDown className="w-4 h-4 text-teal-300" /> : <ChevronRight className="w-4 h-4 text-teal-300" />}
                    <span>{isListoRecojoOpen ? 'Ocultar' : 'Mostrar'}</span>
                    <span className="font-mono bg-teal-950 px-1.5 py-0.2 rounded text-[10px] text-teal-300 font-black">({listosParaRecogerOrders.length})</span>
                  </button>
                </div>
              </div>

              {isListoRecojoOpen && (
                listosParaRecogerOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 italic text-center">No hay paquetes pendientes de retiro en agencia.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 animate-fadeIn">
                    {listosParaRecogerOrders.map(order => renderOrderCard(order))}
                  </div>
                )
              )}
            </div>

          </div>

          {/* SUBCARPETA 3: PEDIDOS YA RECOGIDOS */}
          <div className="rounded-3xl bg-linear-to-b from-emerald-950/20 via-slate-900/60 to-slate-900/90 border border-emerald-500/30 p-4 sm:p-5 space-y-4 shadow-lg shadow-emerald-950/10 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xl font-bold">
                  ✅
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Subcarpeta: Pedidos ya Recogidos ({yaRecogidosOrders.length})
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Entregado Final
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/70">
                    Paquetes que ya fueron retirados físicamente de Shalom o entregados con éxito a la clienta.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsYaRecogidosOpen(!isYaRecogidosOpen)}
                  className="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 active:scale-95 text-emerald-200 font-bold text-xs border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isYaRecogidosOpen ? <ChevronDown className="w-4 h-4 text-emerald-300" /> : <ChevronRight className="w-4 h-4 text-emerald-300" />}
                  <span>{isYaRecogidosOpen ? 'Ocultar Subcarpeta' : 'Mostrar Subcarpeta'}</span>
                  <span className="font-mono bg-emerald-950 px-1.5 py-0.2 rounded text-[10px] text-emerald-300 font-black">({yaRecogidosOrders.length})</span>
                </button>
              </div>
            </div>

            {isYaRecogidosOpen && (
              yaRecogidosOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic text-center">No hay pedidos entregados en este registro.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 animate-fadeIn">
                  {yaRecogidosOrders.map(order => renderOrderCard(order))}
                </div>
              )
            )}
          </div>

        </div>
      ) : (
        /* ========================================================================= */
        /* VISTA ESTÁNDAR PARA TODAS LAS DEMÁS PESTAÑAS (TODOS / ALMACÉN / ALISTANDO)*/
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredOrders.map(order => renderOrderCard(order))}
        </div>
      )}


      {/* --- SWIPE / MOVE STATUS ACTION DIALOG (ITEM 5) --- */}
      {swipeTargetOrder && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 space-y-5 shadow-2xl animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
                  🚚
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">¿A dónde deseas mover el paquete?</h3>
                  <p className="text-xs text-cyan-400 font-mono">#{swipeTargetOrder.codigo_seguimiento}</p>
                </div>
              </div>
              <button onClick={() => setSwipeTargetOrder(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'pendiente', 'en_cola')}
                className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏬</span>
                  <div>
                    <strong className="text-xs font-black text-white block">En Almacén</strong>
                    <span className="text-[10px] text-slate-400">El paquete ingresó al taller en cola</span>
                  </div>
                </div>
                <MoveRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'pendiente', 'bordando')}
                className="w-full p-3.5 rounded-2xl bg-purple-950/40 hover:bg-purple-950/60 border border-purple-500/30 text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🪡</span>
                  <div>
                    <strong className="text-xs font-black text-purple-300 block">Alistándolo</strong>
                    <span className="text-[10px] text-purple-400/80">En proceso de empaquetado y rotulado</span>
                  </div>
                </div>
                <MoveRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'en_camino', 'completado')}
                className="w-full p-3.5 rounded-2xl bg-blue-950/40 hover:bg-blue-950/60 border border-blue-500/30 text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚚</span>
                  <div>
                    <strong className="text-xs font-black text-cyan-300 block">Dejando en Shalom</strong>
                    <span className="text-[10px] text-cyan-400/80">Transportándose o dejado en sucursal/agencia</span>
                  </div>
                </div>
                <MoveRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'entregado', 'completado')}
                className="w-full p-3.5 rounded-2xl bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-500/30 text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <strong className="text-xs font-black text-emerald-300 block">Entregado al Cliente</strong>
                    <span className="text-[10px] text-emerald-400/80">Completado con éxito y registrado</span>
                  </div>
                </div>
                <MoveRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSwipeTargetOrder(null)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Shalom Register Assistance Modal */}
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

      {/* Bulk Print Modal (Shalom y Motorizado) */}
      {showBulkPrint && (
        <BulkPrintModal
          pedidos={selectedOrders.length > 0 ? selectedOrders : filteredOrders}
          tallerConfig={tallerConfig}
          onClose={() => setShowBulkPrint(false)}
          onPrintComplete={handleBulkPrintComplete}
        />
      )}

      {/* Single Shalom/Motorizado Label Modal */}
      {selectedLabelOrder && (
        <ShalomLabelModal
          pedido={selectedLabelOrder}
          tallerConfig={tallerConfig}
          onClose={() => setSelectedLabelOrder(null)}
        />
      )}

      {/* Edit Order Modal */}
      {editingPedido && (
        <EditOrderModal
          pedido={editingPedido}
          onClose={() => setEditingPedido(null)}
          onSave={async (id, updates) => {
            await updatePedido(id, updates);
            setEditingPedido(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">
              ¿Eliminar {selectedIds.length} {selectedIds.length === 1 ? 'pedido' : 'pedidos'}?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta acción no se puede deshacer. Los registros seleccionados serán borrados de forma permanente.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-1/2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="w-1/2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WhatsApp Status Change To-Do Notify Modal */}
      {notifyModalData && (
        <OrderStatusNotifyModal
          orders={notifyModalData.orders}
          statusName={notifyModalData.statusName}
          onClose={() => setNotifyModalData(null)}
        />
      )}

      {/* Shalom Delivery & Official Remission Guide Modal */}
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
          }}

        />
      )}


    </div>
  );
};

