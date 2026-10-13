import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CampoPersonalizadoAgencia } from '../../../types/database.types';
import { CAMPO_PLANTILLAS, CAMPO_TIPOS } from './agencyDraft';
import { inputClass, Explain } from './ui';

// Asistente paso a paso para crear o editar una pregunta: una sola decisión por pantalla.

type Pantalla = 'pregunta' | 'tipo' | 'obligatoria' | 'donde' | 'listo';
const PANTALLAS: Pantalla[] = ['pregunta', 'tipo', 'obligatoria', 'donde', 'listo'];

const EJEMPLO_TIPO: Record<CampoPersonalizadoAgencia['tipo'], string> = {
  texto: '@maria.tiendita',
  numero: '72384910',
  telefono: '987 654 321',
  textarea: 'Casa verde, frente al parque, tocar 2 veces',
};

// Dibujitos para "¿dónde quieres ver la respuesta?"
const MiniRotulo: React.FC<{ on: boolean; respuesta: string }> = ({ on, respuesta }) => (
  <div className="rounded-xl bg-white p-2.5 text-left space-y-1 shadow-inner" aria-hidden="true">
    <div className="h-1.5 w-10 rounded bg-slate-300" />
    <div className="text-[10px] font-black text-slate-900 leading-none">MARÍA QUISPE</div>
    <div className="h-1.5 w-16 rounded bg-slate-200" />
    <div className={`text-[10px] font-bold rounded px-1 py-0.5 leading-none ${on ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-300 line-through'}`}>{respuesta}</div>
  </div>
);
const MiniWhatsapp: React.FC<{ on: boolean; respuesta: string }> = ({ on, respuesta }) => (
  <div className="rounded-xl bg-[#0b141a] p-2.5" aria-hidden="true">
    <div className="ml-auto max-w-[95%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2 py-1.5 space-y-1">
      <div className="h-1.5 w-14 rounded bg-emerald-200/40" />
      <div className="h-1.5 w-10 rounded bg-emerald-200/30" />
      <div className={`text-[10px] font-bold leading-none ${on ? 'text-white' : 'text-emerald-200/30 line-through'}`}>📌 {respuesta}</div>
    </div>
  </div>
);

interface Props {
  initial?: CampoPersonalizadoAgencia;
  accent: string;
  onSave: (campo: CampoPersonalizadoAgencia) => void;
  onCancel: () => void;
}

export const QuestionWizard: React.FC<Props> = ({ initial, accent, onSave, onCancel }) => {
  const [pantalla, setPantalla] = useState<Pantalla>(initial ? 'listo' : 'pregunta');
  const [label, setLabel] = useState(initial?.label || '');
  const [placeholder, setPlaceholder] = useState(initial?.placeholder || '');
  const [tipo, setTipo] = useState<CampoPersonalizadoAgencia['tipo']>(initial?.tipo || 'texto');
  const [requerido, setRequerido] = useState<boolean | null>(initial ? initial.requerido : null);
  const [rotulo, setRotulo] = useState(initial ? initial.mostrar_en_rotulado : true);
  const [comprobante, setComprobante] = useState(initial ? initial.mostrar_en_comprobante : true);

  const idx = PANTALLAS.indexOf(pantalla);
  const ejemplo = placeholder.replace(/^Ej:?\s*/i, '') || EJEMPLO_TIPO[tipo];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const puedeSeguir =
    (pantalla === 'pregunta' && label.trim().length > 1) ||
    pantalla === 'tipo' ||
    (pantalla === 'obligatoria' && requerido !== null) ||
    pantalla === 'donde' ||
    pantalla === 'listo';

  const siguiente = () => {
    if (!puedeSeguir) return;
    if (pantalla === 'listo') {
      onSave({
        id: initial?.id || 'c-' + Date.now().toString(36),
        label: label.trim(),
        placeholder: placeholder.trim() || undefined,
        tipo,
        requerido: Boolean(requerido),
        mostrar_en_rotulado: rotulo,
        mostrar_en_comprobante: comprobante,
        sistema: initial?.sistema || false,
      });
      return;
    }
    setPantalla(PANTALLAS[idx + 1]);
  };

  const atras = () => (idx > 0 ? setPantalla(PANTALLAS[idx - 1]) : onCancel());

  const titulo = {
    pregunta: '¿Qué le quieres preguntar a tu clienta?',
    tipo: '¿Cómo te va a responder?',
    obligatoria: '¿Tiene que responder sí o sí?',
    donde: '¿Dónde quieres ver su respuesta?',
    listo: initial ? 'Revisa tu pregunta' : '¡Tu pregunta está lista!',
  }[pantalla];

  return createPortal(
    <div className="fixed inset-0 z-[9500] bg-[#060913]/97 backdrop-blur-xl flex flex-col animate-fadeIn" role="dialog" aria-modal="true" aria-label="Asistente de pregunta" data-no-print="true">
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(70% 50% at 50% 0%, ${accent}30, transparent 70%)` }} aria-hidden="true" />

      {/* Barra superior con progreso */}
      <div className="relative shrink-0 pt-safe-header px-4 pb-3 max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={atras} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center" aria-label="Atrás">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-1.5" aria-label={`Paso ${idx + 1} de ${PANTALLAS.length}`}>
            {PANTALLAS.map((p, i) => (
              <span key={p} className="h-2 flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= idx ? accent : 'rgba(255,255,255,0.12)' }} />
            ))}
          </div>
          <button type="button" onClick={onCancel} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center" aria-label="Cancelar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="relative flex-1 overflow-y-auto">
        <div key={pantalla} className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-slideUp">
          <div>
            <p className="text-sm font-bold" style={{ color: accent }}>Pregunta {idx + 1} de {PANTALLAS.length}</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mt-1">{titulo}</h2>
          </div>

          {pantalla === 'pregunta' && (
            <div className="space-y-5">
              <input
                type="text"
                autoFocus
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') siguiente(); }}
                placeholder="Escribe aquí tu pregunta…"
                className={`${inputClass} min-h-16 text-xl font-bold`}
                aria-label="Tu pregunta"
              />
              <div className="space-y-2.5">
                <p className="text-[15px] text-slate-300">¿No se te ocurre? Toca una idea:</p>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                  {CAMPO_PLANTILLAS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setLabel(p.label);
                        setTipo(p.tipo);
                        setPlaceholder(p.placeholder);
                      }}
                      className={`min-h-14 px-4 rounded-2xl border-2 text-left text-base font-bold flex items-center gap-3 transition-colors ${
                        label === p.label ? 'border-white bg-white/10 text-white' : 'border-white/10 bg-slate-900/70 text-slate-200 hover:border-white/30'
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Explain>Esta pregunta aparecerá en el formulario que llena tu clienta cuando hace su pedido con esta agencia.</Explain>
            </div>
          )}

          {pantalla === 'tipo' && (
            <div className="space-y-5">
              <p className="text-[15px] text-slate-300">Así el celular de tu clienta le muestra el teclado correcto.</p>
              <div role="radiogroup" aria-label="Tipo de respuesta" className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
                {CAMPO_TIPOS.map(t => {
                  const sel = tipo === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setTipo(t.id)}
                      className={`relative text-left rounded-3xl border-2 p-4 space-y-3 transition-colors ${sel ? 'bg-white/10' : 'border-white/10 bg-slate-900/70 hover:border-white/30'}`}
                      style={sel ? { borderColor: accent } : undefined}
                    >
                      {sel && <span className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-slate-950" style={{ backgroundColor: accent }}><Check className="w-4 h-4 stroke-[3]" /></span>}
                      <span className="flex items-center gap-3">
                        <span className="text-3xl" aria-hidden="true">{t.emoji}</span>
                        <span>
                          <span className="block text-lg font-black text-white">{t.title}</span>
                          <span className="block text-sm text-slate-400">{t.desc}</span>
                        </span>
                      </span>
                      <span className={`block rounded-xl bg-slate-950/80 border border-white/10 px-3 text-sm text-slate-300 font-mono ${t.id === 'textarea' ? 'py-3 min-h-14' : 'py-2.5'}`}>
                        {EJEMPLO_TIPO[t.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="wiz-ph" className="block text-[15px] font-bold text-slate-200">Un ejemplo para ayudarla (opcional)</label>
                <input id="wiz-ph" type="text" value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder={`Ej: ${EJEMPLO_TIPO[tipo]}`} className={inputClass} />
                <p className="text-sm text-slate-500">Se ve en gris dentro de la casilla y desaparece cuando ella escribe.</p>
              </div>
            </div>
          )}

          {pantalla === 'obligatoria' && (
            <div className="space-y-4">
              {[
                { v: true, emoji: '⭐', title: 'Sí, siempre debe responder', desc: 'No podrá terminar su pedido si la deja vacía.' },
                { v: false, emoji: '🙂', title: 'No, puede dejarla en blanco', desc: 'Es opcional. Responde solo si quiere.' },
              ].map(o => {
                const sel = requerido === o.v;
                return (
                  <button
                    key={String(o.v)}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setRequerido(o.v)}
                    className={`w-full text-left rounded-3xl border-2 p-5 flex items-center gap-4 transition-colors ${sel ? 'bg-white/10' : 'border-white/10 bg-slate-900/70 hover:border-white/30'}`}
                    style={sel ? { borderColor: accent } : undefined}
                  >
                    <span className="text-4xl" aria-hidden="true">{o.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-lg font-black text-white">{o.title}</span>
                      <span className="block text-[15px] text-slate-400">{o.desc}</span>
                    </span>
                    {sel && <span className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 shrink-0" style={{ backgroundColor: accent }}><Check className="w-5 h-5 stroke-[3]" /></span>}
                  </button>
                );
              })}
            </div>
          )}

          {pantalla === 'donde' && (
            <div className="space-y-4">
              <p className="text-[15px] text-slate-300">Puedes elegir los dos, uno o ninguno. Toca para prender o apagar.</p>
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
                {[
                  { on: rotulo, set: setRotulo, emoji: '🏷️', title: 'En el rótulo de la caja', desc: 'Se imprime en la etiqueta del paquete.', visual: <MiniRotulo on={rotulo} respuesta={ejemplo} /> },
                  { on: comprobante, set: setComprobante, emoji: '💬', title: 'En el WhatsApp', desc: 'Sale en el comprobante que recibe.', visual: <MiniWhatsapp on={comprobante} respuesta={ejemplo} /> },
                ].map(o => (
                  <button
                    key={o.title}
                    type="button"
                    role="switch"
                    aria-checked={o.on}
                    onClick={() => o.set(!o.on)}
                    className={`text-left rounded-3xl border-2 p-4 space-y-3 transition-colors ${o.on ? 'bg-white/10' : 'border-white/10 bg-slate-900/70'}`}
                    style={o.on ? { borderColor: accent } : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5">
                        <span className="text-3xl" aria-hidden="true">{o.emoji}</span>
                        <span className="text-base font-black text-white leading-tight">{o.title}</span>
                      </span>
                      <span className={`relative w-12 h-7 rounded-full shrink-0 ${o.on ? 'bg-emerald-500' : 'bg-slate-600'}`} aria-hidden="true">
                        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${o.on ? 'translate-x-5' : ''}`} />
                      </span>
                    </span>
                    {o.visual}
                    <span className="block text-sm text-slate-400">{o.desc}</span>
                  </button>
                ))}
              </div>
              <Explain>Su respuesta <strong>siempre</strong> se guarda en el pedido y la ves en tu lista de pedidos, elijas lo que elijas aquí.</Explain>
            </div>
          )}

          {pantalla === 'listo' && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 space-y-4">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Así la verá tu clienta</p>
                <div className="space-y-1.5">
                  <p className="text-base font-bold text-white">{label || 'Tu pregunta'} {requerido && <span className="text-rose-400">*</span>}</p>
                  <div className={`rounded-xl bg-slate-950/80 border border-white/15 px-3 text-slate-500 ${tipo === 'textarea' ? 'py-3 min-h-16' : 'py-3'}`}>{ejemplo}</div>
                </div>
              </div>
              <ul className="rounded-3xl bg-slate-900/80 border border-white/10 divide-y divide-white/5">
                {[
                  { k: 'Pregunta', v: label, go: 'pregunta' as Pantalla },
                  { k: 'Respuesta', v: CAMPO_TIPOS.find(t => t.id === tipo)?.title || '', go: 'tipo' as Pantalla },
                  { k: '¿Obligatoria?', v: requerido ? 'Sí, siempre' : 'No, es opcional', go: 'obligatoria' as Pantalla },
                  { k: 'Se ve en', v: [rotulo && 'el rótulo', comprobante && 'el WhatsApp'].filter(Boolean).join(' y ') || 'solo tu lista de pedidos', go: 'donde' as Pantalla },
                ].map(row => (
                  <li key={row.k} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-500">{row.k}</span>
                      <span className="block text-base font-bold text-white break-words">{row.v}</span>
                    </span>
                    <button type="button" onClick={() => setPantalla(row.go)} className="min-h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-200 shrink-0">
                      Cambiar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Botón principal */}
      <div className="relative shrink-0 border-t border-white/10 bg-slate-950/80 px-4 pt-3 pb-safe">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={siguiente}
            disabled={!puedeSeguir}
            className="w-full min-h-14 rounded-2xl text-lg font-black text-slate-950 flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            {pantalla === 'listo' ? (
              <><Check className="w-6 h-6" /> {initial ? 'Guardar cambios' : 'Agregar esta pregunta'}</>
            ) : (
              <>Siguiente <ArrowRight className="w-6 h-6" /></>
            )}
          </button>
          {!puedeSeguir && pantalla === 'pregunta' && <p className="text-center text-sm text-slate-500 mt-2">Escribe tu pregunta o toca una idea para seguir.</p>}
          {!puedeSeguir && pantalla === 'obligatoria' && <p className="text-center text-sm text-slate-500 mt-2">Elige una de las dos opciones.</p>}
        </div>
      </div>
    </div>,
    document.body
  );
};
