import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Piezas visuales del editor de agencias: letra grande, áreas de toque amplias y lenguaje simple.

export const StepHeader: React.FC<{ emoji: string; title: string; subtitle: string }> = ({ emoji, title, subtitle }) => (
  <div className="flex items-start gap-3 sm:gap-4">
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center text-2xl sm:text-3xl shrink-0" aria-hidden="true">
      {emoji}
    </div>
    <div className="min-w-0">
      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{title}</h2>
      <p className="text-sm sm:text-base text-slate-400 mt-1 leading-snug">{subtitle}</p>
    </div>
  </div>
);

export const Card: React.FC<{
  emoji?: string;
  title?: string;
  description?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  tone?: 'default' | 'muted';
}> = ({ emoji, title, description, right, children, tone = 'default' }) => (
  <section
    className={`rounded-3xl border p-4 sm:p-5 space-y-4 ${
      tone === 'muted' ? 'bg-slate-900/40 border-white/5' : 'bg-slate-900/80 border-white/10'
    }`}
  >
    {(title || right) && (
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {emoji && <span className="text-xl leading-7 shrink-0" aria-hidden="true">{emoji}</span>}
          <div className="min-w-0">
            {title && <h3 className="text-base sm:text-lg font-black text-white leading-7">{title}</h3>}
            {description && <p className="text-sm text-slate-400 leading-snug mt-0.5">{description}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    {children}
  </section>
);

// Interruptor grande: toda la fila es tocable
export const BigSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  emoji?: string;
  disabled?: boolean;
  compact?: boolean;
}> = ({ checked, onChange, label, description, emoji, disabled, compact }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 text-left rounded-2xl border transition-colors ${
      compact ? 'min-h-12 px-3 py-2' : 'min-h-14 px-4 py-3'
    } ${
      checked ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/50 border-white/10 hover:border-white/20'
    } ${disabled ? 'opacity-60' : ''}`}
  >
    <span className="flex items-center gap-3 min-w-0">
      {emoji && <span className="text-xl shrink-0" aria-hidden="true">{emoji}</span>}
      <span className="min-w-0">
        <span className={`block font-bold text-white leading-snug ${compact ? 'text-sm' : 'text-[15px]'}`}>{label}</span>
        {description && <span className="block text-[13px] text-slate-400 leading-snug mt-0.5">{description}</span>}
      </span>
    </span>
    <span
      className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </span>
  </button>
);

export interface ChoiceOption<T extends string> {
  value: T;
  emoji?: string;
  title: string;
  desc?: string;
  visual?: React.ReactNode;
}

// Tarjetas grandes para elegir UNA opción
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  columns?: 1 | 2 | 3 | 4;
  ariaLabel: string;
}) {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-1 min-[420px]:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`grid ${cols} gap-2.5`}>
      {options.map(o => {
        const selected = o.value === value;
        return (
          <button
            key={o.value || 'none'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`relative text-left rounded-2xl border-2 p-4 min-h-16 transition-all ${
              selected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-slate-950/50 hover:border-white/25'
            }`}
          >
            {selected && (
              <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center" aria-hidden="true">
                <Check className="w-4 h-4 stroke-[3]" />
              </span>
            )}
            {o.visual && <div className="mb-3">{o.visual}</div>}
            <span className="flex items-start gap-2.5 pr-7">
              {o.emoji && <span className="text-2xl leading-7 shrink-0" aria-hidden="true">{o.emoji}</span>}
              <span className="min-w-0">
                <span className="block text-[15px] font-black text-white leading-snug">{o.title}</span>
                {o.desc && <span className="block text-[13px] text-slate-400 leading-snug mt-0.5">{o.desc}</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const Field: React.FC<{ label: string; hint?: string; htmlFor?: string; children: React.ReactNode }> = ({ label, hint, htmlFor, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-200">{label}</label>
    {children}
    {hint && <p className="text-[13px] text-slate-500 leading-snug">{hint}</p>}
  </div>
);

export const inputClass =
  'w-full min-h-12 px-4 bg-slate-950/70 border border-white/15 rounded-2xl text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15 transition-colors';

export const textareaClass =
  'w-full px-4 py-3 bg-slate-950/70 border border-white/15 rounded-2xl text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15 transition-colors leading-relaxed';

export const ChipButton: React.FC<{ onClick: () => void; children: React.ReactNode; active?: boolean; title?: string }> = ({ onClick, children, active, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`min-h-10 px-3.5 rounded-xl border text-sm font-bold transition-colors ${
      active ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

// Sección plegable para opciones avanzadas (no estorban a quien no las necesita)
export const Disclosure: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen }) => {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full min-h-12 px-4 flex items-center justify-between gap-2 text-left text-sm font-bold text-slate-300"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3 animate-fadeIn">{children}</div>}
    </div>
  );
};

// Marco de celular para las vistas previas
export const PhoneFrame: React.FC<{ title?: string; children: React.ReactNode; tone?: 'dark' | 'whatsapp' }> = ({ title, children, tone = 'dark' }) => (
  <div className="mx-auto w-full max-w-[360px] rounded-[2.2rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden">
    <div className={`${tone === 'whatsapp' ? 'bg-[#0b141a]' : 'bg-slate-950'} rounded-[1.8rem] overflow-hidden`}>
      <div className="h-6 flex items-center justify-center">
        <span className="w-16 h-1.5 rounded-full bg-slate-700" aria-hidden="true" />
      </div>
      {title && <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">{title}</div>}
      <div className="px-3 pb-4">{children}</div>
    </div>
  </div>
);

// Escala un contenido ancho (como el rótulo A4) para que quepa completo en su contenedor
export const FitToWidth: React.FC<{ children: React.ReactNode; maxScale?: number }> = ({ children, maxScale = 1 }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const measure = () => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const naturalW = inner.scrollWidth;
    const naturalH = inner.scrollHeight;
    if (!naturalW) return;
    const s = Math.min(maxScale, outer.clientWidth / naturalW);
    setScale(s);
    setHeight(naturalH * s);
  };

  useLayoutEffect(measure);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height }}>
      <div ref={innerRef} className="inline-block origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
};
