import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Lock, Trash2, Upload, Check, X, ArrowRight, Settings2 } from 'lucide-react';
import { MetodoEnvio } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { useFeedback } from '../../context/FeedbackContext';
import { getAgencyDaysSummary } from '../../utils/agencyAvailability';
import { AgencyEditor, EditorStep } from './agencies/AgencyEditor';
import { AgencyLogo, isNativeDuplicateField } from './agencies/previews';
import { BigSwitch, inputClass } from './agencies/ui';
import { LOGO_PRESETS, COLOR_PRESETS, newAgencyMethod } from './agencies/agencyDraft';

// Se re-exportan para quien los use desde aquí
export {
  DEFAULT_INICIO_RECEIPT,
  DEFAULT_FIN_RECEIPT,
  construirMensajeComprobacion,
  parsearMensajeComprobante,
} from './agencies/agencyDraft';

const isSystemAgency = (m: MetodoEnvio) =>
  Boolean(m.es_sistema) || m.codigo === 'shalom' || m.codigo === 'olva' || m.id === 'met-shalom' || m.id === 'met-olva';

// ---------------------------------------------------------------------------
// Crear agencia: lo mínimo (nombre, logo, color) y luego directo a personalizar
// ---------------------------------------------------------------------------
const CreateAgencySheet: React.FC<{ onCancel: () => void; onCreate: (nombre: string, foto: string, color: string) => void }> = ({ onCancel, onCreate }) => {
  const { toast } = useFeedback();
  const [nombre, setNombre] = useState('');
  const [foto, setFoto] = useState('');
  const [color, setColor] = useState('#10b981');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add('hide-admin-dock', 'has-active-modal');
    return () => document.body.classList.remove('hide-admin-dock', 'has-active-modal');
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('Escribe el nombre de la agencia.', 'warning');
      return;
    }
    onCreate(nombre.trim(), foto, color);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn" onClick={onCancel} data-no-print="true">
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-agency-title"
        className="w-full max-w-lg max-h-[94dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-white/10 p-5 sm:p-6 space-y-5 pb-safe animate-slideUp sm:animate-scaleUp"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-agency-title" className="text-xl font-black text-white">Nueva agencia</h2>
            <p className="text-sm text-slate-400 mt-0.5">Solo 3 cosas. Lo demás lo ajustas después.</p>
          </div>
          <button type="button" onClick={onCancel} className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="new-agency-name" className="block text-sm font-bold text-slate-200">1. ¿Cómo se llama?</label>
          <input id="new-agency-name" type="text" autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Transportes Flores" className={`${inputClass} text-lg font-bold`} />
          <div className="flex flex-wrap gap-2">
            {['Transportes Flores', 'Marvisur', 'Recojo en tienda', 'Delivery propio'].map(s => (
              <button key={s} type="button" onClick={() => setNombre(s)} className="min-h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[13px] font-bold text-slate-300 hover:bg-white/10">
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-200">2. Elige un logo (opcional)</p>
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-cyan-400/50 text-cyan-300 flex flex-col items-center justify-center gap-1">
              <Upload className="w-5 h-5" />
              <span className="text-[11px] font-bold">Subir</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  toast('La imagen es muy pesada. Usa una de menos de 2 MB.', 'warning');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setFoto(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {foto.startsWith('data:') && (
              <div className="relative aspect-square rounded-2xl border-2 border-cyan-400 bg-white p-1.5">
                <img src={foto} alt="Tu logo" className="w-full h-full object-contain" />
              </div>
            )}
            {LOGO_PRESETS.slice(2, foto.startsWith('data:') ? 4 : 5).map(p => (
              <button
                key={p.url}
                type="button"
                onClick={() => setFoto(foto === p.url ? '' : p.url)}
                aria-pressed={foto === p.url}
                className={`relative aspect-square rounded-2xl border-2 bg-white p-1.5 ${foto === p.url ? 'border-cyan-400' : 'border-transparent'}`}
              >
                <img src={p.url} alt={p.label} className="w-full h-full object-contain" />
                {foto === p.url && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center"><Check className="w-3.5 h-3.5 stroke-[3]" /></span>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-200">3. Elige su color</p>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_PRESETS.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                aria-pressed={color === c.hex}
                aria-label={c.name}
                className={`w-11 h-11 rounded-full border-4 flex items-center justify-center ${color === c.hex ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
              >
                {color === c.hex && <Check className="w-5 h-5 text-white stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="w-full min-h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-base font-black flex items-center justify-center gap-2">
          Crear y personalizar <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Tarjeta de agencia
// ---------------------------------------------------------------------------
const AgencyCard: React.FC<{
  method: MetodoEnvio;
  onOpen: (step?: EditorStep) => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ method, onOpen, onToggle, onDelete }) => {
  const system = isSystemAgency(method);
  const color = method.color_borde || '#06b6d4';
  const preguntas = (method.campos_personalizados || []).filter(c => !isNativeDuplicateField(c)).length;
  const disenoRotulo = method.config_rotulado?.estilo_rotulo === 'eco_ink_saving' ? 'blanco y negro' : 'a color';
  const modo = method.disponibilidad?.modo_horario;
  const dias = modo === 'predeterminado' || (!modo && !method.disponibilidad?.dias_semana?.length)
    ? 'Mismos días que tu negocio'
    : getAgencyDaysSummary(method);

  return (
    <article className={`rounded-3xl border bg-slate-900/80 overflow-hidden flex flex-col transition-opacity ${method.activo ? 'border-white/10' : 'border-white/5 opacity-75'}`}>
      <div className="h-2" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col">
        <div className="flex items-start gap-3">
          <AgencyLogo method={method} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white leading-tight break-words">{method.nombre}</h3>
              {system && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Lock className="w-3 h-3" /> Oficial
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 leading-snug mt-0.5 line-clamp-2">{method.descripcion || 'Sin descripción'}</p>
          </div>
        </div>

        <ul className="space-y-1.5 text-sm text-slate-300">
          <li className="flex items-start gap-2"><span aria-hidden="true">📅</span><span className="min-w-0">{dias}</span></li>
          <li className="flex items-start gap-2"><span aria-hidden="true">📝</span><span>{preguntas === 0 ? 'Solo los datos básicos' : `${preguntas} ${preguntas === 1 ? 'pregunta extra' : 'preguntas extra'}`}</span></li>
          <li className="flex items-start gap-2"><span aria-hidden="true">🏷️</span><span>Rótulo {disenoRotulo}{method.config_rotulado?.bloques_personalizados?.length ? ` • ${method.config_rotulado.bloques_personalizados.length} aviso(s)` : ''}</span></li>
        </ul>

        <BigSwitch
          compact
          checked={method.activo}
          onChange={onToggle}
          label={method.activo ? 'Visible para tus clientas' : 'Oculta para tus clientas'}
        />

        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={() => onOpen()}
            className="w-full min-h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black flex items-center justify-center gap-2"
          >
            <Settings2 className="w-5 h-5" /> Personalizar
          </button>
          <div className="grid grid-cols-3 gap-2">
            {([
              { step: 'horario', label: '📅 Días' },
              { step: 'mensaje', label: '💬 Mensaje' },
              { step: 'rotulo', label: '🏷️ Rótulo' },
            ] as { step: EditorStep; label: string }[]).map(q => (
              <button key={q.step} type="button" onClick={() => onOpen(q.step)} className="min-h-11 rounded-xl bg-white/5 hover:bg-white/10 text-[13px] font-bold text-slate-200">
                {q.label}
              </button>
            ))}
          </div>
          {!system && (
            <button type="button" onClick={onDelete} className="w-full min-h-10 rounded-xl text-[13px] font-bold text-rose-300/80 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Eliminar agencia
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// Pantalla principal de Agencias
// ---------------------------------------------------------------------------
export const CompanyAgenciesTab: React.FC = () => {
  const { tallerConfig, shippingMethods, addShippingMethod, updateShippingMethod, deleteShippingMethod } = useOrders();
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState<{ id: string; step: EditorStep } | null>(null);
  const [creating, setCreating] = useState(false);

  const methods = [...(shippingMethods || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const editingMethod = editing ? methods.find(m => m.id === editing.id) || null : null;
  const visibles = methods.filter(m => m.activo).length;

  const handleToggle = (m: MetodoEnvio) => {
    if (m.activo && visibles <= 1) {
      toast('Debe quedar al menos una agencia visible para que tus clientas puedan pedir.', 'warning');
      return;
    }
    updateShippingMethod(m.id, { activo: !m.activo });
    toast(m.activo ? `"${m.nombre}" ya no aparece para tus clientas` : `"${m.nombre}" ya aparece para tus clientas`, 'info');
  };

  const handleDelete = async (m: MetodoEnvio) => {
    const ok = await confirm({
      title: `¿Eliminar "${m.nombre}"?`,
      message: 'Se borra su configuración. Los pedidos que ya tienes no se pierden.',
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    deleteShippingMethod(m.id);
    toast(`"${m.nombre}" eliminada`);
  };

  const handleCreate = (nombre: string, foto: string, color: string) => {
    const created = addShippingMethod(newAgencyMethod(nombre, foto, color, methods.length + 1));
    setCreating(false);
    toast(`"${created.nombre}" creada. Ahora elige qué días sale.`);
    setEditing({ id: created.id, step: 'horario' });
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Tus agencias de envío</h1>
          <p className="text-[15px] text-slate-400 mt-1 max-w-xl leading-snug">
            Elige con qué agencias envías y personaliza cada una: qué días sale, qué datos pide, el mensaje de WhatsApp y el rótulo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-12 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5" /> Agregar agencia
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {methods.map(m => (
          <AgencyCard
            key={m.id}
            method={m}
            onOpen={step => setEditing({ id: m.id, step: step || 'identidad' })}
            onToggle={() => handleToggle(m)}
            onDelete={() => handleDelete(m)}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-64 rounded-3xl border-2 border-dashed border-white/15 hover:border-cyan-400/60 hover:bg-cyan-500/5 text-slate-400 hover:text-cyan-300 flex flex-col items-center justify-center gap-3 transition-colors"
        >
          <span className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center"><Plus className="w-7 h-7" /></span>
          <span className="text-base font-black">Agregar otra agencia</span>
          <span className="text-sm max-w-[16rem] text-center">Ej: Marvisur, Flores, delivery propio o recojo en tienda</span>
        </button>
      </div>

      {creating && <CreateAgencySheet onCancel={() => setCreating(false)} onCreate={handleCreate} />}

      {editingMethod && editing && (
        <AgencyEditor
          key={editingMethod.id}
          method={editingMethod}
          taller={tallerConfig}
          companyName={tallerConfig.nombre_taller || 'Tu negocio'}
          initialStep={editing.step}
          onSave={updates => updateShippingMethod(editingMethod.id, updates)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
