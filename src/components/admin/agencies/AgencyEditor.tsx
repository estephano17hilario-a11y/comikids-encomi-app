import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check, Eye, Save, Maximize2, HelpCircle, Tag } from 'lucide-react';
import { MetodoEnvio, TallerConfig } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import {
  AgencyDraft,
  RotuloDraft,
  StepProps,
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
import { StepResumen } from './StepResumen';

export type EditorStep = 'identidad' | 'horario' | 'datos' | 'mensaje' | 'rotulo' | 'resumen';

export const EDITOR_STEPS: {
  id: EditorStep;
  emoji: string;
  title: string;
  short: string;
  oneLiner: string;
  accent: string;
  previewTitle: string;
  previewHint: string;
}[] = [
  { id: 'identidad', emoji: '🎨', title: 'Nombre y logo', short: 'Logo', oneLiner: 'Cómo la reconoce tu clienta', accent: '#22d3ee', previewTitle: 'Así te ven tus clientas', previewHint: 'Esta es la tarjeta que tu clienta toca para elegir esta agencia cuando hace su pedido.' },
  { id: 'horario', emoji: '📅', title: 'Días y horario', short: 'Días', oneLiner: 'Qué días llevas paquetes', accent: '#f59e0b', previewTitle: 'Tu semana', previewHint: 'En verde, los días que sale esta agencia. Abajo, lo que leerá tu clienta.' },
  { id: 'datos', emoji: '📝', title: 'Datos que pides', short: 'Datos', oneLiner: 'Qué le preguntas a tu clienta', accent: '#818cf8', previewTitle: 'Formulario de tu clienta', previewHint: 'Así se ve el formulario en el celular de tu clienta. Arriba lo básico; abajo tus preguntas.' },
  { id: 'mensaje', emoji: '💬', title: 'Mensaje de WhatsApp', short: 'Mensaje', oneLiner: 'El comprobante que le llega', accent: '#10b981', previewTitle: 'Lo que recibe por WhatsApp', previewHint: 'Así le llega el comprobante. Los números 1, 2 y 3 son las mismas partes que editas.' },
  { id: 'rotulo', emoji: '🏷️', title: 'Rótulo para imprimir', short: 'Rótulo', oneLiner: 'La etiqueta de la caja', accent: '#ec4899', previewTitle: 'Tu rótulo', previewHint: 'Así saldrá impreso. Los datos de la clienta son de ejemplo.' },
  { id: 'resumen', emoji: '✅', title: 'Revisar y guardar', short: 'Guardar', oneLiner: 'Todo en un vistazo', accent: '#34d399', previewTitle: 'Tu rótulo', previewHint: 'Así saldrá impreso. Los datos de la clienta son de ejemplo.' },
];

const INTRO_KEY = 'encomi_agency_editor_intro_seen_v1';

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
  const [visited, setVisited] = useState<Set<EditorStep>>(() => new Set([initialStep]));
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [showFullLabel, setShowFullLabel] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | undefined>(undefined);
  const [previewPulse, setPreviewPulse] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    if (initialStep !== 'identidad') return false;
    try {
      return localStorage.getItem(INTRO_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const savedSnapshot = useRef(JSON.stringify(draft));
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<number | null>(null);

  const isDirty = JSON.stringify(draft) !== savedSnapshot.current;

  const update = useCallback((patch: Partial<AgencyDraft>) => setDraft(d => ({ ...d, ...patch })), []);
  const updateRotulo = useCallback((patch: Partial<RotuloDraft>) => setDraft(d => ({ ...d, rotulo: { ...d.rotulo, ...patch } })), []);

  const live = useMemo(() => buildLiveMethod(draft, method), [draft, method]);
  const mockPedido = useMemo(() => buildMockPedido(draft, method), [draft, method]);

  const stepIndex = EDITOR_STEPS.findIndex(s => s.id === step);
  const current = EDITOR_STEPS[stepIndex];
  const next = EDITOR_STEPS[stepIndex + 1];
  const prev = EDITOR_STEPS[stepIndex - 1];
  const accent = current.accent;

  const goTo = useCallback((s: EditorStep) => {
    setStep(s);
    setVisited(v => new Set(v).add(s));
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const highlight = useCallback((key: string) => {
    setHighlightKey(key);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightKey(undefined), 2500);
  }, []);

  const closeIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      // sin almacenamiento: se volverá a mostrar la próxima vez
    }
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

  const saveAndClose = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    if (save()) onClose();
  };

  const requestClose = async () => {
    if (!isDirty) {
      onClose();
      return;
    }
    const discard = await confirm({
      title: '¿Salir sin guardar?',
      message: 'Perderás los cambios que hiciste en esta agencia. Si quieres conservarlos, toca «Seguir editando» y luego «Guardar».',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando',
      tone: 'danger',
    });
    if (discard) onClose();
  };

  // Ocultar la navegación del panel mientras el editor está abierto
  useEffect(() => {
    document.body.classList.add('hide-admin-dock', 'has-active-modal');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('hide-admin-dock', 'has-active-modal');
      document.body.style.overflow = '';
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  // Ctrl+S guarda
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

  const stepProps: StepProps = {
    draft,
    update,
    updateRotulo,
    base: method,
    taller,
    accent,
    openPreview: () => {
      // En computadora la vista previa ya está a la derecha: se ilumina para llamar la atención
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setPreviewPulse(true);
        window.setTimeout(() => setPreviewPulse(false), 1400);
      } else {
        setShowPreviewSheet(true);
      }
    },
    highlight,
  };

  const preview = (
    <div className="space-y-3">
      <p className="text-[14px] text-slate-300 leading-snug rounded-2xl bg-white/5 border border-white/10 px-3.5 py-3">
        👀 {current.previewHint}
      </p>
      {step === 'identidad' && <AgencyChoicePreview live={live} />}
      {step === 'horario' && <SchedulePreview draft={draft} live={live} taller={taller} />}
      {step === 'datos' && <FormPreview draft={draft} live={live} highlightKey={highlightKey} />}
      {step === 'mensaje' && <WhatsAppPreview draft={draft} companyName={companyName} />}
      {(step === 'rotulo' || step === 'resumen') && (
        <>
          <LabelPreview live={live} pedido={mockPedido} taller={taller} />
          <button
            type="button"
            onClick={() => setShowFullLabel(true)}
            className="w-full min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-slate-200 flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4" /> Ver en grande
          </button>
        </>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-[#060913] text-white flex flex-col animate-fadeIn" role="dialog" aria-modal="true" aria-label={`Personalizar ${draft.nombre || method.nombre}`} data-no-print="true">
      {/* Ambiente de color del paso */}
      <div
        key={`glow-${step}`}
        className="pointer-events-none absolute inset-0 animate-fadeIn"
        style={{ background: `radial-gradient(55% 45% at 50% 0%, ${accent}2e, transparent 70%), radial-gradient(40% 35% at 100% 100%, ${accent}1a, transparent 70%)` }}
        aria-hidden="true"
      />

      {/* Barra superior */}
      <header className="relative shrink-0 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl pt-safe-header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-3 flex items-center gap-2.5 sm:gap-3">
          <button type="button" onClick={requestClose} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0" aria-label="Cerrar editor">
            <X className="w-5 h-5" />
          </button>
          <span className="hidden min-[440px]:block shrink-0"><AgencyLogo method={live} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-slate-400 leading-none">Personalizando</p>
            <h1 className="text-[15px] sm:text-lg font-black leading-tight mt-0.5 line-clamp-2 break-words">{draft.nombre || 'Agencia sin nombre'}</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowFullLabel(true)}
            className="min-h-11 min-w-11 px-2.5 md:px-3.5 rounded-2xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-400/40 text-sm font-bold text-pink-100 flex items-center justify-center gap-1.5 shrink-0"
            aria-label="Ver cómo queda el rótulo"
            title="Ver cómo queda el rótulo con todos tus cambios"
          >
            <Tag className="w-5 h-5" />
            <span className="hidden md:inline">Ver rótulo</span>
          </button>
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="hidden min-[440px]:flex min-h-11 min-w-11 px-2.5 md:px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-200 items-center justify-center gap-1.5 shrink-0"
            aria-label="Cómo funciona"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="hidden md:inline">¿Cómo funciona?</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty}
            className={`min-h-11 px-3.5 sm:px-5 rounded-2xl text-sm font-black flex items-center gap-2 shrink-0 transition-colors ${
              isDirty ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30' : 'bg-white/5 text-slate-400'
            }`}
          >
            {isDirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            <span className={isDirty ? '' : 'hidden min-[440px]:inline'}>{isDirty ? 'Guardar' : 'Guardado'}</span>
          </button>
        </div>

        {/* Barra de progreso + pasos en celular */}
        <div className="lg:hidden max-w-7xl mx-auto px-3 pb-3 space-y-2">
          <div className="flex items-center gap-1" aria-hidden="true">
            {EDITOR_STEPS.map((s, i) => (
              <span key={s.id} className="h-1.5 flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= stepIndex ? accent : 'rgba(255,255,255,0.12)' }} />
            ))}
          </div>
          <nav aria-label="Pasos" className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {EDITOR_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={s.id === step ? 'step' : undefined}
                className={`shrink-0 min-h-11 px-3 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors ${
                  s.id === step ? 'text-slate-950' : 'bg-white/5 text-slate-300'
                }`}
                style={s.id === step ? { backgroundColor: s.accent } : undefined}
              >
                {visited.has(s.id) && s.id !== step ? <Check className="w-4 h-4 text-emerald-400" /> : <span aria-hidden="true">{s.emoji}</span>}
                <span>{i + 1}. {s.short}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 max-w-7xl w-full mx-auto flex">
        {/* Pasos en computadora */}
        <nav aria-label="Pasos" className="hidden lg:flex flex-col gap-2 w-72 shrink-0 p-5 border-r border-white/10 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1 pb-1">Tu recorrido</p>
          {EDITOR_STEPS.map((s, i) => {
            const isCurrent = s.id === step;
            const done = visited.has(s.id) && !isCurrent;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`min-h-16 px-3.5 py-2.5 rounded-2xl text-left flex items-center gap-3 transition-colors border-2 ${
                  isCurrent ? 'bg-white/5 text-white' : 'border-transparent text-slate-300 hover:bg-white/5'
                }`}
                style={isCurrent ? { borderColor: s.accent } : undefined}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                  style={isCurrent ? { backgroundColor: s.accent, color: '#0f172a' } : done ? { backgroundColor: '#10b98133', color: '#34d399' } : { backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  {done ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-tight">{s.emoji} {s.title}</span>
                  <span className="block text-[12px] text-slate-500 leading-snug mt-0.5">{s.oneLiner}</span>
                </span>
              </button>
            );
          })}
          <div className="mt-auto pt-4 text-[13px] text-slate-500 leading-snug px-1 space-y-2">
            <p>Puedes saltar entre pasos cuando quieras. Nada se guarda hasta que tocas <strong className="text-slate-300">Guardar</strong>.</p>
            <p>Atajo: <kbd className="px-1.5 py-0.5 rounded border border-white/15 font-mono text-[11px]">Ctrl + S</kbd> guarda.</p>
          </div>
        </nav>

        {/* Contenido del paso */}
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto">
          <div key={step} className="max-w-2xl mx-auto px-3 sm:px-6 py-5 sm:py-7 pb-40 lg:pb-12 animate-slideUp">
            <p className="text-sm font-black mb-3" style={{ color: accent }}>Paso {stepIndex + 1} de {EDITOR_STEPS.length} • {current.oneLiner}</p>
            {step === 'identidad' && <StepIdentidad {...stepProps} />}
            {step === 'horario' && <StepHorario {...stepProps} />}
            {step === 'datos' && <StepDatos {...stepProps} />}
            {step === 'mensaje' && <StepMensaje {...stepProps} />}
            {step === 'rotulo' && <StepRotulo {...stepProps} />}
            {step === 'resumen' && <StepResumen {...stepProps} live={live} goTo={goTo} isDirty={isDirty} onSaveAndClose={saveAndClose} />}

            {/* Navegación entre pasos (computadora) */}
            {step !== 'resumen' && (
              <div className="hidden lg:flex items-center justify-between gap-3 pt-8">
                {prev ? (
                  <button type="button" onClick={() => goTo(prev.id)} className="min-h-12 px-5 rounded-2xl bg-white/5 hover:bg-white/10 font-bold flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" /> {prev.title}
                  </button>
                ) : <span />}
                {next && (
                  <button type="button" onClick={() => goTo(next.id)} className="min-h-12 px-5 rounded-2xl text-slate-950 font-black flex items-center gap-2" style={{ backgroundColor: next.accent }}>
                    Siguiente: {next.title} <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vista previa en vivo (computadora) */}
        <aside
          className={`hidden lg:block w-[420px] xl:w-[460px] shrink-0 border-l overflow-y-auto transition-colors duration-500 ${previewPulse ? 'bg-white/10' : 'bg-slate-950/30'}`}
          style={{ borderColor: previewPulse ? accent : 'rgba(255,255,255,0.1)' }}
        >
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white flex items-center gap-2"><Eye className="w-4 h-4" style={{ color: accent }} /> {current.previewTitle}</p>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En vivo</span>
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
            <button type="button" onClick={() => goTo(next.id)} className="flex-1 min-h-12 rounded-2xl text-slate-950 font-black text-sm flex items-center justify-center gap-1.5" style={{ backgroundColor: next.accent }}>
              {next.short} <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button type="button" onClick={saveAndClose} className="flex-1 min-h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5">
              <Check className="w-5 h-5" /> {isDirty ? 'Guardar' : 'Cerrar'}
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
              <p className="text-base font-black flex items-center gap-2"><Eye className="w-5 h-5" style={{ color: accent }} /> {current.previewTitle}</p>
              <button type="button" onClick={() => setShowPreviewSheet(false)} className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center" aria-label="Cerrar vista previa">
                <X className="w-5 h-5" />
              </button>
            </div>
            {preview}
            <button type="button" onClick={() => setShowPreviewSheet(false)} className="w-full min-h-12 rounded-2xl bg-white/10 font-bold">
              Seguir editando
            </button>
          </div>
        </div>
      )}

      {/* Rótulo en grande */}
      {showFullLabel && (
        <div className="fixed inset-0 z-30 bg-black/85 flex items-center justify-center p-3 sm:p-6 animate-fadeIn" onClick={() => setShowFullLabel(false)}>
          <div className="w-full max-w-md max-h-full overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black">Así queda tu rótulo</p>
                <p className="text-sm text-slate-400">Con todos los cambios que hiciste hasta ahora{isDirty ? ' (aún sin guardar)' : ''}.</p>
              </div>
              <button type="button" onClick={() => setShowFullLabel(false)} className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <LabelPreview live={live} pedido={mockPedido} taller={taller} />
            <p className="text-[13px] text-slate-400">Los datos de la clienta son de ejemplo. Al imprimir se usan los de cada pedido.</p>
          </div>
        </div>
      )}

      {/* Bienvenida guiada */}
      {showIntro && (
        <div className="fixed inset-0 z-40 bg-[#060913]/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 10%, #22d3ee33, transparent 70%)' }} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="intro-title" className="relative w-full max-w-lg max-h-full overflow-y-auto rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 space-y-6 animate-scaleUp">
            <div className="text-center space-y-3">
              <div className="mx-auto w-fit"><AgencyLogo method={live} size="lg" /></div>
              <h2 id="intro-title" className="text-2xl sm:text-3xl font-black leading-tight">Vamos a personalizar<br />{draft.nombre || 'tu agencia'}</h2>
              <p className="text-[15px] text-slate-300 leading-relaxed">
                Son {EDITOR_STEPS.length} pasos cortos. En cada uno te explicamos qué es y ves al instante cómo queda. No se guarda nada hasta que tú lo decidas.
              </p>
            </div>
            <ol className="space-y-2.5">
              {EDITOR_STEPS.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-3">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${s.accent}33` }} aria-hidden="true">{s.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black text-white">{i + 1}. {s.title}</span>
                    <span className="block text-[13px] text-slate-400">{s.oneLiner}</span>
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              autoFocus
              onClick={closeIntro}
              className="w-full min-h-14 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-lg font-black flex items-center justify-center gap-2"
            >
              Empezar <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
