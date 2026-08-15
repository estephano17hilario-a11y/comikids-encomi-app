import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pedido } from '../../types/database.types';
import {
  X,
  FileSpreadsheet,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Tag,
  Building2,
  Sparkles
} from 'lucide-react';

interface Props {
  pedidos: Pedido[];
  onClose: () => void;
  onNavigateToOrders: () => void;
  onNavigateToStats: () => void;
}

export const ExecutiveBriefingModal: React.FC<Props> = ({
  pedidos,
  onClose,
  onNavigateToOrders,
  onNavigateToStats
}) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Metrics
  const total = pedidos.length;
  const enAlmacen = pedidos.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length;
  const alistando = pedidos.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length;
  const dejandoShalom = pedidos.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length;
  const entregados = pedidos.filter(p => p.estado_envio === 'entregado').length;

  const shalomTotal = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')).length;
  const motorizadoTotal = pedidos.filter(p => p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')).length;

  const pendientesRotular = pedidos.filter(p => !p.rotulado && p.estado_envio !== 'entregado').length;
  const pendientesShalomReg = pedidos.filter(p => (p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')) && !p.registrado_shalom && p.estado_envio !== 'entregado').length;

  const todayStr = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 sm:p-8 shadow-2xl shadow-cyan-500/20 space-y-5 max-h-[92vh] flex flex-col animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-cyan-500/25">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Informe Ejecutivo de Despachos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  En Vivo
                </span>
              </div>
              <p className="text-xs text-slate-400 capitalize mt-0.5">
                {todayStr} • ComiKids Almacén
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          
          {/* Status Breakdown Grid (4 Columns) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* 1. En Almacén */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                <span>En Almacén</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{enAlmacen}</p>
              <span className="text-[10px] text-amber-300 font-medium block">Por atender</span>
            </div>

            {/* 2. Alistándolo */}
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-1">
              <div className="flex items-center justify-between text-purple-300 text-xs font-bold">
                <span>Alistándolo</span>
                <Package className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{alistando}</p>
              <span className="text-[10px] text-purple-300 font-medium block">En preparación</span>
            </div>

            {/* 3. Dejando en Shalom */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-1">
              <div className="flex items-center justify-between text-cyan-300 text-xs font-bold">
                <span>Dejando Shalom</span>
                <Truck className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{dejandoShalom}</p>
              <span className="text-[10px] text-cyan-300 font-medium block">En ruta / agencia</span>
            </div>

            {/* 4. Entregados */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                <span>Entregados</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{entregados}</p>
              <span className="text-[10px] text-emerald-300 font-medium block">Con éxito</span>
            </div>

          </div>

          {/* Transport Breakdown & Pending Action Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Canal de Despacho */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>Canal de Despacho</span>
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-slate-300 flex items-center gap-2">
                    <span className="text-base">📦</span>
                    <strong>Agencia Shalom Nacional:</strong>
                  </span>
                  <span className="font-mono font-black text-white text-sm bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                    {shalomTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-slate-300 flex items-center gap-2">
                    <span className="text-base">🛵</span>
                    <strong>Motorizado Local Lima:</strong>
                  </span>
                  <span className="font-mono font-black text-white text-sm bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                    {motorizadoTotal}
                  </span>
                </div>
              </div>
            </div>

            {/* Pendientes Operativos */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Acciones Pendientes</span>
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25">
                  <span className="text-amber-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pendientes de rotular:</span>
                  </span>
                  <strong className="font-mono font-black text-amber-300 text-sm">
                    {pendientesRotular}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/25">
                  <span className="text-blue-200 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Pendientes registro Shalom:</span>
                  </span>
                  <strong className="font-mono font-black text-blue-300 text-sm">
                    {pendientesShalomReg}
                  </strong>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToStats();
            }}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Ver Métricas & Gráficos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToOrders();
            }}
            className="py-3 px-6 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer active:scale-95 ml-auto"
          >
            <span>Ir al Gestor de Pedidos ({total})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
