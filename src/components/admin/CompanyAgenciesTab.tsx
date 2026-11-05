import React, { useState } from 'react';
import { Plus, ChevronRight, Lock } from 'lucide-react';
import { MetodoEnvio } from '../../types/database.types';
import { useOrders } from '../../context/OrderContext';
import { useFeedback } from '../../context/FeedbackContext';
import { getAgencyDaysSummary } from '../../utils/agencyAvailability';
import { AgencyEditor } from './agencies/AgencyEditor';
import { AddAgencySheet } from './agencies/AddAgencySheet';
import { AgencyLogo } from './agencies/previews';
import { IosSwitch } from './agencies/ui';
import { newAgencyMethod } from './agencies/agencyDraft';
import { AgencyTemplate, templateToMethod } from '../../data/agencyTemplates';

// Se re-exportan para quien los use desde aquí
export {
  DEFAULT_INICIO_RECEIPT,
  DEFAULT_FIN_RECEIPT,
  construirMensajeComprobacion,
  parsearMensajeComprobante,
} from './agencies/agencyDraft';

const isSystemAgency = (m: MetodoEnvio) =>
  Boolean(m.es_sistema) || m.codigo === 'shalom' || m.codigo === 'olva' || m.id === 'met-shalom' || m.id === 'met-olva';

const AgencyRow: React.FC<{ method: MetodoEnvio; onOpen: () => void; onToggle: () => void }> = ({ method, onOpen, onToggle }) => {
  const modo = method.disponibilidad?.modo_horario;
  const dias = modo === 'predeterminado' || (!modo && !method.disponibilidad?.dias_semana?.length) ? 'Mismos días que tu negocio' : getAgencyDaysSummary(method);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 min-h-[5rem]">
      <button type="button" onClick={onOpen} className="flex items-center gap-3.5 flex-1 min-w-0 text-left active:opacity-70" aria-label={`Configurar ${method.nombre}`}>
        <span className="relative shrink-0">
          <AgencyLogo method={method} size="lg" />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900" style={{ backgroundColor: method.color_borde || '#06b6d4' }} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`text-[17px] font-black leading-tight truncate ${method.activo ? 'text-white' : 'text-slate-400'}`}>{method.nombre}</span>
            {isSystemAgency(method) && <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="Oficial" />}
          </span>
          <span className="block text-[14px] text-slate-400 leading-snug mt-0.5 truncate">{method.activo ? `📅 ${dias}` : 'Oculta para tus clientas'}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
      </button>
      <IosSwitch checked={method.activo} onChange={onToggle} label={`${method.activo ? 'Ocultar' : 'Mostrar'} ${method.nombre}`} />
    </div>
  );
};

export const CompanyAgenciesTab: React.FC = () => {
  const { tallerConfig, shippingMethods, addShippingMethod, updateShippingMethod, deleteShippingMethod } = useOrders();
  const { toast, confirm } = useFeedback();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const methods = [...(shippingMethods || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const editingMethod = editingId ? methods.find(m => m.id === editingId) || null : null;
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
    setEditingId(null);
    deleteShippingMethod(m.id);
    toast(`"${m.nombre}" eliminada`);
  };

  const handleAddTemplate = (t: AgencyTemplate) => {
    const created = addShippingMethod(templateToMethod(t, tallerConfig, methods.length + 1));
    setAdding(false);
    toast(`¡Listo! ${created.nombre} ya está lista para usar.`);
    setEditingId(created.id);
  };

  const handleCreateCustom = (nombre: string, foto: string, color: string) => {
    const created = addShippingMethod(newAgencyMethod(nombre, foto, color, methods.length + 1));
    setAdding(false);
    toast(`"${created.nombre}" creada.`);
    setEditingId(created.id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-24">
      <header className="space-y-1.5 px-1">
        <h1 className="text-[32px] font-black text-white tracking-tight leading-tight">Agencias</h1>
        <p className="text-[16px] text-slate-400 leading-snug">
          Las agencias con las que envías. Prende o apaga las que ven tus clientas y toca una para personalizarla.
        </p>
      </header>

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full min-h-16 rounded-[1.5rem] bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 text-[18px] font-black flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/25 transition-all"
      >
        <Plus className="w-7 h-7 stroke-[3]" /> Agregar agencia
      </button>

      <section aria-label="Mis agencias" className="space-y-2">
        <h2 className="px-3 text-[13px] font-black uppercase tracking-wider text-slate-500">
          Mis agencias · {visibles} {visibles === 1 ? 'visible' : 'visibles'}
        </h2>
        <div className="rounded-[1.75rem] bg-slate-900/80 border border-white/10 divide-y divide-white/8 overflow-hidden">
          {methods.map(m => (
            <AgencyRow key={m.id} method={m} onOpen={() => setEditingId(m.id)} onToggle={() => handleToggle(m)} />
          ))}
        </div>
      </section>

      <p className="px-3 text-[14px] text-slate-500 leading-snug">
        💡 Los cambios se guardan solos y tus clientas los ven al instante.
      </p>

      {adding && (
        <AddAgencySheet
          methods={methods}
          onClose={() => setAdding(false)}
          onAddTemplate={handleAddTemplate}
          onCreateCustom={handleCreateCustom}
          onOpenExisting={m => { setAdding(false); setEditingId(m.id); }}
        />
      )}

      {editingMethod && (
        <AgencyEditor
          key={editingMethod.id}
          method={editingMethod}
          taller={tallerConfig}
          companyName={tallerConfig.nombre_taller || 'Tu negocio'}
          isSystem={isSystemAgency(editingMethod)}
          canHide={!editingMethod.activo || visibles > 1}
          onSave={updates => updateShippingMethod(editingMethod.id, updates)}
          onToggleActive={() => handleToggle(editingMethod)}
          onDelete={() => handleDelete(editingMethod)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
};
