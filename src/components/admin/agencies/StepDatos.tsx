import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Lock, Plus, Pencil } from 'lucide-react';
import { CampoPersonalizadoAgencia } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { StepProps, CAMPO_PLANTILLAS, CAMPO_TIPOS } from './agencyDraft';
import { StepHeader, Card, ChoiceCards, BigSwitch, Field, inputClass, ChipButton } from './ui';
import { isNativeDuplicateField } from './previews';

const tipoInfo = (t: CampoPersonalizadoAgencia['tipo']) => CAMPO_TIPOS.find(x => x.id === t) || CAMPO_TIPOS[0];

interface NuevoCampo {
  label: string;
  placeholder: string;
  tipo: CampoPersonalizadoAgencia['tipo'];
  requerido: boolean;
  rotulo: boolean;
  comprobante: boolean;
}

const VACIO: NuevoCampo = { label: '', placeholder: '', tipo: 'texto', requerido: false, rotulo: true, comprobante: true };

export const StepDatos: React.FC<StepProps> = ({ draft, update }) => {
  const { toast, confirm } = useFeedback();
  const [nuevo, setNuevo] = useState<NuevoCampo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const setCampos = (campos: CampoPersonalizadoAgencia[]) => update({ campos });
  const patchCampo = (id: string, patch: Partial<CampoPersonalizadoAgencia>) =>
    setCampos(draft.campos.map(c => (c.id === id ? { ...c, ...patch } : c)));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= draft.campos.length) return;
    const next = [...draft.campos];
    [next[idx], next[j]] = [next[j], next[idx]];
    setCampos(next);
  };

  const remove = async (c: CampoPersonalizadoAgencia) => {
    const ok = await confirm({ title: `¿Quitar "${c.label}"?`, message: 'Tus clientas ya no verán esta pregunta.', confirmLabel: 'Sí, quitar', tone: 'danger' });
    if (ok) setCampos(draft.campos.filter(x => x.id !== c.id));
  };

  const agregar = () => {
    if (!nuevo) return;
    if (!nuevo.label.trim()) {
      toast('Escribe qué le vas a preguntar a tu clienta.', 'warning');
      return;
    }
    const campo: CampoPersonalizadoAgencia = {
      id: 'c-' + Date.now().toString(36),
      label: nuevo.label.trim(),
      placeholder: nuevo.placeholder.trim() || undefined,
      tipo: nuevo.tipo,
      requerido: nuevo.requerido,
      mostrar_en_rotulado: nuevo.rotulo,
      mostrar_en_comprobante: nuevo.comprobante,
      sistema: false,
    };
    setCampos([...draft.campos, campo]);
    setNuevo(null);
    toast(`Pregunta "${campo.label}" agregada`);
  };

  return (
    <div className="space-y-5">
      <StepHeader emoji="📝" title="Datos que pides" subtitle="Además de lo básico (nombre, celular y destino), puedes hacerle más preguntas a tu clienta." />

      <Card emoji="📋" title={`Tus preguntas (${draft.campos.length})`} description="Usa las flechas para cambiar el orden en que aparecen.">
        {draft.campos.length === 0 && (
          <p className="text-[15px] text-slate-400 py-2">Todavía no hay preguntas. Agrega una abajo 👇</p>
        )}

        <ul className="space-y-3">
          {draft.campos.map((c, idx) => {
            const info = tipoInfo(c.tipo);
            const isEditing = editingId === c.id;
            const hiddenInForm = !c.sistema && isNativeDuplicateField(c);
            return (
              <li key={c.id} className="rounded-2xl bg-slate-950/60 border border-white/10 p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl leading-8 shrink-0" aria-hidden="true">{info.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-base font-black text-white leading-snug break-words">{c.label}</p>
                      <p className="text-[13px] text-slate-400">
                        {info.title}
                        {c.sistema && <span className="inline-flex items-center gap-1 ml-2 text-amber-300 font-bold"><Lock className="w-3 h-3" /> Lo exige la agencia</span>}
                      </p>
                      {hiddenInForm && (
                        <p className="text-[12px] text-sky-300/90 mt-0.5">ℹ️ El formulario ya pregunta esto por su cuenta; aquí sirve para el rótulo y el mensaje.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center disabled:opacity-30" aria-label="Subir">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === draft.campos.length - 1} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center disabled:opacity-30" aria-label="Bajar">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <BigSwitch compact checked={c.requerido} disabled={c.sistema} onChange={v => patchCampo(c.id, { requerido: v })} label="Obligatoria" />
                  <BigSwitch compact checked={c.mostrar_en_rotulado} onChange={v => patchCampo(c.id, { mostrar_en_rotulado: v })} label="Sale en el rótulo" />
                  <BigSwitch compact checked={c.mostrar_en_comprobante} onChange={v => patchCampo(c.id, { mostrar_en_comprobante: v })} label="Sale en WhatsApp" />
                </div>

                {!c.sistema && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : c.id)}
                      className="min-h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-200 flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> {isEditing ? 'Listo' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="min-h-10 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-sm font-bold text-rose-300 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-3 pt-1 animate-fadeIn">
                    <Field label="Pregunta" htmlFor={`lbl-${c.id}`}>
                      <input id={`lbl-${c.id}`} type="text" value={c.label} onChange={e => patchCampo(c.id, { label: e.target.value })} className={inputClass} />
                    </Field>
                    <Field label="Ejemplo que verá dentro de la casilla" htmlFor={`ph-${c.id}`}>
                      <input id={`ph-${c.id}`} type="text" value={c.placeholder || ''} onChange={e => patchCampo(c.id, { placeholder: e.target.value || undefined })} placeholder="Ej: @maria.tiendita" className={inputClass} />
                    </Field>
                    <ChoiceCards ariaLabel="Tipo de respuesta" columns={4} value={c.tipo} onChange={v => patchCampo(c.id, { tipo: v })} options={CAMPO_TIPOS.map(t => ({ value: t.id, emoji: t.emoji, title: t.title }))} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card emoji="➕" title="Agregar una pregunta">
        {!nuevo ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Toca una idea o crea la tuya:</p>
            <div className="flex flex-wrap gap-2">
              {CAMPO_PLANTILLAS.map(p => (
                <ChipButton key={p.label} onClick={() => setNuevo({ ...VACIO, label: p.label, tipo: p.tipo, placeholder: p.placeholder })}>
                  {p.emoji} {p.label}
                </ChipButton>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNuevo({ ...VACIO })}
              className="w-full min-h-14 rounded-2xl border-2 border-dashed border-cyan-400/50 text-cyan-300 font-black text-base flex items-center justify-center gap-2 hover:bg-cyan-500/5"
            >
              <Plus className="w-5 h-5" /> Crear mi propia pregunta
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            <Field label="¿Qué le vas a preguntar?" htmlFor="nuevo-label">
              <input id="nuevo-label" type="text" autoFocus value={nuevo.label} onChange={e => setNuevo({ ...nuevo, label: e.target.value })} placeholder="Ej: Usuario de TikTok" className={`${inputClass} font-bold`} />
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-slate-200">¿Qué tipo de respuesta?</p>
              <ChoiceCards ariaLabel="Tipo de respuesta" columns={4} value={nuevo.tipo} onChange={v => setNuevo({ ...nuevo, tipo: v })} options={CAMPO_TIPOS.map(t => ({ value: t.id, emoji: t.emoji, title: t.title, desc: t.desc }))} />
            </div>
            <Field label="Ejemplo dentro de la casilla (opcional)" htmlFor="nuevo-ph">
              <input id="nuevo-ph" type="text" value={nuevo.placeholder} onChange={e => setNuevo({ ...nuevo, placeholder: e.target.value })} placeholder="Ej: @maria.tiendita" className={inputClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <BigSwitch compact checked={nuevo.requerido} onChange={v => setNuevo({ ...nuevo, requerido: v })} label="Obligatoria" />
              <BigSwitch compact checked={nuevo.rotulo} onChange={v => setNuevo({ ...nuevo, rotulo: v })} label="Sale en el rótulo" />
              <BigSwitch compact checked={nuevo.comprobante} onChange={v => setNuevo({ ...nuevo, comprobante: v })} label="Sale en WhatsApp" />
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setNuevo(null)} className="flex-1 min-h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold">
                Cancelar
              </button>
              <button type="button" onClick={agregar} className="flex-[2] min-h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Agregar pregunta
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
