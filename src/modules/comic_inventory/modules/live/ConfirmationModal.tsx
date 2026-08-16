import React from 'react';
import { Icon } from '../../components/ui/Icon';

interface ConfirmationConfig {
  type: 'start' | 'end';
  title: string;
  message: string;
  onConfirm: () => void;
}

interface ConfirmationModalProps {
  config: ConfirmationConfig;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ config, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-6 animate-fadeIn"
    onClick={onClose}
  >
    <div
      className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-scaleUp text-center relative overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`absolute top-0 left-0 w-full h-1/2 opacity-20 blur-2xl pointer-events-none ${
          config.type === 'start' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}
      />
      <div className="relative z-10">
        <div
          className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center border text-2xl ${
            config.type === 'start'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <Icon name={config.type === 'start' ? 'Zap' : 'History'} size={28} />
        </div>
        <h3 className="text-xl font-black text-white mb-2">{config.title}</h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">{config.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold text-xs tracking-wider hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={config.onConfirm}
            className={`flex-1 py-3 rounded-xl font-black text-xs tracking-wider text-white shadow-lg active:scale-95 transition-all cursor-pointer ${
              config.type === 'start'
                ? 'bg-linear-to-r from-emerald-600 to-teal-600 shadow-emerald-900/40'
                : 'bg-linear-to-r from-rose-600 to-pink-600 shadow-rose-900/40'
            }`}
          >
            {config.type === 'start' ? 'INICIAR LIVE' : 'FINALIZAR'}
          </button>
        </div>
      </div>
    </div>
  </div>
);
