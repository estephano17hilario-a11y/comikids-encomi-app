import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { lookupDni, getFuenteLabel } from '../../services/dniLookupService';
import {
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  AlertCircle,
  Package,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Shield,
  Truck
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  
  // Modes: 'register' or 'login'
  const [isRegisterMode, setIsRegisterMode] = useState(true);

  // Step state for registration: 1, 2, 3, 4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [dni, setDni] = useState('');
  const [edad, setEdad] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login Fields
  const [loginDni, setLoginDni] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // DNI Lookup state
  const [dniLookupLoading, setDniLookupLoading] = useState(false);
  const [dniVerifMsg, setDniVerifMsg] = useState<string | null>(null);
  const [dniVerifOk, setDniVerifOk] = useState(false);

  // Errors & Loading
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step navigation
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (step === 1) {
      if (!nombreCompleto.trim()) {
        setErrorMsg('Por favor ingresa tu nombre completo.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!dni.trim()) {
        setErrorMsg('Por favor ingresa tu DNI / Documento de Identidad.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!edad.trim() || parseInt(edad) <= 0) {
        setErrorMsg('Por favor ingresa tu edad.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      handleFinalRegister();
    }
  };

  const handleFinalRegister = async () => {
    if (!password.trim() || password.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setSubmitting(true);
    const res = await register(
      nombreCompleto.trim(),
      dni.trim(),
      edad ? parseInt(edad) : 0,
      password.trim()
    );
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Error al crear la cuenta.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loginDni.trim() || !loginPassword.trim()) {
      setErrorMsg('Ingresa tu DNI y contraseña.');
      return;
    }

    setSubmitting(true);
    const res = await login(loginDni.trim(), loginPassword.trim());
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'DNI o contraseña incorrectos.');
    }
  };

  const progressPercent = (step / 4) * 100;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-cyan-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-pink-500/15 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 p-0.5 shadow-xl shadow-cyan-500/30 mb-2.5">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-2xl">
              📦
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-linear-to-r from-cyan-400 via-sky-300 to-pink-300 bg-clip-text text-transparent">
            Encomi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Despacho y Envío de Mercadería (Shalom & Motorizado) • ComiKids
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isRegisterMode ? (
          /* =========================================================================
             MODO REGISTRO PASO A PASO (1/4 ➔ 4/4)
             ========================================================================= */
          <div className="space-y-5">
            
            {/* Progress Counter & Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-cyan-400 font-mono tracking-wider">
                  Paso {step} de 4
                </span>
                <span className="text-slate-400 text-[11px]">
                  {step === 1 && 'Tu Nombre'}
                  {step === 2 && 'Tu Identificación'}
                  {step === 3 && 'Tu Edad'}
                  {step === 4 && 'Tu Seguridad'}
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-500 to-pink-500 transition-all duration-500 shadow-md"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Step Question Box */}
            <form onSubmit={handleNextStep} className="space-y-4 pt-1">
              
              {/* STEP 1 (1/4): Nombre Completo */}
              {step === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <label className="block text-sm font-black text-white leading-tight">
                    ¿Cuál es tu nombre completo? 👋
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={nombreCompleto}
                    onChange={e => setNombreCompleto(e.target.value)}
                    placeholder="Ej. Valeria Mendoza"
                    className="w-full px-4 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
                  />
                </div>
              )}

              {/* STEP 2 (2/4): DNI / CE — con autocompletado de nombre */}
              {step === 2 && (
                <div className="space-y-3 animate-fadeIn">
                  <label className="block text-sm font-black text-white leading-tight">
                    ¿Cuál es tu DNI o Carnet de Extranjería? 🆔
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Si tienes DNI peruano (8 dígitos) buscamos tu nombre automáticamente
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      autoFocus
                      value={dni}
                      onChange={async e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setDni(val);
                        setDniVerifMsg(null);
                        setDniVerifOk(false);
                        // Trigger lookup solo para DNI de 8 dígitos
                        if (val.length === 8) {
                          setDniLookupLoading(true);
                          try {
                            const result = await lookupDni(val);
                            if (result.success && result.nombreCompleto) {
                              // Autocompletar nombre solo si el usuario no lo ha escrito
                              if (!nombreCompleto.trim() || nombreCompleto === dni) {
                                setNombreCompleto(result.nombreCompleto);
                              }
                              setDniVerifMsg(getFuenteLabel(result.fuente));
                              setDniVerifOk(true);
                            } else if (result.fuente === 'timeout') {
                              setDniVerifMsg('⏱ Sin respuesta — ingresa tu nombre manualmente');
                              setDniVerifOk(false);
                            } else {
                              setDniVerifMsg('ℹ️ No encontrado — ingresa tu nombre manualmente');
                              setDniVerifOk(false);
                            }
                          } finally {
                            setDniLookupLoading(false);
                          }
                        }
                      }}
                      placeholder="Ej. 74561234"
                      className="w-full px-4 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner font-mono pr-10"
                    />
                    {dniLookupLoading && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <svg className="animate-spin w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {dniVerifMsg && !dniLookupLoading && (
                    <p className={`text-[11px] font-semibold animate-fadeIn ${
                      dniVerifOk ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {dniVerifMsg}
                    </p>
                  )}
                </div>
              )}

              {/* STEP 3 (3/4): Edad */}
              {step === 3 && (
                <div className="space-y-3 animate-fadeIn">
                  <label className="block text-sm font-black text-white leading-tight">
                    ¿Cuál es tu edad? 🎂
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="100"
                    required
                    autoFocus
                    value={edad}
                    onChange={e => setEdad(e.target.value)}
                    placeholder="Ej. 24"
                    className="w-full px-4 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
                  />
                </div>
              )}

              {/* STEP 4 (4/4): Contraseña (con botón 👁️, sin confirmación) */}
              {step === 4 && (
                <div className="space-y-3 animate-fadeIn">
                  <label className="block text-sm font-black text-white leading-tight">
                    Crea tu contraseña de acceso 🔒
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Úsala para ingresar a tu cuenta cuando quieras
                  </p>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full pl-4 pr-12 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                      title={showPassword ? 'Ocultar' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setStep((step - 1) as 1 | 2 | 3 | 4);
                    }}
                    className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Atrás</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 px-5 rounded-2xl bg-linear-to-r from-cyan-500 via-blue-600 to-pink-500 hover:opacity-95 active:scale-95 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : step === 4 ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>¡Crear Mi Cuenta!</span>
                    </>
                  ) : (
                    <>
                      <span>Siguiente</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Link to Login on every step */}
            <div className="pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMsg('');
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ¿Ya tienes una cuenta? <strong className="underline ml-1">Inicia sesión aquí</strong>
              </button>
            </div>

          </div>
        ) : (
          /* =========================================================================
             MODO INICIAR SESIÓN (DNI + CONTRASEÑA CON 👁️)
             ========================================================================= */
          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fadeIn">
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                DNI / Documento de Identidad
              </label>
              <input
                type="text"
                required
                autoFocus
                value={loginDni}
                onChange={e => setLoginDni(e.target.value)}
                placeholder="Ingresa tu DNI registrado"
                className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-12 py-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-inner font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                  title={showLoginPassword ? 'Ocultar' : 'Ver contraseña'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-95 active:scale-95 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>

            {/* Link to Register */}
            <div className="pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setStep(1);
                  setErrorMsg('');
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ¿Aún no tienes cuenta? <strong className="underline ml-1">Crear Cuenta Paso a Paso</strong>
              </button>
            </div>

          </form>
        )}

      </div>

    </div>
  );
};
