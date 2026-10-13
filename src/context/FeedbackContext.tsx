import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

// Sistema unificado de avisos (toasts) y confirmaciones.
// Reemplaza alert()/confirm() nativos, que bloquean la app y se ven distintos en cada celular.

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

interface FeedbackContextType {
  toast: (message: string, tone?: ToastTone, action?: { label: string; onClick: () => void }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

const TONE_STYLES: Record<ToastTone, { icon: React.ElementType; box: string; icon_color: string }> = {
  success: { icon: CheckCircle2, box: 'border-emerald-500/40 bg-emerald-950/95', icon_color: 'text-emerald-400' },
  error: { icon: XCircle, box: 'border-rose-500/40 bg-rose-950/95', icon_color: 'text-rose-400' },
  warning: { icon: AlertTriangle, box: 'border-amber-500/40 bg-amber-950/95', icon_color: 'text-amber-400' },
  info: { icon: Info, box: 'border-cyan-500/40 bg-slate-900/95', icon_color: 'text-cyan-400' },
};

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback<FeedbackContextType['toast']>((message, tone = 'success', action) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-2), { id, message, tone, actionLabel: action?.label, onAction: action?.onClick }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const confirm = useCallback<FeedbackContextType['confirm']>((options) => {
    return new Promise<boolean>(resolve => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {createPortal(
        <div
          className="fixed inset-x-0 z-[10050] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-safe mb-20 sm:mb-24"
          aria-live="polite"
          role="status"
        >
          {toasts.map(t => {
            const style = TONE_STYLES[t.tone];
            const Icon = style.icon;
            return (
              <div
                key={t.id}
                className={`pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-toastIn ${style.box}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${style.icon_color}`} />
                <p className="flex-1 text-sm font-semibold text-white leading-snug whitespace-pre-line">{t.message}</p>
                {t.actionLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      t.onAction?.();
                      dismiss(t.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-white shrink-0"
                  >
                    {t.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
                  aria-label="Cerrar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {confirmState && createPortal(
        <div
          className="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => closeConfirm(false)}
          data-no-print="true"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-title"
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl bg-slate-900 border p-5 sm:p-6 space-y-4 shadow-2xl animate-scaleUp pb-safe ${
              confirmState.tone === 'danger' ? 'border-rose-500/40' : 'border-cyan-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmState.tone === 'danger' ? 'bg-rose-500/15 text-rose-400' : 'bg-cyan-500/15 text-cyan-400'
              }`}>
                {confirmState.tone === 'danger' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 id="feedback-confirm-title" className="text-base font-black text-white leading-snug">
                  {confirmState.title}
                </h3>
                {confirmState.message && (
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{confirmState.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="flex-1 min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-bold"
              >
                {confirmState.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`flex-1 min-h-11 rounded-2xl text-sm font-black shadow-lg ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
                }`}
              >
                {confirmState.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextType => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback debe usarse dentro de FeedbackProvider');
  return ctx;
};
