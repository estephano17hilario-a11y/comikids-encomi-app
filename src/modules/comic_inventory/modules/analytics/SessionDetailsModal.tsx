import React from 'react';
import { Icon } from '../../components/ui/Icon';
import { HistoryItem } from '../../types';

interface SessionDetailsModalProps {
  currentSessionHistory: HistoryItem[];
  onClose: () => void;
  onUpdateSale: (item: HistoryItem, change: number) => void;
  onDeleteSale: (item: HistoryItem) => void;
}

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  currentSessionHistory,
  onClose,
  onUpdateSale,
  onDeleteSale
}) => {
  const totalSessionRevenue = currentSessionHistory.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-3 sm:p-4 animate-fadeIn text-left"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-linear-to-r from-rose-950/80 to-slate-900 border-b border-white/5 flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-0.5">Live Command Center</p>
            <h2 className="text-lg font-black text-white">Ventas del Live Actual</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-3 bg-white/4 border-b border-white/5 flex justify-between items-center">
          <span className="text-xs text-slate-400 font-bold uppercase">Total Acumulado</span>
          <span className="text-xl font-mono font-black text-emerald-400">S/ {totalSessionRevenue.toLocaleString()}</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {currentSessionHistory.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              <Icon name="ShoppingBag" size={32} className="mx-auto mb-2" />
              <p className="text-xs text-slate-400">Aún no hay ventas en este Live.</p>
            </div>
          ) : (
            currentSessionHistory
              .slice()
              .reverse()
              .map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center bg-white/4 p-2.5 rounded-xl border border-white/6 hover:bg-white/8 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-xs text-white truncate">{item.product}</p>
                    <p className="text-[10px] text-slate-400 uppercase">
                      {item.variant} • <span className="text-emerald-400 font-bold">S/ {item.price} c/u</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-black/50 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={() => onUpdateSale(item, -1)}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Icon name="ArrowDown" size={12} />
                      </button>
                      <span className="w-5 text-center text-xs font-mono font-bold text-white">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateSale(item, 1)}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Icon name="ArrowUp" size={12} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteSale(item)}
                      className="p-1.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/25 rounded-lg transition-colors border border-rose-500/20 cursor-pointer"
                    >
                      <Icon name="Trash" size={13} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
