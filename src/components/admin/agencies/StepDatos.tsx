import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Lock, Plus, Pencil } from 'lucide-react';
import { CampoPersonalizadoAgencia } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { StepProps, CAMPO_TIPOS } from './agencyDraft';
import { StepIntro, Card, BigSwitch, Disclosure, Explain } from './ui';
import { isNativeDuplicateField, nativeFieldsFor } from './previews';
import { QuestionWizard } from './QuestionWizard';

const tipoInfo = (t: CampoPersonalizadoAgencia['tipo']) => CAMPO_TIPOS.find(x => x.id === t) || CAMPO_TIPOS[0];

export const StepDatos: React.FC<StepProps> = ({ draft, update, base, accent, openPreview, highlight }) => {
  const { toast, confirm } = useFeedback();
  const [wizard, setWizard] = useState<{ campo?: CampoPersonalizadoAgencia } | null>(null);

  const extras = draft.campos.filter(c => !isNativeDuplicateField(c));
  const internos = draft.campos.filter(c => isNativeDuplicateField(c));

  const setCampos = (campos: CampoPersonalizadoAgencia[]) => update({ campos });
  const patchCampo = (id: string, patch: Partial<CampoPersonalizadoAgencia>) =>
    setCampos(draft.campos.map(c => (c.id === id ? { ...c, ...patch } : c)));

  // Mueve una pregunta extra respecto a la pregunta extra vecina
  const moveExtra = (id: string, dir: -1 | 1) => {
    const pos = extras.findIndex(c => c.id === id);
    const vecina = extras[pos + dir];
    if (!vecina) return;
    const a = draft.campos.findIndex(c => c.id === id);
    const b = draft.campos.findIndex(c => c.id === vecina.id);
    const next = [...draft.campos];
    [next[a], next[b]] = [next[b], next[a]];
    setCampos(next);
    highlight(`campo:${id}`);
  };

  const remove = async (c: CampoPersonalizadoAgencia) => {
    const ok = await confirm({ title: `¿Quitar la pregunta "${c.label}"?`, message: 'Tus clientas ya no la verán en el formulario. Los pedidos anteriores no cambian.', confirmLabel: 'Sí, quitar', tone: 'danger' });
    if (!ok) return;
    setCampos(draft.campos.filter(x => x.id !== c.id));
    toast('Pregunta quitada');
  };

  const handleSave = (campo: CampoPersonalizadoAgencia) => {
    const exists = draft.campos.some(c => c.id === campo.id);
    setCampos(exists ? draft.campos.map(c => (c.id === campo.id ? campo : c)) : [...draft.campos, campo]);
    setWizard(null);
    highlight(`campo:${campo.id}`);
    toast(exists ? 'Pregunta actualizada' : `Listo: tus clientas ahora verán "${campo.label}"`, 'success', { label: 'Ver cómo queda', onClick: openPreview });
  };

  const siempre = [...nativeFieldsFor(base), '👤 Nombres y apellidos', '📅 Fecha en que quiere el envío'];

  return (
    <div className="space-y-5">
      <StepIntro
        emoji="📝"
        title="Datos que pides"
        accent={accent}
        queEs="Cuando tu clienta hace su pedido, llena un formulario corto. El sistema ya le pide lo básico por su cuenta. Aquí puedes agregarle preguntas tuyas, por ejemplo su usuario de TikTok o la talla."
        pasos={[
          'Mira lo que el sistema ya pide solo (no tienes que hacer nada).',
          'Si necesitas saber algo más, toca "Agregar una pregunta".',
          'Elige si la respuesta sale en el rótulo o en el WhatsApp.',
        ]}
      />

      {/* 1. Lo que ya se pide */}
      <Card
        emoji="✅"
        title="1. Esto ya se pide siempre"
        description="El sistema se lo pregunta a tu clienta automáticamente con esta agencia."
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {siempre.map(f => (
            <li key={f} className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-[15px] text-slate-200">
              <Lock className="w-4 h-4 text-emerald-400/70 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 2. Preguntas extra */}
      <Card
        emoji="➕"
        title="2. Tus preguntas extra"
        description={extras.length === 0 ? 'Todavía no agregaste ninguna. Es opcional.' : `Tu clienta verá ${extras.length === 1 ? 'esta pregunta' : `estas ${extras.length} preguntas`} debajo de los datos básicos, en este orden.`}
      >
        {extras.length > 0 && (
          <ul className="space-y-3">
            {extras.map((c, i) => {
              const info = tipoInfo(c.tipo);
              const donde = [c.mostrar_en_rotulado && '🏷️ rótulo', c.mostrar_en_comprobante && '💬 WhatsApp'].filter(Boolean).join(' y ');
              return (
                <li key={c.id} className="rounded-2xl bg-slate-950/60 border border-white/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-slate-950 shrink-0" style={{ backgroundColor: accent }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-black text-white leading-snug break-words">{c.label}{c.requerido && <span className="text-rose-400"> *</span>}</p>
                      <p className="text-[14px] text-slate-400 leading-snug mt-1">
                        {info.emoji} Responde con {info.title.toLowerCase()} • {c.requerido ? 'Obligatoria' : 'Opcional'}
                        <br />
                        {donde ? <>La respuesta sale en el {donde}</> : 'La respuesta solo se guarda en tu lista de pedidos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setWizard({ campo: c })} className="min-h-11 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold text-white flex items-center gap-1.5">
                      <Pencil className="w-4 h-4" /> Cambiar
                    </button>
                    <button type="button" onClick={() => remove(c)} className="min-h-11 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-sm font-bold text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                    {extras.length > 1 && (
                      <span className="flex items-center gap-1 ml-auto">
                        <span className="text-[13px] text-slate-500 mr-1 hidden min-[420px]:inline">Orden:</span>
                        <button type="button" onClick={() => moveExtra(c.id, -1)} disabled={i === 0} className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30" aria-label={`Subir "${c.label}"`}>
                          <ArrowUp className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => moveExtra(c.id, 1)} disabled={i === extras.length - 1} className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30" aria-label={`Bajar "${c.label}"`}>
                          <ArrowDown className="w-5 h-5" />
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setWizard({})}
          className="w-full min-h-16 rounded-2xl border-2 border-dashed text-lg font-black flex items-center justify-center gap-2.5 transition-colors hover:bg-white/5"
          style={{ borderColor: `${accent}99`, color: accent }}
        >
          <Plus className="w-6 h-6" /> Agregar una pregunta
        </button>
        <p className="text-center text-sm text-slate-500">Te guiamos paso a paso, una cosa a la vez.</p>
      </Card>

      {/* 3. Datos internos */}
      {internos.length > 0 && (
        <Disclosure title={`⚙️ Opciones avanzadas: datos base de la agencia (${internos.length})`}>
          <Explain>
            Estos datos el formulario ya los pide por su cuenta (por eso no los ves en "Tus preguntas extra"). Aquí solo eliges si su respuesta se imprime en el rótulo o sale en el WhatsApp.
          </Explain>
          <ul className="space-y-3">
            {internos.map(c => (
              <li key={c.id} className="rounded-2xl bg-slate-950/60 border border-white/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-white flex items-center gap-2 min-w-0">
                    {c.sistema && <Lock className="w-4 h-4 text-amber-300 shrink-0" />}
                    <span className="break-words">{c.label}</span>
                  </p>
                  {!c.sistema && (
                    <button type="button" onClick={() => remove(c)} className="w-10 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0" aria-label={`Quitar ${c.label}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {c.sistema && <p className="text-[13px] text-amber-200/80">La agencia lo exige: no se puede quitar.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <BigSwitch compact checked={c.mostrar_en_rotulado} onChange={v => patchCampo(c.id, { mostrar_en_rotulado: v })} label="🏷️ Se imprime en el rótulo" />
                  <BigSwitch compact checked={c.mostrar_en_comprobante} onChange={v => patchCampo(c.id, { mostrar_en_comprobante: v })} label="💬 Sale en el WhatsApp" />
                </div>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {wizard && (
        <QuestionWizard initial={wizard.campo} accent={accent} onSave={handleSave} onCancel={() => setWizard(null)} />
      )}
    </div>
  );
};
