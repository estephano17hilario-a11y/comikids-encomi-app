import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { ordersService } from '../../services/ordersService';
import { useShalomAgencies, formatFullAgencyName, cleanAddressText } from '../../hooks/useShalomAgencies';
import { searchDistritos } from '../../data/distritosLima';
import { PlacesMapPicker } from './PlacesMapPicker';
import { ShalomAgenciesMap } from './ShalomAgenciesMap';
import { MetodoEnvio, ShalomAgency, Pedido } from '../../types/database.types';
import {
  Package,
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  MapPin,
  Building,
  Navigation,
  AlertCircle,
  Clock,
  Search,
  X,
  User,
  ChevronDown,
  MessageCircle,
  FileCheck2,
  RotateCcw,
  Maximize2
} from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

/**
 * Componente que resalta las letras coincidentes con la búsqueda (sin subrayado)
 */
const HighlightMatch: React.FC<{ text: string; query: string; className?: string }> = ({
  text,
  query,
  className = ''
}) => {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const q = query.trim();
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <span
              key={idx}
              className="font-bold text-cyan-300 bg-cyan-400/20 px-1 py-0.5 rounded"
            >
              {part}
            </span>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  } catch {
    return <span className={className}>{text}</span>;
  }
};

export const OrganicOrderFlow: React.FC<Props> = ({ onSuccess }) => {
  const { createPedido, activeShippingMethods, tallerConfig } = useOrders();
  const { currentUser, login, triggerConfetti } = useAuth();

  // Step state: 1 = WhatsApp, 2 = Método, 3 = Datos de Destino + Nombre
  const [organicStep, setOrganicStep] = useState<1 | 2 | 3>(1);

  // Form Fields con Auto-Persistencia LocalStorage
  const [whatsapp, setWhatsapp] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_phone') || currentUser?.dni || '';
  });

  const [nombreCompleto, setNombreCompleto] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_fullname') || currentUser?.nombre_completo || '';
  });

  const [dniShalom, setDniShalom] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_doc') || currentUser?.dni || '';
  });

  const [distritoQuery, setDistritoQuery] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_district') || '';
  });

  const [direccionExacta, setDireccionExacta] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_address') || '';
  });

  const [referencia, setReferencia] = useState<string>(() => {
    return localStorage.getItem('incomi_saved_reference') || '';
  });

  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    activeShippingMethods[0]?.id || 'met-shalom'
  );

  // Auto-guardado en LocalStorage cuando cambian los campos
  useEffect(() => {
    if (whatsapp) localStorage.setItem('incomi_saved_phone', whatsapp);
  }, [whatsapp]);

  useEffect(() => {
    if (nombreCompleto) localStorage.setItem('incomi_saved_fullname', nombreCompleto);
  }, [nombreCompleto]);

  useEffect(() => {
    if (dniShalom) localStorage.setItem('incomi_saved_doc', dniShalom);
  }, [dniShalom]);

  useEffect(() => {
    if (distritoQuery) localStorage.setItem('incomi_saved_district', distritoQuery);
  }, [distritoQuery]);

  useEffect(() => {
    if (direccionExacta) localStorage.setItem('incomi_saved_address', direccionExacta);
  }, [direccionExacta]);

  useEffect(() => {
    if (referencia) localStorage.setItem('incomi_saved_reference', referencia);
  }, [referencia]);

  // Shalom Hook
  const {
    agencies: shalomAgenciesList,
    isLocating,
    gpsError,
    userLocation,
    setSelectedDepartment: setDepartamentoShalom,
    searchQuery: agencySearchQuery,
    setSearchQuery: setAgencySearchQuery,
    showOnlyNearest5,
    setShowOnlyNearest5,
    triggerGpsLookup,
    getTopNearestAgencies
  } = useShalomAgencies({ initialDepartment: 'TODOS' });

  const [selectedAgencyObject, setSelectedAgencyObject] = useState<ShalomAgency | null>(null);
  const [isAgencyListOpen, setIsAgencyListOpen] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showMotorizadoMapModal, setShowMotorizadoMapModal] = useState(false);

  // Motorizado Branch Coordinates
  const [showDistritoSuggestions, setShowDistritoSuggestions] = useState(false);
  const [lat, setLat] = useState<number>(-12.1215);
  const [lng, setLng] = useState<number>(-77.0298);

  // Custom Method Text
  const [customDestinoText, setCustomDestinoText] = useState('');

  // Secret Empresa Prompt
  const [isEmpresaUnlock, setIsEmpresaUnlock] = useState(false);
  const [empresaPassword, setEmpresaPassword] = useState('');

  // Status & Resumen de Pedido Creado
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Pedido | null>(null);

  const suggestedDistritos = searchDistritos(distritoQuery);

  // Auto-seleccionar primera agencia por defecto si no hay ninguna
  useEffect(() => {
    if (shalomAgenciesList.length > 0 && !selectedAgencyObject) {
      setSelectedAgencyObject(shalomAgenciesList[0]);
    }
  }, [shalomAgenciesList, selectedAgencyObject]);

  // Acción rápida: Buscar 5 Sedes Más Cercanas con GPS
  const handleQuickNearest5 = async () => {
    if (!userLocation) {
      const res = await triggerGpsLookup();
      if (res.coords) {
        setShowOnlyNearest5(true);
        if (res.nearest) {
          setSelectedAgencyObject(res.nearest);
        }
        setIsAgencyListOpen(true);
      }
    } else {
      setShowOnlyNearest5(true);
      const top5 = getTopNearestAgencies(5);
      if (top5.length > 0) {
        setSelectedAgencyObject(top5[0]);
      }
      setIsAgencyListOpen(true);
    }
  };

  const selectedMethod: MetodoEnvio | undefined =
    activeShippingMethods.find(m => m.id === selectedMethodId) || activeShippingMethods[0];

  const whatsappTallerNumber = (tallerConfig?.whatsapp_pedidos || '51987654321').replace(/\D/g, '');

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

    // Persistir teléfono
    localStorage.setItem('incomi_saved_phone', whatsapp.trim());
    setOrganicStep(2);
  };

  // Secret Empresa Login
  const handleEmpresaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await ordersService.loginUser('admin', empresaPassword);
      if (res.user && res.user.rol === 'empresa') {
        await login('admin', empresaPassword);
        window.location.reload();
      } else {
        setErrorMsg('Contraseña de administrador incorrecta.');
      }
    } catch {
      setErrorMsg('Error al autenticar acceso administrativo.');
    }
  };

  // --- STEP 2: METHOD SELECTION ---
  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
    setOrganicStep(3);
  };

  // --- STEP 3: FINAL CONFIRMATION ---
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!nombreCompleto.trim()) {
      setErrorMsg('Por favor ingresa tu Nombre Completo.');
      return;
    }

    if (selectedMethod?.tipo_formulario === 'shalom') {
      if (!selectedAgencyObject) {
        setErrorMsg('Por favor selecciona una Agencia Shalom de destino.');
        return;
      }
      if (!dniShalom.trim()) {
        setErrorMsg('Por favor ingresa tu DNI o Carnet de Extranjería (CE).');
        return;
      }
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

    // Persistir todos los datos
    localStorage.setItem('incomi_saved_fullname', nombreCompleto.trim());
    localStorage.setItem('incomi_saved_doc', dniShalom.trim());
    if (distritoQuery) localStorage.setItem('incomi_saved_district', distritoQuery.trim());
    if (direccionExacta) localStorage.setItem('incomi_saved_address', direccionExacta.trim());
    if (referencia) localStorage.setItem('incomi_saved_reference', referencia.trim());

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
      let agencyLat = selectedAgencyObject?.latitude ? Number(selectedAgencyObject.latitude) : undefined;
      let agencyLng = selectedAgencyObject?.longitude ? Number(selectedAgencyObject.longitude) : undefined;

      if (selectedMethod?.tipo_formulario === 'shalom') {
        const fullAgencyStr = selectedAgencyObject ? formatFullAgencyName(selectedAgencyObject) : 'AGENCIA SHALOM CENTRAL';
        finalDestinoDetalle = `Agencia Shalom: ${fullAgencyStr} (DNI/CE Recojo: ${dniShalom.trim()})`;
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
        latitud: selectedMethod?.tipo_formulario === 'shalom' ? agencyLat : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lat : undefined),
        longitud: selectedMethod?.tipo_formulario === 'shalom' ? agencyLng : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lng : undefined),
        observaciones_cliente: referencia.trim() || undefined,
        fecha_limite: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      });

      triggerConfetti();
      setCreatedOrder(newOrder);

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al registrar el envío. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Construir mensaje predefinido para WhatsApp
  const buildWhatsAppMessage = (order: Pedido) => {
    let destinoTexto = order.destino_detalle;
    if (selectedMethod?.tipo_formulario === 'shalom' && selectedAgencyObject) {
      destinoTexto = formatFullAgencyName(selectedAgencyObject);
    }

    return (
      `¡Hola Comikids! 👋 Acabo de registrar mi envío de mercadería en la web:\n\n` +
      `📦 *Código:* #${order.codigo_seguimiento}\n` +
      `👤 *Destinatario:* ${nombreCompleto.trim()}\n` +
      `📱 *WhatsApp:* +51 ${whatsapp.trim()}\n` +
      `🪪 *DNI / CE:* ${dniShalom.trim() || 'No especificado'}\n` +
      `🚚 *Método:* ${selectedMethod?.nombre || 'Agencia Shalom'}\n` +
      `📍 *Destino:* ${destinoTexto}\n\n` +
      `Adjunto aquí mi comprobante de pago para proceder con el rotulado y despacho. ¡Muchas gracias!`
    );
  };

  const whatsappUrl = createdOrder
    ? `https://wa.me/${whatsappTallerNumber}?text=${encodeURIComponent(buildWhatsAppMessage(createdOrder))}`
    : '#';

  return (
    <div className="w-full max-w-xl mx-auto py-2 font-sans tracking-tight space-y-4">
      


      {/* Modal de Mapa Apple Vision Pro con Buscador Sincronizado */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Mapa de Agencias Shalom</h3>
                <p className="text-xs text-slate-400">Busca o toca cualquier pin en el mapa para seleccionarla</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ShalomAgenciesMap
              agencies={shalomAgenciesList}
              selectedAgency={selectedAgencyObject}
              onSelectAgency={(agency) => {
                setSelectedAgencyObject(agency);
                if (agency.departamento) setDepartamentoShalom(agency.departamento);
                setShowMapModal(false);
                setIsAgencyListOpen(false);
              }}
              userLocation={userLocation}
              onRequestLocation={triggerGpsLookup}
              isLocating={isLocating}
              onClose={() => setShowMapModal(false)}
              searchQuery={agencySearchQuery}
              onSearchChange={setAgencySearchQuery}
            />
          </div>
        </div>
      )}

      {/* Modal de Mapa Apple Vision Pro para Motorizado (Pantalla Completa) */}
      {showMotorizadoMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Ubicar Domicilio en el Mapa</h3>
                <p className="text-xs text-slate-400">Busca tu calle o mueve el pin hasta la puerta exacta de tu domicilio</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMotorizadoMapModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PlacesMapPicker
              initialLat={lat}
              initialLng={lng}
              initialAddress={direccionExacta}
              initialDistrict={distritoQuery}
              isModal={true}
              onCloseModal={() => setShowMotorizadoMapModal(false)}
              onConfirmLocation={({ district, address: confirmedAddr, lat: newLat, lng: newLng }) => {
                if (district) {
                  setDistritoQuery(district);
                  localStorage.setItem('incomi_saved_district', district);
                }
                if (confirmedAddr) {
                  setDireccionExacta(confirmedAddr);
                  localStorage.setItem('incomi_saved_address', confirmedAddr);
                }
                setLat(newLat);
                setLng(newLng);
                setShowMotorizadoMapModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Pantalla Final: Resumen Completo + Envío Obligatorio de Comprobante por WhatsApp */}
      {createdOrder ? (
        <div className="minimal-card p-6 sm:p-10 text-center animate-fadeIn space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/20">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">¡Envío Registrado con Éxito! 🎉</h3>
            <p className="text-xs sm:text-sm text-slate-400">Tu orden ha sido generada en el sistema:</p>
            <div className="inline-block font-mono text-lg font-bold px-5 py-2 rounded-2xl bg-white/[0.06] text-cyan-300 border border-white/10 shadow-inner mt-1">
              #{createdOrder.codigo_seguimiento}
            </div>
          </div>

          {/* Recuadro Cupertino de Resumen Completo */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white/[0.04] border border-white/10 text-left space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-cyan-400" />
                Resumen de Envío
              </span>
              <span className="text-xs font-semibold text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                {selectedMethod?.nombre}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">👤 Destinatario:</span>
                <span className="text-white font-bold text-sm">{nombreCompleto}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">📱 WhatsApp:</span>
                <span className="text-white font-bold text-sm">+51 {whatsapp}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">🪪 DNI o CE de Recojo:</span>
                <span className="text-white font-bold text-sm">{dniShalom || 'No especificado'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">🚚 Tipo de Envío:</span>
                <span className="text-white font-bold text-sm">{selectedMethod?.nombre}</span>
              </div>
            </div>

            {/* Detalle de Agencia Shalom en Formato Optimizado */}
            {selectedMethod?.tipo_formulario === 'shalom' && selectedAgencyObject && (
              <div className="pt-2 border-t border-white/[0.06] text-xs space-y-1">
                <span className="text-slate-400 font-medium block">📦 Agencia Shalom de Destino:</span>
                <p className="text-white font-bold leading-snug">
                  {formatFullAgencyName(selectedAgencyObject)}
                </p>
                {selectedAgencyObject.horario && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{selectedAgencyObject.horario}</span>
                  </p>
                )}
              </div>
            )}

            {selectedMethod?.tipo_formulario === 'mapa_direccion' && (
              <div className="pt-2 border-t border-white/[0.06] text-xs space-y-1">
                <span className="text-slate-400 font-medium block">📍 Dirección de Entrega:</span>
                <p className="text-white font-bold">
                  {distritoQuery} • {direccionExacta} {referencia ? `(Ref: ${referencia})` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Aviso Importante de Envío de Comprobante */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left flex items-start gap-3 text-xs text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Paso Obligatorio:</strong> Para confirmar y procesar tu despacho, debes enviar el comprobante de pago con este resumen al WhatsApp oficial de Comikids.
            </p>
          </div>

          {/* Botón Grande y Llamativo de WhatsApp */}
          <div className="space-y-3 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-base font-bold flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <MessageCircle className="w-6 h-6 fill-current" />
              <span>Enviar Comprobante por WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setCreatedOrder(null);
                setOrganicStep(1);
                if (onSuccess) onSuccess();
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto py-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Registrar otro pedido</span>
            </button>
          </div>

        </div>
      ) : isEmpresaUnlock ? (
        /* Admin Login */
        <div className="minimal-card p-6 sm:p-8 animate-fadeIn space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Panel de Administración</h3>
              <p className="text-xs text-slate-400">Ingresa la clave de acceso</p>
            </div>
          </div>

          <form onSubmit={handleEmpresaLogin} className="space-y-4">
            <input
              type="password"
              autoFocus
              required
              value={empresaPassword}
              onChange={e => setEmpresaPassword(e.target.value)}
              placeholder="Contraseña..."
              className="big-input text-center text-lg"
            />
            {errorMsg && (
              <p className="text-xs text-rose-400 text-center font-semibold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {errorMsg}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsEmpresaUnlock(false)}
                className="big-btn-secondary w-1/3"
              >
                Cancelar
              </button>
              <button type="submit" className="big-btn-primary w-2/3">
                Ingresar
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Flow Container */
        <div className="minimal-card p-5 sm:p-7 space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-3 py-1 rounded-full border border-white/10">
                Paso {organicStep} de 3
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1.5 tracking-tight">
                {organicStep === 1 && 'Envío de Mercadería 📦'}
                {organicStep === 2 && '¿Cómo deseas recibir tu pedido? 🚚'}
                {organicStep === 3 && (
                  selectedMethod?.tipo_formulario === 'shalom' ? (
                    <span className="flex items-center gap-1.5">
                      <span>Envío</span>
                      <span className="text-red-500 font-black tracking-wide drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">SHALOM</span>
                      <span>📦</span>
                    </span>
                  ) : selectedMethod?.tipo_formulario === 'mapa_direccion' ? (
                    <span>Envío por Motorizado 🛵</span>
                  ) : (
                    <span>Datos de Entrega & Destinatario 📍</span>
                  )
                )}
              </h2>
            </div>
            {organicStep > 1 && (
              <button
                type="button"
                onClick={() => setOrganicStep((prev) => (prev - 1) as 1 | 2)}
                className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* =====================================================================
              PASO 1: WHATSAPP (CON MEMORIA AUTO-GUARDADA)
              ===================================================================== */}
          {organicStep === 1 && (
            <form onSubmit={handleWhatsappSubmit} className="space-y-5 animate-fadeIn">
              <div className="space-y-2.5">
                <p className="text-xs sm:text-sm text-slate-400">
                  Ingresa tu número de WhatsApp para enviarte las fotos del paquete y el código de seguimiento:
                </p>
                
                <div className="flex items-center rounded-2xl bg-white/[0.04] border border-white/10 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/20 transition-all p-1.5 shadow-inner">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white/[0.06] rounded-xl text-white font-bold text-base border border-white/10 shrink-0 select-none">
                    <span className="text-lg">🇵🇪</span>
                    <span className="font-mono text-cyan-300 font-bold">+51</span>
                  </div>
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder="987 654 321"
                    className="w-full bg-transparent px-3 py-2.5 text-base sm:text-lg font-bold font-mono text-white placeholder-slate-500 focus:outline-none tracking-wider"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button type="submit" className="big-btn-primary py-3.5">
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* =====================================================================
              PASO 2: SELECCIÓN DE MÉTODO (CON LOGO OFICIAL DE SHALOM)
              ===================================================================== */}
          {organicStep === 2 && (
            <div className="space-y-3.5 animate-fadeIn">
              <p className="text-xs sm:text-sm text-slate-400">
                Selecciona la opción de transporte de tu preferencia:
              </p>

              <div className="grid grid-cols-1 gap-3">
                {activeShippingMethods.map((method) => {
                  const isShalom = method.tipo_formulario === 'shalom';
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handleMethodSelect(method.id)}
                      className="p-4 sm:p-5 rounded-3xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 text-left transition-all flex items-center justify-between group cursor-pointer shadow-lg"
                    >
                      <div className="flex items-center gap-3.5">
                        {isShalom ? (
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center p-2 group-hover:scale-105 transition-transform overflow-hidden shrink-0 shadow-inner">
                            <img src="/Shalom-Courier-Logo.webp" alt="Shalom Courier" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 text-cyan-400 flex items-center justify-center text-xl group-hover:scale-105 transition-transform shrink-0">
                            <Truck className="w-6 h-6" />
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {method.nombre}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {method.descripcion}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              PASO 3: DATOS DE ENTREGA & NOMBRE (COMPACTO CON EMOJIS)
              ===================================================================== */}
          {organicStep === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4 animate-fadeIn">
              
              {/* RAMA A: AGENCIA SHALOM */}
              {selectedMethod?.tipo_formulario === 'shalom' && (
                <div className="space-y-3.5">
                  
                  {/* Botones Compactos de Acción Superior */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleQuickNearest5}
                      disabled={isLocating}
                      className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 text-left transition-all flex items-center gap-2.5 group cursor-pointer shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                        <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">GPS</span>
                        <span className="block text-xs font-bold text-white">Sedes Cercanas</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 text-left transition-all flex items-center gap-2.5 group cursor-pointer shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">Visual</span>
                        <span className="block text-xs font-bold text-white">Ver en Mapa</span>
                      </div>
                    </button>
                  </div>

                  {gpsError && (
                    <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{gpsError}</span>
                    </div>
                  )}

                  {/* Selección de Agencia */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        📦 Agencia Shalom de Destino
                      </label>
                      {selectedAgencyObject && (
                        <button
                          type="button"
                          onClick={() => setIsAgencyListOpen(!isAgencyListOpen)}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          {isAgencyListOpen ? 'Cerrar selector' : 'Cambiar sede'}
                        </button>
                      )}
                    </div>

                    {/* Tarjeta Principal de la Agencia Seleccionada */}
                    {selectedAgencyObject && !isAgencyListOpen && (
                      <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-2xl shadow-lg space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                              <Building className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white leading-tight">
                                {selectedAgencyObject.distrito || selectedAgencyObject.nombre}
                              </h4>
                              <p className="text-[11px] font-medium text-slate-400">
                                {selectedAgencyObject.departamento} • {selectedAgencyObject.provincia}
                              </p>
                            </div>
                          </div>

                          {selectedAgencyObject.distance_meters !== undefined && (
                            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/25 shrink-0">
                              📍 {selectedAgencyObject.distance_meters < 1000 ? `${Math.round(selectedAgencyObject.distance_meters)} m` : `${(selectedAgencyObject.distance_meters / 1000).toFixed(1)} km`}
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-white/[0.06] space-y-1 text-xs text-slate-300">
                          <p className="leading-snug text-[11px]">
                            <strong className="text-white">📍 Dirección:</strong> {cleanAddressText(selectedAgencyObject.direccion, selectedAgencyObject.provincia, selectedAgencyObject.departamento)}
                          </p>
                          {selectedAgencyObject.horario && (
                            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{selectedAgencyObject.horario}</span>
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsAgencyListOpen(true)}
                          className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-cyan-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Buscar / Cambiar de Sede</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Buscador & Lista Compacta */}
                    {(isAgencyListOpen || !selectedAgencyObject) && (
                      <div className="space-y-2.5 animate-fadeIn">
                        
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            autoFocus
                            value={agencySearchQuery}
                            onChange={e => {
                              setAgencySearchQuery(e.target.value);
                              if (showOnlyNearest5) setShowOnlyNearest5(false);
                            }}
                            placeholder="Buscar por distrito o provincia (ej. Gamarra, San Isidro, Trujillo)..."
                            className="w-full pl-10 pr-9 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all font-medium"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                          {agencySearchQuery && (
                            <button
                              type="button"
                              onClick={() => setAgencySearchQuery('')}
                              className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center absolute right-2.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="max-h-[360px] overflow-y-auto space-y-2 p-2 rounded-2xl bg-slate-950/90 border border-white/10 shadow-2xl">
                          {shalomAgenciesList.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-6">
                              No se encontraron agencias con &quot;{agencySearchQuery}&quot;
                            </p>
                          ) : (
                            shalomAgenciesList.map(ag => {
                              const isSelected = selectedAgencyObject?.id === ag.id;
                              const cleanAddr = cleanAddressText(ag.direccion, ag.provincia, ag.departamento);
                              const distanceText = ag.distance_meters !== undefined
                                ? (ag.distance_meters < 1000 ? `${Math.round(ag.distance_meters)} m` : `${(ag.distance_meters / 1000).toFixed(1)} km`)
                                : null;

                              const titleText = `${ag.departamento || ''} / ${ag.provincia || ''} / ${ag.distrito || ag.nombre || ''}`;

                              return (
                                <button
                                  key={ag.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAgencyObject(ag);
                                    if (ag.departamento) setDepartamentoShalom(ag.departamento);
                                    setIsAgencyListOpen(false);
                                  }}
                                  className={`w-full text-left p-3.5 rounded-xl transition-all flex flex-col gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-white shadow-md'
                                      : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-xs font-bold text-white tracking-tight leading-snug">
                                      <HighlightMatch text={titleText} query={agencySearchQuery} />
                                    </h5>

                                    {distanceText && (
                                      <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full shrink-0 border border-cyan-500/25">
                                        📍 {distanceText}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[11px] text-slate-300 leading-snug">
                                    <HighlightMatch text={cleanAddr || 'Dirección de la sede'} query={agencySearchQuery} />
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {selectedAgencyObject && (
                          <div className="pt-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setIsAgencyListOpen(false)}
                              className="px-5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold border border-cyan-500/30 shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cerrar lista de agencias</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* DNI o CE con Emoji */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      🪪 DNI o Carnet de Extranjería (CE) de quien recibirá *
                    </label>
                    <input
                      type="text"
                      required
                      value={dniShalom}
                      onChange={e => setDniShalom(e.target.value)}
                      placeholder="Número de DNI o Carnet de Extranjería"
                      className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 tracking-wider"
                    />
                  </div>

                </div>
              )}

              {/* RAMA B: MOTORIZADO LOCAL LIMA */}
              {selectedMethod?.tipo_formulario === 'mapa_direccion' && (
                <div className="space-y-4">
                  {/* Botón de Expansión a Pantalla Completa */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMotorizadoMapModal(true)}
                      className="w-full p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.98] border border-white/10 text-left transition-all flex items-center justify-between group cursor-pointer shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            Abrir Mapa en Pantalla Completa
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Navega con vista amplia para fijar tu casa con precisión
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>

                  {/* Mapa Interactivo Integrado */}
                  <PlacesMapPicker
                    initialLat={lat}
                    initialLng={lng}
                    initialAddress={direccionExacta}
                    initialDistrict={distritoQuery}
                    onConfirmLocation={({ district, address: confirmedAddr, lat: newLat, lng: newLng }) => {
                      if (district) {
                        setDistritoQuery(district);
                        localStorage.setItem('incomi_saved_district', district);
                      }
                      if (confirmedAddr) {
                        setDireccionExacta(confirmedAddr);
                        localStorage.setItem('incomi_saved_address', confirmedAddr);
                      }
                      setLat(newLat);
                      setLng(newLng);
                    }}
                  />

                  {/* Casillas de Distrito y Dirección que se rellenan automáticamente o permiten edición */}
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Datos de Entrega (Auto-rellenados por el mapa)
                      </span>
                    </div>

                    <div className="space-y-1.5 relative">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        🧭 Distrito de Lima *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          required
                          value={distritoQuery}
                          onFocus={() => setShowDistritoSuggestions(true)}
                          onChange={e => {
                            setDistritoQuery(e.target.value);
                            setShowDistritoSuggestions(true);
                          }}
                          placeholder="Escribe tu distrito (ej. Miraflores, San Isidro)..."
                          className="w-full pl-10 pr-3.5 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      </div>

                      {showDistritoSuggestions && suggestedDistritos.length > 0 && (
                        <div className="absolute z-20 top-full mt-1 w-full max-h-48 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5">
                          {suggestedDistritos.map((distNombre, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setDistritoQuery(distNombre);
                                setShowDistritoSuggestions(false);
                              }}
                              className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.08] text-xs text-white flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="font-semibold">{distNombre}</span>
                              <span className="text-[10px] text-cyan-400 font-mono">Lima</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        📍 Dirección Exacta (Calle, Número, Dpto) *
                      </label>
                      <input
                        type="text"
                        required
                        value={direccionExacta}
                        onChange={e => setDireccionExacta(e.target.value)}
                        placeholder="Ej. Av. Larco 1234, Dpto 402"
                        className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        🏷️ Referencia de Entrega (Opcional)
                      </label>
                      <input
                        type="text"
                        value={referencia}
                        onChange={e => setReferencia(e.target.value)}
                        placeholder="Ej. Frente al parque, rejas negras, timbre blanco"
                        className="w-full px-3.5 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* RAMA C: OTRO MÉTODO PERSONALIZADO */}
              {selectedMethod?.tipo_formulario === 'texto_simple' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    📝 Indicaciones de Entrega *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={customDestinoText}
                    onChange={e => setCustomDestinoText(e.target.value)}
                    placeholder="Indica las instrucciones de entrega..."
                    className="w-full p-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none"
                  />
                </div>
              )}

              {/* NOMBRE COMPLETO CON EMOJI */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  👤 Tu Nombre Completo (Destinatario) *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={nombreCompleto}
                    onChange={e => setNombreCompleto(e.target.value)}
                    placeholder="Ej. Carlos Mendoza Ramos"
                    className="w-full pl-10 pr-3.5 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="big-btn-primary py-3.5 mt-2"
              >
                {submitting ? (
                  <span>Registrando Envío...</span>
                ) : (
                  <>
                    <span>Confirmar y Finalizar Pedido</span>
                    <ArrowRight className="w-4 h-4" />
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
