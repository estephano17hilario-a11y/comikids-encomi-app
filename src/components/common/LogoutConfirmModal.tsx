import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, X, AlertTriangle } from 'lucide-react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutConfirmModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-xs rounded-3xl glass-panel p-6 border border-rose-500/40 shadow-2xl shadow-rose-500/10 text-center space-y-4">
        
        {/* Warning Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
          <LogOut className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base font-extrabold text-white">¿Cerrar Sesión?</h3>
          <p className="text-xs text-slate-400 mt-1">
            ¿Estás segura de que deseas salir? Podrás volver a entrar en cualquier momento con tu WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
          >
            Sí, Salir
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
