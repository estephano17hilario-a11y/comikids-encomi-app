import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  Calendar,
  ShoppingBag,
  Briefcase,
  Store
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const AdditionalDataModal: React.FC<Props> = ({ onClose }) => {
  const { currentUser, updateAdditionalData } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [genero, setGenero] = useState<'masculino' | 'femenino' | 'otro'>(
    currentUser?.genero || 'femenino'
  );
  const [edad, setEdad] = useState<number>(currentUser?.edad || 24);
  const [motivoCompra, setMotivoCompra] = useState<'uso_personal' | 'emprender' | 'empresa'>(
    currentUser?.motivo_compra || 'uso_personal'
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as 2 | 3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    await updateAdditionalData({
      genero,
      edad: Number(edad) || 20,
      motivo_compra: motivoCompra,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-500/10 relative space-y-5">
        
        {/* Header con advertencia de importancia */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/25 px-2.5 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1 shadow-sm">
                  <span>⚡</span>
                  <span>Registre y gane 100 de XP</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Paso {step} de 3</span>
              </div>
              <h3 className="text-lg font-black text-white leading-snug mt-0.5">
                Datos Adicionales
              </h3>
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

        {/* Barra de Progreso */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-amber-400 to-cyan-400 transition-all duration-300 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Paso 1: Género */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                <span>1. Selecciona tu Género</span>
              </label>
              <p className="text-xs text-slate-400">
                Nos ayuda a personalizar las sugerencias de tus prendas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setGenero('femenino')}
                className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all text-left cursor-pointer ${
                  genero === 'femenino'
                    ? 'bg-pink-500/15 border-pink-500 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👩</span>
                  <div>
                    <p className="text-sm font-black">Femenino</p>
                    <p className="text-[11px] text-slate-400">Mujer</p>
                  </div>
                </div>
                {genero === 'femenino' && <CheckCircle2 className="w-5 h-5 text-pink-400" />}
              </button>

              <button
                type="button"
                onClick={() => setGenero('masculino')}
                className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all text-left cursor-pointer ${
                  genero === 'masculino'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👨</span>
                  <div>
                    <p className="text-sm font-black">Masculino</p>
                    <p className="text-[11px] text-slate-400">Hombre</p>
                  </div>
                </div>
                {genero === 'masculino' && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
              </button>

              <button
                type="button"
                onClick={() => setGenero('otro')}
                className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all text-left cursor-pointer ${
                  genero === 'otro'
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="text-sm font-black">Prefiero no especificar</p>
                    <p className="text-[11px] text-slate-400">Otro / Neutro</p>
                  </div>
                </div>
                {genero === 'otro' && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: Edad */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>2. Ingresa tu Edad</span>
              </label>
              <p className="text-xs text-slate-400">
                Escribe tu edad en el siguiente recuadro:
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/4 border border-white/10 space-y-2">
              <input
                type="number"
                min="10"
                max="100"
                value={edad || ''}
                onChange={(e) => setEdad(e.target.value ? Number(e.target.value) : 0)}
                placeholder="Ej. 24"
                className="w-full px-5 py-4 bg-white/6 border-2 border-white/15 rounded-2xl text-center text-3xl font-mono font-black text-amber-400 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 shadow-inner"
              />
            </div>
          </div>
        )}

        {/* Paso 3: Motivo de compra */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-cyan-400" />
                <span>3. ¿Cuál es el motivo de tu pedido?</span>
              </label>
              <p className="text-xs text-slate-400">
                Selecciona la opción que mejor describa tu compra:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setMotivoCompra('uso_personal')}
                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left cursor-pointer ${
                  motivoCompra === 'uso_personal'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black">Uso personal</p>
                    <p className="text-[11px] text-slate-400">Para mi propio uso o regalo familiar</p>
                  </div>
                </div>
                {motivoCompra === 'uso_personal' && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
              </button>

              <button
                type="button"
                onClick={() => setMotivoCompra('emprender')}
                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left cursor-pointer ${
                  motivoCompra === 'emprender'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black">Para Venta</p>
                    <p className="text-[11px] text-slate-400">Para revender, emprender o negocio</p>
                  </div>
                </div>
                {motivoCompra === 'emprender' && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </button>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 ml-auto cursor-pointer"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleFinish}
              className="px-6 py-3 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 ml-auto disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Finalizar y Guardar'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
