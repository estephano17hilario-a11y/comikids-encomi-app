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
  Sparkles,
  Users,
  Calendar,
  Layers,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export type BriefingMode = 'new_orders' | 'daily_closing' | 'manual';

interface Props {
  pedidos: Pedido[];
  mode?: BriefingMode;
  newOrders?: Pedido[];
  referenceDate?: string;
  onClose: () => void;
  onNavigateToOrders: () => void;
  onNavigateToStats: () => void;
}

export const ExecutiveBriefingModal: React.FC<Props> = ({
  pedidos,
  mode = 'manual',
  newOrders = [],
  referenceDate,
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

  // Filter orders for daily closing if in that mode
  const targetDateStr = referenceDate || new Date().toISOString().split('T')[0];
  const relevantOrders = mode === 'daily_closing'
    ? pedidos.filter(p => {
        try {
          return new Date(p.created_at).toISOString().split('T')[0] === targetDateStr;
        } catch {
          return false;
        }
      })
    : pedidos;

  // Metrics
  const total = relevantOrders.length;
  const enAlmacen = relevantOrders.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length;
  const alistando = relevantOrders.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length;
  const dejandoShalom = relevantOrders.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length;
  const entregados = relevantOrders.filter(p => p.estado_envio === 'entregado').length;
  const noEntregados = relevantOrders.filter(p => p.estado_envio !== 'entregado');

  const shalomTotal = relevantOrders.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')).length;
  const motorizadoTotal = relevantOrders.filter(p => p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')).length;

  const pendientesRotular = relevantOrders.filter(p => !p.rotulado && p.estado_envio !== 'entregado').length;
  const pendientesShalomReg = relevantOrders.filter(p => (p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')) && !p.registrado_shalom && p.estado_envio !== 'entregado').length;

  // Unique clients count
  const clientIds = new Set(relevantOrders.map(p => p.usuario_id || p.usuario?.dni || 'anon'));
  const uniqueClientsCount = clientIds.size;

  const displayDateStr = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(targetDateStr + 'T12:00:00'));

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-cyan-500/40 p-5 sm:p-7 shadow-2xl shadow-cyan-500/20 space-y-4 max-h-[92vh] flex flex-col animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg ${
              mode === 'new_orders'
                ? 'bg-linear-to-tr from-pink-500 to-rose-600 shadow-pink-500/25'
                : mode === 'daily_closing'
                ? 'bg-linear-to-tr from-amber-500 to-purple-600 shadow-amber-500/25'
                : 'bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 shadow-cyan-500/25'
            }`}>
              {mode === 'new_orders' ? '🔔' : mode === 'daily_closing' ? '🌙' : '📊'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {mode === 'new_orders'
                    ? `¡Nuevos Pedidos Recibidos! (${newOrders.length})`
                    : mode === 'daily_closing'
                    ? 'Resumen Detallado de Cierre Diario'
                    : 'Informe Ejecutivo de Despachos'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                  mode === 'new_orders'
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 animate-pulse'
                    : mode === 'daily_closing'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                }`}>
                  {mode === 'new_orders' ? 'Nuevos' : mode === 'daily_closing' ? 'Cierre Diario' : 'En Vivo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 capitalize mt-0.5">
                {displayDateStr} • ComiKids Almacén
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
          
          {/* =========================================================================
              MODO A: NUEVOS PEDIDOS REGISTRADOS DESDE QUE TE FUISTE
              ========================================================================= */}
          {mode === 'new_orders' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 bg-pink-500/10 border border-pink-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-pink-200">
                <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
                <span>Se registraron <strong>{newOrders.length} nuevos envíos</strong> mientras estabas ausente. Aquí tienes la información directa:</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {newOrders.map((ord) => {
                  const clientName = ord.usuario?.nombre_completo || 'Cliente';
                  const tiktok = ord.usuario?.tiktok_usuario;
                  const isShalom = ord.metodo_envio_codigo === 'shalom' || ord.destino_detalle?.toLowerCase().includes('shalom');
                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-2xl bg-white/4 border border-white/8 hover:border-pink-500/40 transition-all flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-cyan-300 text-xs">#{ord.codigo_seguimiento}</span>
                          <span className="font-black text-white text-sm">{clientName}</span>
                          {tiktok && (
                            <span className="px-1.5 py-0.5 rounded-md bg-pink-500/20 text-pink-300 font-mono text-[10px] font-bold">
                              @{tiktok.replace(/^@/, '')}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-[11px] truncate flex items-center gap-1.5">
                          <span>{isShalom ? '📦' : '🛵'}</span>
                          <span>{ord.destino_detalle}</span>
                        </p>
                        <p className="text-slate-400 text-[10px]">
                          Bordado: {ord.detalles_bordado}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 font-bold text-[10px] shrink-0 border border-cyan-500/25">
                        {ord.metodo_envio_nombre || (isShalom ? 'Shalom' : 'Motorizado')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              MODO B Y C: STATUS BREAKDOWN GRID (4 Columns)
              ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. En Almacén */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-0.5">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                <span>En Almacén</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{enAlmacen}</p>
              <span className="text-[10px] text-amber-300 font-medium block">Por atender</span>
            </div>

            {/* 2. Alistándolo */}
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-0.5">
              <div className="flex items-center justify-between text-purple-300 text-xs font-bold">
                <span>Alistándolo</span>
                <Package className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{alistando}</p>
              <span className="text-[10px] text-purple-300 font-medium block">En preparación</span>
            </div>

            {/* 3. Dejando en Shalom */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-0.5">
              <div className="flex items-center justify-between text-cyan-300 text-xs font-bold">
                <span>Dejando Shalom</span>
                <Truck className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{dejandoShalom}</p>
              <span className="text-[10px] text-cyan-300 font-medium block">En ruta / agencia</span>
            </div>

            {/* 4. Entregados */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-0.5">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                <span>Entregados</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-2xl font-black text-white font-mono">{entregados}</p>
              <span className="text-[10px] text-emerald-300 font-medium block">Con éxito</span>
            </div>
          </div>

          {/* Transport Breakdown & Clientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Canal de Despacho */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Canal de Despacho</span>
                </span>
                <span className="font-mono text-cyan-300 text-xs">{total} envíos</span>
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

            {/* Nuevos Clientes & Pendientes Operativos */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-pink-400" />
                  <span>Clientes & Flujo</span>
                </span>
                <span className="font-mono text-pink-300 text-xs">{uniqueClientsCount} clientas</span>
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

          {/* =========================================================================
              DETALLE DE ENVÍOS NO ENTREGADOS (Requerimiento Específico)
              ========================================================================= */}
          {noEntregados.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Envíos Registrados No Entregados ({noEntregados.length})</span>
                </h4>
                <span className="text-[10px] text-rose-300 font-bold">Requieren atención</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {noEntregados.map(p => (
                  <div key={p.id} className="p-2 bg-black/40 rounded-xl border border-rose-500/20 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-mono text-cyan-300 font-bold mr-1.5">#{p.codigo_seguimiento}</span>
                      <span className="text-white font-bold">{p.usuario?.nombre_completo || 'Cliente'}</span>
                      <span className="text-slate-400 text-[10px] block truncate">{p.destino_detalle}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                      {p.estado_produccion === 'en_cola' ? 'En Almacén' : p.estado_produccion === 'bordando' ? 'En Preparación' : 'Por Despachar'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
            <span>Ir al Gestor de Pedidos ({pedidos.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
