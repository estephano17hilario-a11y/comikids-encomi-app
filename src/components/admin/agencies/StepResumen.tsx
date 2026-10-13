import React from 'react';
import { Pencil, Check } from 'lucide-react';
import { MetodoEnvio } from '../../../types/database.types';
import { getAgencyDaysSummary } from '../../../utils/agencyAvailability';
import { StepProps } from './agencyDraft';
import { StepIntro } from './ui';
import { AgencyLogo, isNativeDuplicateField } from './previews';
import type { EditorStep } from './AgencyEditor';

const ESTILO_NOMBRE: Record<string, string> = {
  '': 'el de tu negocio',
  estandar_oficial: 'Clásico',
  vision_modern: 'Moderno',
  eco_ink_saving: 'Ahorra tinta',
};

const primeraLinea = (t: string) => {
  const line = t.split('\n').find(l => l.trim()) || '';
  const clean = line.replace(/\*/g, '').trim();
  return clean.length > 70 ? `${clean.slice(0, 70)}…` : clean;
};

export const StepResumen: React.FC<StepProps & { live: MetodoEnvio; goTo: (s: EditorStep) => void; isDirty: boolean; onSaveAndClose: () => void }> = ({
  draft,
  live,
  accent,
  goTo,
  isDirty,
  onSaveAndClose,
}) => {
  const r = draft.rotulo;
  const extras = draft.campos.filter(c => !isNativeDuplicateField(c));
  const partes = [
    r.mostrar_destino && 'destino',
    r.incluir_destinatario && 'quién recibe',
    r.incluir_remitente && 'quién envía',
    (r.mostrar_barcode || r.mostrar_tracking) && 'código',
  ].filter(Boolean) as string[];

  const filas: { step: EditorStep; emoji: string; titulo: string; contenido: React.ReactNode }[] = [
    {
      step: 'identidad',
      emoji: '🎨',
      titulo: 'Nombre y logo',
      contenido: (
        <span className="flex items-center gap-3">
          <AgencyLogo method={live} />
          <span>
            Se llama <strong className="text-white">{draft.nombre || '(sin nombre)'}</strong>
            <span className="flex items-center gap-1.5 text-slate-400 text-sm mt-0.5">
              Color: <span className="w-4 h-4 rounded-full inline-block border border-white/30" style={{ backgroundColor: draft.color }} />
            </span>
          </span>
        </span>
      ),
    },
    {
      step: 'horario',
      emoji: '📅',
      titulo: 'Días y horario',
      contenido: (
        <>
          {draft.modoHorario === 'predeterminado' ? 'Sale los mismos días que tu negocio.' : <>Sale: <strong className="text-white">{getAgencyDaysSummary(live)}</strong></>}
          <br />
          <span className="text-slate-400 text-sm">
            {draft.restringirFecha ? 'Tu clienta solo puede elegir días en que sale.' : 'Tu clienta puede elegir cualquier fecha.'}
            {draft.ocultarSiNoDisponible ? ' Se esconde los días que no sale.' : ''}
          </span>
        </>
      ),
    },
    {
      step: 'datos',
      emoji: '📝',
      titulo: 'Datos que pides',
      contenido: extras.length === 0 ? (
        'Solo los datos básicos (sin preguntas extra).'
      ) : (
        <>
          Lo básico + <strong className="text-white">{extras.length} {extras.length === 1 ? 'pregunta' : 'preguntas'}</strong>:{' '}
          {extras.map(c => c.label).join(', ')}
        </>
      ),
    },
    {
      step: 'mensaje',
      emoji: '💬',
      titulo: 'Mensaje de WhatsApp',
      contenido: (
        <>
          Empieza con: <em className="text-white not-italic">«{primeraLinea(draft.mensajeInicio) || '(vacío)'}»</em>
          {draft.mensajeFin.trim() && (
            <>
              <br />
              <span className="text-slate-400 text-sm">Termina con: «{primeraLinea(draft.mensajeFin)}»</span>
            </>
          )}
        </>
      ),
    },
    {
      step: 'rotulo',
      emoji: '🏷️',
      titulo: 'Rótulo',
      contenido: (
        <>
          <strong className="text-white">{r.orientacion === 'horizontal' ? 'Echado' : 'Parado'}</strong>, diseño {ESTILO_NOMBRE[r.estilo] || r.estilo}.
          <br />
          <span className="text-slate-400 text-sm">
            Muestra: {partes.length ? partes.join(', ') : 'casi nada'}
            {r.bloques.length > 0 ? ` • ${r.bloques.length} ${r.bloques.length === 1 ? 'aviso' : 'avisos'}` : ''}
          </span>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <StepIntro
        emoji="✅"
        title="Revisar y guardar"
        accent={accent}
        queEs="Este es el resumen de cómo quedó tu agencia, en palabras simples. Si algo no te gusta, toca «Cambiar» y vuelves a ese paso."
        pasos={['Lee cada parte del resumen.', 'Cambia lo que quieras.', 'Toca «Guardar y terminar».']}
      />

      <ul className="space-y-3">
        {filas.map(f => (
          <li key={f.step} className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 sm:p-5 flex items-start gap-3">
            <span className="text-2xl leading-8 shrink-0" aria-hidden="true">{f.emoji}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{f.titulo}</p>
              <div className="text-[15px] text-slate-200 leading-relaxed break-words">{f.contenido}</div>
            </div>
            <button type="button" onClick={() => goTo(f.step)} className="min-h-11 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-200 flex items-center gap-1.5 shrink-0">
              <Pencil className="w-4 h-4" /> Cambiar
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSaveAndClose}
        className="w-full min-h-16 rounded-2xl text-lg font-black text-slate-950 flex items-center justify-center gap-2 shadow-xl"
        style={{ backgroundColor: accent }}
      >
        <Check className="w-6 h-6" /> {isDirty ? 'Guardar y terminar' : 'Todo está guardado. Cerrar'}
      </button>
    </div>
  );
};
