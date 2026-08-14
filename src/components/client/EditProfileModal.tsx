import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { calculateLevel } from '../../data/achievementsList';
import {
  X,
  User,
  Phone,
  CreditCard,
  MapPin,
  Save,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const EditProfileModal: React.FC<Props> = ({ onClose }) => {
  const { currentUser, updateProfile } = useAuth();

  const [nombreCompleto, setNombreCompleto] = useState(
    currentUser?.nombre_completo || localStorage.getItem('incomi_saved_fullname') || ''
  );
  const [telefonoDefault, setTelefonoDefault] = useState(
    currentUser?.telefono_default || localStorage.getItem('incomi_saved_phone') || currentUser?.dni || ''
  );
  const [dniDefault, setDniDefault] = useState(
    currentUser?.dni_default || localStorage.getItem('incomi_saved_doc') || currentUser?.dni || ''
  );
  const [distritoDefault, setDistritoDefault] = useState(
    currentUser?.distrito_default || localStorage.getItem('incomi_saved_district') || ''
  );
  const [direccionDefault, setDireccionDefault] = useState(
    currentUser?.direccion_default || localStorage.getItem('incomi_saved_address') || ''
  );
  const [referenciaDefault, setReferenciaDefault] = useState(
    currentUser?.referencia_default || localStorage.getItem('incomi_saved_reference') || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const levelInfo = calculateLevel(currentUser?.puntos_xp || 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const ok = await updateProfile({
      nombre_completo: nombreCompleto.trim(),
      telefono_default: telefonoDefault.trim(),
      dni_default: dniDefault.trim(),
      distrito_default: distritoDefault.trim(),
      direccion_default: direccionDefault.trim(),
      referencia_default: referenciaDefault.trim(),
    });

    setIsSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-cyan-500/10 relative max-h-[90vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser?.avatar_url}
                alt={currentUser?.nombre_completo}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-cyan-400 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-cyan-500 text-white text-[9px] font-black">
                Nv.{levelInfo.nivel}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white leading-tight">
                Editar Perfil y Predeterminados
              </h3>
              <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {levelInfo.nombre} ({currentUser?.puntos_xp || 0} XP)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nota explicativa de auto-rellenado */}
        <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-2.5 text-xs text-cyan-200">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Los datos que guardes aquí se <strong>autocompletarán de forma predeterminada</strong> cada vez que registres un nuevo paquete de despacho.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Nombre Completo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nombre Completo Predeterminado *</span>
            </label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej. María Elena Pérez Torres"
              className="w-full px-4 py-3 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          {/* Celular / WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Predeterminado *</span>
              </label>
              <input
                type="tel"
                required
                value={telefonoDefault}
                onChange={(e) => setTelefonoDefault(e.target.value)}
                placeholder="Ej. 987654321"
                className="w-full px-4 py-3 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* DNI Predeterminado */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                <span>DNI / CE Predeterminado *</span>
              </label>
              <input
                type="text"
                required
                value={dniDefault}
                onChange={(e) => setDniDefault(e.target.value)}
                placeholder="Ej. 72345678"
                className="w-full px-4 py-3 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Distrito y Dirección para Motorizado */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              📍 Dirección Predeterminada de Entrega (Opcional)
            </span>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Distrito (Lima)
              </label>
              <input
                type="text"
                value={distritoDefault}
                onChange={(e) => setDistritoDefault(e.target.value)}
                placeholder="Ej. Miraflores / San Isidro / Los Olivos"
                className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Dirección Exacta
              </label>
              <input
                type="text"
                value={direccionDefault}
                onChange={(e) => setDireccionDefault(e.target.value)}
                placeholder="Ej. Av. Larco 1234, Dpto 402"
                className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Referencia
              </label>
              <input
                type="text"
                value={referenciaDefault}
                onChange={(e) => setReferenciaDefault(e.target.value)}
                placeholder="Ej. Timbre blanco, rejas negras"
                className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/15 rounded-2xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {savedSuccess ? (
              <div className="w-full py-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center justify-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>¡Perfil y datos predeterminados guardados!</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Datos Predeterminados'}</span>
                </button>
              </>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};
