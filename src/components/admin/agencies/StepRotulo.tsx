import React, { useState } from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { BloqueRotuladoPersonalizado } from '../../../types/database.types';
import { useFeedback } from '../../../context/FeedbackContext';
import {
  StepProps,
  ROTULO_PRESETS,
  applyRotuloPreset,
  AVISO_PLANTILLAS,
  BLOQUE_TIPOS,
  EstiloRotulo,
} from './agencyDraft';
import { StepIntro, Card, ChoiceCards, BigSwitch, Field, inputClass, Disclosure, ChipButton, NumberBadge, Explain } from './ui';
import { RotuloDraft } from './agencyDraft';

// Dibujitos de la forma del rótulo
const ShapeEchado = () => (
  <svg viewBox="0 0 120 70" className="w-full h-16" aria-hidden="true">
    <rect x="4" y="8" width="112" height="54" rx="6" fill="#f8fafc" stroke="#22d3ee" strokeWidth="3" />
    <rect x="12" y="16" width="40" height="8" rx="2" fill="#94a3b8" />
    <rect x="12" y="30" width="96" height="10" rx="2" fill="#0f172a" />
    <rect x="12" y="46" width="60" height="6" rx="2" fill="#cbd5e1" />
  </svg>
);
const ShapeParado = () => (
  <svg viewBox="0 0 120 70" className="w-full h-16" aria-hidden="true">
    <rect x="38" y="2" width="44" height="66" rx="5" fill="#f8fafc" stroke="#a78bfa" strokeWidth="3" />
    <rect x="44" y="9" width="24" height="5" rx="1.5" fill="#94a3b8" />
    <rect x="44" y="20" width="32" height="9" rx="2" fill="#0f172a" />
    <rect x="44" y="34" width="32" height="5" rx="1.5" fill="#cbd5e1" />
    <rect x="44" y="44" width="26" height="5" rx="1.5" fill="#cbd5e1" />
    <rect x="44" y="55" width="32" height="7" rx="1.5" fill="#334155" />
  </svg>
);

// Colores de cada parte del rótulo (mismo número en el mapa y en su tarjeta)
const ZONA = {
  arriba: '#22d3ee',
  destino: '#f59e0b',
  recibe: '#10b981',
  envia: '#a78bfa',
  respuestas: '#818cf8',
  avisos: '#f43f5e',
  codigo: '#94a3b8',
};

// Mapa esquemático: muestra dónde va cada parte y se apaga lo que está desactivado
const LabelMap: React.FC<{ r: RotuloDraft; hasRespuestas: boolean }> = ({ r, hasRespuestas }) => {
  const zones: { n: number; label: string; color: string; on: boolean; y: number; h: number }[] = [
    { n: 1, label: 'Parte de arriba (logos)', color: ZONA.arriba, on: r.mostrar_logo_empresa || r.mostrar_logo_agencia || Boolean(r.subtitulo_cabecera), y: 8, h: 26 },
    { n: 2, label: 'Destino', color: ZONA.destino, on: r.mostrar_destino, y: 40, h: 26 },
    { n: 3, label: 'Quién recibe (tu clienta)', color: ZONA.recibe, on: r.incluir_destinatario, y: 72, h: 40 },
    { n: 4, label: 'Quién envía (tu negocio)', color: ZONA.envia, on: r.incluir_remitente, y: 118, h: 26 },
    { n: 5, label: 'Respuestas de tus preguntas', color: ZONA.respuestas, on: hasRespuestas, y: 150, h: 20 },
    { n: 6, label: 'Avisos especiales', color: ZONA.avisos, on: r.bloques.length > 0, y: 176, h: 20 },
    { n: 7, label: 'Código y sello', color: ZONA.codigo, on: r.mostrar_barcode || r.mostrar_tracking || r.mostrar_fecha_sello, y: 202, h: 22 },
  ];
  return (
    <div className="grid grid-cols-1 min-[460px]:grid-cols-[150px_1fr] gap-4 items-center">
      <svg viewBox="0 0 150 232" className="w-36 mx-auto" role="img" aria-label="Mapa de las partes del rótulo">
        <rect x="2" y="2" width="146" height="228" rx="10" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 4" />
        {zones.map(z => (
          <g key={z.n} opacity={z.on ? 1 : 0.25}>
            <rect x="10" y={z.y} width="130" height={z.h} rx="5" fill={z.color} fillOpacity="0.22" stroke={z.color} strokeWidth="2" />
            <circle cx="24" cy={z.y + z.h / 2} r="8" fill={z.color} />
            <text x="24" y={z.y + z.h / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a">{z.n}</text>
          </g>
        ))}
      </svg>
      <ol className="space-y-1.5">
        {zones.map(z => (
          <li key={z.n} className={`flex items-center gap-2.5 text-[15px] ${z.on ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
            <NumberBadge n={z.n} color={z.color} />
            <span>{z.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

const ESTILOS: { value: EstiloRotulo; emoji: string; title: string; desc: string }[] = [
  { value: '', emoji: '🌐', title: 'El de mi negocio', desc: 'Usa el diseño elegido en Ajustes' },
  { value: 'estandar_oficial', emoji: '🏷️', title: 'Clásico', desc: 'Letras grandes, DNI gigante' },
  { value: 'vision_modern', emoji: '💎', title: 'Moderno', desc: 'Limpio y elegante' },
  { value: 'eco_ink_saving', emoji: '🌿', title: 'Ahorra tinta', desc: 'Blanco y negro, gasta 80% menos' },
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
        queEs="El rótulo es la etiqueta que imprimes y pegas en la caja. La persona de la agencia la lee para saber a quién entregar el paquete. Todo lo que cambies aquí se ve al instante en la vista previa."
        pasos={['Elige la forma y el diseño.', 'Si quieres ir rápido, toca un atajo.', 'Prende o apaga cada parte del rótulo (están numeradas).']}
      />

      <Card emoji="📐" title="1. ¿Cómo pegas el rótulo en la caja?" help="Echado: ideal para cajas grandes o bolsas anchas. Parado: ideal para bolsas angostas o impresoras de tickets.">
        <ChoiceCards
          ariaLabel="Forma del rótulo"
          value={r.orientacion}
          onChange={v => updateRotulo({ orientacion: v })}
          options={[
            { value: 'horizontal', title: 'Echado', desc: 'Más ancho que alto', visual: <ShapeEchado /> },
            { value: 'vertical', title: 'Parado', desc: 'Más alto que ancho', visual: <ShapeParado /> },
          ]}
        />
      </Card>

      <Card emoji="🎨" title="2. Elige un diseño" help="«El de mi negocio» usa el diseño que elegiste en Ajustes para todas las agencias. Elige otro solo si quieres que esta agencia sea distinta.">
        <ChoiceCards ariaLabel="Diseño del rótulo" columns={2} value={r.estilo} onChange={v => updateRotulo({ estilo: v })} options={ESTILOS} />
      </Card>

      <Card emoji="⚡" title="3. Atajos rápidos (opcional)" description="Un toque y el rótulo queda listo. Luego puedes ajustar los detalles abajo.">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
          {ROTULO_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                updateRotulo(applyRotuloPreset(r, p.id));
                toast(`Atajo "${p.title}" aplicado`, 'info');
              }}
              className="min-h-16 p-3.5 rounded-2xl border border-white/10 bg-slate-950/50 hover:border-cyan-400/50 hover:bg-cyan-500/5 text-left flex items-start gap-3"
            >
              <span className="text-2xl leading-7" aria-hidden="true">{p.emoji}</span>
              <span>
                <span className="block text-[15px] font-black text-white">{p.title}</span>
                <span className="block text-[13px] text-slate-400 leading-snug">{p.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card emoji="🗺️" title="4. ¿Qué sale en el rótulo?" description="Tu rótulo tiene 7 partes. Abajo hay una tarjeta para cada una, con el mismo número. Lo que apagues se ve tachado aquí.">
        <LabelMap r={r} hasRespuestas={draft.campos.some(c => c.mostrar_en_rotulado)} />
      </Card>

      {/* Parte de arriba */}
      <Card badge={<NumberBadge n={1} color={ZONA.arriba} />} title="Parte de arriba" description="El encabezado: tu logo, el de la agencia y una frase.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <BigSwitch compact checked={r.mostrar_logo_empresa} onChange={v => updateRotulo({ mostrar_logo_empresa: v })} label="Logo de mi negocio" />
          <BigSwitch compact checked={r.mostrar_logo_agencia} onChange={v => updateRotulo({ mostrar_logo_agencia: v })} label="Logo de la agencia" />
        </div>
        <Field label="Frase debajo del título (opcional)" htmlFor="rot-subtitulo">
          <input id="rot-subtitulo" type="text" value={r.subtitulo_cabecera} onChange={e => updateRotulo({ subtitulo_cabecera: e.target.value })} placeholder="Ej: Envío seguro y prioritario" className={inputClass} />
        </Field>
      </Card>

      {/* Destino */}
      <Card badge={<NumberBadge n={2} color={ZONA.destino} />} title="Destino" description="La agencia o dirección a donde va el paquete. Es lo más importante para la agencia.">
        <BigSwitch checked={r.mostrar_destino} onChange={v => updateRotulo({ mostrar_destino: v })} label="Mostrar el destino" />
        {r.mostrar_destino && (
          <Disclosure title="Cambiar el título del destino">
            <input type="text" value={r.titulo_destino} onChange={e => updateRotulo({ titulo_destino: e.target.value })} placeholder="Ej: 📍 AGENCIA DE RECOJO" className={inputClass} aria-label="Título del destino" />
          </Disclosure>
        )}
      </Card>

      {/* Quién recibe */}
      <Card badge={<NumberBadge n={3} color={ZONA.recibe} />} title="Quién recibe (tu clienta)" description="Sus datos para que la agencia le entregue el paquete." help="Para Shalom y Olva deja prendido el DNI: lo piden para entregar. «Gigante» se lee mejor de lejos.">
        <BigSwitch checked={r.incluir_destinatario} onChange={v => updateRotulo({ incluir_destinatario: v })} label="Mostrar los datos de quién recibe" />
        {r.incluir_destinatario && (
          <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <BigSwitch compact checked={r.mostrar_cliente_nombre} onChange={v => updateRotulo({ mostrar_cliente_nombre: v })} label="Nombre" />
              <BigSwitch compact checked={r.mostrar_cliente_dni} onChange={v => updateRotulo({ mostrar_cliente_dni: v })} label="DNI" />
              <BigSwitch compact checked={r.mostrar_cliente_telefono} onChange={v => updateRotulo({ mostrar_cliente_telefono: v })} label="Celular" />
              <BigSwitch compact checked={r.mostrar_badge_modalidad} onChange={v => updateRotulo({ mostrar_badge_modalidad: v })} label="Sello de modalidad" />
            </div>

            {r.mostrar_cliente_dni && (
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-slate-200">Tamaño del DNI</p>
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
                      className={`min-h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 ${
                        r.tamano_dni === o.v ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-slate-950/50'
                      }`}
                    >
                      <span className={`${o.size} font-black font-mono text-white leading-none`}>123</span>
                      <span className="text-[13px] font-bold text-slate-300">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {r.mostrar_badge_modalidad && (
              <Field label="Texto del sello de modalidad" htmlFor="rot-badge" hint="Déjalo vacío para que el sistema lo ponga solo.">
                <input id="rot-badge" type="text" value={r.texto_badge_modalidad} onChange={e => updateRotulo({ texto_badge_modalidad: e.target.value })} placeholder="Ej: RECOJO EN AGENCIA" className={inputClass} />
              </Field>
            )}

            <Disclosure title="Cambiar los títulos de esta parte">
              <Field label="Título de la sección" htmlFor="rot-t-dest">
                <input id="rot-t-dest" type="text" value={r.titulo_destinatario} onChange={e => updateRotulo({ titulo_destinatario: e.target.value })} placeholder="DESTINATARIO (CLIENTE)" className={inputClass} />
              </Field>
              <Field label="Título del nombre" htmlFor="rot-t-nom">
                <input id="rot-t-nom" type="text" value={r.titulo_cliente_nombre} onChange={e => updateRotulo({ titulo_cliente_nombre: e.target.value })} placeholder="Cliente:" className={inputClass} />
              </Field>
              <Field label="Título del DNI" htmlFor="rot-t-dni">
                <input id="rot-t-dni" type="text" value={r.titulo_cliente_dni} onChange={e => updateRotulo({ titulo_cliente_dni: e.target.value })} placeholder="🪪 DNI / DOC RECOJO:" className={inputClass} />
              </Field>
              <Field label="Título del celular" htmlFor="rot-t-tel">
                <input id="rot-t-tel" type="text" value={r.titulo_cliente_telefono} onChange={e => updateRotulo({ titulo_cliente_telefono: e.target.value })} placeholder="📱 TELÉFONO:" className={inputClass} />
              </Field>
            </Disclosure>
          </div>
        )}
      </Card>

      {/* Quién envía */}
      <Card badge={<NumberBadge n={4} color={ZONA.envia} />} title="Quién envía (tu negocio)" description="Tus datos, por si la agencia necesita devolver el paquete o llamarte.">
        <BigSwitch checked={r.incluir_remitente} onChange={v => updateRotulo({ incluir_remitente: v })} label="Mostrar los datos de quién envía" />
        {r.incluir_remitente && (
          <div className="space-y-4 animate-fadeIn">
            <ChoiceCards
              ariaLabel="Datos del remitente"
              value={r.usar_remitente_personalizado ? 'propios' : 'negocio'}
              onChange={v => updateRotulo({ usar_remitente_personalizado: v === 'propios' })}
              options={[
                { value: 'negocio', emoji: '🏪', title: 'Los de mi negocio', desc: 'Los que pusiste en Ajustes' },
                { value: 'propios', emoji: '✍️', title: 'Otros datos', desc: 'Solo para esta agencia' },
              ]}
            />
            {!r.usar_remitente_personalizado && (
              <Explain>Se usan el nombre, documento y celular que pusiste en <strong>Ajustes → Remitente</strong>.</Explain>
            )}
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
                <Field label="Dirección de origen" htmlFor="rem-dir">
                  <input id="rem-dir" type="text" value={r.rem_direccion} onChange={e => updateRotulo({ rem_direccion: e.target.value })} className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Nota (opcional)" htmlFor="rem-obs">
                    <input id="rem-obs" type="text" value={r.rem_observaciones} onChange={e => updateRotulo({ rem_observaciones: e.target.value })} className={inputClass} />
                  </Field>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <BigSwitch compact checked={r.mostrar_remitente_nombre} onChange={v => updateRotulo({ mostrar_remitente_nombre: v })} label="Nombre" />
              <BigSwitch compact checked={r.mostrar_remitente_ruc_dni} onChange={v => updateRotulo({ mostrar_remitente_ruc_dni: v })} label="DNI / RUC" />
              <BigSwitch compact checked={r.mostrar_remitente_telefono} onChange={v => updateRotulo({ mostrar_remitente_telefono: v })} label="Celular" />
              <BigSwitch compact checked={r.mostrar_remitente_origen} onChange={v => updateRotulo({ mostrar_remitente_origen: v })} label="Dirección" />
            </div>
            <Disclosure title="Cambiar el título de esta parte">
              <input type="text" value={r.titulo_remitente} onChange={e => updateRotulo({ titulo_remitente: e.target.value })} placeholder="REMITENTE:" className={inputClass} aria-label="Título del remitente" />
            </Disclosure>
          </div>
        )}
      </Card>

      {/* Datos extra del formulario */}
      {draft.campos.length > 0 && (
        <Card badge={<NumberBadge n={5} color={ZONA.respuestas} />} title="Respuestas de tus preguntas" description="Lo que tu clienta contestó en el paso «Datos que pides». Elige cuáles se imprimen y con qué nombre.">
          <ul className="space-y-2.5">
            {draft.campos.map(c => (
              <li key={c.id} className="rounded-2xl bg-slate-950/50 border border-white/10 p-3 space-y-2.5">
                <BigSwitch
                  compact
                  checked={c.mostrar_en_rotulado}
                  onChange={v => update({ campos: draft.campos.map(x => (x.id === c.id ? { ...x, mostrar_en_rotulado: v } : x)) })}
                  label={c.label}
                />
                {c.mostrar_en_rotulado && (
                  <input
                    type="text"
                    value={r.etiquetas_campos[c.id] || ''}
                    onChange={e => updateRotulo({ etiquetas_campos: { ...r.etiquetas_campos, [c.id]: e.target.value } })}
                    placeholder={`Nombre en el rótulo (si lo dejas vacío: "${c.label}")`}
                    className={inputClass}
                    aria-label={`Nombre en el rótulo para ${c.label}`}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Avisos */}
      <Card badge={<NumberBadge n={6} color={ZONA.avisos} />} title="Avisos especiales" description="Recuadros de color para avisar algo a quien carga la caja. Ej: FRÁGIL o FLETE EN DESTINO.">
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
                  <button type="button" onClick={() => moveBloque(idx, -1)} disabled={idx === 0} className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center disabled:opacity-30" aria-label="Subir aviso"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => moveBloque(idx, 1)} disabled={idx === r.bloques.length - 1} className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center disabled:opacity-30" aria-label="Bajar aviso"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setBloques(r.bloques.filter(x => x.id !== b.id))} className="w-9 h-9 rounded-xl bg-black/20 hover:bg-rose-600 flex items-center justify-center" aria-label="Quitar aviso"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!nuevoAviso ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {AVISO_PLANTILLAS.map(p => (
                <ChipButton key={p.label} onClick={() => addBloque(p.bloque)}>{p.emoji} {p.label}</ChipButton>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNuevoAviso({ titulo: '', contenido: '', tipo: 'aviso', posicion: 'medio' })}
              className="w-full min-h-14 rounded-2xl border-2 border-dashed border-pink-400/50 text-pink-300 font-black text-base flex items-center justify-center gap-2 hover:bg-pink-500/5"
            >
              <Plus className="w-5 h-5" /> Escribir mi propio aviso
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-fadeIn">
            <Field label="Título del aviso" htmlFor="aviso-titulo">
              <input id="aviso-titulo" type="text" autoFocus value={nuevoAviso.titulo || ''} onChange={e => setNuevoAviso({ ...nuevoAviso, titulo: e.target.value })} placeholder="Ej: ⚠️ ¡FRÁGIL!" className={`${inputClass} font-bold`} />
            </Field>
            <Field label="Texto del aviso" htmlFor="aviso-texto">
              <input id="aviso-texto" type="text" value={nuevoAviso.contenido} onChange={e => setNuevoAviso({ ...nuevoAviso, contenido: e.target.value })} placeholder="Ej: Manejar con cuidado" className={inputClass} />
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
                className="flex-[2] min-h-12 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> Agregar aviso
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Código y sello */}
      <Card badge={<NumberBadge n={7} color={ZONA.codigo} />} title="Código y sello" description="El código de barras y el número del pedido sirven para encontrarlo rápido. El sello al pie da confianza.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <BigSwitch compact checked={r.mostrar_barcode} onChange={v => updateRotulo({ mostrar_barcode: v })} label="Código de barras" />
          <BigSwitch compact checked={r.mostrar_tracking} onChange={v => updateRotulo({ mostrar_tracking: v })} label="Número del pedido" />
        </div>
        <BigSwitch checked={r.mostrar_fecha_sello} onChange={v => updateRotulo({ mostrar_fecha_sello: v })} label="Sello con la fecha" description="Un sello al pie que da confianza." />
        {r.mostrar_fecha_sello && (
          <Field label="Texto del sello (opcional)" htmlFor="rot-sello">
            <input id="rot-sello" type="text" value={r.texto_sello_personalizado} onChange={e => updateRotulo({ texto_sello_personalizado: e.target.value })} placeholder="Ej: Paquete revisado y seguro" className={inputClass} />
          </Field>
        )}
      </Card>
    </div>
  );
};
