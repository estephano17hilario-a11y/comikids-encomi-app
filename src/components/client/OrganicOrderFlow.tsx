import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { ordersService } from '../../services/ordersService';
import { useShalomAgencies, formatFullAgencyName } from '../../hooks/useShalomAgencies';
import { searchDistritos } from '../../data/distritosLima';
import { PlacesMapPicker } from './PlacesMapPicker';
import { MetodoEnvio, ShalomAgency } from '../../types/database.types';
import {
  Package,
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  MapPin,
  Phone,
  User,
  CreditCard,
  Building,
  Navigation,
  Compass,
  AlertCircle,
  LocateFixed,
  Clock,
  Search,
  X
} from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

export const OrganicOrderFlow: React.FC<Props> = ({ onSuccess }) => {
  const { createPedido, activeShippingMethods } = useOrders();
  const { currentUser, login, triggerConfetti } = useAuth();

  // Step state: 1 = WhatsApp, 2 = Método, 3 = Datos de Destino + Nombre
  const [organicStep, setOrganicStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [whatsapp, setWhatsapp] = useState(currentUser?.dni || '');
  const [selectedMethodId, setSelectedMethodId] = useState<string>(activeShippingMethods[0]?.id || 'met-shalom');

  // Shalom Hook & Branch Fields
  const {
    agencies: shalomAgenciesList,
    allAgencies,
    nearestAgency,
    loading: loadingAgencies,
    selectedDepartment: departamentoShalom,
    setSelectedDepartment: setDepartamentoShalom,
    searchQuery: agencySearchQuery,
    setSearchQuery: setAgencySearchQuery,
    availableDepartments,
    refreshLocation,
    userLocation
  } = useShalomAgencies({ initialDepartment: 'TODOS' });

  const [selectedAgencyObject, setSelectedAgencyObject] = useState<ShalomAgency | null>(null);
  const [dniShalom, setDniShalom] = useState(currentUser?.dni || '');

  // Motorizado Branch Fields
  const [distritoQuery, setDistritoQuery] = useState('');
  const [showDistritoSuggestions, setShowDistritoSuggestions] = useState(false);
  const [direccionExacta, setDireccionExacta] = useState('');
  const [referencia, setReferencia] = useState('');
  const [lat, setLat] = useState<number>(-12.1215);
  const [lng, setLng] = useState<number>(-77.0298);

  // Custom Method Text (if configured by Comikids)
  const [customDestinoText, setCustomDestinoText] = useState('');

  // Name (Common for all methods)
  const [nombreCompleto, setNombreCompleto] = useState(currentUser?.nombre_completo || '');

  // Secret Empresa Prompt
  const [isEmpresaUnlock, setIsEmpresaUnlock] = useState(false);
  const [empresaPassword, setEmpresaPassword] = useState('');

  // Status
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrderCode, setCreatedOrderCode] = useState<string | null>(null);

  const suggestedDistritos = searchDistritos(distritoQuery);

  // Auto-seleccionar primera agencia cuando cambia la lista
  useEffect(() => {
    if (shalomAgenciesList.length > 0 && !selectedAgencyObject) {
      setSelectedAgencyObject(shalomAgenciesList[0]);
    }
  }, [shalomAgenciesList, selectedAgencyObject]);

  // Si se detecta la agencia más cercana, seleccionarla
  const handleDetectNearestAgency = async () => {
    const coords = await refreshLocation();
    if (coords && nearestAgency) {
      setSelectedAgencyObject(nearestAgency);
      if (nearestAgency.departamento) {
        setDepartamentoShalom(nearestAgency.departamento);
      }
    }
  };

  useEffect(() => {
    if (currentUser) {
      setWhatsapp(currentUser.dni);
      setNombreCompleto(currentUser.nombre_completo);
    }
  }, [currentUser]);

  const selectedMethod: MetodoEnvio | undefined =
    activeShippingMethods.find(m => m.id === selectedMethodId) || activeShippingMethods[0];

  // --- STEP 1: WHATSAPP SUBMIT ---
  const handleWhatsappSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const clean = whatsapp.trim().replace(/\s+/g, '');
    if (!clean) {
      setErrorMsg('Por favor ingresa tu número de WhatsApp.');
      return;
    }

    if (clean.toUpperCase() === '42020312COMIKIDS') {
      setIsEmpresaUnlock(true);
      return;
    }

    if (clean.length < 8) {
      setErrorMsg('Por favor ingresa un número de WhatsApp válido.');
      return;
    }

    setOrganicStep(2);
  };

  // Secret Empresa Login
  const handleEmpresaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await login('42020312COMIKIDS', empresaPassword.trim());
    setSubmitting(false);
    if (!res.success) {
      setErrorMsg('Contraseña incorrecta para la cuenta Empresa.');
    }
  };

  // --- STEP 2: METHOD SELECTION ---
  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
    setOrganicStep(3);
  };

  // --- STEP 3: FINAL SUBMIT ---
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!nombreCompleto.trim()) {
      setErrorMsg('Por favor ingresa tu nombre y apellidos completos.');
      return;
    }

    if (selectedMethod?.tipo_formulario === 'shalom' && !dniShalom.trim()) {
      setErrorMsg('Por favor ingresa tu DNI o Carnet de Extranjería para recoger en Shalom.');
      return;
    }

    if (selectedMethod?.tipo_formulario === 'mapa_direccion') {
      if (!distritoQuery.trim()) {
        setErrorMsg('Por favor selecciona tu distrito en Lima.');
        return;
      }
      if (!direccionExacta.trim()) {
        setErrorMsg('Por favor ingresa tu dirección exacta.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let activeUser = currentUser;
      if (!activeUser) {
        const regRes = await ordersService.registerUser(
          nombreCompleto.trim(),
          whatsapp.trim(),
          20,
          'incomi2026'
        );
        if (regRes.user) {
          activeUser = regRes.user;
        } else {
          const logRes = await ordersService.loginUser(whatsapp.trim(), 'incomi2026');
          activeUser = logRes.user || null;
        }
        if (activeUser) {
          await login(whatsapp.trim(), 'incomi2026');
        }
      }

      let finalDestinoDetalle = '';
      let agencyLat = selectedAgencyObject?.latitude;
      let agencyLng = selectedAgencyObject?.longitude;

      if (selectedMethod?.tipo_formulario === 'shalom') {
        const fullAgencyStr = selectedAgencyObject ? formatFullAgencyName(selectedAgencyObject) : 'AGENCIA SHALOM CENTRAL';
        finalDestinoDetalle = `Agencia Shalom: ${fullAgencyStr} (DNI Recojo: ${dniShalom.trim()})`;
      } else if (selectedMethod?.tipo_formulario === 'mapa_direccion') {
        finalDestinoDetalle = `${distritoQuery.trim()} • ${direccionExacta.trim()}${referencia.trim() ? ` (Ref: ${referencia.trim()})` : ''}`;
      } else {
        finalDestinoDetalle = customDestinoText.trim() || 'Indicaciones de entrega';
      }

      const newOrder = await createPedido({
        usuario_id: activeUser?.id || 'usr-temp',
        usuario: activeUser || undefined,
        detalles_bordado: `Envío de Mercadería para ${nombreCompleto.trim()}`,
        metodo_envio_codigo: selectedMethod?.codigo || 'shalom',
        metodo_envio_nombre: selectedMethod?.nombre || 'Envío',
        destino_detalle: finalDestinoDetalle,
        latitud: selectedMethod?.tipo_formulario === 'shalom' ? (agencyLat ?? undefined) : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lat : undefined),
        longitud: selectedMethod?.tipo_formulario === 'shalom' ? (agencyLng ?? undefined) : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lng : undefined),
        observaciones_cliente: referencia.trim() || undefined,
        fecha_limite: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      });

      triggerConfetti();
      setCreatedOrderCode(newOrder.codigo_seguimiento);

      setTimeout(() => {
        setCreatedOrderCode(null);
        setOrganicStep(1);
        if (onSuccess) onSuccess();
      }, 2500);

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al registrar el envío. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto py-2">
      
      {/* Success Screen */}
      {createdOrderCode ? (
        <div className="minimal-card p-8 sm:p-12 text-center animate-fadeIn space-y-5">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/20">
            <CheckCircle className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-white tracking-tight">¡Envío Programado! 🎉</h3>
            <p className="text-sm text-slate-400">Tu orden de mercadería ha sido registrada:</p>
          </div>
          <div className="inline-block font-mono text-xl font-black px-6 py-3 rounded-2xl bg-white/[0.05] text-cyan-300 border border-white/10 shadow-inner">
            #{createdOrderCode}
          </div>
          <p className="text-xs text-slate-500">Abriendo el seguimiento en vivo...</p>
        </div>
      ) : isEmpresaUnlock ? (
        /* Secret Empresa Password Dialog */
        <div className="minimal-card p-8 sm:p-10 space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-2xl font-black text-white">Acceso Administradora</h3>
            <p className="text-sm text-slate-400 mt-1">Ingresa tu contraseña para acceder al panel de Comikids:</p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmpresaLogin} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              value={empresaPassword}
              onChange={e => setEmpresaPassword(e.target.value)}
              placeholder="••••••••"
              className="big-input text-lg"
            />
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEmpresaUnlock(false);
                  setWhatsapp('');
                }}
                className="py-4 px-6 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="big-btn-primary flex-1 text-base"
              >
                {submitting ? 'Ingresando...' : 'Entrar al Panel'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* =========================================================================
           ULTRA-MINIMALIST LARGE STEP WIZARD
           ========================================================================= */
        <div className="minimal-card p-6 sm:p-10 space-y-8 animate-fadeIn">
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                Paso {organicStep} de 3
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                {organicStep === 1 && '¿Cuál es tu WhatsApp?'}
                {organicStep === 2 && '¿Cómo deseas recibirlo?'}
                {organicStep === 3 && 'Datos de Entrega'}
              </h2>
            </div>

            {organicStep > 1 && (
              <button
                type="button"
                onClick={() => setOrganicStep((organicStep - 1) as 1 | 2)}
                className="py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* =====================================================================
              PASO 1: WHATSAPP (GRAN RECUADRO CON PREFIJO +51 FIJO)
              ===================================================================== */}
          {organicStep === 1 && (
            <form onSubmit={handleWhatsappSubmit} className="space-y-6 animate-fadeIn">
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Ingresa tu número para enviarte las fotos del paquete y el código de seguimiento.
                </p>
                
                {/* Contenedor Unificado con Prefijo +51 Fijo */}
                <div className="flex items-center rounded-2xl bg-white/[0.04] border border-white/10 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/20 transition-all p-1.5 shadow-inner">
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.06] rounded-xl text-white font-black text-base border border-white/10 shrink-0 select-none shadow-sm">
                    <span className="text-lg">🇵🇪</span>
                    <span className="font-mono text-cyan-300 font-black tracking-wider">+51</span>
                  </div>
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder="987 654 321"
                    className="w-full bg-transparent px-4 py-3 text-lg sm:text-xl font-bold font-mono text-white placeholder-slate-500 focus:outline-none tracking-wider"
                  />
                </div>
              </div>

              <button type="submit" className="big-btn-primary">
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* =====================================================================
              PASO 2: ¿CÓMO QUIERES RECIBIR TU PEDIDO? (RECUADROS GRANDES TÁCTILES)
              ===================================================================== */}
          {organicStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-sm text-slate-400">
                Selecciona la opción de transporte de tu preferencia:
              </p>

              <div className="grid grid-cols-1 gap-4">
                {activeShippingMethods.map((method) => {
                  const isShalom = method.tipo_formulario === 'shalom';
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handleMethodSelect(method.id)}
                      className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] hover:bg-cyan-500/[0.08] border border-white/[0.08] hover:border-cyan-400/50 text-left transition-all flex items-center justify-between group active:scale-[0.98] shadow-lg"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          {isShalom ? <Package className="w-8 h-8" /> : <Truck className="w-8 h-8" />}
                        </div>
                        <div>
                          <h4 className="text-lg sm:text-xl font-black text-white group-hover:text-cyan-300 transition-colors">
                            {method.nombre}
                          </h4>
                          <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            {method.descripcion}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              PASO 3: DATOS DE ENTREGA & NOMBRE (AMPLIO Y MODERNO)
              ===================================================================== */}
          {organicStep === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-6 animate-fadeIn">
              
              {/* RAMA A: AGENCIA SHALOM (Buscador Único sin Selects) */}
              {selectedMethod?.tipo_formulario === 'shalom' && (
                <div className="space-y-5">
                  {/* Botón de Geolocalización Inteligente GPS */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/25">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <LocateFixed className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Geolocalización GPS</p>
                        <p className="text-[11px] text-cyan-300/80">
                          {nearestAgency && nearestAgency.distance_meters !== undefined
                            ? `Sede más cercana: ${(nearestAgency.distance_meters / 1000).toFixed(1)} km`
                            : 'Detecta automáticamente la agencia Shalom más cercana a ti'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectNearestAgency}
                      disabled={loadingAgencies}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>{loadingAgencies ? 'Buscando...' : '📍 Usar mi GPS'}</span>
                    </button>
                  </div>

                  {/* Buscador de Agencia por Nombre, Distrito, Departamento o Código */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Buscar Agencia Shalom (Total: {allAgencies.length || 546} sedes) *
                      </label>
                      {agencySearchQuery && (
                        <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                          {shalomAgenciesList.length} encontrada{shalomAgenciesList.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={agencySearchQuery}
                        onChange={e => setAgencySearchQuery(e.target.value)}
                        placeholder="Escribe para buscar (ej. Gamarra, San Isidro, Trujillo, Arequipa, Cusco)..."
                        className="big-input pl-10 pr-10 text-sm"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      {agencySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setAgencySearchQuery('')}
                          className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Lista de Resultados Desplegable y Scrolleable (Sin cortes, acceso a las 546) */}
                    <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md">
                      {shalomAgenciesList.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-4">
                          No se encontraron agencias con &quot;{agencySearchQuery}&quot;
                        </p>
                      ) : (
                        shalomAgenciesList.map(ag => {
                          const isSelected = selectedAgencyObject?.id === ag.id;
                          const fullName = formatFullAgencyName(ag);
                          return (
                            <button
                              key={ag.id}
                              type="button"
                              onClick={() => {
                                setSelectedAgencyObject(ag);
                                if (ag.departamento) setDepartamentoShalom(ag.departamento);
                              }}
                              className={`w-full text-left p-3 rounded-xl text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 font-bold shadow-md shadow-cyan-500/10'
                                  : 'hover:bg-white/[0.06] border border-transparent text-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-bold leading-snug ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                                  {fullName}
                                </span>
                              </div>
                              {ag.horario && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>{ag.horario}</span>
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Tarjeta de Agencia Seleccionada */}
                  {selectedAgencyObject && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/70 to-slate-900/90 border border-cyan-500/40 space-y-2 text-xs text-slate-300 shadow-2xl">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5 leading-snug">
                          <Building className="w-4 h-4 text-cyan-400 shrink-0" />
                          {formatFullAgencyName(selectedAgencyObject)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] shrink-0">
                          SELECCIONADA
                        </span>
                      </div>

                      <div className="flex items-start gap-2 text-cyan-200">
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span><strong>Dirección:</strong> {selectedAgencyObject.direccion} ({selectedAgencyObject.distrito})</span>
                      </div>

                      {selectedAgencyObject.horario && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span><strong>Horario:</strong> {selectedAgencyObject.horario}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Campo DNI para recoger */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      DNI o Carnet de Extranjería (Para recoger en agencia) *
                    </label>
                    <input
                      type="text"
                      required
                      value={dniShalom}
                      onChange={e => setDniShalom(e.target.value)}
                      placeholder="Ej. 74561234"
                      className="big-input font-mono text-base font-bold"
                    />
                  </div>
                </div>
              )}

              {/* RAMA B: MOTORIZADO LOCAL LIMA */}
              {selectedMethod?.tipo_formulario === 'mapa_direccion' && (
                <div className="space-y-5">
                  {/* Distrito Inteligente */}
                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Distrito en Lima (Escribe para autocompletar) *
                      </label>
                      <span className="text-[11px] text-cyan-400 font-semibold">43 Distritos</span>
                    </div>

                    <input
                      type="text"
                      required
                      value={distritoQuery}
                      onFocus={() => setShowDistritoSuggestions(true)}
                      onChange={e => {
                        setDistritoQuery(e.target.value);
                        setShowDistritoSuggestions(true);
                      }}
                      placeholder="Ej: Miraflores, La Victoria, Surco, San Borja..."
                      className="big-input text-base font-medium"
                    />

                    {showDistritoSuggestions && (
                      <div className="absolute z-30 top-full mt-2 w-full bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto p-2">
                        <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-b border-white/[0.06]">
                          <span>Sugerencias ({suggestedDistritos.length}):</span>
                          <button
                            type="button"
                            onClick={() => setShowDistritoSuggestions(false)}
                            className="text-cyan-400 hover:underline font-bold"
                          >
                            Cerrar
                          </button>
                        </div>
                        {suggestedDistritos.map((d, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setDistritoQuery(d);
                              setShowDistritoSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/[0.08] text-sm text-slate-100 rounded-xl flex items-center justify-between transition-colors"
                          >
                            <span>{d}</span>
                            <span className="text-xs text-slate-500">Lima</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dirección Exacta */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Dirección Exacta (Calle, Avenida, Número, Dpto) *
                    </label>
                    <input
                      type="text"
                      required
                      value={direccionExacta}
                      onChange={e => setDireccionExacta(e.target.value)}
                      placeholder="Ej. Av. Larco 812, Dpto 402"
                      className="big-input text-base font-medium"
                    />
                  </div>

                  {/* Referencia */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Referencia de Llegada (Opcional)
                    </label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={e => setReferencia(e.target.value)}
                      placeholder="Ej. Frente al parque, rejas negras, tocar timbre 4"
                      className="big-input text-base"
                    />
                  </div>

                  {/* Mapa */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Vista en Mapa / Pin de Ubicación
                    </label>
                    <PlacesMapPicker
                      address={`${distritoQuery} ${direccionExacta}`.trim() || 'Lima, Perú'}
                      onAddressChange={(addr, newLat, newLng) => {
                        if (newLat && newLng) {
                          setLat(newLat);
                          setLng(newLng);
                        }
                      }}
                      lat={lat}
                      lng={lng}
                    />
                  </div>
                </div>
              )}

              {/* RAMA C: PERSONALIZADO */}
              {selectedMethod?.tipo_formulario === 'texto_simple' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Lugar o indicaciones de entrega:
                  </label>
                  <input
                    type="text"
                    required
                    value={customDestinoText}
                    onChange={e => setCustomDestinoText(e.target.value)}
                    placeholder="Ej. Recojo presencial en almacén..."
                    className="big-input text-base"
                  />
                </div>
              )}

              {/* NOMBRE COMPLETO */}
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Nombre Completo y Apellidos del Destinatario *
                </label>
                <input
                  type="text"
                  required
                  value={nombreCompleto}
                  onChange={e => setNombreCompleto(e.target.value)}
                  placeholder="Ej. Valeria Mendoza Flores"
                  className="big-input text-lg font-bold"
                />
              </div>

              {/* BOTÓN GIGANTE DE CONFIRMACIÓN */}
              <button
                type="submit"
                disabled={submitting}
                className="big-btn-primary pt-4 pb-4 text-lg mt-4"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Programando Envío...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Confirmar & Despachar Mercadería 🚀</span>
                  </>
                )}
              </button>

            </form>
          )}

        </div>
      )}

    </div>
  );
};
