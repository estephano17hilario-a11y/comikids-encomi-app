import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { ordersService } from '../../services/ordersService';
import { useShalomAgencies, formatFullAgencyName, cleanAddressText } from '../../hooks/useShalomAgencies';
import { useOlvaAgencies, formatFullOlvaAgencyName, cleanOlvaAddressText } from '../../hooks/useOlvaAgencies';
import { DEPARTAMENTOS_OLVA } from '../../data/olvaAgencies';
import { searchDistritos } from '../../data/distritosLima';
import { PlacesMapPicker } from './PlacesMapPicker';
import { ShalomAgenciesMap } from './ShalomAgenciesMap';
import { OlvaAgenciesMap } from './OlvaAgenciesMap';
import { EncomiAiChatModal } from './EncomiAiChatModal';
import { MetodoEnvio, ShalomAgency, OlvaAgency, Pedido, CampoPersonalizadoAgencia } from '../../types/database.types';
import { extractShalomDestino } from '../../utils/shalomAgencyResolver';
import { evaluateShippingCutoff, getMinAvailableShippingDate, formatFriendlyDate, formatFriendlyTime } from '../../utils/shippingCutoff';
import {
  isAgencyDateAllowed,
  getNextAvailableDateForAgency,
  getAgencyDaysSummary,
  isAgencyCurrentlyVisible,
} from '../../utils/agencyAvailability';
import {
  DatosComprobante,
  enviarComprobanteAWhatsapp,
  buildWhatsAppComprobanteUrl,
  buildWhatsAppNativeUrl,
  getWhatsAppBusinessChatUrl,
  getJoinEncomiWhatsAppUrl,
  isMobileDevice
} from '../../services/whatsappService';

import { OrderSuccessAnimation } from './OrderSuccessAnimation';
import { DniService } from '../../services/dniService';
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
  Maximize2,
  Calendar,
  Loader2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';


interface Props {
  onSuccess?: () => void;
}

/**
 * Componente que resalta las palabras o tokens coincidentes con la búsqueda
 */
const HighlightMatch: React.FC<{ text: string; query: string; className?: string }> = React.memo(({
  text,
  query,
  className = ''
}) => {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return <span className={className}>{text}</span>;

  try {
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span className={className}>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <span
              key={idx}
              className="font-black text-cyan-300 bg-cyan-400/25 px-1 py-0.5 rounded shadow-xs"
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
});

const formatPhoneWithSpaces = (raw: string) => {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 9);
  const parts = digits.match(/.{1,3}/g);
  return parts ? parts.join(' ') : digits;
};

export const OrganicOrderFlow: React.FC<Props> = ({ onSuccess }) => {
  const { createPedido, activeShippingMethods, tallerConfig } = useOrders();
  const { currentUser, login, triggerConfetti } = useAuth();

  // Step state: 1 = WhatsApp, 2 = Método, 3 = Datos de Destino + Nombre
  const [organicStep, setOrganicStep] = useState<1 | 2 | 3>(1);

  // Form Fields con Auto-Persistencia LocalStorage y Datos Predeterminados de Usuario
  const [whatsapp, setWhatsapp] = useState<string>(() => {
    const raw = currentUser?.telefono_default || localStorage.getItem('incomi_saved_phone') || currentUser?.dni || '';
    return formatPhoneWithSpaces(raw);
  });

  const [nombreCompleto, setNombreCompleto] = useState<string>(() => {
    return currentUser?.nombre_completo || localStorage.getItem('incomi_saved_fullname') || '';
  });

  const cutoffStatus = evaluateShippingCutoff(tallerConfig);
  const minShippingDate = cutoffStatus.minAvailableDateYMD;

  const [fechaEnvioDeseada, setFechaEnvioDeseada] = useState<string>(() => {
    return getMinAvailableShippingDate(tallerConfig);
  });

  useEffect(() => {
    if (fechaEnvioDeseada < minShippingDate) {
      setFechaEnvioDeseada(minShippingDate);
    }
  }, [minShippingDate]);


  const [dniShalom, setDniShalom] = useState<string>(() => {
    const savedDoc = localStorage.getItem('incomi_saved_doc');
    if (savedDoc && savedDoc.trim().length >= 8) return savedDoc.trim();
    if (currentUser?.dni_default && currentUser.dni_default.trim().length >= 8) return currentUser.dni_default.trim();
    if (currentUser?.dni && !currentUser.dni.startsWith('usr-') && currentUser.dni !== '061625' && currentUser.dni.trim().length === 8) {
      return currentUser.dni.trim();
    }
    if (savedDoc && savedDoc.trim().length < 8) {
      localStorage.removeItem('incomi_saved_doc');
    }
    return '';
  });

  const [isResolvingDni, setIsResolvingDni] = useState(false);
  const [dniSource, setDniSource] = useState<'sunat_padron_local' | 'database_history' | 'cache' | null>(null);
  const lastResolvedDniRef = React.useRef<string>('');
  const initialResolvedRef = React.useRef<boolean>(false);

  const handleDniChange = async (val: string) => {
    const rawVal = val.replace(/\D/g, '').slice(0, 12);
    setDniShalom(rawVal);
    if (rawVal.length >= 8) {
      localStorage.setItem('incomi_saved_doc', rawVal);
    }

    // Si tiene exactamente 8 dígitos, consultar en SUNAT / BD
    if (rawVal.length === 8) {
      if (lastResolvedDniRef.current === rawVal) return;
      setIsResolvingDni(true);
      try {
        const res = await DniService.lookupByDni(rawVal);
        if (res.success && res.data?.nombreCompleto) {
          setNombreCompleto(res.data.nombreCompleto);
          try { localStorage.setItem('incomi_saved_fullname', res.data.nombreCompleto); } catch {}
          setDniSource(res.source || 'sunat_padron_local');
          lastResolvedDniRef.current = rawVal;
        } else {
          setDniSource(null);
          lastResolvedDniRef.current = '';
        }
      } catch (err) {
        console.warn('[DNI LOOKUP ERROR]', err);
        setDniSource(null);
        lastResolvedDniRef.current = '';
      } finally {
        setIsResolvingDni(false);
      }
    } else {
      lastResolvedDniRef.current = '';
    }
  };

  // Autoresolver DNI una sola vez al inicio si ya venía precargado con 8 dígitos y el nombre está vacío
  useEffect(() => {
    if (initialResolvedRef.current) return;
    const clean = String(dniShalom || '').replace(/\D/g, '');
    if (clean.length === 8 && !nombreCompleto) {
      initialResolvedRef.current = true;
      handleDniChange(clean);
    }
  }, []);

  const [correoCliente, setCorreoCliente] = useState<string>(() => {
    return currentUser?.email_default || currentUser?.email || localStorage.getItem('incomi_saved_email') || '';
  });

  const [olvaModalidad, setOlvaModalidad] = useState<'agencia' | 'domicilio'>(() => {
    return currentUser?.olva_modalidad_default || (localStorage.getItem('incomi_saved_olva_modalidad') as 'agencia' | 'domicilio') || 'domicilio';
  });

  const [olvaDireccion, setOlvaDireccion] = useState<string>(() => {
    return currentUser?.direccion_default || localStorage.getItem('incomi_saved_olva_address') || '';
  });

  const [olvaReferencia, setOlvaReferencia] = useState<string>(() => {
    return currentUser?.referencia_default || localStorage.getItem('incomi_saved_olva_reference') || '';
  });

  const [distritoQuery, setDistritoQuery] = useState<string>(() => {
    return currentUser?.distrito_default || localStorage.getItem('incomi_saved_district') || '';
  });

  const [direccionExacta, setDireccionExacta] = useState<string>(() => {
    return currentUser?.direccion_default || localStorage.getItem('incomi_saved_address') || '';
  });

  const [referencia, setReferencia] = useState<string>(() => {
    return currentUser?.referencia_default || localStorage.getItem('incomi_saved_reference') || '';
  });

  const [selectedMethodId, setSelectedMethodId] = useState<string>(() => {
    const savedMethod = localStorage.getItem('incomi_saved_method_id');
    if (savedMethod && activeShippingMethods.some(m => m.id === savedMethod)) {
      return savedMethod;
    }
    return activeShippingMethods[0]?.id || 'met-shalom';
  });

  // Sincronizar automáticamente cuando el usuario actualiza sus datos predeterminados en el perfil
  useEffect(() => {
    if (currentUser) {
      if (currentUser.nombre_completo) setNombreCompleto(currentUser.nombre_completo);
      if (currentUser.telefono_default) setWhatsapp(currentUser.telefono_default);
      if (currentUser.dni_default && currentUser.dni_default.trim().length >= 8) {
        setDniShalom(currentUser.dni_default.trim());
      } else if (currentUser.dni && currentUser.dni.trim().length >= 8 && !currentUser.dni.startsWith('usr-') && currentUser.dni !== '061625') {
        setDniShalom(currentUser.dni.trim());
      }
      if (currentUser.email_default || currentUser.email) setCorreoCliente(currentUser.email_default || currentUser.email || '');
      if (currentUser.distrito_default) setDistritoQuery(currentUser.distrito_default);
      if (currentUser.direccion_default) {
        setDireccionExacta(currentUser.direccion_default);
        setOlvaDireccion(currentUser.direccion_default);
      }
      if (currentUser.referencia_default) {
        setReferencia(currentUser.referencia_default);
        setOlvaReferencia(currentUser.referencia_default);
      }
      if (currentUser.olva_modalidad_default) setOlvaModalidad(currentUser.olva_modalidad_default);
    }
  }, [currentUser]);

  // Auto-guardado en LocalStorage cuando cambian los campos
  useEffect(() => {
    if (whatsapp) localStorage.setItem('incomi_saved_phone', whatsapp);
  }, [whatsapp]);

  useEffect(() => {
    if (nombreCompleto) localStorage.setItem('incomi_saved_fullname', nombreCompleto);
  }, [nombreCompleto]);

  useEffect(() => {
    if (dniShalom && dniShalom.trim().length >= 8) {
      localStorage.setItem('incomi_saved_doc', dniShalom.trim());
    }
  }, [dniShalom]);

  useEffect(() => {
    if (selectedMethodId) {
      localStorage.setItem('incomi_saved_method_id', selectedMethodId);
    }
  }, [selectedMethodId]);

  useEffect(() => {
    if (correoCliente) localStorage.setItem('incomi_saved_email', correoCliente);
  }, [correoCliente]);

  useEffect(() => {
    if (olvaModalidad) localStorage.setItem('incomi_saved_olva_modalidad', olvaModalidad);
  }, [olvaModalidad]);

  useEffect(() => {
    if (olvaDireccion) localStorage.setItem('incomi_saved_olva_address', olvaDireccion);
  }, [olvaDireccion]);

  useEffect(() => {
    if (olvaReferencia) localStorage.setItem('incomi_saved_olva_reference', olvaReferencia);
  }, [olvaReferencia]);

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

  const [selectedAgencyObject, setSelectedAgencyObject] = useState<ShalomAgency | null>(() => {
    try {
      const saved = localStorage.getItem('incomi_saved_shalom_agency');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedAgencyObject) {
      localStorage.setItem('incomi_saved_shalom_agency', JSON.stringify(selectedAgencyObject));
      if (selectedAgencyObject.departamento) {
        setDepartamentoShalom(selectedAgencyObject.departamento);
      }
    }
  }, [selectedAgencyObject]);

  const [isAgencyListOpen, setIsAgencyListOpen] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Olva Hook & State (376 Agencias Nacionales)
  const {
    agencies: olvaAgenciesList,
    isLocating: isLocatingOlva,
    gpsError: gpsErrorOlva,
    userLocation: userLocationOlva,
    selectedDepartment: departamentoOlva,
    setSelectedDepartment: setDepartamentoOlva,
    searchQuery: olvaAgencySearchQuery,
    setSearchQuery: setOlvaAgencySearchQuery,
    showOnlyNearest5: showOnlyNearest5Olva,
    setShowOnlyNearest5: setShowOnlyNearest5Olva,
    locateAndSort: triggerOlvaGpsLookup,
  } = useOlvaAgencies({ initialDepartment: 'TODOS', autoFetchNearby: true });

  const [selectedOlvaAgencyObject, setSelectedOlvaAgencyObject] = useState<OlvaAgency | null>(() => {
    try {
      const saved = localStorage.getItem('incomi_saved_olva_agency');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (selectedOlvaAgencyObject) {
      localStorage.setItem('incomi_saved_olva_agency', JSON.stringify(selectedOlvaAgencyObject));
      if (selectedOlvaAgencyObject.departamento) {
        setDepartamentoOlva(selectedOlvaAgencyObject.departamento);
      }
    }
  }, [selectedOlvaAgencyObject]);

  const [isOlvaAgencyListOpen, setIsOlvaAgencyListOpen] = useState(false);
  const [showOlvaMapModal, setShowOlvaMapModal] = useState(false);

  // Motorizado Branch State
  const [motorizadoSubStep, setMotorizadoSubStep] = useState<'map' | 'form'>('map');
  const [showDistritoSuggestions, setShowDistritoSuggestions] = useState(false);
  const [initialMapAddress, setInitialMapAddress] = useState<string>('');
  const [lat, setLat] = useState<number>(-12.1215);
  const [lng, setLng] = useState<number>(-77.0298);

  // Custom Method Text
  const [customDestinoText, setCustomDestinoText] = useState('');

  // Campos personalizados dinámicos por agencia / motorizado
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('incomi_saved_custom_fields');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues(prev => {
      const updated = { ...prev, [fieldId]: value };
      localStorage.setItem('incomi_saved_custom_fields', JSON.stringify(updated));
      return updated;
    });

    // Si este campo es un DNI o número de 8 dígitos, intentar resolver el nombre automáticamente
    const strVal = String(value || '').replace(/\D/g, '');
    const isDniField = fieldId.toLowerCase().includes('dni') || fieldId.toLowerCase().includes('documento');
    if (isDniField && strVal.length === 8) {
      handleDniChange(strVal);
    }
  };

  // Secret Empresa Prompt
  const [isEmpresaUnlock, setIsEmpresaUnlock] = useState(false);
  const [empresaPassword, setEmpresaPassword] = useState('');
  const [unlockTarget, setUnlockTarget] = useState<{
    type: 'matrix' | 'empresa';
    identifier: string;
    nombre: string;
  } | null>(null);

  // Status & Resumen de Pedido Creado (Con Persistencia Inmune a Recargas y Login en Móviles)
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEncomiAiModal, setShowEncomiAiModal] = useState(false);
  const [showDispatchAnimation, setShowDispatchAnimation] = useState(false);
  const [createdOrder, setCreatedOrderState] = useState<Pedido | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'nuevo_envio' || urlParams.get('nuevo') === 'true') {
          localStorage.removeItem('incomi_current_receipt_order');
          return null;
        }
      }
      const saved = localStorage.getItem('incomi_current_receipt_order');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'nuevo_envio' || urlParams.get('nuevo') === 'true') {
        localStorage.removeItem('incomi_current_receipt_order');
        setCreatedOrderState(null);
        setOrganicStep(1);
      }
    }
  }, []);

  const setCreatedOrder = (order: Pedido | null) => {
    setCreatedOrderState(order);
    if (order) {
      localStorage.setItem('incomi_current_receipt_order', JSON.stringify(order));
    } else {
      localStorage.removeItem('incomi_current_receipt_order');
    }
  };

  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    if (!createdOrder) return;
    setShowScrollHint(true);
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setShowScrollHint(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [createdOrder]);

  const suggestedDistritos = searchDistritos(distritoQuery);

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

    // 1. Acceso Master Matrix (963097777 / matrix4012)
    if (clean === '963097777') {
      setUnlockTarget({
        type: 'matrix',
        identifier: '963097777',
        nombre: 'Control Central Matrix'
      });
      setIsEmpresaUnlock(true);
      setEmpresaPassword('');
      setErrorMsg('');
      return;
    }

    // 2. Acceso Cuentas de Empresa (ComiKids u otras empresas creadas)
    const empresas = ordersService.getEmpresas();
    const matchedEmp = empresas.find(
      emp => emp.numero_entrada.toUpperCase() === clean.toUpperCase() ||
      (clean === '061625' && emp.id === 'empresa-master-comikids') ||
      (clean.toUpperCase() === '42020312COMIKIDS' && emp.id === 'empresa-master-comikids')
    );

    if (matchedEmp) {
      setUnlockTarget({
        type: 'empresa',
        identifier: matchedEmp.numero_entrada,
        nombre: matchedEmp.nombre
      });
      setIsEmpresaUnlock(true);
      setEmpresaPassword('');
      setErrorMsg('');
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

  // Empresa & Matrix Login Submit
  const handleEmpresaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!unlockTarget) return;

    try {
      const res = await login(unlockTarget.identifier, empresaPassword);
      if (res.success) {
        setIsEmpresaUnlock(false);
        setUnlockTarget(null);
        setEmpresaPassword('');
      } else {
        setErrorMsg(res.error || 'Contraseña incorrecta.');
      }
    } catch {
      setErrorMsg('Error al autenticar credenciales de acceso.');
    }
  };

  // --- STEP 2: METHOD SELECTION ---
  const handleMethodSelect = (methodId: string) => {
    setSelectedMethodId(methodId);
    const method = activeShippingMethods.find(m => m.id === methodId);
    if (method?.tipo_formulario === 'mapa_direccion') {
      setMotorizadoSubStep('map');
    }

    // Auto-calibrar la fecha de envío si la actual no está permitida para esta agencia
    if (method) {
      const check = isAgencyDateAllowed(method, fechaEnvioDeseada);
      if (!check.allowed) {
        const nextValid = getNextAvailableDateForAgency(method, fechaEnvioDeseada, minShippingDate);
        setFechaEnvioDeseada(nextValid);
      }
    }

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

    // Validación de fecha de despacho según disponibilidad de la agencia
    if (selectedMethod?.disponibilidad?.restringir_fecha_envio !== false) {
      const dateCheck = isAgencyDateAllowed(selectedMethod, fechaEnvioDeseada);
      if (!dateCheck.allowed) {
        setErrorMsg(dateCheck.reason || 'La fecha seleccionada no es un día de despacho para esta agencia. Por favor ajústala antes de continuar.');
        return;
      }
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
      // Validación de CE: 9 dígitos debe empezar con "00"
      const dniClean = dniShalom.trim();
      if (dniClean.length === 9 && !dniClean.startsWith('00')) {
        setErrorMsg('El Carnet de Extranjería (CE) de 9 dígitos debe comenzar con "00" (ej: 001234567). Por favor corrígelo antes de continuar.');
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

    if (selectedMethod?.tipo_formulario === 'olva') {
      if (!dniShalom.trim()) {
        setErrorMsg('Por favor ingresa el DNI o Carnet de Extranjería (CE) de quien recibe.');
        return;
      }
      // Validación de CE: 9 dígitos debe empezar con "00"
      const dniOlvaClean = dniShalom.trim();
      if (dniOlvaClean.length === 9 && !dniOlvaClean.startsWith('00')) {
        setErrorMsg('El Carnet de Extranjería (CE) de 9 dígitos debe comenzar con "00" (ej: 001234567). Por favor corrígelo antes de continuar.');
        return;
      }
      if (!whatsapp.trim()) {
        setErrorMsg('Por favor ingresa el celular de quien recibe.');
        return;
      }
      if (!correoCliente.trim()) {
        setErrorMsg('Por favor ingresa el correo electrónico para la notificación de Olva.');
        return;
      }
      if (!olvaDireccion.trim()) {
        setErrorMsg(
          olvaModalidad === 'agencia'
            ? 'Por favor ingresa la dirección o sede de la Agencia Olva de destino.'
            : 'Por favor ingresa la dirección exacta de tu domicilio.'
        );
        return;
      }
    }

    // Validación de campos personalizados adicionales de la agencia
    if (selectedMethod?.campos_personalizados && selectedMethod.campos_personalizados.length > 0) {
      const isNativeDuplicateField = (c: CampoPersonalizadoAgencia) => {
        if (c.sistema) return true;
        const id = (c.id || '').toLowerCase();
        const lbl = (c.label || '').toLowerCase();
        if (['c-shalom-dni', 'c-olva-dni', 'c-olva-dir', 'c-mot-nombre', 'c-mot-tel', 'c-mot-ref'].includes(id)) return true;
        if (lbl.includes('dni') || lbl.includes('carnet') || lbl.includes('documento')) return true;
        if (lbl.includes('teléfono') || lbl.includes('telefono') || lbl.includes('celular') || lbl.includes('whatsapp')) return true;
        if (lbl.includes('nombres y apellidos') || lbl.includes('nombre completo')) return true;
        if (lbl.includes('dirección') || lbl.includes('direccion') || lbl.includes('agencia olva') || lbl.includes('agencia shalom')) return true;
        return false;
      };

      for (const campo of selectedMethod.campos_personalizados) {
        if (campo.requerido && !isNativeDuplicateField(campo)) {
          const val = customFieldValues[campo.id] ?? customFieldValues[campo.label];
          if (!val || String(val).trim() === '') {
            setErrorMsg(`Por favor completa el campo requerido: ${campo.label}`);
            return;
          }
        }
      }
    }

      // Persistir todos los datos
      localStorage.setItem('incomi_saved_fullname', nombreCompleto.trim());
      if (dniShalom.trim().length >= 8) {
        localStorage.setItem('incomi_saved_doc', dniShalom.trim());
      }
      if (selectedAgencyObject) {
        localStorage.setItem('incomi_saved_shalom_agency', JSON.stringify(selectedAgencyObject));
      }
      if (selectedOlvaAgencyObject) {
        localStorage.setItem('incomi_saved_olva_agency', JSON.stringify(selectedOlvaAgencyObject));
      }
      if (selectedMethodId) {
        localStorage.setItem('incomi_saved_method_id', selectedMethodId);
      }
      if (correoCliente) localStorage.setItem('incomi_saved_email', correoCliente.trim());
      if (distritoQuery) localStorage.setItem('incomi_saved_district', distritoQuery.trim());
      if (direccionExacta) localStorage.setItem('incomi_saved_address', direccionExacta.trim());
      if (referencia) localStorage.setItem('incomi_saved_reference', referencia.trim());
      if (olvaDireccion) localStorage.setItem('incomi_saved_olva_address', olvaDireccion.trim());
      if (olvaReferencia) localStorage.setItem('incomi_saved_olva_reference', olvaReferencia.trim());
      localStorage.setItem('incomi_saved_olva_modalidad', olvaModalidad);

      setSubmitting(true);
      try {
        const userIdentifier = (dniShalom.trim().length >= 8 ? dniShalom.trim() : '') || whatsapp.trim();
        let activeUser: any = null;

        // Si el usuario actual es cliente y coincide con este identificador, usarlo
        if (currentUser && currentUser.rol !== 'empresa' && (currentUser.dni === userIdentifier || currentUser.id === userIdentifier || currentUser.telefono_default === whatsapp.trim())) {
          activeUser = currentUser;
          const userUpdates: any = {
            nombre_completo: nombreCompleto.trim(),
            telefono_default: whatsapp.trim() || activeUser.telefono_default,
            dni_default: (dniShalom.trim().length >= 8 ? dniShalom.trim() : '') || activeUser.dni_default,
            email_default: correoCliente.trim() || activeUser.email_default,
            distrito_default: distritoQuery.trim() || activeUser.distrito_default,
            direccion_default: (selectedMethod?.tipo_formulario === 'olva' ? olvaDireccion.trim() : direccionExacta.trim()) || activeUser.direccion_default,
            referencia_default: (selectedMethod?.tipo_formulario === 'olva' ? olvaReferencia.trim() : referencia.trim()) || activeUser.referencia_default,
            olva_modalidad_default: olvaModalidad,
          };
          activeUser = { ...activeUser, ...userUpdates };
          ordersService.updateUserProfile(activeUser.id, userUpdates).catch(e => console.warn('User profile update warn:', e));
        } else {
          // Registrar o actualizar el perfil de la clienta en memoria
          try {
            const regRes = await ordersService.registerUser(
              nombreCompleto.trim(),
              userIdentifier,
              undefined,
              'incomi2026',
              whatsapp.trim()
            );
            activeUser = regRes.user || null;
            if (activeUser) {
              ordersService.updateUserProfile(activeUser.id, {
                dni_default: dniShalom.trim().length >= 8 ? dniShalom.trim() : undefined,
                email_default: correoCliente.trim() || undefined,
                distrito_default: distritoQuery.trim() || undefined,
                direccion_default: (selectedMethod?.tipo_formulario === 'olva' ? olvaDireccion.trim() : direccionExacta.trim()) || undefined,
                referencia_default: (selectedMethod?.tipo_formulario === 'olva' ? olvaReferencia.trim() : referencia.trim()) || undefined,
                olva_modalidad_default: olvaModalidad,
              } as any).catch(e => console.warn('User extra update warn:', e));
            }
          } catch (regErr) {
            console.warn('Error en registro preliminar de usuario (continuando con pedido):', regErr);
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
        } else if (selectedMethod?.tipo_formulario === 'olva') {
          const modLabel = olvaModalidad === 'agencia' ? 'Agencia Olva' : 'Domicilio';
          const refText = (olvaModalidad === 'domicilio' && olvaReferencia.trim()) ? ` (Ref: ${olvaReferencia.trim()})` : '';
          finalDestinoDetalle = `Olva Courier (${modLabel}): ${olvaDireccion.trim()}${refText} • DNI: ${dniShalom.trim()} • Tel: ${whatsapp.trim()} • Correo: ${correoCliente.trim()}`;
        } else {
          finalDestinoDetalle = customDestinoText.trim() || 'Indicaciones de entrega';
        }

        const clientUserData = activeUser || {
          id: 'usr-' + Date.now().toString(36),
          dni: userIdentifier,
          nombre_completo: nombreCompleto.trim(),
          telefono_default: whatsapp.trim(),
          email: correoCliente.trim() || undefined,
          rol: 'client',
          created_at: new Date().toISOString()
        };

        const finalCustomFields: Record<string, any> = { ...customFieldValues };
        finalCustomFields['c-shalom-dni'] = dniShalom.trim();
        finalCustomFields['c-olva-dni'] = dniShalom.trim();
        finalCustomFields['c-olva-dir'] = olvaDireccion.trim();
        finalCustomFields['DNI / CE'] = dniShalom.trim();
        finalCustomFields['DNI / Carnet de Extranjería'] = dniShalom.trim();
        finalCustomFields['Celular / WhatsApp'] = whatsapp.trim();
        finalCustomFields['Nombres y Apellidos'] = nombreCompleto.trim();

        const orderPayload = {
          usuario_id: clientUserData.id,
          usuario: clientUserData,
          detalles_bordado: `Envío de Mercadería para ${nombreCompleto.trim()}`,
          metodo_envio_codigo: selectedMethod?.codigo || 'shalom',
          metodo_envio_nombre: selectedMethod?.nombre || 'Envío',
          destino_detalle: finalDestinoDetalle,
          latitud: selectedMethod?.tipo_formulario === 'shalom' ? agencyLat : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lat : undefined),
          longitud: selectedMethod?.tipo_formulario === 'shalom' ? agencyLng : (selectedMethod?.tipo_formulario === 'mapa_direccion' ? lng : undefined),
          observaciones_cliente: (selectedMethod?.tipo_formulario === 'olva' ? (olvaModalidad === 'domicilio' ? olvaReferencia.trim() : undefined) : referencia.trim()) || undefined,
          fecha_limite: fechaEnvioDeseada || new Date().toISOString().split('T')[0],
          campos_personalizados: finalCustomFields,
        };

        // Creación del pedido con timeout de rescate para asegurar que NUNCA se quede colgado
        const newOrder = await Promise.race([
          createPedido(orderPayload),
          new Promise<Pedido>((_, reject) => setTimeout(() => reject(new Error('Timeout de creación de pedido')), 4000))
        ]).catch((createErr) => {
          console.warn('Timeout o fallo en createPedido context, usando fallback local inmediato:', createErr);
          return ordersService.createPedido(orderPayload);
        });

        triggerConfetti();
        setCreatedOrder(newOrder);
        setShowDispatchAnimation(true);

        // Login en segundo plano sin bloquear el despacho
        if (currentUser?.rol !== 'empresa' && activeUser) {
          login(userIdentifier, 'incomi2026').catch(e => console.warn('Background login warn:', e));
        }

      } catch (err) {
        console.error('Error al registrar el envío:', err);
        setErrorMsg('Ocurrió un problema temporal. Por favor presiona de nuevo para confirmar.');
      } finally {
        setSubmitting(false);
      }
    };

  // Paso 1 & 2: Extracción dinámica de variables para el Comprobante Estándar
  const getDatosComprobanteActual = (order: Pedido | null): DatosComprobante => {
    let destinoTexto = order?.destino_detalle || '';
    if (selectedMethod?.tipo_formulario === 'shalom' && selectedAgencyObject) {
      destinoTexto = formatFullAgencyName(selectedAgencyObject);
    } else if (selectedMethod?.tipo_formulario === 'mapa_direccion') {
      destinoTexto = `${distritoQuery.trim()} • ${direccionExacta.trim()}`;
    } else if (selectedMethod?.tipo_formulario === 'olva') {
      const modLabel = olvaModalidad === 'agencia' ? 'Agencia Olva' : 'Domicilio';
      destinoTexto = `${modLabel}: ${olvaDireccion.trim()}`;
    }

    const orderLat = order?.latitud || lat;
    const orderLng = order?.longitud || lng;
    const mapsUrl = (selectedMethod?.tipo_formulario === 'mapa_direccion' && orderLat && orderLng)
      ? `https://www.google.com/maps?q=${orderLat},${orderLng}`
      : undefined;

    return {
      destinatario: nombreCompleto.trim() || order?.usuario?.nombre_completo || 'Cliente',
      telefonoCliente: whatsapp.trim() || order?.usuario?.telefono_default || order?.usuario?.dni || '',
      documentoRecojo: dniShalom.trim() || order?.usuario?.dni_default || order?.usuario?.dni || '',
      correoCliente: correoCliente.trim() || order?.usuario?.email_default || order?.usuario?.email || undefined,
      modalidadOlva: selectedMethod?.tipo_formulario === 'olva' ? olvaModalidad : undefined,
      tipoEnvio: selectedMethod?.nombre || order?.metodo_envio_nombre || (selectedMethod?.tipo_formulario === 'shalom' ? 'Agencia Shalom Nacional' : (selectedMethod?.tipo_formulario === 'olva' ? 'Olva Courier Nacional' : 'Motorizado Local Lima')),
      destinoDetalle: destinoTexto || order?.destino_detalle || 'Agencia de destino',
      codigoSeguimiento: order?.codigo_seguimiento,
      fechaDeseadaEnvio: fechaEnvioDeseada || order?.fecha_limite,
      referencia: (selectedMethod?.tipo_formulario === 'olva' ? (olvaModalidad === 'domicilio' ? olvaReferencia.trim() : undefined) : referencia.trim()) || order?.observaciones_cliente || undefined,
      coordenadasMapsUrl: mapsUrl,
      remitenteNombre: tallerConfig?.nombre_taller,
      remitenteDni: tallerConfig?.remitente_dni || tallerConfig?.ruc_dni,
      remitenteEmail: tallerConfig?.remitente_email,
      remitenteCelular: tallerConfig?.remitente_celular || tallerConfig?.celular_taller,
      camposPersonalizados: order?.campos_personalizados || customFieldValues,
      plantillaMensajeAgencia: selectedMethod?.mensaje_comprobacion,
    };
  };

  const datosComprobanteActuales = getDatosComprobanteActual(createdOrder);
  const isMobile = typeof window !== 'undefined' && isMobileDevice();
  const whatsappUrl = isMobile
    ? buildWhatsAppNativeUrl(datosComprobanteActuales)
    : buildWhatsAppComprobanteUrl(datosComprobanteActuales);

  // Paso 3: Función de envío directo
  const handleEnviarComprobanteWhatsApp = () => {
    enviarComprobanteAWhatsapp(datosComprobanteActuales);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-1 font-sans tracking-tight space-y-3.5">
      
      {/* Overlay Animado 60 FPS de Despacho con Auto-Redirección a WhatsApp */}
      {showDispatchAnimation && createdOrder && (
        <OrderSuccessAnimation
          order={createdOrder}
          comprobanteData={datosComprobanteActuales}
          onFinished={() => setShowDispatchAnimation(false)}
        />
      )}
      


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

      {/* Modal de Mapa Oficial Olva Courier con Buscador y GPS Sincronizado */}
      {showOlvaMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900/95 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-amber-400">🚚</span>
                  <span>Mapa de Agencias Olva Courier</span>
                </h3>
                <p className="text-xs text-amber-200/70">Busca o toca cualquier sede oficial Olva en el mapa para seleccionarla</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOlvaMapModal(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <OlvaAgenciesMap
              agencies={olvaAgenciesList}
              selectedAgency={selectedOlvaAgencyObject}
              onSelectAgency={(agency) => {
                setSelectedOlvaAgencyObject(agency);
                setOlvaDireccion(formatFullOlvaAgencyName(agency));
                if (agency.departamento) setDepartamentoOlva(agency.departamento);
                setShowOlvaMapModal(false);
                setIsOlvaAgencyListOpen(false);
              }}
              userLocation={userLocationOlva}
              onRequestLocation={triggerOlvaGpsLookup}
              isLocating={isLocatingOlva}
              onClose={() => setShowOlvaMapModal(false)}
              searchQuery={olvaAgencySearchQuery}
              onSearchChange={setOlvaAgencySearchQuery}
            />
          </div>
        </div>
      )}



      {/* Aviso Personalizado de la Empresa (si existe) */}
      {!createdOrder && tallerConfig?.anuncio_publico_clientes && (
        <div className="p-3.5 sm:p-4 rounded-3xl bg-linear-to-r from-amber-500/15 via-pink-500/10 to-purple-500/15 border border-amber-500/35 text-xs text-amber-200 flex items-start gap-3 shadow-lg shadow-amber-500/10 animate-fadeIn">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 leading-snug">
            <strong className="text-amber-300 font-bold block text-[11px] uppercase tracking-wide">
              Aviso Importante ComiKids:
            </strong>
            <p className="text-slate-100 text-xs sm:text-sm">{tallerConfig.anuncio_publico_clientes}</p>
          </div>
        </div>
      )}

      {/* Pantalla Final: Resumen Compacto + Envío Obligatorio por WhatsApp */}
      {createdOrder ? (
        <div className="minimal-card p-3 text-center animate-fadeIn space-y-2 relative">
          
          {/* Encabezado Compacto Integrado Directamente en el Resumen */}
          <div className="py-2 px-3 rounded-xl bg-linear-to-r from-emerald-500/20 via-slate-900 to-cyan-500/20 border border-emerald-500/35 flex items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block">
                  ¡Envío Registrado con Éxito!
                </span>
                <div className="font-mono text-sm font-black text-cyan-300">
                  #{createdOrder.codigo_seguimiento}
                </div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 text-slate-200 border border-white/10 shrink-0">
              {selectedMethod?.nombre || 'Envío'}
            </span>
          </div>

          {/* Cuerpo del Resumen de Envío */}
          <div className="p-2.5 rounded-xl bg-white/4 border border-white/10 text-left space-y-2 shadow-md">
            {selectedMethod?.tipo_formulario === 'mapa_direccion' ? (
              /* Comprobante Motorizado */
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">👤 Destinatario:</span>
                    <span className="text-white font-bold text-sm">{nombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">📅 Fecha Deseada de Envío:</span>
                    <span className="text-cyan-300 font-bold text-sm font-mono">{fechaEnvioDeseada}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">🚚 Tipo de Despacho:</span>
                    <span className="text-white font-bold text-sm">{selectedMethod?.nombre || 'Motorizado Local'}</span>
                  </div>
                </div>


                <div className="pt-2 border-t border-white/6 text-xs space-y-0.5">
                  <span className="text-slate-400 text-[11px] font-medium block">📍 Dirección de Entrega:</span>
                  <p className="text-white font-bold text-xs sm:text-sm">
                    {distritoQuery} • {direccionExacta}
                  </p>
                </div>

                {referencia.trim() && (
                  <div className="pt-1 text-xs space-y-0.5">
                    <span className="text-cyan-400 font-bold block text-[11px]">🏷️ Referencia:</span>
                    <p className="text-white font-medium text-xs bg-white/4 p-2 rounded-xl border border-white/10">
                      {referencia}
                    </p>
                  </div>
                )}

                {(createdOrder?.latitud || lat) && (createdOrder?.longitud || lng) && (
                  <div className="pt-1.5 border-t border-white/6">
                    <a
                      href={`https://www.google.com/maps?q=${createdOrder?.latitud || lat},${createdOrder?.longitud || lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-blue-600/25 hover:bg-blue-600/35 text-blue-300 border border-blue-500/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <span>📍 Ver ubicación en Google Maps</span>
                    </a>
                  </div>
                )}
              </div>
            ) : selectedMethod?.tipo_formulario === 'olva' ? (
              /* Comprobante Olva Courier */
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">👤 Destinatario:</span>
                    <span className="text-white font-bold text-xs sm:text-sm truncate block">{nombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">📅 Fecha Deseada:</span>
                    <span className="text-cyan-300 font-bold text-xs sm:text-sm font-mono truncate block">{fechaEnvioDeseada}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">📱 Celular:</span>
                    <span className="text-white font-bold text-xs sm:text-sm font-mono">+51 {whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">🪪 DNI / Doc:</span>
                    <span className="text-white font-bold text-xs sm:text-sm font-mono">{dniShalom || 'No especificado'}</span>
                  </div>
                  {correoCliente && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px] font-medium">📧 Correo:</span>
                      <span className="text-yellow-300 font-bold text-xs sm:text-sm font-mono truncate block">{correoCliente}</span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px] font-medium">🚚 Modalidad:</span>
                    <span className="text-white font-bold text-xs sm:text-sm">
                      Olva Courier ({olvaModalidad === 'agencia' ? '🏢 Recojo en Agencia' : '🏠 Entrega a Domicilio'})
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/6 text-xs space-y-1">
                  <span className="text-slate-400 text-[11px] font-medium block">
                    {olvaModalidad === 'agencia' ? '🏢 Agencia Olva de Destino:' : '📍 Dirección de Domicilio:'}
                  </span>
                  <p className="text-white font-bold text-xs sm:text-sm leading-snug">
                    {olvaDireccion}
                  </p>
                  {olvaModalidad === 'domicilio' && olvaReferencia.trim() && (
                    <p className="text-[11px] text-yellow-300/90 bg-yellow-500/10 p-2 rounded-xl border border-yellow-500/20 mt-1">
                      <strong>🏷️ Ref:</strong> {olvaReferencia}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Comprobante Shalom / Otros */
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">👤 Destinatario:</span>
                    <span className="text-white font-bold text-xs sm:text-sm truncate block">{nombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">📅 Fecha Deseada de Envío:</span>
                    <span className="text-cyan-300 font-bold text-xs sm:text-sm font-mono truncate block">{fechaEnvioDeseada}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">📱 WhatsApp:</span>
                    <span className="text-white font-bold text-xs sm:text-sm font-mono">+51 {whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">🪪 DNI / Doc:</span>
                    <span className="text-white font-bold text-xs sm:text-sm font-mono">{dniShalom || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">🚚 Tipo de Envío:</span>
                    <span className="text-white font-bold text-xs sm:text-sm">{selectedMethod?.nombre}</span>
                  </div>
                </div>


                {selectedAgencyObject && (
                  <div className="pt-2 border-t border-white/6 text-xs space-y-2">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px] font-medium block">📦 Agencia Shalom de Destino:</span>
                      <p className="text-white font-bold text-xs leading-snug">
                        {formatFullAgencyName(selectedAgencyObject)}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-rose-300 font-bold bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-500/30">
                        <span>🏢 Sede Oficial Destino:</span>
                        <strong className="text-white font-black">{extractShalomDestino(formatFullAgencyName(selectedAgencyObject), selectedAgencyObject.code || undefined)}</strong>
                        {selectedAgencyObject.code && (
                          <span className="text-[10px] font-mono text-rose-200 bg-rose-900/70 px-1.5 py-0.2 rounded-md border border-rose-500/40 font-black">
                            {selectedAgencyObject.code}
                          </span>
                        )}
                      </div>
                      {selectedAgencyObject.horario && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{selectedAgencyObject.horario}</span>
                        </p>
                      )}
                    </div>


                    {/* Botón al costado / pie del comprobante Shalom: Ver tiempo aproximado de envío */}
                    <div className="pt-1 flex items-center justify-start">
                      <button
                        type="button"
                        onClick={() => setShowEncomiAiModal(true)}
                        className="py-1.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 text-purple-200 hover:text-white border border-purple-400/40 text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-cyan-300" />
                        <span>⏱️ Ver tiempo aproximado de envío</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CAMPOS PERSONALIZADOS / INFORMACIÓN ADICIONAL EN COMPROBANTE */}
            {(() => {
              const campos = createdOrder?.campos_personalizados || customFieldValues;
              if (!campos || Object.keys(campos).length === 0) return null;
              const entries = Object.entries(campos).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
              if (entries.length === 0) return null;
              return (
                <div className="pt-2.5 mt-2.5 border-t border-white/10 space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block">
                    📋 Información Adicional Registrada:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {entries.map(([k, v]) => (
                      <div key={k} className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-slate-400 block font-medium">{k}:</span>
                        <span className="text-white font-bold text-xs">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 1. Botón Principal de WhatsApp */}
          <a
            href={whatsappUrl}
            onClick={(e) => {
              e.preventDefault();
              handleEnviarComprobanteWhatsApp();
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Enviar Comprobante por WhatsApp</span>
          </a>

          {/* 2. Botón Promocional */}
          <a
            href={getJoinEncomiWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-4 rounded-2xl bg-linear-to-r from-cyan-500/20 via-blue-600/20 to-purple-600/20 hover:from-cyan-500/30 hover:to-purple-600/30 border-2 border-cyan-400/50 hover:border-cyan-300 text-cyan-200 hover:text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] cursor-pointer group"
          >
            <span className="text-base group-hover:scale-110 transition-transform">🚀</span>
            <span>¿Quieres unirte a ComiKids? ¡Únete a Encomi y envía 10 veces más rápido!</span>
          </a>

          {/* 3. Botón de Preguntas Frecuentes con Encomi AI (Exclusivo Shalom) */}
          {(selectedMethod?.tipo_formulario === 'shalom' || createdOrder?.metodo_envio_codigo === 'shalom') && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowEncomiAiModal(true)}
                className="w-full py-2.5 px-5 rounded-2xl bg-linear-to-r from-purple-600/30 via-indigo-600/30 to-cyan-600/30 hover:from-purple-600/45 hover:to-cyan-600/45 border border-purple-500/45 text-purple-200 hover:text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-950/30 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                <span>Preguntas Frecuentes con Encomi AI</span>
              </button>
            </div>
          )}

          {/* 4. Botón para Registrar Nuevo Envío */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setCreatedOrder(null);
                setOrganicStep(1);
              }}
              className="w-full py-3 rounded-2xl bg-white/6 hover:bg-white/12 active:scale-[0.98] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10 shadow-md"
            >
              <span>➕ Registrar un Nuevo Envío</span>
            </button>
          </div>

        </div>
      ) : isEmpresaUnlock ? (
        /* Empresa & Matrix Access Verification */
        <div className="minimal-card p-6 sm:p-8 animate-fadeIn space-y-5 rounded-3xl bg-slate-900/95 border-2 border-emerald-500/35 backdrop-blur-2xl shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              unlockTarget?.type === 'matrix' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              {unlockTarget?.type === 'matrix' ? <ShieldCheck className="w-7 h-7" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {unlockTarget?.type === 'matrix' ? 'Control Central Matrix' : `Acceso Empresa: ${unlockTarget?.nombre}`}
              </h3>
              <p className="text-xs text-slate-400">
                {unlockTarget?.type === 'matrix' 
                  ? 'Ingresa la clave maestra (matrix4012)'
                  : `Ingresa la contraseña para ${unlockTarget?.nombre}`
                }
              </p>
            </div>
          </div>

          <form onSubmit={handleEmpresaLogin} className="space-y-4">
            <input
              type="password"
              autoFocus
              required
              value={empresaPassword}
              onChange={e => setEmpresaPassword(e.target.value)}
              placeholder="Contraseña de acceso..."
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
                onClick={() => {
                  setIsEmpresaUnlock(false);
                  setUnlockTarget(null);
                  setEmpresaPassword('');
                  setErrorMsg('');
                }}
                className="big-btn-secondary w-1/3"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`big-btn-primary w-2/3 ${
                  unlockTarget?.type === 'matrix' ? '!bg-gradient-to-r !from-emerald-500 !to-teal-600 !text-slate-950 font-black' : ''
                }`}
              >
                Ingresar
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Flow Container */
        <div className="glass-panel p-4 sm:p-5 space-y-4 rounded-3xl bg-slate-900/95 border-2 border-cyan-500/35 backdrop-blur-2xl shadow-2xl shadow-cyan-500/15">
          
          {/* Header — compacto */}
          <div className="flex items-center justify-between border-b border-white/8 pb-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/6 px-2.5 py-0.5 rounded-full border border-white/10">
                Paso {organicStep} de 3
              </span>
              <h2 className="text-base font-bold text-white mt-1 tracking-tight">
                {organicStep === 1 && (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>Envío de Mercadería</span>
                    <span>📦</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-black">
                      <MessageCircle className="w-3 h-3 fill-current" />
                      <span>WhatsApp</span>
                    </span>
                  </span>
                )}
                {organicStep === 2 && '¿Cómo deseas recibir tu pedido? 🚚'}
                {organicStep === 3 && (
                  selectedMethod?.tipo_formulario === 'shalom' ? (
                    <span className="flex items-center gap-1.5">
                      <span>Envío</span>
                      <span className="text-red-500 font-black tracking-wide drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">SHALOM</span>
                      <span>📦</span>
                    </span>
                  ) : selectedMethod?.tipo_formulario === 'olva' ? (
                    <span className="flex items-center gap-1.5">
                      <span>Envío</span>
                      <span className="text-yellow-400 font-black tracking-wide drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]">OLVA COURIER</span>
                      <span>📦</span>
                    </span>
                  ) : selectedMethod?.tipo_formulario === 'mapa_direccion' ? (
                    motorizadoSubStep === 'map' ? (
                      <span>Selecciona punto de entrega 🏍️</span>
                    ) : (
                      <span>Confirmar Datos de Entrega 🛵</span>
                    )
                  ) : (
                    <span>Datos de Entrega & Destinatario 🏍️</span>
                  )
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Branding Oficial de la Empresa: Foto y Nombre arriba a la derecha */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 border border-pink-400/30 text-pink-200 shadow-sm">
                <img
                  src={tallerConfig?.logo_url || '/Comikids.png'}
                  alt={tallerConfig?.nombre_taller || 'Empresa'}
                  className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
                />
                <span className="text-[11px] sm:text-xs font-black tracking-tight truncate max-w-[120px] sm:max-w-none">
                  {tallerConfig?.nombre_taller || 'ComiKids'}
                </span>
              </div>

              {organicStep > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (organicStep === 3 && selectedMethod?.tipo_formulario === 'mapa_direccion' && motorizadoSubStep === 'form') {
                      setMotorizadoSubStep('map');
                      return;
                    }
                    setOrganicStep((prev) => (prev - 1) as 1 | 2);
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* =====================================================================
              PASO 1: WHATSAPP (CON MEMORIA AUTO-GUARDADA)
              ===================================================================== */}
          {organicStep === 1 && (
            <form onSubmit={handleWhatsappSubmit} className="space-y-5 animate-fadeIn">
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  Ingresa tu número de WhatsApp para enviarte las fotos del paquete 📦 y el código de seguimiento:
                </p>
                
                <div className="flex items-center rounded-2xl bg-white/5 border-2 border-white/15 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/25 transition-all p-2 shadow-inner">
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/8 rounded-xl text-white font-bold text-base sm:text-lg border border-white/10 shrink-0 select-none">
                    <span className="text-xl">🇵🇪</span>
                    <span className="font-mono text-cyan-300 font-bold">+51</span>
                  </div>
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={whatsapp}
                    onChange={e => setWhatsapp(formatPhoneWithSpaces(e.target.value))}
                    placeholder="987 654 321"
                    maxLength={11}
                    className="w-full bg-transparent px-4 py-3 text-lg sm:text-2xl font-bold font-mono text-white placeholder-slate-500 focus:outline-none tracking-wider"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3.5 rounded-2xl border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button type="submit" className="big-btn-primary py-4.5 sm:py-5 text-base sm:text-lg font-black shadow-xl">
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* =====================================================================
              PASO 2: SELECCIÓN DE MÉTODO (CON LOGOS OFICIALES, SHALOM Y OTRAS AGENCIAS)
              ===================================================================== */}
          {organicStep === 2 && (() => {
            const visibleMethods = activeShippingMethods.filter(m =>
              isAgencyCurrentlyVisible(m, fechaEnvioDeseada)
            );
            const mainMethods = visibleMethods.filter(
              m => m.tipo_formulario !== 'olva' && m.codigo !== 'olva'
            );
            const otherMethods = visibleMethods.filter(
              m => m.tipo_formulario === 'olva' || m.codigo === 'olva'
            );

            const renderMethodButton = (method: MetodoEnvio) => {
              const isShalom = method.tipo_formulario === 'shalom' || method.codigo === 'shalom';
              const isOlva = method.tipo_formulario === 'olva' || method.codigo === 'olva';
              const daysSummary = getAgencyDaysSummary(method);

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleMethodSelect(method.id)}
                  className="p-4 sm:p-5 rounded-3xl bg-white/4 hover:bg-white/8 active:scale-[0.98] border border-white/10 text-left transition-all flex items-center justify-between group cursor-pointer shadow-lg"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {isShalom ? (
                      <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/15 flex items-center justify-center p-2 group-hover:scale-105 transition-transform overflow-hidden shrink-0 shadow-inner">
                        <img src="/Shalom-Courier-Logo.webp" alt="Shalom Courier" className="w-full h-full object-contain" />
                      </div>
                    ) : isOlva ? (
                      <div className="w-12 h-12 rounded-2xl bg-[#FFDE00] border border-yellow-400/60 flex items-center justify-center p-1 group-hover:scale-105 transition-transform overflow-hidden shrink-0 shadow-md">
                        <img src="/Olva-Courier-Logo.svg" alt="Olva Courier" className="w-full h-full object-contain" />
                      </div>
                    ) : method.foto_url ? (
                      <div className="w-12 h-12 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center p-1 group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                        <img src={method.foto_url} alt={method.nombre} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-white/6 border border-white/10 text-cyan-400 flex items-center justify-center text-xl group-hover:scale-105 transition-transform shrink-0">
                        <Truck className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2 flex-wrap">
                        <span>{method.nombre}</span>
                        {isShalom && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600/25 text-red-400 border border-red-500/40 shadow-xs">
                            Shalom
                          </span>
                        )}
                        {isOlva && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-400/25 text-yellow-300 border border-yellow-400/40 shadow-xs">
                            Olva
                          </span>
                        )}
                        {daysSummary && daysSummary !== 'Todos los días hábiles' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            📅 {daysSummary}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {method.descripcion}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </button>
              );
            };

            return (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  Selecciona la opción de transporte de tu preferencia:
                </p>

                {/* Métodos Principales */}
                <div className="grid grid-cols-1 gap-3">
                  {mainMethods.map(renderMethodButton)}
                </div>

                {/* Sección Otras Agencias (Olva Courier y otras) */}
                {otherMethods.length > 0 && (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center gap-2.5 px-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <span>📦</span>
                        <span>Otras agencias</span>
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {otherMethods.map(renderMethodButton)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* =====================================================================
              PASO 3: DATOS DE ENTREGA & NOMBRE (COMPACTO CON EMOJIS)
              ===================================================================== */}
          {organicStep === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4 animate-fadeIn">
              
              {/* RAMA A: AGENCIA SHALOM */}
              {selectedMethod?.tipo_formulario === 'shalom' && (
                <div className="space-y-3.5">
                  
                  {/* Botones de Acción Superior */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleQuickNearest5}
                      disabled={isLocating}
                      className="py-3.5 sm:py-4 px-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/12 text-left transition-all flex items-center gap-3 group cursor-pointer shadow-md min-h-[58px]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <Navigation className={`w-4.5 h-4.5 ${isLocating ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">GPS</span>
                        <span className="block text-xs sm:text-sm font-black text-white leading-tight truncate">Sedes Cercanas</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      className="py-3.5 sm:py-4 px-3.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/12 text-left transition-all flex items-center gap-3 group cursor-pointer shadow-md min-h-[58px]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Visual</span>
                        <span className="block text-xs sm:text-sm font-black text-white leading-tight truncate">Ver en Mapa</span>
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
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-lg space-y-2.5">
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

                        <div className="pt-2 border-t border-white/6 space-y-1 text-xs text-slate-300">
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
                          className="w-full py-2 rounded-xl bg-white/6 hover:bg-white/12 text-xs font-bold text-cyan-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Buscar / Cambiar de Sede</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Botón para abrir buscador cuando no hay agencia seleccionada */}
                    {!selectedAgencyObject && !isAgencyListOpen && (
                      <button
                        type="button"
                        onClick={() => setIsAgencyListOpen(true)}
                        className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-cyan-400/50 text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <Search className="w-4 h-4 text-cyan-400" />
                        <span>Seleccionar Agencia Shalom de Destino</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    )}

                    {/* Buscador & Lista Flotante de Agencias (Solo visible cuando isAgencyListOpen=true) */}
                    {isAgencyListOpen && (
                      <div className="relative space-y-2 animate-fadeIn z-50">
                        
                        {/* Panel Flotante de Resultados: Solo aparece cuando isAgencyListOpen es TRUE */}
                        {isAgencyListOpen && (
                          <div className="absolute bottom-full mb-2.5 left-0 right-0 w-full z-50 max-h-[39vh] sm:max-h-[43vh] overflow-y-auto space-y-1.5 p-2.5 rounded-2xl bg-slate-950/98 backdrop-blur-2xl border-2 border-cyan-400/90 shadow-[0_25px_60px_rgba(0,0,0,0.95)] animate-fadeIn">
                            {shalomAgenciesList.length === 0 ? (
                              <p className="text-center text-xs text-slate-400 py-6">
                                No se encontraron agencias con &quot;{agencySearchQuery}&quot;
                              </p>
                            ) : (
                              shalomAgenciesList.slice(0, 35).map(ag => {
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
                                    className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                                      isSelected
                                        ? 'bg-cyan-500/25 border border-cyan-500/60 text-white shadow-md'
                                        : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
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

                            {selectedAgencyObject && (
                              <div className="pt-1 flex justify-center sticky bottom-0 bg-slate-950/95 py-1.5 backdrop-blur-md rounded-b-xl border-t border-white/8">
                                <button
                                  type="button"
                                  onClick={() => setIsAgencyListOpen(false)}
                                  className="px-4 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cerrar lista de agencias</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Input del Buscador */}
                        <div className="relative flex items-center">
                          <input
                            type="text"

                            value={agencySearchQuery}
                            onFocus={() => setIsAgencyListOpen(true)}
                            onClick={() => setIsAgencyListOpen(true)}
                            onChange={e => {
                              setAgencySearchQuery(e.target.value);
                              setIsAgencyListOpen(true);
                              if (showOnlyNearest5) setShowOnlyNearest5(false);
                            }}
                            placeholder="Buscar por distrito o provincia (ej. Pangoa co, Gamarra, Trujillo)..."
                            className="w-full pl-10 pr-9 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all font-medium"
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
                      </div>
                    )}
                  </div>

                  {/* DNI o CE con Emoji */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                        🪪 DNI o Carnet de Extranjería (CE) de quien recibirá *
                      </label>
                      {isResolvingDni && (
                        <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando en RENIEC/SUNAT...
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        value={dniShalom}
                        onChange={e => handleDniChange(e.target.value)}
                        placeholder="Número de DNI (8 dígitos) o CE"
                        className="w-full pl-5 pr-20 py-3.5 sm:py-4 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-mono font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 tracking-wider shadow-inner"
                      />
                      {dniShalom.length === 8 && (
                        <div className="absolute right-3 px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black text-xs tracking-wider shadow-sm animate-fadeIn pointer-events-none">
                          DNI
                        </div>
                      )}
                      {dniShalom.length === 9 && dniShalom.startsWith('00') && (
                        <div className="absolute right-3 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-xs tracking-wider shadow-sm animate-fadeIn pointer-events-none">
                          CE ✓
                        </div>
                      )}
                      {dniShalom.length === 9 && !dniShalom.startsWith('00') && (
                        <div className="absolute right-3 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-xs tracking-wider shadow-sm animate-fadeIn pointer-events-none">
                          CE inválido
                        </div>
                      )}
                      {dniShalom.length > 9 && (
                        <div className="absolute right-3 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-xs tracking-wider shadow-sm animate-fadeIn pointer-events-none">
                          Número inválido
                        </div>
                      )}
                    </div>
                    {dniShalom.length === 9 && !dniShalom.startsWith('00') && (
                      <p className="text-xs text-rose-400 font-semibold mt-1.5 flex items-center gap-1.5">
                        ⚠️ El CE de 9 dígitos debe comenzar con <span className="font-mono font-black text-rose-300">"00"</span> — ej: <span className="font-mono">001234567</span>
                      </p>
                    )}
                  </div>

                </div>
              )}

              {/* RAMA B: MOTORIZADO LOCAL LIMA */}
              {selectedMethod?.tipo_formulario === 'mapa_direccion' && (
                <div className="space-y-4">
                  
                  {/* SUBPASO 1: MAPA GIGANTE OBLIGATORIO */}
                  {motorizadoSubStep === 'map' && (
                    <div className="animate-fadeIn">
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
                            setInitialMapAddress(confirmedAddr);
                            localStorage.setItem('incomi_saved_address', confirmedAddr);
                          }
                          setLat(newLat);
                          setLng(newLng);
                          setMotorizadoSubStep('form');
                        }}
                      />
                    </div>
                  )}

                  {/* SUBPASO 2: FORMULARIO DE CONFIRMACIÓN CON BOTÓN DE VOLVER AL MAPA */}
                  {motorizadoSubStep === 'form' && (
                    <div className="space-y-4 animate-fadeIn">
                      
                      {/* Tarjeta de Resumen con Botón de Volver al Mapa */}
                      <div className="p-4 sm:p-5 rounded-3xl bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block">
                              Punto fijado en el Mapa ({distritoQuery || 'Lima'})
                            </span>
                            <p className="text-sm sm:text-base font-black text-white truncate">
                              {direccionExacta || 'Dirección seleccionada'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMotorizadoSubStep('map')}
                          className="px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-bold border border-cyan-500/40 flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all shadow-md"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Volver al Mapa</span>
                        </button>
                      </div>

                      {/* Casillas de Distrito y Dirección */}
                      <div className="p-5 sm:p-6 rounded-3xl bg-white/5 border-2 border-white/10 space-y-4 shadow-xl">
                        
                        <div className="space-y-2 relative">
                          <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
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
                              className="w-full pl-12 pr-4 py-4 sm:py-4.5 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 shadow-inner"
                            />
                            <Search className="w-5 h-5 text-cyan-400 absolute left-4 pointer-events-none" />
                          </div>

                          {showDistritoSuggestions && suggestedDistritos.length > 0 && (
                            <div className="absolute z-20 top-full mt-1.5 w-full max-h-56 overflow-y-auto bg-slate-900/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2">
                              {suggestedDistritos.map((distNombre, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setDistritoQuery(distNombre);
                                    setShowDistritoSuggestions(false);
                                  }}
                                  className="w-full text-left p-3.5 rounded-xl hover:bg-white/8 text-xs sm:text-sm text-white flex items-center justify-between transition-colors cursor-pointer"
                                >
                                  <span className="font-bold">{distNombre}</span>
                                  <span className="text-xs text-cyan-400 font-mono">Lima</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                            📍 Dirección Exacta (Calle, Pasaje, Número, Dpto) *
                          </label>
                          <input
                            type="text"
                            required
                            value={direccionExacta}
                            onChange={e => setDireccionExacta(e.target.value)}
                            placeholder="Ej. Av. Larco 1234, Dpto 402 / Pasaje Los Sauces 120"
                            className="w-full px-5 py-4 sm:py-4.5 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 shadow-inner"
                          />
                          
                          {/* Mensajes condicionales con recuadro azul para sugerencia y verde para recordatorio */}
                          {(!initialMapAddress || direccionExacta.trim() === initialMapAddress.trim()) ? (
                            <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/15 p-3 rounded-2xl border border-blue-500/30 font-medium mt-1.5 animate-fadeIn">
                              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                              <span>puedes especificar mas, la direccion si lo ves necesario</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/25 font-medium mt-1.5 animate-fadeIn">
                              <span className="text-base shrink-0">👁️</span>
                              <span><strong>Recordatorio:</strong> La dirección modificada debe ser acorde a la ubicación fijada en el mapa.</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                            🏷️ Referencia de Entrega (Opcional)
                          </label>
                          <input
                            type="text"
                            value={referencia}
                            onChange={e => setReferencia(e.target.value)}
                            placeholder="Ej. Frente al parque, rejas negras, timbre blanco"
                            className="w-full px-5 py-4 sm:py-4.5 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-inner"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* RAMA C: OLVA COURIER NACIONAL */}
              {selectedMethod?.tipo_formulario === 'olva' && (
                <div className="space-y-4">
                  {/* Selector de Modalidad: Para Agencia vs Para Domicilio */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      📦 ¿Cómo deseas recibir con Olva Courier? *
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setOlvaModalidad('agencia')}
                        className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
                          olvaModalidad === 'agencia'
                            ? 'bg-linear-to-r from-amber-500/25 to-yellow-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                            : 'bg-white/4 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          olvaModalidad === 'agencia' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/8 text-slate-400'
                        }`}>
                          🏢
                        </div>
                        <div>
                          <strong className="text-xs sm:text-sm font-black block leading-tight">Para Agencia Olva</strong>
                          <span className="text-[10px] text-slate-400 block">Recojo en sede oficial Olva</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOlvaModalidad('domicilio')}
                        className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
                          olvaModalidad === 'domicilio'
                            ? 'bg-linear-to-r from-amber-500/25 to-yellow-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                            : 'bg-white/4 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          olvaModalidad === 'domicilio' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-white/8 text-slate-400'
                        }`}>
                          🏠
                        </div>
                        <div>
                          <strong className="text-xs sm:text-sm font-black block leading-tight">Para Domicilio</strong>
                          <span className="text-[10px] text-slate-400 block">Directo a tu casa / trabajo</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* MODALIDAD 1: RECOJO EN AGENCIA OLVA CON MAPA, GPS Y 376 SEDES */}
                  {olvaModalidad === 'agencia' && (
                    <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/5 border-2 border-amber-500/30 space-y-4 shadow-xl animate-fadeIn">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 text-base">🚚</span>
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            Directorio Nacional de Agencias Olva (376 Sedes)
                          </span>
                        </div>

                        {olvaAgencySearchQuery && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                            {olvaAgenciesList.length} sede{olvaAgenciesList.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {/* Botones de Acción Rápida: Abrir Mapa & Encontrar Cercanas con GPS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowOlvaMapModal(true)}
                          className="w-full py-3.5 sm:py-4 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs sm:text-sm font-black border border-amber-500/40 flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:scale-98 min-h-[54px]"
                        >
                          <MapPin className="w-4.5 h-4.5 text-amber-400" />
                          <span>🗺️ Ver Mapa de Agencias Olva</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await triggerOlvaGpsLookup();
                            setIsOlvaAgencyListOpen(true);
                          }}
                          disabled={isLocatingOlva}
                          className="w-full py-3.5 sm:py-4 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-black border border-amber-500/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 min-h-[54px]"
                        >
                          <Navigation className={`w-4.5 h-4.5 text-amber-400 ${isLocatingOlva ? 'animate-spin' : ''}`} />
                          <span>{isLocatingOlva ? 'Localizando...' : '📍 5 Sedes Más Cercanas'}</span>
                        </button>
                      </div>

                      {gpsErrorOlva && (
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{gpsErrorOlva}</span>
                        </div>
                      )}

                      {/* Filtro por Departamentos de Olva */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                          Filtrar por Departamento:
                        </label>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                          {DEPARTAMENTOS_OLVA.map(dep => {
                            const isSel = (departamentoOlva || 'TODOS') === dep;
                            return (
                              <button
                                key={dep}
                                type="button"
                                onClick={() => {
                                  setDepartamentoOlva(dep);
                                  setShowOnlyNearest5Olva(false);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                  isSel
                                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                                    : 'bg-white/6 hover:bg-white/12 text-slate-300 border border-white/10'
                                }`}
                              >
                                {dep}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tarjeta de Agencia Olva Seleccionada */}
                      {selectedOlvaAgencyObject && !isOlvaAgencyListOpen && (
                        <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 space-y-2.5 shadow-lg animate-fadeIn">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                                Sede Olva Seleccionada ({selectedOlvaAgencyObject.tipo || 'TIENDA'})
                              </span>
                              <h4 className="text-sm font-black text-white">
                                {selectedOlvaAgencyObject.departamento} / {selectedOlvaAgencyObject.provincia} / {selectedOlvaAgencyObject.distrito}
                              </h4>
                            </div>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1 shrink-0">
                              <CheckCircle className="w-3 h-3" />
                              <span>Confirmada</span>
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-200">
                            <p className="leading-snug">
                              <strong className="text-white">📍 Dirección:</strong> {cleanOlvaAddressText(selectedOlvaAgencyObject.direccion || selectedOlvaAgencyObject.address, selectedOlvaAgencyObject.provincia, selectedOlvaAgencyObject.departamento)}
                            </p>
                            {selectedOlvaAgencyObject.horario && (
                              <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>{selectedOlvaAgencyObject.horario}</span>
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsOlvaAgencyListOpen(true)}
                            className="w-full py-2 rounded-xl bg-white/8 hover:bg-white/15 text-xs font-bold text-amber-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Buscar / Cambiar de Sede Olva</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Botón para abrir buscador Olva cuando no hay agencia seleccionada */}
                      {!selectedOlvaAgencyObject && !isOlvaAgencyListOpen && (
                        <button
                          type="button"
                          onClick={() => setIsOlvaAgencyListOpen(true)}
                          className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-amber-400/50 text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <Search className="w-4 h-4 text-amber-400" />
                          <span>Seleccionar Agencia Olva de Destino</span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                      )}

                      {/* Buscador & Lista Flotante de Agencias Olva (Solo visible cuando isOlvaAgencyListOpen=true) */}
                      {isOlvaAgencyListOpen && (
                        <div className="relative space-y-2 animate-fadeIn z-50">
                          
                          {/* Panel Flotante de Resultados: Solo aparece cuando isOlvaAgencyListOpen es TRUE */}
                          {isOlvaAgencyListOpen && (
                            <div className="absolute bottom-full mb-2.5 left-0 right-0 w-full z-50 max-h-[39vh] sm:max-h-[43vh] overflow-y-auto space-y-1.5 p-2.5 rounded-2xl bg-slate-950/98 backdrop-blur-2xl border-2 border-amber-400/90 shadow-[0_25px_60px_rgba(0,0,0,0.95)] animate-fadeIn">
                              {olvaAgenciesList.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-6">
                                  No se encontraron agencias Olva con &quot;{olvaAgencySearchQuery}&quot;
                                </p>
                              ) : (
                                olvaAgenciesList.slice(0, 35).map(ag => {
                                  const isSelected = selectedOlvaAgencyObject?.id === ag.id;
                                  const cleanAddr = cleanOlvaAddressText(ag.direccion || ag.address, ag.provincia, ag.departamento);
                                  const distanceText = ag.distance_meters !== undefined
                                    ? (ag.distance_meters < 1000 ? `${Math.round(ag.distance_meters)} m` : `${(ag.distance_meters / 1000).toFixed(1)} km`)
                                    : null;

                                  const titleText = `${ag.departamento || ''} / ${ag.provincia || ''} / ${ag.distrito || ag.nombre || ''} (${ag.tipo || 'TIENDAS'})`;

                                  return (
                                    <button
                                      key={ag.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedOlvaAgencyObject(ag);
                                        setOlvaDireccion(formatFullOlvaAgencyName(ag));
                                        if (ag.departamento) setDepartamentoOlva(ag.departamento);
                                        setIsOlvaAgencyListOpen(false);
                                      }}
                                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                                        isSelected
                                          ? 'bg-amber-500/25 border border-amber-500/60 text-white shadow-md'
                                          : 'bg-white/4 hover:bg-white/8 border border-white/8 text-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <h5 className="text-xs font-bold text-white tracking-tight leading-snug">
                                          <HighlightMatch text={titleText} query={olvaAgencySearchQuery} />
                                        </h5>

                                        {distanceText && (
                                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full shrink-0 border border-amber-500/30">
                                            📍 {distanceText}
                                          </span>
                                        )}
                                      </div>

                                      <p className="text-[11px] text-slate-300 leading-snug">
                                        <HighlightMatch text={cleanAddr || 'Dirección de sede Olva'} query={olvaAgencySearchQuery} />
                                      </p>

                                      {ag.horario && (
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                          <span>🕒</span>
                                          <span>{ag.horario}</span>
                                        </p>
                                      )}
                                    </button>
                                  );
                                })
                              )}

                              {selectedOlvaAgencyObject && (
                                <div className="pt-1 flex justify-center sticky bottom-0 bg-slate-950/95 py-1.5 backdrop-blur-md rounded-b-xl border-t border-white/8">
                                  <button
                                    type="button"
                                    onClick={() => setIsOlvaAgencyListOpen(false)}
                                    className="px-4 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cerrar lista de agencias</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Input del Buscador Olva */}
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={olvaAgencySearchQuery}
                              onFocus={() => setIsOlvaAgencyListOpen(true)}
                              onClick={() => setIsOlvaAgencyListOpen(true)}
                              onChange={e => {
                                setOlvaAgencySearchQuery(e.target.value);
                                setIsOlvaAgencyListOpen(true);
                                if (showOnlyNearest5Olva) setShowOnlyNearest5Olva(false);
                              }}
                              placeholder="Buscar sede Olva por distrito, calle o nombre (ej. Pangoa, Miraflores, Cusco)..."
                              className="w-full pl-10 pr-9 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all font-medium"
                            />
                            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 pointer-events-none" />
                            {olvaAgencySearchQuery && (
                              <button
                                type="button"
                                onClick={() => setOlvaAgencySearchQuery('')}
                                className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center absolute right-2.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODALIDAD 2: DIRECCIÓN EXACTA A DOMICILIO */}
                  {olvaModalidad === 'domicilio' && (
                    <div className="p-4 sm:p-5 rounded-3xl bg-white/4 border border-amber-400/30 space-y-3.5 shadow-xl animate-fadeIn">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/8 text-xs font-black text-amber-300 uppercase tracking-wider">
                        <span>🏠</span>
                        <span>Dirección Exacta de Entrega a Domicilio</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                          📍 Dirección Exacta (Calle, Avenida, Número, Dpto, Distrito y Ciudad) *
                        </label>
                        <input
                          type="text"
                          required
                          value={olvaDireccion}
                          onChange={e => setOlvaDireccion(e.target.value)}
                          placeholder="Ej. Av. Los Fresnos 345, Dpto 302, Urb. Sol de Oro, Los Olivos, Lima"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                          🏷️ Referencia de Entrega (Opcional)
                        </label>
                        <input
                          type="text"
                          value={olvaReferencia}
                          onChange={e => setOlvaReferencia(e.target.value)}
                          placeholder="Ej. Frente al parque Los Jazmines, portón negro, timbre blanco"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* DATOS DE QUIEN RECIBE (CLIENTA) */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-white/4 border border-amber-400/30 space-y-3.5 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/8 text-xs font-black text-amber-300 uppercase tracking-wider">
                      <span>👤</span>
                      <span>Datos Obligatorios de Quien Recibe (Clienta)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* DNI (cliente) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                            🪪 DNI o CE (Cliente) *
                          </label>
                          {isResolvingDni && (
                            <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                            </span>
                          )}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            required
                            value={dniShalom}
                            onChange={e => handleDniChange(e.target.value)}
                            placeholder="Ej. 72345678 o CE"
                            className="w-full pl-4 pr-16 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                          {dniShalom.length === 8 && (
                            <div className="absolute right-2.5 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-[11px] tracking-wider pointer-events-none animate-fadeIn">
                              DNI
                            </div>
                          )}
                          {dniShalom.length === 9 && dniShalom.startsWith('00') && (
                            <div className="absolute right-2.5 px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black text-[11px] tracking-wider pointer-events-none animate-fadeIn">
                              CE ✓
                            </div>
                          )}
                          {dniShalom.length === 9 && !dniShalom.startsWith('00') && (
                            <div className="absolute right-2.5 px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-[11px] tracking-wider pointer-events-none animate-fadeIn">
                              CE inválido
                            </div>
                          )}
                          {dniShalom.length > 9 && (
                            <div className="absolute right-2 px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-[10px] tracking-wider pointer-events-none animate-fadeIn">
                              Número inválido
                            </div>
                          )}
                        </div>
                        {dniShalom.length === 9 && !dniShalom.startsWith('00') && (
                          <p className="text-[11px] text-rose-400 font-semibold mt-1 flex items-center gap-1">
                            ⚠️ El CE de 9 dígitos debe comenzar con <span className="font-mono font-black text-rose-300">"00"</span> — ej: <span className="font-mono">001234567</span>
                          </p>
                        )}
                      </div>

                      {/* CELULAR (cliente) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                          📱 Celular / WhatsApp (Cliente) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={whatsapp}
                          onChange={e => setWhatsapp(formatPhoneWithSpaces(e.target.value))}
                          placeholder="987 654 321"
                          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Correo cliente (cliente) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        📧 Correo Electrónico (Cliente) *
                      </label>
                      <input
                        type="email"
                        required
                        value={correoCliente}
                        onChange={e => setCorreoCliente(e.target.value)}
                        placeholder="ejemplo@gmail.com"
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <p className="text-[10px] text-slate-400">Olva Courier enviará notificaciones del estado del envío a este correo.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* RAMA D: OTRO MÉTODO PERSONALIZADO */}
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
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-base text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none"
                  />
                </div>
              )}

              {/* CAMPOS PERSONALIZADOS ADICIONALES DE LA AGENCIA (Solo preguntas adicionales para no duplicar datos) */}
              {(() => {
                const isNativeDuplicateField = (campo: CampoPersonalizadoAgencia) => {
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

                const extraFields = (selectedMethod?.campos_personalizados || []).filter(c => !isNativeDuplicateField(c));

                if (extraFields.length === 0 || (selectedMethod?.tipo_formulario === 'mapa_direccion' && motorizadoSubStep !== 'form')) {
                  return null;
                }

                return (
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border-2 border-indigo-500/30 space-y-3.5 shadow-xl animate-fadeIn">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/8 text-xs font-black text-indigo-300 uppercase tracking-wider">
                      <span>📋</span>
                      <span>Información Adicional para {selectedMethod.nombre}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {extraFields.map(campo => {
                        const val = customFieldValues[campo.id] ?? customFieldValues[campo.label] ?? '';
                        return (
                          <div key={campo.id} className={campo.tipo === 'textarea' ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                              {campo.label} {campo.requerido && <span className="text-rose-400">*</span>}
                            </label>

                            {campo.tipo === 'textarea' ? (
                              <textarea
                                rows={2}
                                required={campo.requerido}
                                value={val}
                                onChange={e => handleCustomFieldChange(campo.id, e.target.value)}
                                placeholder={campo.placeholder || `Ingresa ${campo.label}...`}
                                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
                              />
                            ) : (
                              <input
                                type={campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'numero' ? 'number' : 'text'}
                                required={campo.requerido}
                                value={val}
                                onChange={e => handleCustomFieldChange(campo.id, e.target.value)}
                                placeholder={campo.placeholder || `Ingresa ${campo.label}...`}
                                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner font-medium"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* NOMBRE Y APELLIDOS (Solo se muestra cuando no estamos en la selección del mapa de motorizado) */}
              {(selectedMethod?.tipo_formulario !== 'mapa_direccion' || motorizadoSubStep === 'form') && (
                <>
                  <div className="space-y-2 pt-2 border-t border-white/8">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                        👤 Nombres y Apellidos *
                      </label>
                      {isResolvingDni && (
                        <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Autocompletando...
                        </span>
                      )}
                      {dniSource && !isResolvingDni && (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-fadeIn">
                          Autorellenado
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        value={nombreCompleto}
                        onChange={e => setNombreCompleto(e.target.value)}
                        placeholder="Ej. Carlos Mendoza Ramos"
                        className={`w-full pl-12 pr-4.5 py-4 sm:py-4.5 bg-white/6 border-2 rounded-2xl text-base sm:text-lg font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-inner transition-colors ${
                          dniSource ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-white/15'
                        }`}
                      />
                      <User className={`w-5 h-5 absolute left-4 pointer-events-none ${dniSource ? 'text-emerald-400' : 'text-cyan-400'}`} />
                    </div>
                  </div>

                  {/* Celular / WhatsApp para Motorizado y Otros Métodos (Shalom y Olva ya lo tienen en su sección) */}
                  {selectedMethod?.tipo_formulario !== 'shalom' && selectedMethod?.tipo_formulario !== 'olva' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                        📱 Celular / WhatsApp de Contacto *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="tel"
                          required
                          value={whatsapp}
                          onChange={e => setWhatsapp(formatPhoneWithSpaces(e.target.value))}
                          placeholder="987 654 321"
                          maxLength={11}
                          className="w-full pl-5 pr-4 py-3.5 sm:py-4 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-mono font-bold text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 tracking-wider shadow-inner"
                        />
                      </div>
                    </div>
                  )}

                  {/* Casilla: Fecha Deseada de Envío / Despacho con Restricción de Corte Horario */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                        📅 Fecha en la que deseas el Envío / Despacho *
                      </label>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                        cutoffStatus.isPastCutoff
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {cutoffStatus.isPastCutoff ? '⏰ Corte de hoy finalizado' : '⚡ Despacho hoy disponible'}
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="date"
                        required
                        min={minShippingDate}
                        value={fechaEnvioDeseada}
                        onChange={e => {
                          const selected = e.target.value;
                          if (selected && selected < minShippingDate) {
                            setFechaEnvioDeseada(minShippingDate);
                          } else {
                            setFechaEnvioDeseada(selected);
                          }
                        }}
                        className="w-full pl-12 pr-4.5 py-4 sm:py-4.5 bg-white/6 border-2 border-white/15 rounded-2xl text-base sm:text-lg font-bold text-cyan-300 placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-inner font-mono cursor-pointer"
                      />
                      <Calendar className="w-5 h-5 text-cyan-400 absolute left-4 pointer-events-none" />
                    </div>

                    {/* Aviso Explicativo del Horario de Corte */}
                    <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 shadow-md animate-fadeIn ${
                      cutoffStatus.isPastCutoff
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    }`}>
                      {cutoffStatus.isPastCutoff ? (
                        <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className="font-bold text-white block">
                          {cutoffStatus.isPastCutoff ? '⏰ Información del Despacho:' : '⚡ Despacho el Mismo Día:'}
                        </span>
                        <p className="leading-snug">{cutoffStatus.noticeText}</p>
                      </div>
                    </div>

                    {/* Alerta Inteligente de Disponibilidad de la Agencia */}
                    {selectedMethod && (() => {
                      const agencyDateStatus = isAgencyDateAllowed(selectedMethod, fechaEnvioDeseada);
                      if (agencyDateStatus.allowed) return null;

                      return (
                        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-fadeIn shadow-md">
                          <div className="flex items-center gap-2 font-black text-amber-300">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Aviso de Despacho para {selectedMethod.nombre}</span>
                          </div>
                          <p className="text-[11.5px] leading-relaxed">
                            {agencyDateStatus.reason}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const nextValid = getNextAvailableDateForAgency(selectedMethod, fechaEnvioDeseada, minShippingDate);
                              setFechaEnvioDeseada(nextValid);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer active:scale-95"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Cambiar al próximo día disponible</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>



                  {errorMsg && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="big-btn-primary py-4.5 sm:py-5 text-base sm:text-lg font-black mt-2 shadow-2xl"
                  >
                    {submitting ? (
                      <span>Registrando Envío...</span>
                    ) : (
                      <>
                        <span>Confirmar y Finalizar Pedido</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          )}

        </div>
      )}

      {/* Encomi AI Interactive FAQ Chat Modal */}
      {showEncomiAiModal && (
        <EncomiAiChatModal
          initialOrder={createdOrder}
          clientName={nombreCompleto || 'Cliente'}
          clientId={currentUser?.id || 'guest'}
          isAdmin={currentUser?.rol === 'empresa'}
          onClose={() => setShowEncomiAiModal(false)}
        />
      )}

    </div>
  );
};
