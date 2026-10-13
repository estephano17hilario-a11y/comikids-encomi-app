import React from 'react';
import { ArrowRight, Truck, CheckCheck, Lock } from 'lucide-react';
import { MetodoEnvio, TallerConfig, Pedido } from '../../../types/database.types';
import { ShalomLabelPrint } from '../ShalomLabelPrint';
import { DIAS_SEMANA_ORDEN, DIAS_SEMANA_ABREV, getAgencyDaysSummary, formatHorarioAmigable } from '../../../utils/agencyAvailability';
import { AgencyDraft, RECEIPT_DIVIDER, VARIABLES_MENSAJE, construirMensajeComprobacion } from './agencyDraft';
import { PhoneFrame, FitToWidth } from './ui';

export const AgencyLogo: React.FC<{ method: Pick<MetodoEnvio, 'codigo' | 'tipo_formulario' | 'foto_url' | 'nombre'>; size?: 'md' | 'lg' }> = ({ method, size = 'md' }) => {
  const box = size === 'lg' ? 'w-14 h-14' : 'w-12 h-12';
  const isOlva = method.codigo === 'olva' || method.tipo_formulario === 'olva';
  const isShalom = method.codigo === 'shalom' || method.tipo_formulario === 'shalom';
  const src = method.foto_url || (isShalom ? '/Shalom-Courier-Logo.webp' : isOlva ? '/Olva-Courier-Logo.svg' : '');
  if (src) {
    return (
      <div className={`${box} rounded-2xl flex items-center justify-center p-1.5 overflow-hidden shrink-0 border ${isOlva ? 'bg-[#FFDE00] border-yellow-400/60' : 'bg-white border-white/20'}`}>
        <img src={src} alt="" className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      </div>
    );
  }
  return (
    <div className={`${box} rounded-2xl bg-white/8 border border-white/10 text-cyan-300 flex items-center justify-center shrink-0`}>
      <Truck className="w-6 h-6" />
    </div>
  );
};

// Paso 1: así aparece la agencia cuando la clienta elige cómo recibir su pedido
export const AgencyChoicePreview: React.FC<{ live: MetodoEnvio }> = ({ live }) => {
  const summary = getAgencyDaysSummary(live);
  return (
    <PhoneFrame title="Así te ven tus clientas">
      <p className="text-[13px] text-slate-300 font-semibold px-1 pb-2">¿Cómo deseas recibir tu pedido? 🚚</p>
      <div
        className="p-3.5 rounded-2xl bg-white/5 border-2 flex items-center justify-between gap-2"
        style={{ borderColor: `${live.color_borde || '#06b6d4'}88` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <AgencyLogo method={live} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{live.nombre || 'Nombre de la agencia'}</p>
            {summary && summary !== 'Todos los días • 24 Horas' && (
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                📅 {summary}
              </span>
            )}
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{live.descripcion || 'Descripción corta de la agencia'}</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
      </div>
      <div className="mt-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3 opacity-50" aria-hidden="true">
        <div className="w-12 h-12 rounded-2xl bg-white/5" />
        <div className="space-y-1.5 flex-1">
          <div className="h-2.5 w-24 rounded bg-white/10" />
          <div className="h-2 w-36 rounded bg-white/5" />
        </div>
      </div>
    </PhoneFrame>
  );
};

// Paso 2: semana visual con los días que sale la agencia
export const SchedulePreview: React.FC<{ draft: AgencyDraft; live: MetodoEnvio; taller: TallerConfig }> = ({ draft, live, taller }) => {
  const usesCompany = draft.modoHorario === 'predeterminado';
  // Mismo valor por defecto que usa Ajustes de la empresa (lunes a sábado)
  const companyDays = (taller.dias_despacho_activos || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']).map(d => d.toLowerCase());
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Semana de esta agencia</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA_ORDEN.map(dia => {
            const on = usesCompany
              ? companyDays.includes(dia)
              : draft.dias.length === 0 || draft.dias.includes(dia);
            const h = draft.modalidadHorario === 'individual_por_dia' && !usesCompany ? draft.horariosPorDia[dia] : draft.horarioGlobal;
            const hours = usesCompany ? (taller.hora_corte_envio_hoy ? `≤${taller.hora_corte_envio_hoy}` : '') : h?.es_24_horas ? '24h' : h?.hora_inicio && h?.hora_fin ? `${h.hora_inicio}` : '';
            return (
              <div
                key={dia}
                className={`rounded-xl py-2 text-center border ${on ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'bg-slate-950/60 border-white/5 text-slate-600'}`}
              >
                <div className="text-xs font-black">{DIAS_SEMANA_ABREV[dia]}</div>
                <div className="text-[10px] mt-0.5 font-mono">{on ? hours || '✓' : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Lo que verá tu clienta</p>
        {usesCompany ? (
          <p className="text-[15px] text-white leading-snug">
            Sale los mismos días que tu negocio
            {taller.hora_corte_envio_hoy ? <> (pedidos hasta las <strong>{taller.hora_corte_envio_hoy}</strong>)</> : null}.
          </p>
        ) : (
          <p className="text-[15px] text-white leading-snug">📅 {getAgencyDaysSummary(live)}</p>
        )}
        {draft.modoHorario === 'personalizado' && draft.modalidadHorario === 'uno_para_todos' && (
          <p className="text-sm text-slate-400">Horario: {formatHorarioAmigable(draft.horarioGlobal)}</p>
        )}
        <ul className="text-sm text-slate-400 space-y-1 pt-1">
          <li>{draft.ocultarSiNoDisponible ? '🙈 Se esconde los días que no sale' : '👀 Siempre aparece en la lista'}</li>
          <li>{draft.restringirFecha ? '🗓️ Solo puede elegir días en que sale' : '🗓️ Puede elegir cualquier fecha'}</li>
        </ul>
      </div>
    </div>
  );
};

// Datos que el formulario ya pide por su cuenta según el tipo de agencia
export const nativeFieldsFor = (live: MetodoEnvio): string[] => {
  const tipo = live.tipo_formulario;
  if (tipo === 'shalom') return ['📍 Agencia Shalom de destino (lista oficial)', '🪪 DNI de quien recibe', '📱 Celular / WhatsApp'];
  if (tipo === 'olva') return ['🏢 Recojo en agencia o a domicilio', '📍 Agencia o dirección', '🪪 DNI', '📱 Celular', '✉️ Correo'];
  if (tipo === 'mapa_direccion') return ['🗺️ Ubicación en el mapa', '📍 Distrito y dirección', '📱 Celular / WhatsApp'];
  return ['📍 Dirección o indicaciones de entrega', '📱 Celular / WhatsApp'];
};

// Igual que el formulario de la clienta: estos datos los pide el sistema por su cuenta
export const isNativeDuplicateField = (campo: { id: string; label: string; sistema?: boolean }) => {
  if (campo.sistema) return true;
  const id = (campo.id || '').toLowerCase();
  const lbl = (campo.label || '').toLowerCase();
  if (['c-shalom-dni', 'c-shalom-tel', 'c-olva-dni', 'c-olva-tel', 'c-olva-dir', 'c-mot-nombre', 'c-mot-tel', 'c-mot-ref'].includes(id)) return true;
  if (lbl.includes('dni') || lbl.includes('carnet') || lbl.includes('documento')) return true;
  if (lbl.includes('teléfono') || lbl.includes('telefono') || lbl.includes('celular') || lbl.includes('whatsapp')) return true;
  if (lbl.includes('nombres y apellidos') || lbl.includes('nombre completo')) return true;
  if (lbl.includes('dirección') || lbl.includes('direccion') || lbl.includes('agencia olva') || lbl.includes('agencia shalom')) return true;
  return false;
};

// Paso 3: el formulario que llena la clienta
export const FormPreview: React.FC<{ draft: AgencyDraft; live: MetodoEnvio; highlightKey?: string }> = ({ draft, live, highlightKey }) => {
  const extras = draft.campos.filter(c => !isNativeDuplicateField(c));
  return (
    <PhoneFrame title="Formulario de tu clienta">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">Siempre se pide</p>
        {[...nativeFieldsFor(live), '👤 Nombres y apellidos', '📅 Fecha de envío'].map(f => (
          <div key={f} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[13px] text-slate-300">
            <span>{f}</span>
            <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          </div>
        ))}
        {extras.length > 0 && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 px-1 pt-2">Tus preguntas</p>
        )}
        {extras.map(c => (
          <div
            key={c.id}
            className={`space-y-1 rounded-xl transition-all ${highlightKey === `campo:${c.id}` ? 'ring-2 ring-indigo-400 bg-indigo-500/15 p-1.5 animate-scaleUp' : ''}`}
          >
            <p className="text-[13px] font-bold text-white px-1">
              {c.label} {c.requerido && <span className="text-rose-400">*</span>}
            </p>
            <div className={`px-3 rounded-xl bg-white/5 border border-indigo-400/30 text-[13px] text-slate-500 ${c.tipo === 'textarea' ? 'py-3 min-h-14' : 'py-2.5'}`}>
              {c.placeholder || 'Escribe aquí…'}
            </div>
          </div>
        ))}
        <div className="pt-2">
          <div className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 text-sm font-black text-center">Confirmar pedido</div>
        </div>
      </div>
    </PhoneFrame>
  );
};

// Reemplaza las variables con datos de ejemplo para que se lea como un mensaje real
const fillExample = (text: string, draft: AgencyDraft) => {
  let out = text;
  for (const v of VARIABLES_MENSAJE) out = out.split(v.token).join(v.ejemplo);
  const extras = draft.campos
    .filter(c => c.mostrar_en_comprobante && !isNativeDuplicateField(c))
    .map(c => `📌 *${c.label}:* ${c.placeholder?.replace(/^Ej:?\s*/i, '') || 'respuesta'}`)
    .join('\n');
  return out
    .replace(/{dni}/g, '72384910')
    .replace(/{telefono}/g, '+51 987 654 321')
    .replace(/{modalidad}/g, draft.nombre || 'Agencia')
    .replace(/{campos_adicionales}/g, extras);
};

// Convierte *negrita* de WhatsApp en negrita real
const renderWhatsappText = (text: string) =>
  text.split('\n').map((line, i) => (
    <React.Fragment key={i}>
      {line.split(/(\*[^*]+\*)/g).map((part, j) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <strong key={j}>{part.slice(1, -1)}</strong> : <React.Fragment key={j}>{part}</React.Fragment>
      )}
      {'\n'}
    </React.Fragment>
  ));

export const MSG_COLORS = { saludo: '#22d3ee', datos: '#94a3b8', despedida: '#f472b6' };

const PartTag: React.FC<{ n: number; color: string; label: string }> = ({ n, color, label }) => (
  <span className="inline-flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-wider" style={{ color }}>
    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-slate-950" style={{ backgroundColor: color }}>{n}</span>
    {label}
  </span>
);

// Paso 4: comprobante por WhatsApp, con sus 3 partes marcadas
export const WhatsAppPreview: React.FC<{ draft: AgencyDraft; companyName: string }> = ({ draft, companyName }) => {
  const full = construirMensajeComprobacion('·', '', draft.nombre);
  const datos = full.split(RECEIPT_DIVIDER).slice(1).join(RECEIPT_DIVIDER).trim();
  const saludo = draft.mensajeInicio.trim();
  const despedida = draft.mensajeFin.trim();
  return (
    <PhoneFrame tone="whatsapp">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-black">
          {(companyName || 'E').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{companyName || 'Tu negocio'}</p>
          <p className="text-[11px] text-emerald-400">en línea</p>
        </div>
      </div>
      <div className="ml-auto max-w-[96%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2.5 text-[13px] text-white leading-relaxed whitespace-pre-wrap break-words shadow space-y-2">
        <div className="rounded-lg border-l-4 bg-black/15 px-2 py-1.5" style={{ borderColor: MSG_COLORS.saludo }}>
          <PartTag n={1} color={MSG_COLORS.saludo} label="Saludo" />
          <div>{saludo ? renderWhatsappText(fillExample(saludo, draft)) : <em className="opacity-60">(vacío)</em>}</div>
        </div>
        <div className="rounded-lg border-l-4 bg-black/10 px-2 py-1.5" style={{ borderColor: MSG_COLORS.datos }}>
          <PartTag n={2} color={MSG_COLORS.datos} label="Datos automáticos" />
          <div className="text-emerald-50/90">{renderWhatsappText(fillExample(datos, draft).trim())}</div>
        </div>
        {despedida && (
          <div className="rounded-lg border-l-4 bg-black/15 px-2 py-1.5" style={{ borderColor: MSG_COLORS.despedida }}>
            <PartTag n={3} color={MSG_COLORS.despedida} label="Despedida" />
            <div>{renderWhatsappText(fillExample(despedida, draft))}</div>
          </div>
        )}
        <span className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70">
          12:45 <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
        </span>
      </div>
    </PhoneFrame>
  );
};

// Paso 5: el rótulo real, escalado para que siempre se vea completo
export const LabelPreview: React.FC<{ live: MetodoEnvio; pedido: Pedido; taller: TallerConfig }> = ({ live, pedido, taller }) => (
  <div className="rounded-3xl bg-white p-2 sm:p-3 shadow-2xl">
    <FitToWidth>
      <ShalomLabelPrint
        pedido={pedido}
        tallerConfig={taller}
        customMethodOverride={live}
        estiloRotuloOverride={live.config_rotulado?.estilo_rotulo}
        orientacionOverride={live.config_rotulado?.orientacion}
      />
    </FitToWidth>
  </div>
);
