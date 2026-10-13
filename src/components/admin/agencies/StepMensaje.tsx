import React, { useRef } from 'react';
import { RotateCcw, Lock } from 'lucide-react';
import { useFeedback } from '../../../context/FeedbackContext';
import { StepProps, SALUDO_SUGERENCIAS, DESPEDIDA_SUGERENCIAS, VARIABLES_MENSAJE, DEFAULT_INICIO_RECEIPT, DEFAULT_FIN_RECEIPT } from './agencyDraft';
import { StepHeader, Card, ChipButton, textareaClass } from './ui';
import { isNativeDuplicateField } from './previews';

// Inserta una variable donde está el cursor
const useInsert = (value: string, onChange: (v: string) => void) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = ref.current;
    if (!el) {
      onChange(`${value}${value.endsWith(' ') || !value ? '' : ' '}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return { ref, insert };
};

const VariableChips: React.FC<{ onInsert: (t: string) => void }> = ({ onInsert }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-[13px] text-slate-500">Poner automáticamente:</span>
    {VARIABLES_MENSAJE.map(v => (
      <button
        key={v.token}
        type="button"
        onClick={() => onInsert(v.token)}
        className="min-h-9 px-3 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-[13px] font-bold hover:bg-indigo-500/25"
        title={`Se reemplaza por: ${v.ejemplo}`}
      >
        + {v.label}
      </button>
    ))}
  </div>
);

export const StepMensaje: React.FC<StepProps> = ({ draft, update }) => {
  const { toast } = useFeedback();
  const saludo = useInsert(draft.mensajeInicio, v => update({ mensajeInicio: v }));
  const despedida = useInsert(draft.mensajeFin, v => update({ mensajeFin: v }));
  const extras = draft.campos.filter(c => c.mostrar_en_comprobante && !isNativeDuplicateField(c));

  return (
    <div className="space-y-5">
      <StepHeader emoji="💬" title="Mensaje de WhatsApp" subtitle="Es el comprobante que recibe tu clienta al hacer su pedido. Solo escribes el saludo y la despedida." />

      <Card
        emoji="👋"
        title="1. Saludo (va arriba)"
        right={
          <button
            type="button"
            onClick={() => {
              update({ mensajeInicio: DEFAULT_INICIO_RECEIPT(draft.nombre), mensajeFin: DEFAULT_FIN_RECEIPT() });
              toast('Mensaje original restaurado', 'info');
            }}
            className="min-h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-300 flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar
          </button>
        }
      >
        <textarea
          ref={saludo.ref}
          rows={3}
          value={draft.mensajeInicio}
          onChange={e => update({ mensajeInicio: e.target.value })}
          aria-label="Saludo del mensaje"
          className={textareaClass}
        />
        <VariableChips onInsert={saludo.insert} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-slate-500">Ideas:</span>
          {SALUDO_SUGERENCIAS(draft.nombre).map(s => (
            <ChipButton key={s.label} onClick={() => update({ mensajeInicio: s.text })}>{s.label}</ChipButton>
          ))}
        </div>
      </Card>

      <Card emoji="🔒" title="2. Datos del pedido (automático)" description="El sistema los completa solo con lo que escribió tu clienta. No tienes que hacer nada." tone="muted">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
          {['🏷️ Código del pedido', '👤 Nombre', '🪪 DNI', '📱 WhatsApp', `🚚 ${draft.nombre || 'Agencia'}`, '📅 Fecha de envío', '📍 Destino'].map(item => (
            <li key={item} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
              <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
          {extras.map(c => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-200">
              <Lock className="w-3.5 h-3.5 text-indigo-400/60 shrink-0" />
              <span>📌 {c.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card emoji="💖" title="3. Despedida (va abajo)">
        <textarea
          ref={despedida.ref}
          rows={3}
          value={draft.mensajeFin}
          onChange={e => update({ mensajeFin: e.target.value })}
          aria-label="Despedida del mensaje"
          className={textareaClass}
        />
        <VariableChips onInsert={despedida.insert} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-slate-500">Ideas:</span>
          {DESPEDIDA_SUGERENCIAS.map(s => (
            <ChipButton key={s.label} onClick={() => update({ mensajeFin: s.text })}>{s.label}</ChipButton>
          ))}
        </div>
        <p className="text-[13px] text-slate-500">Tip: escribe entre asteriscos para poner en negrita. Ej: *IMPORTANTE*</p>
      </Card>
    </div>
  );
};
