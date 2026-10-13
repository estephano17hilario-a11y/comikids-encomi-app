import React, { useState } from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { BloqueRotuladoPersonalizado } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import { StepProps, RotuloDraft, RotuloPreset, ROTULO_PRESETS, applyRotuloPreset, AVISO_PLANTILLAS, BLOQUE_TIPOS, EstiloRotulo } from './agencyDraft';
import { StepIntro, Card, ChoiceCards, BigSwitch, Field, inputClass, Disclosure, ChipButton, NumberBadge, Explain } from './ui';
import { isNativeDuplicateField } from './previews';

// Colores de cada parte del rótulo (mismo número en el mapa y en su tarjeta)
const ZONA = {
  arriba: '#22d3ee',
  clienta: '#10b981',
  remitente: '#a78bfa',
  avisos: '#f43f5e',
  codigo: '#94a3b8',
};

const remitenteActivo = (r: RotuloDraft) =>
  r.mostrar_remitente_nombre || r.mostrar_remitente_ruc_dni || r.mostrar_remitente_telefono || r.mostrar_remitente_origen;

// Mapa del rótulo (parado): muestra dónde va cada parte; lo apagado se ve tenue y tachado
const LabelMap: React.FC<{ r: RotuloDraft }> = ({ r }) => {
  const zones: { n: number; label: string; color: string; on: boolean; y: number; h: number }[] = [
    { n: 1, label: 'Parte de arriba (logos)', color: ZONA.arriba, on: r.mostrar_logo_empresa || r.mostrar_logo_agencia || Boolean(r.subtitulo_cabecera), y: 8, h: 30 },
    { n: 2, label: 'Datos de tu clienta', color: ZONA.clienta, on: true, y: 44, h: 92 },
    { n: 3, label: 'Tus datos (remitente)', color: ZONA.remitente, on: remitenteActivo(r), y: 142, h: 30 },
    { n: 4, label: 'Avisos especiales', color: ZONA.avisos, on: r.bloques.length > 0, y: 178, h: 22 },
    { n: 5, label: 'Código y sello', color: ZONA.codigo, on: r.mostrar_barcode || r.mostrar_tracking || r.mostrar_fecha_sello, y: 206, h: 22 },
  ];
  return (
    <div className="grid grid-cols-1 min-[460px]:grid-cols-[140px_1fr] gap-4 items-center">
      <svg viewBox="0 0 150 236" className="w-32 mx-auto" role="img" aria-label="Mapa de las partes del rótulo">
        <rect x="2" y="2" width="146" height="232" rx="10" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 4" />
        {zones.map(z => (
          <g key={z.n} opacity={z.on ? 1 : 0.22}>
            <rect x="10" y={z.y} width="130" height={z.h} rx="5" fill={z.color} fillOpacity="0.22" stroke={z.color} strokeWidth="2" />
            <circle cx="26" cy={z.y + z.h / 2} r="9" fill={z.color} />
            <text x="26" y={z.y + z.h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{z.n}</text>
          </g>
        ))}
      </svg>
      <ol className="space-y-2">
        {zones.map(z => (
          <li key={z.n} className={`flex items-center gap-2.5 text-base ${z.on ? 'text-slate-100' : 'text-slate-500'}`}>
            <NumberBadge n={z.n} color={z.color} />
            <span className={z.on ? '' : 'line-through'}>{z.label}</span>
            {!z.on && <span className="text-[12px] no-underline text-slate-500">(no sale)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
};

// Mini rótulos para elegir el diseño
const MiniColor = () => (
  <svg viewBox="0 0 120 80" className="w-full h-20" aria-hidden="true">
    <rect x="34" y="2" width="52" height="76" rx="5" fill="#fff" stroke="#22d3ee" strokeWidth="2.5" />
    <rect x="40" y="8" width="40" height="9" rx="2" fill="#0ea5e9" />
    <rect x="40" y="22" width="40" height="16" rx="2" fill="#0f172a" />
    <rect x="40" y="42" width="28" height="5" rx="1.5" fill="#f59e0b" />
    <rect x="40" y="51" width="40" height="5" rx="1.5" fill="#cbd5e1" />
    <rect x="40" y="61" width="40" height="11" rx="1.5" fill="#334155" />
  </svg>
);
const MiniBN = () => (
  <svg viewBox="0 0 120 80" className="w-full h-20" aria-hidden="true">
    <rect x="34" y="2" width="52" height="76" rx="5" fill="#fff" stroke="#94a3b8" strokeWidth="2.5" />
    <rect x="40" y="8" width="40" height="9" rx="2" fill="none" stroke="#475569" strokeWidth="1.5" />
    <rect x="40" y="22" width="40" height="16" rx="2" fill="none" stroke="#0f172a" strokeWidth="2" />
    <rect x="40" y="42" width="28" height="5" rx="1.5" fill="#cbd5e1" />
    <rect x="40" y="51" width="40" height="5" rx="1.5" fill="#e2e8f0" />
    <rect x="40" y="61" width="40" height="11" rx="1.5" fill="none" stroke="#475569" strokeWidth="1.5" />
  </svg>
);

const DISENOS: { value: EstiloRotulo; title: string; desc: string; visual: React.ReactNode }[] = [
  { value: 'estandar_oficial', title: 'A color', desc: 'Más llamativo y fácil de leer.', visual: <MiniColor /> },
  { value: 'eco_ink_saving', title: 'Blanco y negro', desc: 'Gasta mucho menos tinta.', visual: <MiniBN /> },
];

const PIEZA_TIPO_CLASS: Record<string, string> = {
  aviso: 'bg-amber-400/15 border-amber-400/50 text-amber-100',
  flete: 'bg-rose-500/15 border-rose-500/50 text-rose-100',
  destacado: 'bg-purple-500/15 border-purple-500/50 text-purple-100',
  nota: 'bg-slate-500/15 border-slate-400/40 text-slate-200',
};

const POSICIONES: { id: NonNullable<BloqueRotuladoPersonalizado['posicion']>; label: string }[] = [
  { id: 'arriba', label: '⬆️ Arriba' },
  { id: 'medio', label: '↔️ Al medio' },
  { id: 'abajo', label: '⬇️ Abajo' },
];

export const StepRotulo: React.FC<StepProps> = ({ draft, updateRotulo, update, accent, openPreview }) => {
  const { toast } = useFeedback();
  const r = draft.rotulo;
  const [nuevoAviso, setNuevoAviso] = useState<Omit<BloqueRotuladoPersonalizado, 'id'> | null>(null);
  // Atajo puesto: se guarda cómo estaba el rótulo antes para poder deshacerlo
  const [atajo, setAtajo] = useState<{ id: RotuloPreset; antes: RotuloDraft; despues: RotuloDraft } | null>(null);
  const atajoActivo = atajo && JSON.stringify(atajo.despues) === JSON.stringify(r) ? atajo.id : null;

  const toggleAtajo = (id: RotuloPreset, title: string) => {
    if (atajoActivo === id && atajo) {
      updateRotulo(atajo.antes);
      setAtajo(null);
      toast(`Quitaste «${title}». Tu rótulo volvió a como estaba.`, 'info');
      return;
    }
    const antes = atajo && atajoActivo ? atajo.antes : r;
    const despues = applyRotuloPreset(r, id);
    updateRotulo(despues);
    setAtajo({ id, antes, despues });
    toast(`Pusiste «${title}». Si no te gusta, tócalo otra vez para quitarlo.`, 'success', { label: 'Ver cómo queda', onClick: openPreview });
  };

  // Al prender o apagar un dato del remitente, el remitente se incluye solo si queda alguno prendido
  const setRemitente = (patch: Partial<RotuloDraft>) => {
    const next = { ...r, ...patch };
    updateRotulo({ ...patch, incluir_remitente: remitenteActivo(next) });
  };
  const preguntas = draft.campos.filter(c => !isNativeDuplicateField(c));

  const setBloques = (bloques: BloqueRotuladoPersonalizado[]) => updateRotulo({ bloques });
  const addBloque = (b: Omit<BloqueRotuladoPersonalizado, 'id'>) => {
    setBloques([...r.bloques, { ...b, id: 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }]);
    toast('Aviso agregado al rótulo', 'success', { label: 'Ver cómo queda', onClick: openPreview });
  };
  const moveBloque = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= r.bloques.length) return;
    const next = [...r.bloques];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBloques(next);
  };

  return (
    <div className="space-y-5">
      <StepIntro
        emoji="🏷️"
        title="Rótulo para imprimir"
        accent={accent}
        queEs="El rótulo es la etiqueta que imprimes y pegas parada en la caja. La persona de la agencia la lee para saber a quién entregar el paquete y a dónde."
        pasos={[
          'Elige si lo quieres a color o en blanco y negro.',
          'Si quieres ir rápido, toca un atajo (te decimos qué sale y qué no).',
          'Revisa los datos de tu clienta y decide si pones los tuyos.',
        ]}
      />

      {/* 1. Diseño */}
      <Card emoji="🎨" title="1. ¿A color o en blanco y negro?" help="Si tu impresora es de tinta y quieres ahorrar, elige «Blanco y negro». Los datos que salen son los mismos.">
        <ChoiceCards ariaLabel="Diseño del rótulo" value={r.estilo} onChange={v => updateRotulo({ estilo: v })} options={DISENOS} />
      </Card>

      {/* 2. Atajos reversibles */}
      <Card
        emoji="⚡"
        title="2. Atajos (opcional)"
        description="Un atajo prende y apaga varias opciones de abajo por ti, de un solo toque."
        help="Toca un atajo para ponerlo. Si no te gusta, tócalo otra vez y tu rótulo vuelve a como estaba. También puedes no usar ninguno y elegir todo abajo."
      >
        <div className="space-y-3">
          {ROTULO_PRESETS.map(p => {
            const activo = atajoActivo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="switch"
                aria-checked={activo}
                onClick={() => toggleAtajo(p.id, p.title)}
                className={`w-full text-left rounded-2xl border-2 p-4 space-y-3 transition-colors ${activo ? 'bg-white/10' : 'border-white/10 bg-slate-950/50 hover:border-white/30'}`}
                style={activo ? { borderColor: accent } : undefined}
              >
                <span className="flex items-start gap-3">
                  <span className="text-3xl leading-9 shrink-0" aria-hidden="true">{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-black text-white">{p.title}</span>
                      {p.recomendado && <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Recomendado</span>}
                    </span>
                    <span className="block text-[15px] text-slate-300 leading-snug mt-1">{p.desc}</span>
                  </span>
                  <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${activo ? 'bg-emerald-500' : 'bg-slate-600'}`} aria-hidden="true">
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
                  </span>
                </span>
                <span className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                    <span className="block text-xs font-black uppercase tracking-wider text-emerald-300">Sí se imprime</span>
                    {p.sale.map(t => (
                      <span key={t} className="flex items-start gap-1.5 text-sm text-slate-200"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{t}</span>
                    ))}
                  </span>
                  {p.noSale.length > 0 && (
                    <span className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 space-y-1">
                      <span className="block text-xs font-black uppercase tracking-wider text-rose-300">No se imprime</span>
                      {p.noSale.map(t => (
                        <span key={t} className="flex items-start gap-1.5 text-sm text-slate-200"><X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />{t}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={`block text-center text-sm font-black rounded-xl py-2.5 ${activo ? 'bg-white/10 text-white' : 'text-slate-950'}`} style={activo ? undefined : { backgroundColor: accent }}>
                  {activo ? '✓ Puesto • Toca para quitarlo' : 'Tocar para poner este atajo'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Mapa */}
      <Card emoji="🗺️" title="3. Las partes de tu rótulo" description="Tu rótulo tiene 5 partes. Abajo hay una tarjeta para cada una, con el mismo número y color.">
        <LabelMap r={r} />
      </Card>

      {/* Parte 1 */}
      <Card badge={<NumberBadge n={1} color={ZONA.arriba} />} title="Parte de arriba" description="El encabezado del rótulo.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <BigSwitch compact checked={r.mostrar_logo_empresa} onChange={v => updateRotulo({ mostrar_logo_empresa: v })} label="Logo de mi negocio" />
          <BigSwitch compact checked={r.mostrar_logo_agencia} onChange={v => updateRotulo({ mostrar_logo_agencia: v })} label="Logo de la agencia" />
        </div>
        <Field label="Frase debajo del título (opcional)" htmlFor="rot-subtitulo" hint="Ej: «Envío seguro». Si la dejas vacía no sale nada.">
          <input id="rot-subtitulo" type="text" value={r.subtitulo_cabecera} onChange={e => updateRotulo({ subtitulo_cabecera: e.target.value })} placeholder="Ej: Envío seguro y prioritario" className={inputClass} />
        </Field>
      </Card>

      {/* Parte 2: todo lo de la clienta en un solo lugar */}
      <Card
        badge={<NumberBadge n={2} color={ZONA.clienta} />}
        title="Datos de tu clienta"
        description="Todo lo que la agencia necesita para entregarle el paquete. Prende lo que quieres que salga."
      >
        <div className="space-y-2">
          <BigSwitch checked={r.mostrar_cliente_nombre} onChange={v => updateRotulo({ mostrar_cliente_nombre: v })} emoji="👤" label="Su nombre" />
          <BigSwitch checked={r.mostrar_cliente_dni} onChange={v => updateRotulo({ mostrar_cliente_dni: v })} emoji="🪪" label="Su DNI" description="Shalom y Olva lo piden para entregar el paquete." />
          {r.mostrar_cliente_dni && (
            <div className="rounded-2xl bg-slate-950/50 border border-white/10 p-3 space-y-2 animate-fadeIn">
              <p className="text-sm font-bold text-slate-200">¿Qué tan grande sale el DNI?</p>
              <div role="radiogroup" aria-label="Tamaño del DNI" className="grid grid-cols-3 gap-2">
                {([
                  { v: 'normal', label: 'Normal', size: 'text-base' },
                  { v: 'grande', label: 'Grande', size: 'text-xl' },
                  { v: 'gigante', label: 'Gigante', size: 'text-3xl' },
                ] as const).map(o => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={r.tamano_dni === o.v}
                    onClick={() => updateRotulo({ tamano_dni: o.v })}
                    className={`min-h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 ${r.tamano_dni === o.v ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-slate-950/50'}`}
                  >
                    <span className={`${o.size} font-black font-mono text-white leading-none`}>123</span>
                    <span className="text-[13px] font-bold text-slate-300">{o.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[13px] text-slate-500">«Gigante» se lee mejor de lejos.</p>
            </div>
          )}
          <BigSwitch checked={r.mostrar_cliente_telefono} onChange={v => updateRotulo({ mostrar_cliente_telefono: v })} emoji="📱" label="Su celular" />
          <BigSwitch checked={r.mostrar_destino} onChange={v => updateRotulo({ mostrar_destino: v })} emoji="📍" label="A dónde va el paquete" description="La agencia o dirección de destino. Recomendado: siempre prendido." />
          <BigSwitch checked={r.mostrar_badge_modalidad} onChange={v => updateRotulo({ mostrar_badge_modalidad: v })} emoji="🏷️" label="Sello «Recojo en agencia»" description="Un sellito que dice cómo recibe el paquete." />
          {r.mostrar_badge_modalidad && (
            <input
              type="text"
              value={r.texto_badge_modalidad}
              onChange={e => updateRotulo({ texto_badge_modalidad: e.target.value })}
              placeholder="Texto del sello (vacío = lo pone el sistema)"
              className={inputClass}
              aria-label="Texto del sello de modalidad"
            />
          )}
        </div>

        {preguntas.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-black text-slate-200">Respuestas a tus preguntas</p>
            <p className="text-[13px] text-slate-500 -mt-1">Lo que tu clienta contestó en «Datos que pides».</p>
            {preguntas.map(c => (
              <div key={c.id} className="space-y-2">
                <BigSwitch
                  checked={c.mostrar_en_rotulado}
                  onChange={v => update({ campos: draft.campos.map(x => (x.id === c.id ? { ...x, mostrar_en_rotulado: v } : x)) })}
                  emoji="📝"
                  label={c.label}
                />
                {c.mostrar_en_rotulado && (
                  <input
                    type="text"
                    value={r.etiquetas_campos[c.id] || ''}
                    onChange={e => updateRotulo({ etiquetas_campos: { ...r.etiquetas_campos, [c.id]: e.target.value } })}
                    placeholder={`Nombre en el rótulo (vacío = «${c.label}»)`}
                    className={inputClass}
                    aria-label={`Nombre en el rótulo para ${c.label}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <Disclosure title="Cambiar los textos de los títulos (opcional)">
          <Field label="Título de esta parte" htmlFor="rot-t-dest">
            <input id="rot-t-dest" type="text" value={r.titulo_destinatario} onChange={e => updateRotulo({ titulo_destinatario: e.target.value })} placeholder="DESTINATARIO (CLIENTE)" className={inputClass} />
          </Field>
          <Field label="Antes del nombre" htmlFor="rot-t-nom">
            <input id="rot-t-nom" type="text" value={r.titulo_cliente_nombre} onChange={e => updateRotulo({ titulo_cliente_nombre: e.target.value })} placeholder="Cliente:" className={inputClass} />
          </Field>
          <Field label="Antes del DNI" htmlFor="rot-t-dni">
            <input id="rot-t-dni" type="text" value={r.titulo_cliente_dni} onChange={e => updateRotulo({ titulo_cliente_dni: e.target.value })} placeholder="🪪 DNI / DOC RECOJO:" className={inputClass} />
          </Field>
          <Field label="Antes del celular" htmlFor="rot-t-tel">
            <input id="rot-t-tel" type="text" value={r.titulo_cliente_telefono} onChange={e => updateRotulo({ titulo_cliente_telefono: e.target.value })} placeholder="📱 TELÉFONO:" className={inputClass} />
          </Field>
        </Disclosure>
      </Card>

      {/* Parte 3: remitente, apagado por defecto */}
      <Card badge={<NumberBadge n={3} color={ZONA.remitente} />} title="Tus datos (remitente)" description="El remitente eres tú: quien envía el paquete.">
        <div className="space-y-2">
          <p className="text-base font-black text-white">¿Qué datos tuyos quieres poner?</p>
          <p className="text-sm text-slate-400 -mt-1">Por defecto no se pone ninguno. Prende solo los que quieras que salgan.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <BigSwitch compact checked={r.mostrar_remitente_nombre} onChange={v => setRemitente({ mostrar_remitente_nombre: v })} emoji="🏪" label="Mi nombre" />
            <BigSwitch compact checked={r.mostrar_remitente_ruc_dni} onChange={v => setRemitente({ mostrar_remitente_ruc_dni: v })} emoji="🪪" label="Mi DNI o RUC" />
            <BigSwitch compact checked={r.mostrar_remitente_telefono} onChange={v => setRemitente({ mostrar_remitente_telefono: v })} emoji="📱" label="Mi celular" />
            <BigSwitch compact checked={r.mostrar_remitente_origen} onChange={v => setRemitente({ mostrar_remitente_origen: v })} emoji="📍" label="Mi dirección" />
          </div>
        </div>
        {!remitenteActivo(r) && (
          <Explain>Ponlos si quieres que la agencia sepa quién envía y pueda llamarte o devolverte el paquete si no lo recogen.</Explain>
        )}

        {remitenteActivo(r) && (
          <div className="rounded-3xl border-2 p-4 space-y-4 animate-slideUp" style={{ borderColor: `${ZONA.remitente}66`, backgroundColor: `${ZONA.remitente}12` }}>
            <div className="space-y-2">
              <p className="text-base font-black text-white">¿De dónde saco tus datos?</p>
              <ChoiceCards
                ariaLabel="Origen de los datos del remitente"
                value={r.usar_remitente_personalizado ? 'propios' : 'negocio'}
                onChange={v => updateRotulo({ usar_remitente_personalizado: v === 'propios' })}
                options={[
                  { value: 'negocio', emoji: '⚙️', title: 'De mis Ajustes', desc: 'Los que pusiste en Ajustes → Remitente.' },
                  { value: 'propios', emoji: '✍️', title: 'Escribirlos aquí', desc: 'Otros datos solo para esta agencia.' },
                ]}
              />
            </div>

            {r.usar_remitente_personalizado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                <Field label="Nombre" htmlFor="rem-nom">
                  <input id="rem-nom" type="text" value={r.rem_nombre} onChange={e => updateRotulo({ rem_nombre: e.target.value })} className={inputClass} />
                </Field>
                <Field label="DNI o RUC" htmlFor="rem-doc">
                  <input id="rem-doc" type="text" inputMode="numeric" value={r.rem_ruc_dni} onChange={e => updateRotulo({ rem_ruc_dni: e.target.value })} className={`${inputClass} font-mono`} />
                </Field>
                <Field label="Celular" htmlFor="rem-cel">
                  <input id="rem-cel" type="tel" value={r.rem_celular} onChange={e => updateRotulo({ rem_celular: e.target.value })} className={`${inputClass} font-mono`} />
                </Field>
                <Field label="Dirección" htmlFor="rem-dir">
                  <input id="rem-dir" type="text" value={r.rem_direccion} onChange={e => updateRotulo({ rem_direccion: e.target.value })} className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Nota (opcional)" htmlFor="rem-obs">
                    <input id="rem-obs" type="text" value={r.rem_observaciones} onChange={e => updateRotulo({ rem_observaciones: e.target.value })} className={inputClass} />
                  </Field>
                </div>
              </div>
            )}

            <Disclosure title="Cambiar el título de esta parte (opcional)">
              <input type="text" value={r.titulo_remitente} onChange={e => updateRotulo({ titulo_remitente: e.target.value })} placeholder="REMITENTE:" className={inputClass} aria-label="Título del remitente" />
            </Disclosure>
          </div>
        )}
      </Card>

      {/* Parte 4: avisos */}
      <Card badge={<NumberBadge n={4} color={ZONA.avisos} />} title="Avisos especiales (opcional)" description="Recuadros de color para avisarle algo a quien carga la caja.">
        {r.bloques.length > 0 && (
          <ul className="space-y-2">
            {r.bloques.map((b, idx) => (
              <li key={b.id} className={`rounded-2xl border-2 p-3 flex items-start justify-between gap-2 ${PIEZA_TIPO_CLASS[b.tipo || 'nota']}`}>
                <div className="min-w-0">
                  {b.titulo && <p className="text-sm font-black break-words">{b.titulo}</p>}
                  <p className="text-sm break-words opacity-90">{b.contenido}</p>
                  <p className="text-[12px] opacity-70 mt-0.5">{POSICIONES.find(p => p.id === (b.posicion || 'medio'))?.label}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => moveBloque(idx, -1)} disabled={idx === 0} className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center disabled:opacity-30" aria-label="Subir aviso"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => moveBloque(idx, 1)} disabled={idx === r.bloques.length - 1} className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center disabled:opacity-30" aria-label="Bajar aviso"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setBloques(r.bloques.filter(x => x.id !== b.id))} className="w-10 h-10 rounded-xl bg-black/20 hover:bg-rose-600 flex items-center justify-center" aria-label="Quitar aviso"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!nuevoAviso ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Toca uno listo para agregarlo:</p>
            <div className="flex flex-wrap gap-2">
              {AVISO_PLANTILLAS.map(p => (
                <ChipButton key={p.label} onClick={() => addBloque(p.bloque)}>{p.emoji} {p.label}</ChipButton>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNuevoAviso({ titulo: '', contenido: '', tipo: 'aviso', posicion: 'medio' })}
              className="w-full min-h-14 rounded-2xl border-2 border-dashed border-rose-400/50 text-rose-300 font-black text-base flex items-center justify-center gap-2 hover:bg-rose-500/5"
            >
              <Plus className="w-5 h-5" /> Escribir mi propio aviso
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-fadeIn">
            <Field label="Título del aviso" htmlFor="aviso-titulo">
              <input id="aviso-titulo" type="text" autoFocus value={nuevoAviso.titulo || ''} onChange={e => setNuevoAviso({ ...nuevoAviso, titulo: e.target.value })} placeholder="Ej: 💰 PAGO CONTRA ENTREGA" className={`${inputClass} font-bold`} />
            </Field>
            <Field label="Texto del aviso" htmlFor="aviso-texto">
              <input id="aviso-texto" type="text" value={nuevoAviso.contenido} onChange={e => setNuevoAviso({ ...nuevoAviso, contenido: e.target.value })} placeholder="Ej: Cobrar S/ 50 al entregar" className={inputClass} />
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-slate-200">Color</p>
              <div className="grid grid-cols-2 gap-2">
                {BLOQUE_TIPOS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNuevoAviso({ ...nuevoAviso, tipo: t.id })}
                    aria-pressed={nuevoAviso.tipo === t.id}
                    className={`min-h-12 px-3 rounded-2xl border-2 flex items-center gap-2 text-left text-sm font-bold text-white ${nuevoAviso.tipo === t.id ? 'border-cyan-400 bg-white/5' : 'border-white/10'}`}
                  >
                    <span className={`w-5 h-5 rounded-full shrink-0 ${t.swatch}`} aria-hidden="true" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-slate-200">¿Dónde va?</p>
              <div className="flex flex-wrap gap-2">
                {POSICIONES.map(p => (
                  <ChipButton key={p.id} active={(nuevoAviso.posicion || 'medio') === p.id} onClick={() => setNuevoAviso({ ...nuevoAviso, posicion: p.id })}>{p.label}</ChipButton>
                ))}
              </div>
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setNuevoAviso(null)} className="flex-1 min-h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  if (!nuevoAviso.contenido.trim() && !nuevoAviso.titulo?.trim()) {
                    toast('Escribe el título o el texto del aviso.', 'warning');
                    return;
                  }
                  addBloque({ ...nuevoAviso, titulo: nuevoAviso.titulo?.trim() || undefined, contenido: nuevoAviso.contenido.trim() });
                  setNuevoAviso(null);
                }}
                className="flex-[2] min-h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> Agregar aviso
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Parte 5: código y sello */}
      <Card badge={<NumberBadge n={5} color={ZONA.codigo} />} title="Código y sello" description="Ayudan a encontrar el pedido rápido y dan confianza.">
        <div className="space-y-2">
          <BigSwitch checked={r.mostrar_barcode} onChange={v => updateRotulo({ mostrar_barcode: v })} emoji="▮▯▮" label="Código de barras" description="Se puede escanear con un lector." />
          <BigSwitch checked={r.mostrar_tracking} onChange={v => updateRotulo({ mostrar_tracking: v })} emoji="#️⃣" label="Número del pedido" description="Ej: #ENC4821, para buscarlo en tu lista." />
          <BigSwitch checked={r.mostrar_fecha_sello} onChange={v => updateRotulo({ mostrar_fecha_sello: v })} emoji="🗓️" label="Sello con la fecha" description="Un sello al pie con la fecha de impresión." />
        </div>
        {r.mostrar_fecha_sello && (
          <Field label="Texto del sello (opcional)" htmlFor="rot-sello">
            <input id="rot-sello" type="text" value={r.texto_sello_personalizado} onChange={e => updateRotulo({ texto_sello_personalizado: e.target.value })} placeholder="Ej: Paquete revisado y seguro" className={inputClass} />
          </Field>
        )}
      </Card>
    </div>
  );
};
