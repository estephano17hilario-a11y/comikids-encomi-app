import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Pedido } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';
import {
  Clock,
  Package,
  PackageCheck,
  Truck,
  MessageCircle,
  Layers,
  MapPin,
  Boxes,
  Calendar as CalendarIcon
} from 'lucide-react';
import { OrdersCalendarView } from './OrdersCalendarView';

export const OrderLiveTracker: React.FC = () => {
  const { pedidos, tallerConfig } = useOrders();
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState<'activos' | 'todos'>('activos');
  const [viewMode, setViewMode] = useState<'lista' | 'calendario'>('lista');

  const clientOrders = pedidos.filter(p => {
    if (!currentUser) return true;
    return p.usuario_id === currentUser.id;
  });

  const displayedOrders = filter === 'activos'
    ? clientOrders.filter(p => p.estado_envio !== 'entregado')
    : clientOrders;

  const getStepProgress = (pedido: Pedido) => {
    if (pedido.estado_envio === 'entregado' || pedido.estado_envio === 'en_camino') return 4;
    if (pedido.estado_produccion === 'completado') return 3;
    if (pedido.estado_produccion === 'bordando') return 2;
    return 1;
  };

  const steps = [
    { num: 1, title: 'En Almacén', icon: Clock },
    { num: 2, title: 'En Embalaje', icon: Boxes },
    { num: 3, title: 'Por Despachar', icon: PackageCheck },
    { num: 4, title: 'En Camino', icon: Truck },
  ];

  const getWhatsAppEditUrl = (pedido: Pedido) => {
    const number = tallerConfig.whatsapp_pedidos || '51987654321';
    const clientName = currentUser?.nombre_completo || 'Clienta';
    const text = `¡Hola Encomi! 📦\nSoy *${clientName}*, deseo consultar el estado de mi envío *#${pedido.codigo_seguimiento}*.\n\n*Destino:* ${pedido.destino_detalle}\n\n¿Cómo va mi despacho? ✨`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  };

  if (viewMode === 'calendario') {
    return (
      <div className="w-full max-w-xl mx-auto">
        <OrdersCalendarView
          orders={clientOrders}
          whatsappNumber={tallerConfig.whatsapp_pedidos || '51987654321'}
          clientName={currentUser?.nombre_completo || 'Clienta'}
          onBackToList={() => setViewMode('lista')}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      
      {/* Header with Clean Tabs and Calendar Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Mis Envíos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Seguimiento en tiempo real</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-1 bg-white/[0.05] rounded-2xl border border-white/10">
            <button
              onClick={() => setFilter('activos')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filter === 'activos'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              En Curso ({clientOrders.filter(p => p.estado_envio !== 'entregado').length})
            </button>
            <button
              onClick={() => setFilter('todos')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filter === 'todos'
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Historial ({clientOrders.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('calendario')}
            className="px-3.5 py-2.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            title="Ver mapa de calendario"
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Ver en Calendario</span>
          </button>
        </div>
      </div>

      {displayedOrders.length === 0 ? (
        <div className="minimal-card p-12 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-white/[0.04] flex items-center justify-center text-slate-600 border border-white/[0.08]">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-white">Sin envíos en esta sección</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Usa el botón "Nuevo Envío" para programar tu primer despacho de mercadería.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedOrders.map((pedido) => {
            const currentStep = getStepProgress(pedido);
            const whatsappUrl = getWhatsAppEditUrl(pedido);

            return (
              <div
                key={pedido.id}
                className="minimal-card p-6 sm:p-7 space-y-6 animate-fadeIn"
              >
                {/* Top Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base sm:text-lg font-black text-cyan-400">
                      #{pedido.codigo_seguimiento}
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white/[0.06] text-slate-200 border border-white/10">
                      {pedido.metodo_envio_nombre}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(pedido.created_at)}
                  </span>
                </div>

                {/* Destination */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Destino de Entrega
                  </p>
                  <p className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{pedido.destino_detalle}</span>
                  </p>
                  {pedido.latitud && pedido.longitud && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <a
                        href={`https://www.google.com/maps?q=${pedido.latitud},${pedido.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <span>📍 Maps</span>
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${pedido.latitud},${pedido.longitud}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <span>🚗 Waze</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* 4-Step Visual Timeline */}
                <div className="pt-3 border-t border-white/[0.08]">
                  <div className="grid grid-cols-4 gap-2">
                    {steps.map((step) => {
                      const isPast = currentStep > step.num;
                      const isCurrent = currentStep === step.num;
                      const StepIcon = step.icon;

                      return (
                        <div key={step.num} className="flex flex-col items-center text-center">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                              isPast
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : isCurrent
                                ? 'bg-cyan-500 text-white animate-pulse shadow-xl shadow-cyan-500/40 ring-4 ring-cyan-400/20'
                                : 'bg-white/[0.04] text-slate-600 border border-white/10'
                            }`}
                          >
                            <StepIcon className="w-5 h-5" />
                          </div>
                          <p
                            className={`text-xs font-black mt-2 leading-tight ${
                              isCurrent ? 'text-cyan-400' : isPast ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {step.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* WhatsApp Action Button */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Consultar sobre este paquete en WhatsApp</span>
                </a>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
