import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Eye, Check, Loader2, Trash2, Maximize2, Lock } from 'lucide-react';
import { MetodoEnvio, TallerConfig } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { getAgencyDaysSummary } from '../../../utils/agencyAvailability';
import {
  AgencyDraft,
  RotuloDraft,
  StepProps,
  draftFromMethod,
  buildMethodUpdates,
  buildLiveMethod,
  buildMockPedido,
} from './agencyDraft';
import { AgencyLogo, AgencyChoicePreview, SchedulePreview, FormPreview, WhatsAppPreview, LabelPreview, isNativeDuplicateField } from './previews';
import { StepIdentidad } from './StepIdentidad';
import { StepHorario } from './StepHorario';
import { StepDatos } from './StepDatos';
import { StepRemitente } from './StepRemitente';
import { StepMensaje } from './StepMensaje';
import { StepRotulo } from './StepRotulo';
import { IosSwitch } from './ui';

export type EditorStep = 'hub' | 'identidad' | 'horario' | 'datos' | 'remitente' | 'mensaje' | 'rotulo';

const PAGES: Record<Exclude<EditorStep, 'hub'>, { title: string; accent: string; previewTitle: string; previewHint: string }> = {
  identidad: { title: 'Nombre y logo', accent: '#22d3ee', previewTitle: 'Así te ven tus clientas', previewHint: 'Esta es la tarjeta que tu clienta toca para elegir esta agencia.' },
  horario: { title: 'Días de envío', accent: '#f59e0b', previewTitle: 'Tu semana', previewHint: 'En verde, los días que sale esta agencia.' },
  datos: { title: 'Datos que pides', accent: '#818cf8', previewTitle: 'Formulario de tu clienta', previewHint: 'Así se ve el formulario en el celular de tu clienta.' },
  remitente: { title: 'Tus datos (remitente)', accent: '#06b6d4', previewTitle: 'Tu rótulo', previewHint: 'Así saldrá impreso. Los datos de la clienta son de ejemplo.' },
  mensaje: { title: 'Mensaje de WhatsApp', accent: '#10b981', previewTitle: 'Lo que recibe por WhatsApp', previewHint: 'Así le llega el comprobante a tu clienta.' },
  rotulo: { title: 'Rótulo para imprimir', accent: '#ec4899', previewTitle: 'Tu rótulo', previewHint: 'Así saldrá impreso. Los datos de la clienta son de ejemplo.' },
};

interface Props {
  method: MetodoEnvio;
  taller: TallerConfig;
  companyName: string;
  initialStep?: EditorStep;
  isSystem: boolean;
  canHide: boolean; // false si es la única agencia visible
  onSave: (updates: Partial<MetodoEnvio>) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// Fila estilo ajustes de iPhone
const Row: React.FC<{ emoji: string; color: string; title: string; subtitle: string; onClick: () => void }> = ({ emoji, color, title, subtitle, onClick }) => (
  <button type="button" onClick={onClick} className="w-full min-h-[4.25rem] px-4 py-3 flex items-center gap-3.5 text-left active:bg-white/5 hover:bg-white/[0.03] transition-colors">
    <span className="w-11 h-11 rounded-[0.85rem] flex items-center justify-center text-[22px] shrink-0 shadow-md" style={{ backgroundColor: color }} aria-hidden="true">{emoji}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[17px] font-bold text-white leading-tight">{title}</span>
      <span className="block text-[14px] text-slate-400 leading-snug mt-0.5 truncate">{subtitle}</span>
    </span>
    <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
  </button>
);

export const AgencyEditor: React.FC<Props> = ({ method, taller, companyName, initialStep = 'hub', isSystem, canHide, onSave, onToggleActive, onDelete, onClose }) => {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<AgencyDraft>(() => draftFromMethod(method, taller));
  const [page, setPage] = useState<EditorStep>(initialStep);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [showFullLabel, setShowFullLabel] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const lastSaved = useRef(JSON.stringify(draft));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const methodRef = useRef(method);
  methodRef.current = method;
  const saveTimer = useRef<number | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const update = useCallback((patch: Partial<AgencyDraft>) => setDraft(d => ({ ...d, ...patch })), []);
  const updateRotulo = useCallback((patch: Partial<RotuloDraft>) => setDraft(d => ({ ...d, rotulo: { ...d.rotulo, ...patch } })), []);

  const live = useMemo(() => buildLiveMethod(draft, method), [draft, method]);
  const mockPedido = useMemo(() => buildMockPedido(draft, method), [draft, method]);

  // ---------- Guardado automático ----------
  const flush = useCallback(() => {
    const d = draftRef.current;
    const snapshot = JSON.stringify(d);
    if (snapshot === lastSaved.current) {
      setStatus('saved');
      return;
    }
    if (!d.nombre.trim()) return; // sin nombre no se guarda
    onSave(buildMethodUpdates(d, methodRef.current));
    lastSaved.current = snapshot;
    setStatus('saved');
  }, [onSave]);

  useEffect(() => {
    if (JSON.stringify(draft) === lastSaved.current) return;
    setStatus('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, flush]);

  // Al cerrar o salir, se guarda lo pendiente
  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    flushRef.current();
  }, []);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    document.body.classList.add('hide-admin-dock', 'has-active-modal');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('hide-admin-dock', 'has-active-modal');
      document.body.style.overflow = '';
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  const goTo = useCallback((p: EditorStep) => {
    setPage(p);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const highlight = useCallback((key: string) => {
    setHighlightKey(key);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightKey(undefined), 2500);
  }, []);

  const closeAll = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (!draft.nombre.trim()) {
      toast('Ponle un nombre a la agencia para guardarla.', 'warning');
      goTo('identidad');
      return;
    }
    flush();
    onClose();
  };

  const info = page === 'hub' ? null : PAGES[page];
  const accent = info?.accent || '#22d3ee';

  const stepProps: StepProps = {
    draft,
    update,
    updateRotulo,
    base: method,
    taller,
    accent,
    openPreview: () => setShowPreviewSheet(true),
    highlight,
  };

  const preview = (
    <div className="space-y-3">
      {info && <p className="text-[14px] text-slate-300 leading-snug rounded-2xl bg-white/5 border border-white/10 px-3.5 py-3">👀 {info.previewHint}</p>}
      {page === 'identidad' && <AgencyChoicePreview live={live} />}
      {page === 'horario' && <SchedulePreview draft={draft} live={live} taller={taller} />}
      {page === 'datos' && <FormPreview draft={draft} live={live} highlightKey={highlightKey} />}
      {page === 'mensaje' && <WhatsAppPreview draft={draft} companyName={companyName} />}
      {(page === 'rotulo' || page === 'remitente') && (
        <>
          <LabelPreview live={live} pedido={mockPedido} taller={taller} />
          <button type="button" onClick={() => setShowFullLabel(true)} className="w-full min-h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-slate-200 flex items-center justify-center gap-2">
            <Maximize2 className="w-4 h-4" /> Ver en grande
          </button>
        </>
      )}
    </div>
  );

  // ---------- Resúmenes para la pantalla principal ----------
  const extras = draft.campos.filter(c => !isNativeDuplicateField(c, draft.tipo)).length;
  const r = draft.rotulo;
  const imprimeRemitente = r.mostrar_remitente_nombre || r.mostrar_remitente_ruc_dni || r.mostrar_remitente_telefono || r.mostrar_remitente_origen;
  const diasResumen = draft.modoHorario === 'predeterminado' ? 'Los mismos días que tu negocio' : getAgencyDaysSummary(live);
  const req = method.requisitos;

  const statusChip = (
    <span className={`flex items-center gap-1.5 text-[13px] font-bold shrink-0 ${status === 'saving' ? 'text-slate-400' : 'text-emerald-400'}`} aria-live="polite">
      {status === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Check className="w-4 h-4 stroke-[3]" /> Guardado</>}
    </span>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-[#0a0f1e] text-white flex flex-col animate-fadeIn" role="dialog" aria-modal="true" aria-label={`Configurar ${draft.nombre || method.nombre}`} data-no-print="true">
      {/* Barra superior estilo iOS */}
      <header className="relative shrink-0 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl pt-safe-header">
        <div className="max-w-2xl mx-auto px-3 pb-3 flex items-center gap-2">
          {page === 'hub' ? (
            <button type="button" onClick={closeAll} className="min-h-11 pl-1 pr-3 rounded-2xl text-cyan-300 font-bold text-[17px] flex items-center gap-0.5 hover:bg-white/5" aria-label="Volver a mis agencias">
              <ChevronLeft className="w-7 h-7" /> Agencias
            </button>
          ) : (
            <button type="button" onClick={() => { flush(); goTo('hub'); }} className="min-h-11 pl-1 pr-3 rounded-2xl font-bold text-[17px] flex items-center gap-0.5 hover:bg-white/5" style={{ color: accent }}>
              <ChevronLeft className="w-7 h-7" /> Atrás
            </button>
          )}
          <h1 className="flex-1 text-center text-[17px] font-black truncate px-1">{page === 'hub' ? '' : info?.title}</h1>
          <div className="min-w-[6.5rem] flex justify-end">{statusChip}</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className={`max-w-2xl mx-auto px-4 py-5 ${page === 'hub' ? 'pb-16' : 'pb-36'}`}>
          {/* ============ PANTALLA PRINCIPAL ============ */}
          {page === 'hub' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Cabecera con logo */}
              <div className="rounded-[1.75rem] bg-slate-900/80 border border-white/10 p-5 text-center space-y-4" style={{ boxShadow: `0 0 60px -25px ${draft.color}` }}>
                <button type="button" onClick={() => goTo('identidad')} className="mx-auto block active:scale-95 transition-transform" aria-label="Cambiar nombre y logo">
                  <AgencyLogo method={live} size="xl" />
                </button>
                <div>
                  <h2 className="text-2xl font-black leading-tight break-words">{draft.nombre || 'Agencia sin nombre'}</h2>
                  <p className="text-[15px] text-slate-400 mt-1 leading-snug">{draft.descripcion || 'Servicio de entrega'}</p>
                  <button type="button" onClick={() => goTo('identidad')} className="mt-2 text-[14px] font-bold text-cyan-300 hover:underline">Cambiar nombre, logo o color</button>
                </div>
                <div className="rounded-2xl bg-slate-950/60 border border-white/10 px-4 py-3 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="text-[16px] font-black">{method.activo ? 'Visible para tus clientas' : 'Oculta para tus clientas'}</p>
                    <p className="text-[13px] text-slate-400 leading-snug">{method.activo ? 'Ellas pueden elegirla al pedir.' : 'No aparece al hacer un pedido.'}</p>
                  </div>
                  <IosSwitch checked={method.activo} onChange={() => { if (method.activo && !canHide) { toast('Debe quedar al menos una agencia visible.', 'warning'); return; } onToggleActive(); }} label="Visible para tus clientas" />
                </div>
              </div>

              {/* Qué pide la agencia */}
              {req && (
                <section aria-label={`Qué pide ${method.nombre}`} className="space-y-2">
                  <h3 className="px-2 text-[13px] font-black uppercase tracking-wider text-slate-500">Qué pide {method.nombre}</h3>
                  <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
                    {([['📤 Remitente (tú)', req.remitente, '#22d3ee'], ['📥 Destinatario (clienta)', req.destinatario, '#34d399']] as const).map(([t, items, c]) => (
                      <div key={t} className="rounded-2xl bg-slate-900/80 border border-white/10 p-3.5">
                        <p className="text-[13px] font-black mb-2" style={{ color: c }}>{t}</p>
                        <ul className="space-y-1.5">
                          {items.map((q, i) => (
                            <li key={i} className="text-[14px] text-slate-200 leading-snug">{q.emoji} {q.label}{!q.obligatorio && <span className="text-slate-500"> (opc.)</span>}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {(req.recojo || req.pago) && (
                    <p className="px-2 text-[13px] text-slate-400 leading-snug">
                      {req.recojo && <>🏢 {req.recojo}. </>}{req.pago && <>💵 {req.pago}.</>}
                    </p>
                  )}
                </section>
              )}

              {/* Lista de ajustes */}
              <section aria-label="Ajustes de la agencia" className="space-y-2">
                <h3 className="px-2 text-[13px] font-black uppercase tracking-wider text-slate-500">Personalizar</h3>
                <div className="rounded-[1.5rem] bg-slate-900/80 border border-white/10 divide-y divide-white/8 overflow-hidden">
                  <Row emoji="📅" color="#f59e0b" title="Días de envío" subtitle={diasResumen} onClick={() => goTo('horario')} />
                  <Row emoji="📝" color="#6366f1" title="Datos que pides a tu clienta" subtitle={extras === 0 ? 'Solo los datos básicos' : `${extras} ${extras === 1 ? 'pregunta extra' : 'preguntas extra'}`} onClick={() => goTo('datos')} />
                  <Row emoji="📤" color="#0891b2" title="Tus datos (remitente)" subtitle={imprimeRemitente ? 'Se imprimen en el rótulo' : 'No se imprimen'} onClick={() => goTo('remitente')} />
                  <Row emoji="💬" color="#10b981" title="Mensaje de WhatsApp" subtitle={(draft.mensajeInicio.split('\n')[0] || '').replace(/[*_]/g, '').slice(0, 48) || 'Mensaje predeterminado'} onClick={() => goTo('mensaje')} />
                  <Row emoji="🏷️" color="#ec4899" title="Rótulo para imprimir" subtitle={r.estilo === 'eco_ink_saving' ? 'Blanco y negro (ahorra tinta)' : 'A color'} onClick={() => goTo('rotulo')} />
                </div>
              </section>

              <button type="button" onClick={() => setShowFullLabel(true)} className="w-full min-h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-[16px] font-bold flex items-center justify-center gap-2.5">
                <Eye className="w-5 h-5 text-pink-300" /> Ver cómo queda el rótulo
              </button>

              {isSystem ? (
                <p className="flex items-center justify-center gap-1.5 text-[13px] text-slate-500"><Lock className="w-3.5 h-3.5" /> Agencia oficial: no se puede eliminar</p>
              ) : (
                <button type="button" onClick={onDelete} className="w-full min-h-12 rounded-2xl text-[15px] font-bold text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-2">
                  <Trash2 className="w-5 h-5" /> Eliminar esta agencia
                </button>
              )}
            </div>
          )}

          {/* ============ SUB-PÁGINAS ============ */}
          {page === 'identidad' && <StepIdentidad {...stepProps} />}
          {page === 'horario' && <StepHorario {...stepProps} />}
          {page === 'datos' && <StepDatos {...stepProps} />}
          {page === 'remitente' && <StepRemitente {...stepProps} />}
          {page === 'mensaje' && <StepMensaje {...stepProps} />}
          {page === 'rotulo' && <StepRotulo {...stepProps} />}
        </div>
      </div>

      {/* Barra inferior de las sub-páginas */}
      {page !== 'hub' && (
        <div className="fixed bottom-0 inset-x-0 z-10 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-4 pt-3 pb-safe">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button type="button" onClick={() => setShowPreviewSheet(true)} className="min-h-14 px-5 rounded-2xl bg-white/10 hover:bg-white/15 font-bold text-[16px] flex items-center gap-2 shrink-0">
              <Eye className="w-5 h-5" /> Ver cómo queda
            </button>
            <button type="button" onClick={() => { flush(); goTo('hub'); }} className="flex-1 min-h-14 rounded-2xl text-slate-950 font-black text-[17px] flex items-center justify-center gap-2" style={{ backgroundColor: accent }}>
              <Check className="w-5 h-5 stroke-[3]" /> Listo
            </button>
          </div>
        </div>
      )}

      {/* Vista previa */}
      {showPreviewSheet && info && (
        <div className="fixed inset-0 z-20 bg-black/70 flex items-end sm:items-center justify-center animate-fadeIn" onClick={() => setShowPreviewSheet(false)}>
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-slate-900 border-t border-white/10 p-4 pb-safe space-y-3 animate-slideUp" onClick={e => e.stopPropagation()} role="dialog" aria-label="Vista previa">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-black flex items-center gap-2"><Eye className="w-5 h-5" style={{ color: accent }} /> {info.previewTitle}</p>
              <button type="button" onClick={() => setShowPreviewSheet(false)} className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center" aria-label="Cerrar vista previa"><X className="w-5 h-5" /></button>
            </div>
            {preview}
            <button type="button" onClick={() => setShowPreviewSheet(false)} className="w-full min-h-12 rounded-2xl bg-white/10 font-bold">Seguir editando</button>
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
                <p className="text-sm text-slate-400">Con tus cambios actuales.</p>
              </div>
              <button type="button" onClick={() => setShowFullLabel(false)} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center" aria-label="Cerrar"><X className="w-5 h-5" /></button>
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
