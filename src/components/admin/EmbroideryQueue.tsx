import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { Pedido } from '../../types/database.types';
import { formatShortDate } from '../../utils/formatters';
import {
  Scissors,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ZoomIn,
  Palette,
  Clock,
  Check,
  MapPin,
  MessageSquareHeart
} from 'lucide-react';

export const EmbroideryQueue: React.FC = () => {
  const { pedidos, updateEstadoProduccion } = useOrders();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const productionOrders = pedidos.filter(p => p.estado_produccion === 'en_cola' || p.estado_produccion === 'bordando');

  const getUrgencyBadge = (fechaLimite?: string) => {
    if (!fechaLimite) return null;
    const now = new Date().getTime();
    const limit = new Date(fechaLimite).getTime();
    const diffDays = Math.ceil((limit - now) / (1000 * 3600 * 24));

    if (diffDays <= 0) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3" /> ¡Entrega Hoy / Urgente!
        </span>
      );
    }
    if (diffDays === 1) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Entrega Mañana
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
        <Calendar className="w-3 h-3 text-pink-400" /> Plazo: {formatShortDate(fechaLimite)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-5 rounded-3xl border border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Cola Técnica de Producción de Bordados
            </h3>
            <p className="text-xs text-slate-400">
              Control visual de diseño, hilos y referencias para la máquina y bastidor
            </p>
          </div>
        </div>

        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {productionOrders.length} {productionOrders.length === 1 ? 'pedido en taller' : 'pedidos en taller'}
        </span>
      </div>

      {productionOrders.length === 0 ? (
        <div className="py-16 text-center rounded-3xl glass-card border border-slate-800">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-600">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="text-base font-bold text-white">¡Taller al día! 🎉</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No hay prendas pendientes en la cola de bordados. Todos los pedidos registrados han sido completados o despachados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {productionOrders.map((pedido) => {
            const isBordando = pedido.estado_produccion === 'bordando';

            return (
              <div
                key={pedido.id}
                className={`rounded-3xl glass-card p-5 sm:p-6 border transition-all space-y-4 shadow-xl ${
                  isBordando
                    ? 'border-purple-500/50 bg-slate-900/90 shadow-purple-500/5'
                    : 'border-slate-800/80 bg-slate-950/70'
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-pink-400">
                      #{pedido.codigo_seguimiento}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        isBordando
                          ? 'bg-purple-500 text-white animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isBordando ? '🪡 En Máquina' : '⏳ Esperando Bastidor'}
                    </span>
                  </div>

                  {getUrgencyBadge(pedido.fecha_limite)}
                </div>

                {/* Photo & Specs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 aspect-square sm:aspect-auto">
                    {pedido.foto_referencia_url ? (
                      <>
                        <img
                          src={pedido.foto_referencia_url}
                          alt="Boceto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <button
                          onClick={() => setSelectedPhoto(pedido.foto_referencia_url || null)}
                          className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold gap-1 transition-opacity"
                        >
                          <ZoomIn className="w-5 h-5" />
                          <span>Ver Zoom</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4">
                        <Scissors className="w-8 h-8 mb-1" />
                        <span className="text-[10px]">Sin foto</span>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Arte / Texto a Bordar
                      </span>
                      <p className="text-xs font-bold text-slate-100 leading-relaxed bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                        "{pedido.detalles_bordado}"
                      </p>
                    </div>

                    <p className="text-xs text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{pedido.destino_detalle}</span>
                    </p>

                    {pedido.observaciones_cliente && (
                      <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-[11px] text-pink-200">
                        <span className="font-bold">Mensaje de Clienta:</span> "{pedido.observaciones_cliente}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <div className="text-xs text-slate-400">
                    Clienta: <span className="font-bold text-slate-200">{pedido.usuario?.nombre_completo || 'Clienta'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isBordando ? (
                      <button
                        onClick={() => updateEstadoProduccion(pedido.id, 'bordando')}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Scissors className="w-4 h-4" />
                        <span>Montar en Bastidor</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => updateEstadoProduccion(pedido.id, 'completado')}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Marcar Bordado Listo</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Image Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto} alt="Zoom" className="w-full h-full object-contain rounded-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
