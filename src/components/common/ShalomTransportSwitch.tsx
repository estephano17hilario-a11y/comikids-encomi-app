import React from 'react';
import { Truck, Plane } from 'lucide-react';

export type ShalomModalidad = 'terrestre' | 'aereo';

interface ShalomTransportSwitchProps {
  value: ShalomModalidad;
  onChange: (next: ShalomModalidad) => void;
  compact?: boolean;
  label?: string;
  helperText?: boolean;
  className?: string;
}

/**
 * Switch reutilizable Terrestre (predeterminado) <-> Aéreo para Agencia Shalom.
 */
export const ShalomTransportSwitch: React.FC<ShalomTransportSwitchProps> = ({
  value,
  onChange,
  compact = false,
  label = 'Modalidad de envío Shalom',
  helperText = true,
  className = '',
}) => {
  const isAereo = value === 'aereo';

  const handleToggle = () => {
    onChange(isAereo ? 'terrestre' : 'aereo');
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => onChange('terrestre')}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            !isAereo
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 shadow-xs'
              : 'bg-slate-900/70 text-slate-400 border border-slate-700/60 hover:text-slate-200'
          }`}
          title="Envío Terrestre (Predeterminado)"
        >
          <Truck className="w-3 h-3 shrink-0" />
          <span>Terrestre</span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={isAereo}
          aria-label="Cambiar entre envío Terrestre y Aéreo"
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
            isAereo
              ? 'bg-sky-500 border-sky-400'
              : 'bg-emerald-600/80 border-emerald-400/60'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
              isAereo ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => onChange('aereo')}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
            isAereo
              ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60 shadow-xs'
              : 'bg-slate-900/70 text-slate-400 border border-slate-700/60 hover:text-slate-200'
          }`}
          title="Envío Aéreo (Vía avión)"
        >
          <Plane className="w-3 h-3 shrink-0" />
          <span>Aéreo</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-3 transition-all ${
        isAereo
          ? 'bg-sky-500/10 border-sky-400/45 shadow-md shadow-sky-950/20'
          : 'bg-white/5 border-white/12'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              isAereo
                ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
            }`}
          >
            {isAereo ? <Plane className="w-4.5 h-4.5" /> : <Truck className="w-4.5 h-4.5" />}
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 leading-tight">
              {label}
            </span>
            <span
              className={`block text-xs font-black leading-tight mt-0.5 ${
                isAereo ? 'text-sky-200' : 'text-emerald-200'
              }`}
            >
              {isAereo ? '✈️ Envío Aéreo activado' : '🚚 Envío Terrestre (Predeterminado)'}
            </span>
          </div>
        </div>

        {/* Control Switch Terrestre <-> Aéreo */}
        <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => onChange('terrestre')}
            className={`inline-flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
              !isAereo ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Terrestre</span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={isAereo}
            aria-label="Seleccionar envío Terrestre o Aéreo en Shalom"
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
              isAereo
                ? 'bg-sky-500 border-sky-300/70'
                : 'bg-emerald-600/80 border-emerald-400/60'
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform ${
                isAereo ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onChange('aereo')}
            className={`inline-flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
              isAereo ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Aéreo</span>
          </button>
        </div>
      </div>

      {helperText && isAereo && (
        <p className="mt-2 pt-2 border-t border-sky-400/20 text-[11px] text-sky-200/90 leading-snug">
          ✈️ Se despachará por <strong>vía aérea</strong> hacia la agencia Shalom seleccionada (con tarifa aérea sujeta a disponibilidad de ruta).
        </p>
      )}
    </div>
  );
};
