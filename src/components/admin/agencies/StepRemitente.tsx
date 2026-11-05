import React from 'react';
import { StepProps } from './agencyDraft';
import { StepIntro, Card, BigSwitch, Field, inputClass } from './ui';

/** Quién envía: los datos del negocio que se imprimen en el rótulo cuando la agencia los pide */
export const StepRemitente: React.FC<StepProps> = ({ draft, updateRotulo, base, accent, taller }) => {
  const r = draft.rotulo;
  const requisitos = base.requisitos?.remitente || [];
  const imprime = r.mostrar_remitente_nombre || r.mostrar_remitente_ruc_dni || r.mostrar_remitente_telefono || r.mostrar_remitente_origen;

  const setTodo = (v: boolean) =>
    updateRotulo({
      incluir_remitente: v,
      mostrar_remitente_nombre: v,
      mostrar_remitente_ruc_dni: v,
      mostrar_remitente_telefono: v,
      mostrar_remitente_origen: v,
    });

  const negocio = {
    nombre: taller.remitente_default?.nombre || taller.nombre_taller || '—',
    doc: taller.remitente_default?.ruc_dni || taller.remitente_dni || taller.ruc_dni || '—',
    cel: taller.remitente_default?.celular || taller.remitente_celular || taller.celular_taller || '—',
    dir: taller.remitente_default?.direccion || taller.direccion_taller || '—',
  };

  return (
    <div className="space-y-5">
      <StepIntro
        emoji="📤"
        title="Tus datos como remitente"
        accent={accent}
        queEs="El remitente eres tú: quien envía el paquete. Algunas agencias piden tus datos en la etiqueta de la caja."
        pasos={['Prende «Imprimir mis datos» si tu agencia los pide.', 'Elige cuáles quieres que salgan.', 'Si quieres, usa datos distintos a los de tu negocio.']}
      />

      {requisitos.length > 0 && (
        <Card emoji="📋" title={`${draft.nombre || base.nombre} pide del remitente`}>
          <ul className="flex flex-wrap gap-2">
            {requisitos.map((q, i) => (
              <li key={i} className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/25 text-[14px] text-cyan-100 font-semibold">
                {q.emoji} {q.label}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card emoji="🖨️" title="¿Imprimir mis datos en el rótulo?">
        <BigSwitch checked={imprime} onChange={setTodo} label={imprime ? 'Sí, imprimir mis datos' : 'No, solo los de mi clienta'} description="Aparecen arriba del rótulo, en el recuadro «Remitente»." />

        {imprime && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fadeIn">
            <BigSwitch compact checked={r.mostrar_remitente_nombre} onChange={v => updateRotulo({ mostrar_remitente_nombre: v, incluir_remitente: true })} label="👤 Nombre" />
            <BigSwitch compact checked={r.mostrar_remitente_ruc_dni} onChange={v => updateRotulo({ mostrar_remitente_ruc_dni: v, incluir_remitente: true })} label="🪪 DNI o RUC" />
            <BigSwitch compact checked={r.mostrar_remitente_telefono} onChange={v => updateRotulo({ mostrar_remitente_telefono: v, incluir_remitente: true })} label="📱 Celular" />
            <BigSwitch compact checked={r.mostrar_remitente_origen} onChange={v => updateRotulo({ mostrar_remitente_origen: v, incluir_remitente: true })} label="📍 Dirección de origen" />
          </div>
        )}
      </Card>

      {imprime && (
        <Card emoji="🏪" title="¿De quién son los datos?">
          <BigSwitch
            checked={!r.usar_remitente_personalizado}
            onChange={v => updateRotulo({ usar_remitente_personalizado: !v })}
            label="Los de mi negocio"
            description="Se toman de Ajustes de tu empresa."
          />
          {!r.usar_remitente_personalizado ? (
            <ul className="rounded-2xl bg-slate-950/60 border border-white/10 p-3.5 space-y-1.5 text-[15px] text-slate-200">
              <li>👤 {negocio.nombre}</li>
              <li>🪪 {negocio.doc}</li>
              <li>📱 {negocio.cel}</li>
              <li>📍 {negocio.dir}</li>
            </ul>
          ) : (
            <div className="space-y-3 animate-fadeIn">
              <Field label="Nombre o razón social" htmlFor="rem-nombre">
                <input id="rem-nombre" value={r.rem_nombre} onChange={e => updateRotulo({ rem_nombre: e.target.value })} className={inputClass} placeholder="Ej: Comikids Perú" />
              </Field>
              <Field label="DNI o RUC" htmlFor="rem-doc">
                <input id="rem-doc" inputMode="numeric" value={r.rem_ruc_dni} onChange={e => updateRotulo({ rem_ruc_dni: e.target.value })} className={inputClass} placeholder="Ej: 20123456789" />
              </Field>
              <Field label="Celular" htmlFor="rem-cel">
                <input id="rem-cel" inputMode="tel" value={r.rem_celular} onChange={e => updateRotulo({ rem_celular: e.target.value })} className={inputClass} placeholder="Ej: 987654321" />
              </Field>
              <Field label="Dirección de origen" htmlFor="rem-dir">
                <input id="rem-dir" value={r.rem_direccion} onChange={e => updateRotulo({ rem_direccion: e.target.value })} className={inputClass} placeholder="Ej: Av. Gamarra 123, La Victoria" />
              </Field>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
