import React from 'react';
import { useOrders } from '../../context/OrderContext';
import { Bell, X, ArrowRight } from 'lucide-react';

interface Props {
  onViewOrder?: () => void;
}

export const OrderAlertModal: React.FC<Props> = ({ onViewOrder }) => {
  const { latestNewOrder, clearLatestOrderAlert } = useOrders();

  if (!latestNewOrder) return null;

  return (
    <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-bounce">
      <div className="rounded-3xl glass-panel p-4 border-2 border-pink-500 shadow-2xl shadow-pink-500/30 bg-slate-950/95 backdrop-blur-xl flex flex-col gap-3">
        
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/40">
              <Bell className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-pink-400">
                ¡Nuevo Pedido Incomi! 🧵✨
              </h4>
              <p className="text-xs font-bold text-white leading-tight">
                {latestNewOrder.usuario?.nombre_completo || 'Clienta'}
              </p>
            </div>
          </div>

          <button
            onClick={clearLatestOrderAlert}
            className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1">
          <p className="font-mono text-pink-300 font-bold">
            #{latestNewOrder.codigo_seguimiento} • {latestNewOrder.metodo_envio_nombre}
          </p>
          <p className="line-clamp-1 text-slate-300 text-[11px]">
            "{latestNewOrder.detalles_bordado}"
          </p>
          <p className="text-[10px] text-cyan-400 font-medium truncate">
            📍 {latestNewOrder.destino_detalle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearLatestOrderAlert();
              if (onViewOrder) onViewOrder();
            }}
            className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1"
          >
            <span>Ver Pedido</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={clearLatestOrderAlert}
            className="py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
