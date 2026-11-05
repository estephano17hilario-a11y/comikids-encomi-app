import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, ChevronLeft, Plus, Upload, ArrowRight, Info } from 'lucide-react';
import { MetodoEnvio } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { AGENCY_TEMPLATES, AgencyTemplate, KIND_LABEL, findExistingForTemplate } from '../../../data/agencyTemplates';
import { COLOR_PRESETS } from './agencyDraft';
import { resizeLogoFile } from './imageUtils';
import { inputClass } from './ui';

interface Props {
  methods: MetodoEnvio[];
  onClose: () => void;
  /** Agregar una plantilla de agencia peruana */
  onAddTemplate: (t: AgencyTemplate) => void;
  /** Crear una agencia propia desde cero */
  onCreateCustom: (nombre: string, foto: string, color: string) => void;
  /** Abrir la configuración de una agencia que ya existe */
  onOpenExisting: (m: MetodoEnvio) => void;
}

const TemplateLogo: React.FC<{ t: AgencyTemplate; big?: boolean }> = ({ t, big }) => (
  <div
    className={`${big ? 'w-24 h-24 rounded-[1.7rem] p-3' : 'w-full aspect-square rounded-[1.4rem] p-3'} flex items-center justify-center overflow-hidden shadow-lg border border-black/10`}
    style={{ backgroundColor: t.logoBg }}
  >
    <img src={t.logo} alt="" className="w-full h-full object-contain" />
  </div>
);

const ReqList: React.FC<{ title: string; emoji: string; items: AgencyTemplate['remitente']; tone: string }> = ({ title, emoji, items, tone }) => (
  <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
    <p className="text-[13px] font-black uppercase tracking-wider mb-2.5" style={{ color: tone }}>{emoji} {title}</p>
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] text-white leading-snug">
          <span className="text-lg leading-5 shrink-0" aria-hidden="true">{r.emoji}</span>
          <span className="min-w-0">
            {r.label}
            {!r.obligatorio && <span className="ml-1.5 text-[12px] text-slate-400">(opcional)</span>}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export const AddAgencySheet: React.FC<Props> = ({ methods, onClose, onAddTemplate, onCreateCustom, onOpenExisting }) => {
  const { toast } = useFeedback();
  const [view, setView] = useState<'lista' | 'detalle' | 'propia'>('lista');
  const [selected, setSelected] = useState<AgencyTemplate | null>(null);
  const [query, setQuery] = useState('');
  const [nombre, setNombre] = useState('');
  const [foto, setFoto] = useState('');
  const [color, setColor] = useState('#10b981');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add('hide-admin-dock', 'has-active-modal');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('hide-admin-dock', 'has-active-modal');
      document.body.style.overflow = '';
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AGENCY_TEMPLATES;
    return AGENCY_TEMPLATES.filter(t => t.nombre.toLowerCase().includes(q) || t.resumen.toLowerCase().includes(q));
  }, [query]);

  const existing = selected ? findExistingForTemplate(selected, methods) : undefined;

  const title = view === 'lista' ? 'Agregar agencia' : view === 'detalle' ? selected?.nombre || '' : 'Tu propia agencia';

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('Escribe el nombre de la agencia.', 'warning');
      return;
    }
    onCreateCustom(nombre.trim(), foto, color);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn" onClick={onClose} data-no-print="true">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl h-[92dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col rounded-t-[2rem] sm:rounded-[2rem] bg-slate-900 border border-white/10 overflow-hidden animate-slideUp"
      >
        <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

        {/* Barra */}
        <div className="shrink-0 px-4 pt-2 pb-3 flex items-center gap-2">
          {view !== 'lista' ? (
            <button type="button" onClick={() => setView('lista')} className="min-h-11 pr-3 pl-1 rounded-2xl text-cyan-300 font-bold flex items-center gap-0.5 hover:bg-white/5">
              <ChevronLeft className="w-6 h-6" /> Atrás
            </button>
          ) : (
            <span className="w-11" />
          )}
          <h2 className="flex-1 text-center text-[17px] font-black text-white truncate">{title}</h2>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
          {/* ---------- LISTA DE PLANTILLAS ---------- */}
          {view === 'lista' && (
            <div className="space-y-4">
              <p className="text-[15px] text-slate-300 leading-snug">
                Toca una agencia. Ya viene con lo que normalmente pide, <strong className="text-white">no tienes que configurar nada</strong>.
              </p>
              <div className="relative">
                <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar agencia…"
                  className={`${inputClass} pl-12 rounded-full`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {filtered.map(t => {
                  const has = Boolean(findExistingForTemplate(t, methods));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelected(t); setView('detalle'); }}
                      className="relative flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"
                    >
                      <TemplateLogo t={t} />
                      {has && (
                        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-white leading-tight line-clamp-2">{t.nombre}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setView('propia')}
                  className="flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"
                >
                  <div className="w-full aspect-square rounded-[1.4rem] border-2 border-dashed border-cyan-400/60 bg-cyan-500/5 flex items-center justify-center text-cyan-300">
                    <Plus className="w-9 h-9" />
                  </div>
                  <span className="text-[13px] font-bold text-cyan-300 leading-tight">Otra agencia</span>
                </button>
              </div>

              {filtered.length === 0 && (
                <p className="text-center text-slate-400 py-6">
                  No hay una plantilla con ese nombre. Toca <strong className="text-cyan-300">Otra agencia</strong> para crearla.
                </p>
              )}
            </div>
          )}

          {/* ---------- DETALLE DE UNA PLANTILLA ---------- */}
          {view === 'detalle' && selected && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-4">
                <TemplateLogo t={selected} big />
                <div className="min-w-0">
                  <h3 className="text-2xl font-black text-white leading-tight">{selected.nombre}</h3>
                  <p className="text-[15px] text-slate-300 leading-snug mt-1">{selected.resumen}</p>
                  <span className="inline-block mt-2 px-2.5 py-1 rounded-full bg-white/8 text-[12px] font-bold text-slate-200">{KIND_LABEL[selected.kind]}</span>
                </div>
              </div>

              <p className="text-[15px] font-black text-white pt-1">¿Qué datos pide {selected.nombre}?</p>
              <ReqList title="Del remitente (tú)" emoji="📤" items={selected.remitente} tone="#22d3ee" />
              <ReqList title="Del destinatario (tu clienta)" emoji="📥" items={selected.destinatario} tone="#34d399" />

              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-2 text-[15px] text-slate-200">
                <p><span aria-hidden="true">🏢</span> <strong className="text-white">Recojo:</strong> {selected.recojo}</p>
                <p><span aria-hidden="true">💵</span> <strong className="text-white">Pago:</strong> {selected.pago}</p>
                {selected.notas.map((n, i) => (
                  <p key={i} className="text-slate-300"><span aria-hidden="true">💡</span> {n}</p>
                ))}
              </div>

              <p className="flex items-start gap-2 text-[13px] text-slate-400 leading-snug">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Son los datos habituales del servicio. Cada agencia puede cambiarlos, confirma con tu sucursal. Después puedes ajustar todo.
              </p>
            </div>
          )}

          {/* ---------- AGENCIA PROPIA ---------- */}
          {view === 'propia' && (
            <form id="custom-agency-form" onSubmit={submitCustom} className="space-y-5 animate-fadeIn">
              <div className="space-y-2">
                <label htmlFor="custom-name" className="block text-[15px] font-black text-white">1. ¿Cómo se llama?</label>
                <input id="custom-name" type="text" autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Transportes Rápido" className={`${inputClass} text-lg font-bold`} />
                <div className="flex flex-wrap gap-2">
                  {['Recojo en tienda', 'Delivery propio', 'Motorizado'].map(s => (
                    <button key={s} type="button" onClick={() => setNombre(s)} className="min-h-9 px-3 rounded-full bg-white/8 text-[13px] font-bold text-slate-200 hover:bg-white/15">{s}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-black text-white">2. Su logo (opcional)</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-[1.5rem] border-2 border-dashed border-cyan-400/60 bg-cyan-500/5 text-cyan-300 flex flex-col items-center justify-center gap-1 overflow-hidden">
                    {foto ? <img src={foto} alt="Tu logo" className="w-full h-full object-contain bg-white p-2" /> : (<><Upload className="w-6 h-6" /><span className="text-[12px] font-bold">Subir foto</span></>)}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try { setFoto(await resizeLogoFile(file)); } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo usar esa imagen.', 'warning'); }
                    }}
                  />
                  <p className="text-[14px] text-slate-400 leading-snug">Una foto o logo cuadrado se ve mejor. Si no tienes, déjalo vacío.</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-black text-white">3. Su color</p>
                <div className="flex flex-wrap gap-3">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      aria-pressed={color === c.hex}
                      aria-label={c.name}
                      className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-transform ${color === c.hex ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {color === c.hex && <Check className="w-6 h-6 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Botón de acción fijo abajo */}
        {view === 'detalle' && selected && (
          <div className="shrink-0 px-4 pt-3 pb-safe border-t border-white/10 bg-slate-900">
            {existing ? (
              <button type="button" onClick={() => onOpenExisting(existing)} className="w-full min-h-14 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-base font-black flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-emerald-400" /> Ya la tienes · Abrir su configuración
              </button>
            ) : (
              <button type="button" onClick={() => onAddTemplate(selected)} className="w-full min-h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 text-lg font-black flex items-center justify-center gap-2">
                <Plus className="w-6 h-6" /> Agregar {selected.nombre}
              </button>
            )}
          </div>
        )}
        {view === 'propia' && (
          <div className="shrink-0 px-4 pt-3 pb-safe border-t border-white/10 bg-slate-900">
            <button type="submit" form="custom-agency-form" className="w-full min-h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-lg font-black flex items-center justify-center gap-2">
              Crear agencia <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
