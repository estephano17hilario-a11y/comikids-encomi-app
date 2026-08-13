import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { Pedido } from '../../types/database.types';
import { ShalomLabelModal } from './ShalomLabelModal';
import {
  Search,
  Clock,
  Boxes,
  PackageCheck,
  Truck,
  FileText,
  ArrowRight,
  MapPin,
  Package
} from 'lucide-react';

export const KanbanBoard: React.FC = () => {
  const { pedidos, tallerConfig, updateEstadoProduccion, updateEstadoEnvio } = useOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShalomOrder, setSelectedShalomOrder] = useState<Pedido | null>(null);

  const filteredOrders = pedidos.filter(p => {
    return (
      p.codigo_seguimiento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.usuario?.nombre_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.usuario?.dni || '').includes(searchTerm) ||
      (p.destino_detalle || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const colEnAlmacen = filteredOrders.filter(p => p.estado_produccion === 'en_cola');
  const colEmbalaje = filteredOrders.filter(p => p.estado_produccion === 'bordando');
  const colPorDespachar = filteredOrders.filter(p => p.estado_produccion === 'completado' && p.estado_envio === 'pendiente');
  const colEnviados = filteredOrders.filter(p => p.estado_envio === 'en_camino' || p.estado_envio === 'entregado');

  const handleAdvanceState = async (pedido: Pedido) => {
    if (pedido.estado_produccion === 'en_cola') {
      await updateEstadoProduccion(pedido.id, 'bordando');
    } else if (pedido.estado_produccion === 'bordando') {
      await updateEstadoProduccion(pedido.id, 'completado');
    } else if (pedido.estado_produccion === 'completado' && pedido.estado_envio === 'pendiente') {
      await updateEstadoEnvio(pedido.id, 'en_camino');
    } else if (pedido.estado_envio === 'en_camino') {
      await updateEstadoEnvio(pedido.id, 'entregado');
    }
  };

  const getActionBtn = (pedido: Pedido) => {
    if (pedido.estado_produccion === 'en_cola') return { label: '📦 Pasar a Embalaje', color: 'bg-cyan-600 hover:bg-cyan-500' };
    if (pedido.estado_produccion === 'bordando') return { label: '🏷️ Marcar Listo para Despacho', color: 'bg-purple-600 hover:bg-purple-500' };
    if (pedido.estado_produccion === 'completado' && pedido.estado_envio === 'pendiente') {
      return { label: '🚚 Despachar Paquete', color: 'bg-amber-600 hover:bg-amber-500' };
    }
    if (pedido.estado_envio === 'en_camino') return { label: '✅ Confirmar Entrega', color: 'bg-emerald-600 hover:bg-emerald-500' };
    return null;
  };

  const renderOrderCard = (pedido: Pedido) => {
    const action = getActionBtn(pedido);
    const isShalom = pedido.metodo_envio_codigo === 'shalom';

    return (
      <div
        key={pedido.id}
        className="minimal-card p-5 space-y-4 hover:border-cyan-500/40 transition-all shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-cyan-400">
                #{pedido.codigo_seguimiento}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-white/[0.06] text-slate-200 border border-white/10">
                {pedido.metodo_envio_nombre}
              </span>
            </div>
            <h4 className="text-base font-black text-white mt-1.5">
              {pedido.usuario?.nombre_completo || 'Destinatario'}
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              📱 {pedido.usuario?.dni || '-'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
          <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="truncate">{pedido.destino_detalle}</span>
          </p>
          {pedido.observaciones_cliente && (
            <p className="text-[11px] text-slate-400 italic">
              Ref: "{pedido.observaciones_cliente}"
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {action && (
            <button
              onClick={() => handleAdvanceState(pedido)}
              className={`flex-1 py-3 px-4 rounded-xl text-white font-black text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${action.color}`}
            >
              <span>{action.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isShalom && (
            <button
              onClick={() => setSelectedShalomOrder(pedido)}
              className="p-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 transition-colors shadow-sm"
              title="Generar Rótulo Shalom"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="minimal-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, DNI, código..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="big-input pl-11 py-3 text-xs sm:text-sm"
          />
        </div>

        <span className="text-xs font-black uppercase tracking-wider text-slate-400">
          Total: {pedidos.length} envíos
        </span>
      </div>

      {/* 4-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Column 1 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-black uppercase text-cyan-300">En Almacén</h4>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-cyan-500/20 text-cyan-300">
              {colEnAlmacen.length}
            </span>
          </div>
          <div className="space-y-3 min-h-[160px]">
            {colEnAlmacen.length === 0 ? <p className="text-center py-10 text-xs text-slate-500">Sin pedidos</p> : colEnAlmacen.map(renderOrderCard)}
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-black uppercase text-purple-300">En Embalaje</h4>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-purple-500/20 text-purple-300">
              {colEmbalaje.length}
            </span>
          </div>
          <div className="space-y-3 min-h-[160px]">
            {colEmbalaje.length === 0 ? <p className="text-center py-10 text-xs text-slate-500">Sin paquetes</p> : colEmbalaje.map(renderOrderCard)}
          </div>
        </div>

        {/* Column 3 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black uppercase text-amber-300">Por Despachar</h4>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300">
              {colPorDespachar.length}
            </span>
          </div>
          <div className="space-y-3 min-h-[160px]">
            {colPorDespachar.length === 0 ? <p className="text-center py-10 text-xs text-slate-500">Todo despachado</p> : colPorDespachar.map(renderOrderCard)}
          </div>
        </div>

        {/* Column 4 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black uppercase text-emerald-300">Enviados / Listos</h4>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300">
              {colEnviados.length}
            </span>
          </div>
          <div className="space-y-3 min-h-[160px]">
            {colEnviados.length === 0 ? <p className="text-center py-10 text-xs text-slate-500">Sin despachos</p> : colEnviados.map(renderOrderCard)}
          </div>
        </div>

      </div>

      {selectedShalomOrder && (
        <ShalomLabelModal
          pedido={selectedShalomOrder}
          tallerConfig={tallerConfig}
          onClose={() => setSelectedShalomOrder(null)}
        />
      )}

    </div>
  );
};
