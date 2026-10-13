import React from 'react';
import { DiaSemana, HorarioDia } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { DIAS_SEMANA_ORDEN, DIAS_SEMANA_LABELS, DIAS_SEMANA_ABREV } from '../../../utils/agencyAvailability';
import { StepProps } from './agencyDraft';
import { StepHeader, Card, ChoiceCards, BigSwitch, ChipButton, Field, inputClass } from './ui';

const LUN_VIE: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const LUN_SAB: DiaSemana[] = [...LUN_VIE, 'sabado'];
const MIE_SAB: DiaSemana[] = ['miercoles', 'sabado'];

const sameDays = (a: DiaSemana[], b: DiaSemana[]) => a.length === b.length && a.every(d => b.includes(d));

const TimeRange: React.FC<{ value: HorarioDia; onChange: (v: HorarioDia) => void; idPrefix: string }> = ({ value, onChange, idPrefix }) => (
  <div className="grid grid-cols-2 gap-3">
    <Field label="Desde" htmlFor={`${idPrefix}-ini`}>
      <input
        id={`${idPrefix}-ini`}
        type="time"
        value={value.hora_inicio || '08:30'}
        onChange={e => onChange({ ...value, es_24_horas: false, hora_inicio: e.target.value })}
        className={`${inputClass} font-mono font-bold`}
      />
    </Field>
    <Field label="Hasta (hora de corte)" htmlFor={`${idPrefix}-fin`}>
      <input
        id={`${idPrefix}-fin`}
        type="time"
        value={value.hora_fin || '18:30'}
        onChange={e => onChange({ ...value, es_24_horas: false, hora_fin: e.target.value })}
        className={`${inputClass} font-mono font-bold`}
      />
    </Field>
  </div>
);

export const StepHorario: React.FC<StepProps> = ({ draft, update, taller }) => {
  const { toast } = useFeedback();
  const allDays = draft.dias.length === 0;
  const isOn = (dia: DiaSemana) => allDays || draft.dias.includes(dia);

  const toggleDay = (dia: DiaSemana) => {
    const current = allDays ? [...DIAS_SEMANA_ORDEN] : draft.dias;
    const next = current.includes(dia) ? current.filter(d => d !== dia) : [...current, dia];
    if (next.length === 0) {
      // Una lista vacía significa "todos los días": se evita que apagar el último día haga lo contrario
      toast('La agencia debe salir al menos un día.', 'warning');
      return;
    }
    update({ dias: next.length === 7 ? [] : DIAS_SEMANA_ORDEN.filter(d => next.includes(d)) });
  };

  return (
    <div className="space-y-5">
      <StepHeader emoji="📅" title="Días y horario" subtitle="Dile al sistema qué días sale esta agencia, así tus clientas solo eligen fechas posibles." />

      <Card emoji="🤔" title="¿Sale los mismos días que tu negocio?">
        <ChoiceCards
          ariaLabel="Tipo de horario"
          value={draft.modoHorario}
          onChange={v => update({ modoHorario: v })}
          options={[
            {
              value: 'predeterminado',
              emoji: '✅',
              title: 'Sí, igual que mi negocio',
              desc: `Usa los días y la hora de corte de Ajustes${taller.hora_corte_envio_hoy ? ` (${taller.hora_corte_envio_hoy})` : ''}. Si los cambias allá, se cambian aquí solos.`,
            },
            { value: 'personalizado', emoji: '🗓️', title: 'No, tiene sus propios días', desc: 'Elijo los días y horas solo para esta agencia.' },
          ]}
        />
      </Card>

      {draft.modoHorario === 'personalizado' && (
        <>
          <Card emoji="📆" title="¿Qué días sale?" description="Toca los días para prender o apagar.">
            <div className="flex flex-wrap gap-2">
              <ChipButton active={allDays} onClick={() => update({ dias: [] })}>Todos los días</ChipButton>
              <ChipButton active={!allDays && sameDays(draft.dias, LUN_SAB)} onClick={() => update({ dias: LUN_SAB })}>Lunes a sábado</ChipButton>
              <ChipButton active={!allDays && sameDays(draft.dias, LUN_VIE)} onClick={() => update({ dias: LUN_VIE })}>Lunes a viernes</ChipButton>
              <ChipButton active={!allDays && sameDays(draft.dias, MIE_SAB)} onClick={() => update({ dias: MIE_SAB })}>Miércoles y sábado</ChipButton>
            </div>
            <div className="grid grid-cols-4 min-[480px]:grid-cols-7 gap-2">
              {DIAS_SEMANA_ORDEN.map(dia => {
                const on = isOn(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDay(dia)}
                    aria-pressed={on}
                    aria-label={DIAS_SEMANA_LABELS[dia]}
                    className={`min-h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      on ? 'bg-emerald-500/15 border-emerald-400 text-white' : 'bg-slate-950/60 border-white/10 text-slate-500'
                    }`}
                  >
                    <span className="text-base font-black">{DIAS_SEMANA_ABREV[dia]}</span>
                    <span className="text-[11px] font-bold">{on ? 'Sale' : 'No sale'}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card emoji="⏰" title="¿A qué hora?">
            <ChoiceCards
              ariaLabel="Horario de la agencia"
              value={draft.modalidadHorario === 'individual_por_dia' ? 'por_dia' : draft.horarioGlobal.es_24_horas ? 'todo_el_dia' : 'horario'}
              onChange={v => {
                if (v === 'todo_el_dia') update({ modalidadHorario: 'uno_para_todos', horarioGlobal: { ...draft.horarioGlobal, es_24_horas: true } });
                else if (v === 'horario') update({ modalidadHorario: 'uno_para_todos', horarioGlobal: { ...draft.horarioGlobal, es_24_horas: false, hora_inicio: draft.horarioGlobal.hora_inicio || '08:30', hora_fin: draft.horarioGlobal.hora_fin || '18:30' } });
                else update({ modalidadHorario: 'individual_por_dia' });
              }}
              columns={3}
              options={[
                { value: 'todo_el_dia', emoji: '🌞', title: 'Todo el día', desc: 'Sin hora límite' },
                { value: 'horario', emoji: '🕘', title: 'Un horario fijo', desc: 'El mismo para todos los días' },
                { value: 'por_dia', emoji: '📋', title: 'Distinto cada día', desc: 'Hora y aviso por día' },
              ]}
            />

            {draft.modalidadHorario === 'uno_para_todos' && !draft.horarioGlobal.es_24_horas && (
              <TimeRange idPrefix="global" value={draft.horarioGlobal} onChange={v => update({ horarioGlobal: v })} />
            )}

            {draft.modalidadHorario === 'individual_por_dia' && (
              <div className="space-y-2.5">
                {DIAS_SEMANA_ORDEN.filter(isOn).map(dia => {
                  const h: HorarioDia = draft.horariosPorDia[dia] || { es_24_horas: false, hora_inicio: '08:30', hora_fin: '18:30' };
                  const setH = (v: HorarioDia) => update({ horariosPorDia: { ...draft.horariosPorDia, [dia]: v } });
                  return (
                    <div key={dia} className="rounded-2xl bg-slate-950/50 border border-white/10 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-base text-white">{DIAS_SEMANA_LABELS[dia]}</strong>
                        <div className="w-44">
                          <BigSwitch compact checked={Boolean(h.es_24_horas)} onChange={v => setH({ ...h, es_24_horas: v })} label="Todo el día" />
                        </div>
                      </div>
                      {!h.es_24_horas && <TimeRange idPrefix={dia} value={h} onChange={setH} />}
                      <input
                        type="text"
                        value={draft.mensajesPorDia[dia] || ''}
                        onChange={e => update({ mensajesPorDia: { ...draft.mensajesPorDia, [dia]: e.target.value } })}
                        placeholder={`Aviso para el ${DIAS_SEMANA_LABELS[dia].toLowerCase()} (opcional). Ej: Sale hasta las 2 pm`}
                        className={inputClass}
                        aria-label={`Aviso especial para ${DIAS_SEMANA_LABELS[dia]}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Card emoji="🙋‍♀️" title="¿Cómo lo ve tu clienta?">
        <div className="space-y-2.5">
          <BigSwitch
            checked={draft.restringirFecha}
            onChange={v => update({ restringirFecha: v })}
            emoji="🗓️"
            label="Solo dejar elegir días en que sale"
            description="Si eligen otro día, el sistema les pide cambiarlo."
          />
          <BigSwitch
            checked={draft.ocultarSiNoDisponible}
            onChange={v => update({ ocultarSiNoDisponible: v })}
            emoji="🙈"
            label="Esconder la agencia los días que no sale"
            description="No aparecerá en la lista esos días."
          />
        </div>
        <Field label="Mensaje para tus clientas (opcional)" htmlFor="disp-msg" hint="Reemplaza el resumen automático. Ej: Despachamos solo miércoles y sábados.">
          <input
            id="disp-msg"
            type="text"
            value={draft.mensajeDisponibilidad}
            onChange={e => update({ mensajeDisponibilidad: e.target.value })}
            placeholder="Ej: Despachamos solo miércoles y sábados"
            className={inputClass}
          />
        </Field>
      </Card>
    </div>
  );
};
