import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check, Eye, Save, Maximize2 } from 'lucide-react';
import { MetodoEnvio, TallerConfig } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import {
  AgencyDraft,
  RotuloDraft,
  draftFromMethod,
  buildMethodUpdates,
  buildLiveMethod,
  buildMockPedido,
} from './agencyDraft';
import { AgencyLogo, AgencyChoicePreview, SchedulePreview, FormPreview, WhatsAppPreview, LabelPreview } from './previews';
import { StepIdentidad } from './StepIdentidad';
import { StepHorario } from './StepHorario';
import { StepDatos } from './StepDatos';
import { StepMensaje } from './StepMensaje';
import { StepRotulo } from './StepRotulo';

export type EditorStep = 'identidad' | 'horario' | 'datos' | 'mensaje' | 'rotulo';

export const EDITOR_STEPS: { id: EditorStep; emoji: string; title: string; short: string; previewTitle: string }[] = [
  { id: 'identidad', emoji: '🎨', title: 'Nombre y logo', short: 'Logo', previewTitle: 'Así te ven tus clientas' },
  { id: 'horario', emoji: '📅', title: 'Días y horario', short: 'Días', previewTitle: 'Días de salida' },
  { id: 'datos', emoji: '📝', title: 'Datos que pides', short: 'Datos', previewTitle: 'Formulario de tu clienta' },
  { id: 'mensaje', emoji: '💬', title: 'Mensaje de WhatsApp', short: 'Mensaje', previewTitle: 'Lo que recibe por WhatsApp' },
  { id: 'rotulo', emoji: '🏷️', title: 'Rótulo para imprimir', short: 'Rótulo', previewTitle: 'Tu rótulo' },
];

interface Props {
  method: MetodoEnvio;
  taller: TallerConfig;
  companyName: string;
  initialStep?: EditorStep;
  onSave: (updates: Partial<MetodoEnvio>) => void;
  onClose: () => void;
}

export const AgencyEditor: React.FC<Props> = ({ method, taller, companyName, initialStep = 'identidad', onSave, onClose }) => {
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState<AgencyDraft>(() => draftFromMethod(method, taller));
  const [step, setStep] = useState<EditorStep>(initialStep);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [showFullLabel, setShowFullLabel] = useState(false);
  const savedSnapshot = useRef(JSON.stringify(draft));
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDirty = JSON.stringify(draft) !== savedSnapshot.current;

  const update = useCallback((patch: Partial<AgencyDraft>) => setDraft(d => ({ ...d, ...patch })), []);
  const updateRotulo = useCallback((patch: Partial<RotuloDraft>) => setDraft(d => ({ ...d, rotulo: { ...d.rotulo, ...patch } })), []);

  const live = useMemo(() => buildLiveMethod(draft, method), [draft, method]);
  const mockPedido = useMemo(() => buildMockPedido(draft, method), [draft, method]);

  const stepIndex = EDITOR_STEPS.findIndex(s => s.id === step);
  const current = EDITOR_STEPS[stepIndex];
  const next = EDITOR_STEPS[stepIndex + 1];
  const prev = EDITOR_STEPS[stepIndex - 1];

  const goTo = (s: EditorStep) => {
    setStep(s);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = (): boolean => {
    if (!draft.nombre.trim()) {
      toast('Ponle un nombre a la agencia antes de guardar.', 'warning');
      goTo('identidad');
      return false;
    }
    onSave(buildMethodUpdates(draft, method));
    savedSnapshot.current = JSON.stringify(draft);
    toast(`¡Listo! "${draft.nombre.trim()}" quedó guardada`);
    return true;
  };

  const requestClose = async () => {
    if (!isDirty) {
      onClose();
      return;
    }
    const discard = await confirm({
      title: '¿Salir sin guardar?',
      message: 'Perderás los cambios que hiciste en esta agencia.',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando',
      tone: 'danger',
    });
    if (discard) onClose();
  };

  // Ocultar la navegación del panel mientras el editor está abierto; Ctrl+S guarda
  useEffect(() => {
    document.body.classList.add('hide-admin-dock', 'has-active-modal');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('hide-admin-dock', 'has-active-modal');
      document.body.style.overflow = '';
    };
  }, []);

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stepProps = { draft, update, updateRotulo, base: method, taller };

  const preview = (
    <>
      {step === 'identidad' && <AgencyChoicePreview live={live} />}
      {step === 'horario' && <SchedulePreview draft={draft} live={live} taller={taller} />}
      {step === 'datos' && <FormPreview draft={draft} live={live} />}
      {step === 'mensaje' && <WhatsAppPreview draft={draft} companyName={companyName} />}
      {step === 'rotulo' && (
        <div className="space-y-3">
          <LabelPreview live={live} pedido={mockPedido} taller={taller} />
          <button
            type="button"
            onClick={() => setShowFullLabel(true)}
            className="w-full min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-slate-200 flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4" /> Ver en grande
          </button>
        </div>
      )}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-[#060913] text-white flex flex-col animate-fadeIn" role="dialog" aria-modal="true" aria-label={`Personalizar ${draft.nombre || method.nombre}`} data-no-print="true">
      {/* Barra superior */}
      <header className="shrink-0 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl pt-safe-header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-3 flex items-center gap-3">
          <button type="button" onClick={requestClose} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0" aria-label="Cerrar editor">
            <X className="w-5 h-5" />
          </button>
          <AgencyLogo method={live} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-slate-400 leading-none">Personalizando</p>
            <h1 className="text-base sm:text-lg font-black truncate leading-tight mt-0.5">{draft.nombre || 'Agencia sin nombre'}</h1>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty}
            className={`min-h-11 px-4 sm:px-5 rounded-2xl text-sm font-black flex items-center gap-2 shrink-0 transition-colors ${
              isDirty ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30' : 'bg-white/5 text-slate-400'
            }`}
          >
            {isDirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            <span>{isDirty ? 'Guardar' : 'Guardado'}</span>
          </button>
        </div>

        {/* Pasos en celular */}
        <nav aria-label="Pasos" className="lg:hidden max-w-7xl mx-auto px-3 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {EDITOR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              aria-current={s.id === step ? 'step' : undefined}
              className={`shrink-0 min-h-11 px-3 rounded-xl text-sm font-bold flex items-center gap-1.5 ${
                s.id === step ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 text-slate-300'
              }`}
            >
              <span aria-hidden="true">{s.emoji}</span>
              <span>{i + 1}. {s.short}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto flex">
        {/* Pasos en computadora */}
        <nav aria-label="Pasos" className="hidden lg:flex flex-col gap-2 w-64 shrink-0 p-5 border-r border-white/10 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1 pb-1">Pasos</p>
          {EDITOR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              aria-current={s.id === step ? 'step' : undefined}
              className={`min-h-14 px-3.5 rounded-2xl text-left flex items-center gap-3 transition-colors ${
                s.id === step ? 'bg-cyan-500/15 border-2 border-cyan-400 text-white' : 'border-2 border-transparent text-slate-300 hover:bg-white/5'
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${s.id === step ? 'bg-cyan-400 text-slate-950' : 'bg-white/10'}`}>
                {i + 1}
              </span>
              <span className="text-[15px] font-bold leading-tight">{s.emoji} {s.title}</span>
            </button>
          ))}
          <div className="mt-auto pt-4 text-[13px] text-slate-500 leading-snug px-1">
            Puedes saltar entre pasos cuando quieras. Atajo: <kbd className="px-1.5 py-0.5 rounded border border-white/15 font-mono text-[11px]">Ctrl + S</kbd> guarda.
          </div>
        </nav>

        {/* Contenido del paso */}
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 sm:px-6 py-5 sm:py-7 pb-40 lg:pb-12">
            <p className="text-sm font-bold text-cyan-300 mb-3">Paso {stepIndex + 1} de {EDITOR_STEPS.length}</p>
            {step === 'identidad' && <StepIdentidad {...stepProps} />}
            {step === 'horario' && <StepHorario {...stepProps} />}
            {step === 'datos' && <StepDatos {...stepProps} />}
            {step === 'mensaje' && <StepMensaje {...stepProps} />}
            {step === 'rotulo' && <StepRotulo {...stepProps} />}

            {/* Navegación entre pasos (computadora) */}
            <div className="hidden lg:flex items-center justify-between gap-3 pt-8">
              {prev ? (
                <button type="button" onClick={() => goTo(prev.id)} className="min-h-12 px-5 rounded-2xl bg-white/5 hover:bg-white/10 font-bold flex items-center gap-2">
                  <ArrowLeft className="w-5 h-5" /> {prev.title}
                </button>
              ) : <span />}
              {next ? (
                <button type="button" onClick={() => goTo(next.id)} className="min-h-12 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black flex items-center gap-2">
                  Siguiente: {next.title} <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button type="button" onClick={() => { if (save()) onClose(); }} className="min-h-12 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-2">
                  <Check className="w-5 h-5" /> Guardar y terminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vista previa en vivo (computadora) */}
        <aside className="hidden lg:block w-[420px] xl:w-[460px] shrink-0 border-l border-white/10 overflow-y-auto bg-slate-950/40">
          <div className="p-5 space-y-3 sticky top-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Eye className="w-4 h-4" /> {current.previewTitle}</p>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En vivo</span>
            </div>
            {preview}
          </div>
        </aside>
      </div>

      {/* Barra inferior (celular) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-3 pt-2.5 pb-safe">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (prev ? goTo(prev.id) : requestClose())}
            className="min-h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0"
            aria-label={prev ? `Volver a ${prev.title}` : 'Cerrar'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowPreviewSheet(true)}
            className="min-h-12 px-4 rounded-2xl bg-white/10 font-bold text-sm flex items-center gap-2 shrink-0"
          >
            <Eye className="w-5 h-5" /> Ver cómo queda
          </button>
          {next ? (
            <button type="button" onClick={() => goTo(next.id)} className="flex-1 min-h-12 rounded-2xl bg-cyan-500 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5">
              {next.short} <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button type="button" onClick={() => { if (save()) onClose(); }} className="flex-1 min-h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5">
              <Check className="w-5 h-5" /> Terminar
            </button>
          )}
        </div>
      </div>

      {/* Vista previa en celular */}
      {showPreviewSheet && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/70 flex items-end animate-fadeIn" onClick={() => setShowPreviewSheet(false)}>
          <div
            className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-slate-900 border-t border-white/10 p-4 pb-safe space-y-3 animate-slideUp"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Vista previa"
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-black flex items-center gap-2"><Eye className="w-5 h-5 text-cyan-300" /> {current.previewTitle}</p>
              <button type="button" onClick={() => setShowPreviewSheet(false)} className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center" aria-label="Cerrar vista previa">
                <X className="w-5 h-5" />
              </button>
            </div>
            {preview}
          </div>
        </div>
      )}

      {/* Rótulo en grande */}
      {showFullLabel && (
        <div className="fixed inset-0 z-30 bg-black/85 flex items-center justify-center p-3 sm:p-6 animate-fadeIn" onClick={() => setShowFullLabel(false)}>
          <div className="w-full max-w-4xl max-h-full overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-black">Tu rótulo ({draft.rotulo.orientacion === 'horizontal' ? 'echado' : 'parado'})</p>
              <button type="button" onClick={() => setShowFullLabel(false)} className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <LabelPreview live={live} pedido={mockPedido} taller={taller} />
            <p className="text-[13px] text-slate-400">Los datos de la clienta son de ejemplo. Al imprimir se usan los de cada pedido.</p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
