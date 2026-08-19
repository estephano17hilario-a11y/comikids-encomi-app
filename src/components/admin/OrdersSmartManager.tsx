import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { BulkPrintModal } from './BulkPrintModal';
import { ShalomLabelModal } from './ShalomLabelModal';
import { EditOrderModal } from './EditOrderModal';
import { ShalomRegisterModal } from './ShalomRegisterModal';
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
  Tag
} from 'lucide-react';

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
  const [transportFilter, setTransportFilter] = useState<'all' | 'shalom' | 'motorizado'>('all');

  // Multi-select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<Pedido | null>(null);
  const [showShalomRegister, setShowShalomRegister] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeTargetOrder, setSwipeTargetOrder] = useState<Pedido | null>(null);
  const [notifyModalData, setNotifyModalData] = useState<{
    orders: Pedido[];
    statusName: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper para nombre legible del estado
  const getStatusLabel = (envio: EstadoEnvio, prod?: EstadoProduccion): string => {
    if (envio === 'entregado') return 'Entregado';
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
      if (statusFilter === 'almacen') return order.estado_produccion === 'en_cola' && order.estado_envio === 'pendiente';
      if (statusFilter === 'alistando') return order.estado_produccion === 'bordando' && order.estado_envio === 'pendiente';
      if (statusFilter === 'dejando_shalom') return order.estado_envio === 'en_camino' || (order.estado_produccion === 'completado' && order.estado_envio === 'pendiente');
      if (statusFilter === 'entregado') return order.estado_envio === 'entregado';

      // Vista "Todos": Todos los pedidos vigentes EXCEPTO los que ya fueron entregados
      return order.estado_envio !== 'entregado';
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

  // Handler para exportar Excel oficial masivo de Shalom y marcar como registrados
  const handleRegisterShalomExcel = async () => {
    if (selectedShalomOrders.length === 0) return;
    setIsProcessing(true);
    try {
      downloadShalomExcel(selectedShalomOrders, tallerConfig);
      for (const order of selectedShalomOrders) {
        await updatePedido(order.id, { registrado_shalom: true });
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

  // Contadores dinámicos calculados en tiempo real
  const counts = useMemo(() => {
    return {
      all: pedidos.filter(p => p.estado_envio !== 'entregado').length,
      almacen: pedidos.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length,
      alistando: pedidos.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length,
      dejando_shalom: pedidos.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length,
      entregado: pedidos.filter(p => p.estado_envio === 'entregado').length,
      shalom: pedidos.filter(p => (p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')) && p.estado_envio !== 'entregado').length,
      motorizado: pedidos.filter(p => (p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')) && p.estado_envio !== 'entregado').length,
    };
  }, [pedidos]);

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
      
      {/* --- TOP FLOATING ACTION BAR FOR MASS ACTIONS (ITEM 7: FOLLOWS SCROLL AT TOP) --- */}
      {selectedIds.length > 0 && createPortal(
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-9990 w-11/12 max-w-3xl animate-slideDown print:hidden" data-no-print="true">
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
                  className="text-[10px] text-cyan-400 hover:text-white underline cursor-pointer"
                >
                  Deseleccionar
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
                <FileSpreadsheet className="w-3.5 h-3.5 text-yellow-300" />
                <span>Registrar Shalom</span>
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

      {/* Header & Search Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>📋</span>
              <span>Gestor Inteligente de Pedidos & Envíos</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Control To-Do de alistado, despacho en Shalom y Motorizado con selección en masa
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBulkPrint(true)}
              className="py-2 px-3.5 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              title="Imprimir o descargar todos los rótulos A4"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Rótulos A4 ({selectedIds.length > 0 ? selectedIds.length : filteredOrders.length})</span>
            </button>

            <button
              onClick={selectAll}
              className="py-2 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-cyan-400 font-bold text-xs flex items-center gap-1.5 border border-cyan-500/20 transition-all cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>
                {selectedIds.length === filteredOrders.length && filteredOrders.length > 0
                  ? 'Deseleccionar Todo'
                  : 'Seleccionar Todo'}
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          
          <div className="relative col-span-1 sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, cliente, DNI o agencia..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status Tabs con conteos entre paréntesis */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Todos ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('almacen')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'almacen' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              En Almacén ({counts.almacen})
            </button>
            <button
              onClick={() => setStatusFilter('alistando')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'alistando' ? 'bg-purple-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Alistándolo ({counts.alistando})
            </button>
            <button
              onClick={() => setStatusFilter('dejando_shalom')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'dejando_shalom' ? 'bg-blue-500 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Dejando en Shalom ({counts.dejando_shalom})
            </button>
            <button
              onClick={() => setStatusFilter('entregado')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'entregado' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Entregado a Shalom ({counts.entregado})
            </button>
          </div>

          {/* Transport Method Filter con conteos entre paréntesis */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setTransportFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${transportFilter === 'all' ? 'bg-white/15 text-white font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Todos ({counts.all})
            </button>
            <button
              onClick={() => setTransportFilter('shalom')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${transportFilter === 'shalom' ? 'bg-rose-500/25 border border-rose-500/40 text-rose-300 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <span>📦</span>
              <span>Shalom ({counts.shalom})</span>
            </button>
            <button
              onClick={() => setTransportFilter('motorizado')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${transportFilter === 'motorizado' ? 'bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-black shadow-md' : 'text-slate-400 hover:text-white'}`}
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
              ? 'Prueba ajustando los filtros de búsqueda o estado.'
              : 'No hay pedidos registrados en este momento.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const isSelected = selectedIds.includes(order.id);
            const dni = order.usuario?.dni || order.usuario?.dni_default || '';
            const rawKey = (
              order.usuario?.dni?.trim() ||
              order.usuario?.telefono_default?.trim() ||
              order.usuario?.nombre_completo?.trim().toLowerCase() ||
              ''
            );
            const dupInfo = rawKey ? duplicateOrdersMap.get(rawKey) : null;
            const isDuplicateOrSimultaneous = Boolean(dupInfo && dupInfo.count >= 2);

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

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    order.metodo_envio_codigo === 'shalom'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {order.metodo_envio_codigo === 'shalom' ? '📦 Shalom' : '🛵 Motorizado'}
                  </span>
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
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-white tracking-tight truncate">
                      {order.usuario?.nombre_completo || 'Cliente'}
                    </h4>
                    {dni && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {dni}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-snug text-[11px] text-slate-300 break-words">
                      {order.destino_detalle}
                    </p>
                  </div>

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
                      {order.estado_envio === 'entregado' ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {order.metodo_envio_codigo === 'motorizado' ? '✓ Entregado' : '✓ Entregado a Shalom'}
                        </span>
                      ) : order.estado_envio === 'en_camino' || (order.estado_produccion === 'completado' && order.estado_envio === 'pendiente') ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {order.metodo_envio_codigo === 'motorizado' ? '🛵 En Ruta' : '🚚 Dejando en Shalom'}
                        </span>
                      ) : order.estado_produccion === 'bordando' ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🪡 Alistándolo
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🏬 En Almacén
                        </span>
                      )}
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
          })}
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
          onRegistered={async (registeredIds) => {
            for (const id of registeredIds) {
              await updatePedido(id, { registrado_shalom: true });
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

    </div>
  );
};
