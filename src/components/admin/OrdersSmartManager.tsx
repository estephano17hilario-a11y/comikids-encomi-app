import React, { useState, useMemo, useRef } from 'react';
import { Pedido, EstadoEnvio, EstadoProduccion } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { BulkPrintModal } from './BulkPrintModal';
import { EditOrderModal } from './EditOrderModal';
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
  X
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'cola' | 'embalando' | 'despachar' | 'camino' | 'entregado'>('all');
  const [transportFilter, setTransportFilter] = useState<'all' | 'shalom' | 'motorizado'>('all');

  // Multi-select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals State
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeTargetOrder, setSwipeTargetOrder] = useState<Pedido | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Swipe detection touch state
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

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
      if (statusFilter === 'cola') return order.estado_produccion === 'en_cola' && order.estado_envio === 'pendiente';
      if (statusFilter === 'embalando') return order.estado_produccion === 'bordando' && order.estado_envio === 'pendiente';
      if (statusFilter === 'despachar') return order.estado_produccion === 'completado' && order.estado_envio === 'pendiente';
      if (statusFilter === 'camino') return order.estado_envio === 'en_camino';
      if (statusFilter === 'entregado') return order.estado_envio === 'entregado';

      return true;
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
    try {
      await updateMultipleEstados(selectedIds, envio, prod);
      clearSelection();
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
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (order: Pedido) => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > 60) {
      // Swiped left or right!
      setSwipeTargetOrder(order);
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleSingleOrderMove = async (orderId: string, envio: EstadoEnvio, prod?: EstadoProduccion) => {
    setIsProcessing(true);
    try {
      if (prod) await updateEstadoProduccion(orderId, prod);
      await updateEstadoEnvio(orderId, envio);
      setSwipeTargetOrder(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedOrders = pedidos.filter(p => selectedIds.includes(p.id));

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
      
      {/* --- TOP FLOATING ACTION BAR FOR MASS ACTIONS (ITEM 7: FOLLOWS SCROLL AT TOP) --- */}
      {selectedIds.length > 0 && (
        <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-3xl animate-slideDown print:hidden" data-no-print="true">
          <div className="p-3.5 sm:p-4 rounded-3xl bg-slate-900/95 border-2 border-cyan-500/60 backdrop-blur-3xl shadow-2xl shadow-cyan-500/25 flex flex-wrap items-center justify-between gap-3">
            
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
                  Cancelar selección
                </button>
              </div>
            </div>

            {/* Mass Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Mover a Embalando */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('pendiente', 'bordando')}
                className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                title="Mover a Embalaje"
              >
                <span>📦 Embalar</span>
              </button>

              {/* Mover a Por Despachar / Enviar */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('en_camino', 'completado')}
                className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                title="Mover a En Camino"
              >
                <span>🚚 Enviar</span>
              </button>

              {/* Mover a Entregado */}
              <button
                disabled={isProcessing}
                onClick={() => handleMassStatusUpdate('entregado', 'completado')}
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                title="Marcar como Entregado"
              >
                <span>✓ Entregar</span>
              </button>

              {/* Imprimir en Lote */}
              <button
                disabled={isProcessing}
                onClick={() => setShowBulkPrint(true)}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                title="Imprimir Rótulos"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rótulos</span>
              </button>

              {/* Borrar en masa */}
              <button
                disabled={isProcessing}
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer"
                title="Borrar seleccionados"
              >
                <Trash2 className="w-4 h-4" />
              </button>

            </div>

          </div>
        </div>
      )}

      {/* Header & Search Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>📋</span>
              <span>Gestor Inteligente de Pedidos & Envíos</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Control To-Do de embalaje, despacho en Shalom y Motorizado con selección en masa
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === filteredOrders.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span>Deseleccionar Todo</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Seleccionar Todos ({filteredOrders.length})</span>
                </>
              )}
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
              placeholder="Buscar por código, casera, DNI o agencia..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Status Tabs */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${statusFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('embalando')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${statusFilter === 'embalando' ? 'bg-purple-600 text-white font-black' : 'text-slate-400 hover:text-white'}`}
            >
              Embalaje
            </button>
            <button
              onClick={() => setStatusFilter('despachar')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${statusFilter === 'despachar' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
            >
              Por Enviar
            </button>
            <button
              onClick={() => setStatusFilter('camino')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${statusFilter === 'camino' ? 'bg-blue-500 text-white font-black' : 'text-slate-400 hover:text-white'}`}
            >
              En Camino
            </button>
            <button
              onClick={() => setStatusFilter('entregado')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${statusFilter === 'entregado' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
            >
              Entregados
            </button>
          </div>

          {/* Transport Method Filter */}
          <div className="col-span-1 sm:col-span-1 flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setTransportFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all ${transportFilter === 'all' ? 'bg-white/15 text-white font-black' : 'text-slate-400 hover:text-white'}`}
            >
              Todos ({pedidos.length})
            </button>
            <button
              onClick={() => setTransportFilter('shalom')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${transportFilter === 'shalom' ? 'bg-rose-500/25 border border-rose-500/40 text-rose-300 font-black' : 'text-slate-400 hover:text-white'}`}
            >
              <span>📦</span>
              <span>Shalom</span>
            </button>
            <button
              onClick={() => setTransportFilter('motorizado')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${transportFilter === 'motorizado' ? 'bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-black' : 'text-slate-400 hover:text-white'}`}
            >
              <span>🛵</span>
              <span>Motorizado</span>
            </button>
          </div>

        </div>

      </div>

      {/* Orders Grid / Cards List with Swipe Gesture Support */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-white/10 space-y-3">
          <p className="text-4xl">📭</p>
          <h3 className="text-lg font-bold text-white">No hay pedidos en esta clasificación</h3>
          <p className="text-xs text-slate-400">Intenta cambiar los filtros de búsqueda o estado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const isSelected = selectedIds.includes(order.id);
            const isShalom = order.metodo_envio_codigo === 'shalom';

            return (
              <div
                key={order.id}
                onClick={() => toggleSelect(order.id)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => handleTouchEnd(order)}
                className={`relative rounded-3xl p-5 border transition-all duration-200 cursor-pointer select-none space-y-3.5 group ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-400/60 shadow-xl shadow-cyan-500/15 ring-2 ring-cyan-500/30'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Selection Checkbox & Method Badge */}
                <div className="flex items-center justify-between">
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

                    <span className="font-mono text-xs font-black text-white">
                      {order.codigo_seguimiento}
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 ${
                    isShalom
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {isShalom ? '📦 Shalom' : '🛵 Moto'}
                  </span>
                </div>

                {/* Recipient info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-black text-white line-clamp-1">
                      {order.usuario?.nombre_completo || 'Cliente'}
                    </strong>
                    {order.usuario?.dni && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {order.usuario.dni}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{order.destino_detalle}</span>
                  </p>
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

                {/* Status Badges & Quick Action Pills */}
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  
                  {/* Status Indicator & Swipe Hint */}
                  <button
                    type="button"
                    onClick={() => setSwipeTargetOrder(order)}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    title="Clic o desliza para cambiar estado"
                  >
                    {order.estado_envio === 'entregado' ? (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ✓ Entregado
                      </span>
                    ) : order.estado_envio === 'en_camino' ? (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        🚚 En Camino
                      </span>
                    ) : order.estado_produccion === 'bordando' ? (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        ⚡ Embalando
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🕒 En Almacén
                      </span>
                    )}
                  </button>

                  {/* Individual Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingPedido(order)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Editar Pedido"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`¿Eliminar el pedido ${order.codigo_seguimiento}?`)) {
                          await deletePedido(order.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Eliminar Pedido"
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
      {swipeTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-cyan-500/30 p-6 space-y-5 shadow-2xl animate-scaleUp">
            
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
              <button
                onClick={() => setSwipeTargetOrder(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                disabled={isProcessing}
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'pendiente', 'bordando')}
                className="w-full p-3.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 text-xs font-black flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Embalando / En Preparación</span>
                </div>
                <MoveRight className="w-4 h-4" />
              </button>

              <button
                disabled={isProcessing}
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'pendiente', 'completado')}
                className="w-full p-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-500/30 text-xs font-black flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>🏢</span>
                  <span>Listo para Despacho / Mandando a Agencia</span>
                </div>
                <MoveRight className="w-4 h-4" />
              </button>

              <button
                disabled={isProcessing}
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'en_camino', 'completado')}
                className="w-full p-3.5 rounded-2xl bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/30 text-xs font-black flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>🚀</span>
                  <span>Recibido en Shalom / Motorizado en Ruta</span>
                </div>
                <MoveRight className="w-4 h-4" />
              </button>

              <button
                disabled={isProcessing}
                onClick={() => handleSingleOrderMove(swipeTargetOrder.id, 'entregado', 'completado')}
                className="w-full p-3.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/30 text-xs font-black flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Entregado con Éxito al Cliente</span>
                </div>
                <MoveRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setSwipeTargetOrder(null)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

          </div>
        </div>
      )}

      {/* Bulk Print Modal */}
      {showBulkPrint && (
        <BulkPrintModal
          pedidos={selectedOrders}
          tallerConfig={tallerConfig}
          onClose={() => setShowBulkPrint(false)}
        />
      )}

      {/* Edit Single Order Modal (Centered & Locked) */}
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
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
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
                className="w-1/2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="w-1/2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
