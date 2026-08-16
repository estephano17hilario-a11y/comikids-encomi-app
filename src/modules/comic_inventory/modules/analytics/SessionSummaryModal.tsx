import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';

interface SessionStats {
  sold: number;
  revenue: number;
}

interface SessionSummaryModalProps {
  stats: SessionStats;
  onClose: () => void;
  onSave: (notes: string) => void;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ stats, onClose, onSave }) => {
  const [notes, setNotes] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fadeIn text-left"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-scaleUp relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/40 text-rose-400 text-xl font-bold">
            🔴
          </div>
          <h2 className="text-xl font-black text-white">Resumen de Live TikTok</h2>
          <p className="text-xs text-slate-400">Resultados de la sesión de venta en vivo</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-white/4 rounded-2xl border border-white/6 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Ingresos Totales</p>
            <p className="text-xl font-mono font-black text-emerald-400">S/ {stats.revenue.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-white/4 rounded-2xl border border-white/6 text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Prendas Vendidas</p>
            <p className="text-xl font-mono font-black text-white">{stats.sold} u.</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
            <Icon name="FileText" size={12} /> Notas de la Transmisión
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Mucha demanda de pijamas talla S. Reponer stock..."
            className="w-full h-20 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => onSave(notes)}
          className="w-full py-3.5 rounded-xl bg-linear-to-r from-rose-600 via-pink-600 to-amber-600 font-black uppercase tracking-wider text-xs shadow-lg active:scale-95 transition-all text-white cursor-pointer"
        >
          Guardar y Cerrar Live
        </button>
      </div>
    </div>
  );
};
