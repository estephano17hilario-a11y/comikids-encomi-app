import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, EstadoEnvio, EstadoProduccion, ShalomAgency, OlvaAgency } from '../../types/database.types';
import { useShalomAgencies, formatFullAgencyName, cleanAddressText } from '../../hooks/useShalomAgencies';
import { useOlvaAgencies, formatFullOlvaAgencyName, cleanOlvaAddressText } from '../../hooks/useOlvaAgencies';
import { ShalomAgenciesMap } from '../client/ShalomAgenciesMap';
import { OlvaAgenciesMap } from '../client/OlvaAgenciesMap';
import { DEPARTAMENTOS_PERU } from '../../data/shalomAgencies';
import { DEPARTAMENTOS_OLVA } from '../../data/olvaAgencies';
import { extractShalomDestino } from '../../utils/shalomAgencyResolver';
import { DniService } from '../../services/dniService';
import { getDailyShalomPin } from '../../utils/formatters';
import {
  X,
  Save,
  Package,
  MapPin,
  User,
  FileText,
  Phone,
  CreditCard,
  Search,
  Building,
  Clock,
  CheckCircle2,
  ChevronDown,
  Navigation,
  Sparkles,
  AlertCircle,
  Truck,
  Edit3,
  Building2,
  Loader2,
  Calendar
} from 'lucide-react';


interface Props {
  pedido: Pedido;
  onClose: () => void;
  onSave: (pedidoId: string, updates: Partial<Pedido>) => Promise<void>;
}

// Componente para resaltar coincidencias en la búsqueda de agencias
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

export const EditOrderModal: React.FC<Props> = ({ pedido, onClose, onSave }) => {
  // Datos del Cliente
  const initialClientName =
    pedido.usuario?.nombre_completo ||
    (pedido.detalles_bordado?.includes('Envío de Mercadería para ')
      ? pedido.detalles_bordado.replace(/^Envío de Mercadería para\s+/i, '').trim()
      : '');

  const [nombreCliente, setNombreCliente] = useState(initialClientName);
  const [telefonoCliente, setTelefonoCliente] = useState(pedido.usuario?.telefono_default || '');
  const [dniCliente, setDniCliente] = useState(pedido.usuario?.dni || '');
  const [fechaEnvioCliente, setFechaEnvioCliente] = useState(pedido.fecha_limite || '');
  const [isResolvingDni, setIsResolvingDni] = useState(false);
  const [dniSource, setDniSource] = useState<string | null>(null);

  const handleDniInputChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 12);
    setDniCliente(clean);
    if (!dniRecojoShalom) handleShalomDniChange(clean);
    if (!olvaDni) setOlvaDni(clean);

    if (clean.length === 8) {
      setIsResolvingDni(true);
      try {
        const res = await DniService.lookupByDni(clean);
        if (res.success && res.data?.nombreCompleto) {
          setNombreCliente(res.data.nombreCompleto);
          setDniSource(res.source || 'sunat_padron_local');
        }
      } catch (err) {
        console.warn('[DNI LOOKUP WARN]', err);
      } finally {
        setIsResolvingDni(false);
      }
    } else {
      setDniSource(null);
    }
  };

  // Detección inicial del método / courier
  const detectInitialCourier = (): 'shalom' | 'olva' | 'motorizado' | 'otro' => {
    const code = (pedido.metodo_envio_codigo || '').toLowerCase();
    const dest = (pedido.destino_detalle || '').toLowerCase();

    if (code === 'olva' || dest.includes('olva')) return 'olva';
    if (code === 'motorizado' || dest.includes('motorizado')) return 'motorizado';
    if (code === 'shalom' || dest.includes('shalom')) return 'shalom';
    return 'shalom';
  };

  const [selectedCourier, setSelectedCourier] = useState<'shalom' | 'olva' | 'motorizado' | 'otro'>(detectInitialCourier);

  // Hook & Estado para Shalom (Catálogo DB)
  const {
    agencies: shalomAgenciesList,
    allAgencies: allShalomAgencies,
    selectedDepartment: departamentoShalom,
    setSelectedDepartment: setDepartamentoShalom,
    searchQuery: shalomSearchQuery,
    setSearchQuery: setShalomSearchQuery,
    isLocating: isLocatingShalom,
    triggerGpsLookup: triggerShalomGpsLookup,
    userLocation: userLocationShalom,
    gpsError: gpsErrorShalom,
  } = useShalomAgencies({ initialDepartment: 'TODOS' });

  const [selectedShalomAgency, setSelectedShalomAgency] = useState<ShalomAgency | null>(null);
  const [isShalomListOpen, setIsShalomListOpen] = useState(false);
  const [showShalomMapModal, setShowShalomMapModal] = useState(false);

  // Extracción de DNI de recojo Shalom
  const initialShalomDni = useMemo(() => {
    const match = (pedido.destino_detalle || '').match(/\b(?:DNI[\s\/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i);
    const candidate = match && match[1] ? match[1].trim() : '';
    if (candidate && candidate.toUpperCase() !== 'NCIADOS' && candidate.replace(/\D/g, '').length >= 6) {
      return candidate;
    }
    return (pedido.usuario?.dni && pedido.usuario.dni !== 'NCIADOS') ? pedido.usuario.dni : '';
  }, [pedido]);

  const [dniRecojoShalom, setDniRecojoShalom] = useState(initialShalomDni);

  // Hook & Estado para Olva (Catálogo DB)
  const {
    agencies: olvaAgenciesList,
    allAgencies: allOlvaAgencies,
    selectedDepartment: departamentoOlva,
    setSelectedDepartment: setDepartamentoOlva,
    searchQuery: olvaSearchQuery,
    setSearchQuery: setOlvaSearchQuery,
    isLocating: isLocatingOlva,
    locateAndSort: triggerOlvaGpsLookup,
    userLocation: userLocationOlva,
    gpsError: gpsErrorOlva,
  } = useOlvaAgencies({ initialDepartment: 'TODOS', autoFetchNearby: true });

  const [olvaModalidad, setOlvaModalidad] = useState<'agencia' | 'domicilio'>(() => {
    if (pedido.destino_detalle?.toLowerCase().includes('domicilio')) return 'domicilio';
    return 'agencia';
  });

  const [selectedOlvaAgency, setSelectedOlvaAgency] = useState<OlvaAgency | null>(null);
  const [isOlvaListOpen, setIsOlvaListOpen] = useState(false);
  const [showOlvaMapModal, setShowOlvaMapModal] = useState(false);

  // Datos adicionales para Olva (DNI, Tel, Correo, Dirección domicilio, Referencia)
  const [olvaDni, setOlvaDni] = useState(() => {
    const match = (pedido.destino_detalle || '').match(/DNI:\s*([^\s•]+)/i);
    return match ? match[1].trim() : (pedido.usuario?.dni || '');
  });
  const [olvaTel, setOlvaTel] = useState(() => {
    const match = (pedido.destino_detalle || '').match(/Tel:\s*([^\s•]+)/i);
    return match ? match[1].trim() : (pedido.usuario?.telefono_default || '');
  });
  const [olvaEmail, setOlvaEmail] = useState(() => {
    const match = (pedido.destino_detalle || '').match(/Correo:\s*([^\s•]+)/i);
    return match ? match[1].trim() : (pedido.usuario?.email_default || '');
  });
  const [olvaDireccion, setOlvaDireccion] = useState(() => {
    const match = (pedido.destino_detalle || '').match(/Olva Courier \((?:Domicilio|Agencia)\):\s*([^•(]+)/i);
    return match ? match[1].trim() : '';
  });
  const [olvaReferencia, setOlvaReferencia] = useState(() => {
    const match = (pedido.destino_detalle || '').match(/Ref:\s*([^)]+)/i);
    return match ? match[1].trim() : (pedido.observaciones_cliente || '');
  });

  // Motorizado / Destino Genérico
  const [motorizadoDireccion, setMotorizadoDireccion] = useState(() => {
    if (pedido.metodo_envio_codigo === 'motorizado' || pedido.destino_detalle?.includes('Motorizado')) {
      return pedido.destino_detalle.replace(/^Motorizado[^:]*:\s*/i, '').trim();
    }
    return pedido.destino_detalle || '';
  });

  // Destino Detalle final string
  const [destinoDetalle, setDestinoDetalle] = useState(pedido.destino_detalle || '');
  const [isManualDestinoEdit, setIsManualDestinoEdit] = useState(false);

  // Otros campos
  const [detallesBordado, setDetallesBordado] = useState(pedido.detalles_bordado || '');
  const [observaciones, setObservaciones] = useState(pedido.observaciones_cliente || '');
  const [claveRecojo, setClaveRecojo] = useState(pedido.shalom_clave_recojo || getDailyShalomPin());
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>(pedido.estado_envio);
  const [estadoProduccion, setEstadoProduccion] = useState<EstadoProduccion>(pedido.estado_produccion);
  const [saving, setSaving] = useState(false);

  // Bloquear scroll de fondo
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Intentar pre-seleccionar agencia Shalom si coincide en el catálogo
  useEffect(() => {
    if (selectedCourier === 'shalom' && allShalomAgencies.length > 0 && !selectedShalomAgency) {
      const dest = pedido.destino_detalle || '';
      // 1. Coincidencia por código (CÓDIGO: XXX)
      const codeMatch = dest.match(/\(CÓDIGO:\s*([^)]+)\)/i);
      if (codeMatch && codeMatch[1]) {
        const found = allShalomAgencies.find(a => a.code && a.code.toUpperCase().trim() === codeMatch[1].toUpperCase().trim());
        if (found) {
          setSelectedShalomAgency(found);
          return;
        }
      }
      // 2. Coincidencia por nombre / distrito
      const foundByName = allShalomAgencies.find(a => {
        const dist = (a.distrito || a.district || '').toUpperCase().trim();
        const prov = (a.provincia || a.province || '').toUpperCase().trim();
        return dist.length > 2 && dest.toUpperCase().includes(dist) && dest.toUpperCase().includes(prov);
      });
      if (foundByName) {
        setSelectedShalomAgency(foundByName);
      }
    }
  }, [selectedCourier, allShalomAgencies, selectedShalomAgency, pedido.destino_detalle]);

  // Intentar pre-seleccionar agencia Olva si coincide en el catálogo
  useEffect(() => {
    if (selectedCourier === 'olva' && olvaModalidad === 'agencia' && allOlvaAgencies.length > 0 && !selectedOlvaAgency) {
      const dest = pedido.destino_detalle || '';
      const found = allOlvaAgencies.find(a => {
        const dist = (a.distrito || a.district || '').toUpperCase().trim();
        const prov = (a.provincia || a.province || '').toUpperCase().trim();
        return dist.length > 2 && dest.toUpperCase().includes(dist) && dest.toUpperCase().includes(prov);
      });
      if (found) {
        setSelectedOlvaAgency(found);
      }
    }
  }, [selectedCourier, olvaModalidad, allOlvaAgencies, selectedOlvaAgency, pedido.destino_detalle]);

  // Sincronizar destinoDetalle cuando se selecciona agencia Shalom o cambia el DNI de recojo
  const handleSelectShalomAgency = (agency: ShalomAgency) => {
    setSelectedShalomAgency(agency);
    setIsShalomListOpen(false);
    setShowShalomMapModal(false);
    if (agency.departamento) setDepartamentoShalom(agency.departamento);

    const fullAgencyStr = formatFullAgencyName(agency);
    const docRecojo = dniRecojoShalom.trim() || dniCliente.trim() || 'No especificado';
    const newDestino = `Agencia Shalom: ${fullAgencyStr} (DNI/CE Recojo: ${docRecojo})`;
    setDestinoDetalle(newDestino);
  };

  const handleShalomDniChange = (newDni: string) => {
    setDniRecojoShalom(newDni);
    if (selectedShalomAgency) {
      const fullAgencyStr = formatFullAgencyName(selectedShalomAgency);
      const docRecojo = newDni.trim() || dniCliente.trim() || 'No especificado';
      setDestinoDetalle(`Agencia Shalom: ${fullAgencyStr} (DNI/CE Recojo: ${docRecojo})`);
    }
  };

  // Sincronizar destinoDetalle cuando se selecciona agencia Olva
  const handleSelectOlvaAgency = (agency: OlvaAgency) => {
    setSelectedOlvaAgency(agency);
    setIsOlvaListOpen(false);
    setShowOlvaMapModal(false);
    if (agency.departamento) setDepartamentoOlva(agency.departamento);

    const fullAgencyStr = formatFullOlvaAgencyName(agency);
    const doc = olvaDni.trim() || dniCliente.trim() || 'No especificado';
    const tel = olvaTel.trim() || telefonoCliente.trim() || 'No especificado';
    const email = olvaEmail.trim() || 'No especificado';
    const newDestino = `Olva Courier (Agencia): ${fullAgencyStr} • DNI: ${doc} • Tel: ${tel} • Correo: ${email}`;
    setDestinoDetalle(newDestino);
  };

  // Sincronizar destinoDetalle para Olva Domicilio
  const updateOlvaDomicilio = (newDir?: string, newRef?: string, newDni?: string, newTel?: string, newEmail?: string) => {
    const dir = newDir !== undefined ? newDir : olvaDireccion;
    const ref = newRef !== undefined ? newRef : olvaReferencia;
    const doc = newDni !== undefined ? newDni : (olvaDni || dniCliente);
    const tel = newTel !== undefined ? newTel : (olvaTel || telefonoCliente);
    const email = newEmail !== undefined ? newEmail : olvaEmail;

    const refStr = ref.trim() ? ` (Ref: ${ref.trim()})` : '';
    const newDestino = `Olva Courier (Domicilio): ${dir.trim()}${refStr} • DNI: ${doc.trim() || 'No especificado'} • Tel: ${tel.trim() || 'No especificado'} • Correo: ${email.trim() || 'No especificado'}`;
    setDestinoDetalle(newDestino);
  };

  // Guardar cambios
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalNombre = nombreCliente.trim() || 'Cliente';
      const finalPhone = telefonoCliente.trim().replace(/\D/g, '');
      const finalDni = dniCliente.trim().toUpperCase() || pedido.usuario_id;
      const updatedDetalles = detallesBordado.trim() || `Envío de Mercadería para ${finalNombre}`;

      // Determinar método de envío código y nombre
      let finalMetodoCodigo = selectedCourier;
      let finalMetodoNombre = 'Agencia Shalom Nacional';
      if (selectedCourier === 'olva') {
        finalMetodoNombre = 'Olva Courier Nacional';
      } else if (selectedCourier === 'motorizado') {
        finalMetodoNombre = 'Motorizado Local Lima';
      } else if (selectedCourier === 'otro') {
        finalMetodoNombre = 'Entrega Personalizada';
      }

      // Destino final
      let finalDestino = destinoDetalle.trim();
      if (!finalDestino) {
        if (selectedCourier === 'shalom' && selectedShalomAgency) {
          finalDestino = `Agencia Shalom: ${formatFullAgencyName(selectedShalomAgency)} (DNI/CE Recojo: ${dniRecojoShalom.trim() || finalDni})`;
        } else if (selectedCourier === 'olva' && olvaModalidad === 'agencia' && selectedOlvaAgency) {
          finalDestino = `Olva Courier (Agencia): ${formatFullOlvaAgencyName(selectedOlvaAgency)} • DNI: ${olvaDni.trim() || finalDni} • Tel: ${olvaTel.trim() || finalPhone} • Correo: ${olvaEmail.trim()}`;
        } else if (selectedCourier === 'motorizado') {
          finalDestino = `Motorizado Local Lima: ${motorizadoDireccion.trim()}`;
        } else {
          finalDestino = 'Entrega acordada en taller';
        }
      }

      await onSave(pedido.id, {
        metodo_envio_codigo: finalMetodoCodigo,
        metodo_envio_nombre: finalMetodoNombre,
        destino_detalle: finalDestino,
        detalles_bordado: updatedDetalles,
        observaciones_cliente: observaciones.trim(),
        fecha_limite: fechaEnvioCliente || undefined,
        shalom_clave_recojo: claveRecojo.trim() || getDailyShalomPin(),
        estado_envio: estadoEnvio,
        estado_produccion: estadoProduccion,
        usuario: {
          id: pedido.usuario?.id || pedido.usuario_id || ('usr-' + Date.now().toString(36)),
          dni: finalDni,
          nombre_completo: finalNombre,
          telefono_default: finalPhone || undefined,
          email_default: olvaEmail.trim() || pedido.usuario?.email_default || undefined,
          password_hash: pedido.usuario?.password_hash || 'incomi2026',
          rol: pedido.usuario?.rol || 'client',
          avatar_url: pedido.usuario?.avatar_url || '',
          puntos_xp: pedido.usuario?.puntos_xp || 0,
          nivel: pedido.usuario?.nivel || 1,
          created_at: pedido.usuario?.created_at || new Date().toISOString(),
        },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/10 p-5 sm:p-7 shadow-2xl shadow-cyan-500/10 space-y-5 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Editar Datos del Despacho</h3>
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 font-mono">
                <span className="text-cyan-300 font-bold">#{pedido.codigo_seguimiento}</span>
                {pedido.created_at && (
                  <span>• Creado: {new Date(pedido.created_at).toLocaleDateString('es-PE')} {new Date(pedido.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
                {pedido.updated_at && (
                  <span className="text-amber-300">• Última ed: {new Date(pedido.updated_at).toLocaleDateString('es-PE')} {new Date(pedido.updated_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Datos del Cliente y Fecha de Envío */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Nombre Clienta *
                </label>
                {isResolvingDni && (
                  <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                  </span>
                )}
                {dniSource && !isResolvingDni && (
                  <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                    Autorellenado
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={nombreCliente}
                onChange={e => setNombreCliente(e.target.value)}
                placeholder="Ej. María Pérez"
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-bold transition-colors ${
                  dniSource ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                WhatsApp / Teléfono
              </label>
              <input
                type="tel"
                value={telefonoCliente}
                onChange={e => {
                  setTelefonoCliente(e.target.value);
                  if (!olvaTel) setOlvaTel(e.target.value);
                }}
                placeholder="Ej. 987654321"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-pink-400" />
                  DNI / Documento *
                </label>
                {isResolvingDni && (
                  <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </span>
                )}
              </div>
              <input
                type="text"
                value={dniCliente}
                onChange={e => handleDniInputChange(e.target.value)}
                placeholder="Ej. 71234567"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Fecha Envío Cliente
              </label>
              <input
                type="date"
                value={fechaEnvioCliente}
                onChange={e => setFechaEnvioCliente(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                title="Fecha elegida por la clienta para enviar"
              />
            </div>
          </div>

          {/* =========================================================================
              ZONA DE SELECCIÓN DE COURIER / AGENCIA (SHALOM vs OLVA vs MOTORIZADO)
              ========================================================================= */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Empresa de Envío & Agencias Oficiales</span>
              </label>
              <span className="text-[10px] text-slate-400">Escoge agencia de la base de datos</span>
            </div>

            {/* Selector de Courier / Método */}
            <div className="grid grid-cols-3 gap-2">
              {/* Opción Shalom */}
              <button
                type="button"
                onClick={() => setSelectedCourier('shalom')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedCourier === 'shalom'
                    ? 'bg-cyan-500/25 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/20 font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-white/10 p-0.5 overflow-hidden flex items-center justify-center">
                  <img src="/Shalom-Courier-Logo.webp" alt="Shalom" className="w-full h-full object-contain" />
                </div>
                <span>Agencia Shalom</span>
              </button>

              {/* Opción Olva */}
              <button
                type="button"
                onClick={() => setSelectedCourier('olva')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedCourier === 'olva'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20 font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-yellow-400 p-0.5 overflow-hidden flex items-center justify-center">
                  <img src="/Olva-Courier-Logo.svg" alt="Olva" className="w-full h-full object-contain" />
                </div>
                <span>Olva Courier</span>
              </button>

              {/* Opción Motorizado / Otro */}
              <button
                type="button"
                onClick={() => setSelectedCourier('motorizado')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedCourier === 'motorizado' || selectedCourier === 'otro'
                    ? 'bg-purple-500/25 border-purple-400 text-purple-200 shadow-md shadow-purple-500/20 font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Truck className="w-4 h-4 text-purple-400" />
                <span>Motorizado / Otro</span>
              </button>
            </div>

            {/* -------------------------------------------------------------
                SECCIÓN A: AGENCIA SHALOM (546 SEDES EN BASE DE DATOS)
                ------------------------------------------------------------- */}
            {selectedCourier === 'shalom' && (
              <div className="space-y-3 bg-slate-950 p-4 rounded-3xl border border-cyan-500/30 shadow-inner animate-fadeIn">
                
                {/* Cabecera Shalom & Botones Rápidos (Mapa & GPS) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                      Directorio Oficial Agencias Shalom (546 Sedes)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShalomMapModal(true)}
                      className="py-1 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>🗺️ Ver en Mapa</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await triggerShalomGpsLookup();
                        setIsShalomListOpen(true);
                      }}
                      disabled={isLocatingShalom}
                      className="py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Navigation className={`w-3.5 h-3.5 text-cyan-400 ${isLocatingShalom ? 'animate-spin' : ''}`} />
                      <span>{isLocatingShalom ? 'Buscando...' : '📍 GPS Cercanas'}</span>
                    </button>
                  </div>
                </div>

                {gpsErrorShalom && (
                  <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{gpsErrorShalom}</span>
                  </div>
                )}

                {/* Tarjeta de Agencia Shalom Seleccionada */}
                {selectedShalomAgency && !isShalomListOpen && (
                  <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 space-y-2 text-xs text-cyan-200 animate-fadeIn">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-white">
                            {selectedShalomAgency.distrito || selectedShalomAgency.nombre}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {selectedShalomAgency.departamento} • {selectedShalomAgency.provincia}
                            {selectedShalomAgency.code && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                                {selectedShalomAgency.code}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sede Activa</span>
                      </span>
                    </div>

                    {/* Badge Destino Oficial Shalom */}
                    <div className="flex items-center gap-1.5 text-xs text-rose-300 font-bold bg-rose-950/50 px-2.5 py-1 rounded-xl border border-rose-500/40">
                      <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Sede Oficial Destino: <strong className="text-white font-black">{extractShalomDestino(formatFullAgencyName(selectedShalomAgency), selectedShalomAgency.code)}</strong></span>
                    </div>

                    <p className="text-[11px] text-slate-300 pt-1 border-t border-cyan-500/20">
                      <strong>📍 Dirección:</strong> {cleanAddressText(selectedShalomAgency.direccion, selectedShalomAgency.provincia, selectedShalomAgency.departamento)}
                    </p>

                    {selectedShalomAgency.horario && (
                      <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{selectedShalomAgency.horario}</span>
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsShalomListOpen(true)}
                      className="w-full py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-xs font-bold text-cyan-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Buscar / Cambiar Sede Shalom</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Buscador & Lista de Agencias Shalom desde la Base de Datos */}
                {(isShalomListOpen || !selectedShalomAgency) && (
                  <div className="space-y-2 animate-fadeIn">
                    
                    {/* Filtro de Departamentos */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Dpto:</span>
                      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                        {DEPARTAMENTOS_PERU.slice(0, 10).map(dep => {
                          const isSel = (departamentoShalom || 'TODOS') === dep;
                          return (
                            <button
                              key={dep}
                              type="button"
                              onClick={() => setDepartamentoShalom(dep)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                              }`}
                            >
                              {dep}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Buscador Input */}
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        value={shalomSearchQuery}
                        onChange={e => setShalomSearchQuery(e.target.value)}
                        placeholder="🔍 Escribe para filtrar (ej. Gamarra, San Isidro, Trujillo, Arequipa)..."
                        className="w-full pl-8 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      {shalomSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setShalomSearchQuery('')}
                          className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Lista Scrolleable de Agencias */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800">
                      {shalomAgenciesList.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-4">
                          No se encontraron agencias Shalom con &quot;{shalomSearchQuery}&quot;
                        </p>
                      ) : (
                        shalomAgenciesList.slice(0, 100).map(ag => {
                          const isSelected = selectedShalomAgency?.id === ag.id;
                          const cleanAddr = cleanAddressText(ag.direccion, ag.provincia, ag.departamento);
                          const titleText = `${ag.departamento || ''} / ${ag.provincia || ''} / ${ag.distrito || ag.nombre || ''}`;

                          return (
                            <button
                              key={ag.id}
                              type="button"
                              onClick={() => handleSelectShalomAgency(ag)}
                              className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500/25 border border-cyan-500/50 text-cyan-200 font-bold shadow-xs'
                                  : 'bg-white/3 hover:bg-white/8 border border-white/5 text-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-[11px] font-bold text-white tracking-tight leading-tight">
                                  <HighlightMatch text={titleText} query={shalomSearchQuery} />
                                </h5>
                                {ag.code && (
                                  <span className="text-[9px] font-mono font-black text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/25 shrink-0">
                                    {ag.code}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 leading-snug">
                                <HighlightMatch text={cleanAddr || 'Dirección de la sede'} query={shalomSearchQuery} />
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {selectedShalomAgency && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setIsShalomListOpen(false)}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 transition-colors cursor-pointer"
                        >
                          Cerrar lista
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* DNI o Carnet de Extranjería para Recojo en Shalom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                      🪪 DNI / CE de quien recogerá en Shalom *
                    </label>
                    <input
                      type="text"
                      required={selectedCourier === 'shalom'}
                      value={dniRecojoShalom}
                      onChange={e => handleShalomDniChange(e.target.value)}
                      placeholder="DNI o CE de recojo"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-300 mb-1">
                      🔑 Clave PIN Shalom (4-6 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={claveRecojo}
                      onChange={e => setClaveRecojo(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                      placeholder={getDailyShalomPin() || '0909'}
                      className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded-xl text-xs font-mono font-bold text-amber-300 text-center focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* -------------------------------------------------------------
                SECCIÓN B: OLVA COURIER (376 SEDES EN BASE DE DATOS)
                ------------------------------------------------------------- */}
            {selectedCourier === 'olva' && (
              <div className="space-y-3 bg-slate-950 p-4 rounded-3xl border border-amber-500/30 shadow-inner animate-fadeIn">
                
                {/* Selector de Modalidad Olva */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-sm">🚚</span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Modalidad Olva Courier
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOlvaModalidad('agencia');
                        if (selectedOlvaAgency) handleSelectOlvaAgency(selectedOlvaAgency);
                      }}
                      className={`py-1 px-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        olvaModalidad === 'agencia'
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      🏢 Para Agencia
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOlvaModalidad('domicilio');
                        updateOlvaDomicilio();
                      }}
                      className={`py-1 px-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        olvaModalidad === 'domicilio'
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      🏠 Para Domicilio
                    </button>
                  </div>
                </div>

                {/* Si es Modalidad Para Agencia Olva -> Mostrar buscador y catálogo DB */}
                {olvaModalidad === 'agencia' && (
                  <div className="space-y-2.5">
                    
                    {/* Botones Rápidos (Mapa Olva & GPS) */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-300 uppercase">
                        Sedes Oficiales Olva ({olvaAgenciesList.length} disponibles)
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowOlvaMapModal(true)}
                          className="py-1 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>🗺️ Ver Mapa</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await triggerOlvaGpsLookup();
                            setIsOlvaListOpen(true);
                          }}
                          disabled={isLocatingOlva}
                          className="py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold border border-white/10 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                        >
                          <Navigation className={`w-3.5 h-3.5 text-amber-400 ${isLocatingOlva ? 'animate-spin' : ''}`} />
                          <span>{isLocatingOlva ? 'Localizando...' : '📍 GPS Cercanas'}</span>
                        </button>
                      </div>
                    </div>

                    {gpsErrorOlva && (
                      <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{gpsErrorOlva}</span>
                      </div>
                    )}

                    {/* Tarjeta de Agencia Olva Seleccionada */}
                    {selectedOlvaAgency && !isOlvaListOpen && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2 text-xs text-amber-200 animate-fadeIn">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-white">
                                {selectedOlvaAgency.departamento} / {selectedOlvaAgency.provincia} / {selectedOlvaAgency.distrito}
                              </h4>
                              <p className="text-[11px] text-amber-300/80">
                                Tipo: {selectedOlvaAgency.tipo || 'TIENDA'}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Confirmada</span>
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/20">
                          <strong>📍 Dirección:</strong> {cleanOlvaAddressText(selectedOlvaAgency.direccion || selectedOlvaAgency.address, selectedOlvaAgency.provincia, selectedOlvaAgency.departamento)}
                        </p>

                        {selectedOlvaAgency.horario && (
                          <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>{selectedOlvaAgency.horario}</span>
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsOlvaListOpen(true)}
                          className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-bold text-amber-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Buscar / Cambiar Sede Olva</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Buscador & Lista de Agencias Olva de Base de Datos */}
                    {(isOlvaListOpen || !selectedOlvaAgency) && (
                      <div className="space-y-2 animate-fadeIn">
                        {/* Filtro Departamentos Olva */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Dpto:</span>
                          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {DEPARTAMENTOS_OLVA.slice(0, 10).map(dep => {
                              const isSel = (departamentoOlva || 'TODOS') === dep;
                              return (
                                <button
                                  key={dep}
                                  type="button"
                                  onClick={() => setDepartamentoOlva(dep)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                                  }`}
                                >
                                  {dep}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Buscador Input */}
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus
                            value={olvaSearchQuery}
                            onChange={e => setOlvaSearchQuery(e.target.value)}
                            placeholder="🔍 Buscar sede Olva por distrito, calle o nombre (ej. Miraflores, Cusco, Huancayo)..."
                            className="w-full pl-8 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          {olvaSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setOlvaSearchQuery('')}
                              className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Lista Scrolleable de Agencias Olva */}
                        <div className="max-h-48 overflow-y-auto space-y-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800">
                          {olvaAgenciesList.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-4">
                              No se encontraron sedes Olva con &quot;{olvaSearchQuery}&quot;
                            </p>
                          ) : (
                            olvaAgenciesList.slice(0, 100).map(ag => {
                              const isSelected = selectedOlvaAgency?.id === ag.id;
                              const cleanAddr = cleanOlvaAddressText(ag.direccion || ag.address, ag.provincia, ag.departamento);
                              const titleText = `${ag.departamento || ''} / ${ag.provincia || ''} / ${ag.distrito || ag.nombre || ''}`;

                              return (
                                <button
                                  key={ag.id}
                                  type="button"
                                  onClick={() => handleSelectOlvaAgency(ag)}
                                  className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500/25 border border-amber-500/50 text-amber-200 font-bold shadow-xs'
                                      : 'bg-white/3 hover:bg-white/8 border border-white/5 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-[11px] font-bold text-white tracking-tight leading-tight">
                                      <HighlightMatch text={titleText} query={olvaSearchQuery} />
                                    </h5>
                                    {ag.tipo && (
                                      <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/25 shrink-0">
                                        {ag.tipo}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-snug">
                                    <HighlightMatch text={cleanAddr || 'Dirección de la sede'} query={olvaSearchQuery} />
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {selectedOlvaAgency && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setIsOlvaListOpen(false)}
                              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 transition-colors cursor-pointer"
                            >
                              Cerrar lista
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* Si es Modalidad Para Domicilio Olva */}
                {olvaModalidad === 'domicilio' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-300 mb-1">
                        🏠 Dirección de Domicilio / Entrega *
                      </label>
                      <input
                        type="text"
                        required={selectedCourier === 'olva' && olvaModalidad === 'domicilio'}
                        value={olvaDireccion}
                        onChange={e => {
                          setOlvaDireccion(e.target.value);
                          updateOlvaDomicilio(e.target.value);
                        }}
                        placeholder="Ej. Av. Los Álamos 450, Dpto 302, Surco, Lima"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        🏷️ Referencia de Domicilio
                      </label>
                      <input
                        type="text"
                        value={olvaReferencia}
                        onChange={e => {
                          setOlvaReferencia(e.target.value);
                          updateOlvaDomicilio(undefined, e.target.value);
                        }}
                        placeholder="Ej. Frente al parque, rejas negras..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                {/* Datos de contacto de Olva (DNI, Tel, Correo) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-amber-500/20">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">🪪 DNI Quien Recibe</label>
                    <input
                      type="text"
                      value={olvaDni}
                      onChange={e => {
                        setOlvaDni(e.target.value);
                        if (olvaModalidad === 'domicilio') updateOlvaDomicilio(undefined, undefined, e.target.value);
                        else if (selectedOlvaAgency) handleSelectOlvaAgency(selectedOlvaAgency);
                      }}
                      placeholder="DNI"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">📱 Celular Contacto</label>
                    <input
                      type="tel"
                      value={olvaTel}
                      onChange={e => {
                        setOlvaTel(e.target.value);
                        if (olvaModalidad === 'domicilio') updateOlvaDomicilio(undefined, undefined, undefined, e.target.value);
                        else if (selectedOlvaAgency) handleSelectOlvaAgency(selectedOlvaAgency);
                      }}
                      placeholder="Teléfono"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">📧 Correo para Guía</label>
                    <input
                      type="email"
                      value={olvaEmail}
                      onChange={e => {
                        setOlvaEmail(e.target.value);
                        if (olvaModalidad === 'domicilio') updateOlvaDomicilio(undefined, undefined, undefined, undefined, e.target.value);
                        else if (selectedOlvaAgency) handleSelectOlvaAgency(selectedOlvaAgency);
                      }}
                      placeholder="Correo"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* -------------------------------------------------------------
                SECCIÓN C: MOTORIZADO LOCAL O DESTINO PERSONALIZADO
                ------------------------------------------------------------- */}
            {(selectedCourier === 'motorizado' || selectedCourier === 'otro') && (
              <div className="space-y-3 bg-slate-950 p-4 rounded-3xl border border-purple-500/30 shadow-inner animate-fadeIn">
                <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
                  <Truck className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                    Dirección de Entrega Motorizado / Local
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    📍 Dirección Exacta y Distrito *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={motorizadoDireccion}
                    onChange={e => {
                      setMotorizadoDireccion(e.target.value);
                      setDestinoDetalle(`Motorizado Local Lima: ${e.target.value}`);
                    }}
                    placeholder="Ej. Av. Larco 1234, Dpto 402, Miraflores, Lima"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            )}

            {/* Vista Previa del Destino Detalle & Opción de Edición Manual */}
            <div className="p-3 rounded-2xl bg-white/4 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Destino / Rótulo Oficial Generado:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsManualDestinoEdit(!isManualDestinoEdit)}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isManualDestinoEdit ? 'Cerrar edición manual' : 'Editar texto directo'}</span>
                </button>
              </div>

              {isManualDestinoEdit ? (
                <textarea
                  required
                  rows={2}
                  value={destinoDetalle}
                  onChange={e => setDestinoDetalle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-cyan-500 rounded-xl text-xs text-cyan-200 font-mono focus:outline-none"
                />
              ) : (
                <p className="text-xs font-semibold text-slate-200 break-words font-mono bg-black/40 p-2.5 rounded-xl border border-white/5">
                  {destinoDetalle || 'Selecciona una agencia arriba para generar el rótulo exacto...'}
                </p>
              )}
            </div>

          </div>

          {/* Detalles del Paquete y Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-purple-400" />
                Detalles del Paquete / Mercadería *
              </label>
              <input
                type="text"
                required
                value={detallesBordado}
                onChange={e => setDetallesBordado(e.target.value)}
                placeholder="Ej. Poleras bordadas ComiKids"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Observaciones Adicionales
              </label>
              <input
                type="text"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Notas de entrega o referencias..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Estados de Producción y Envío */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Estado de Producción / Alistado
              </label>
              <select
                value={estadoProduccion}
                onChange={e => setEstadoProduccion(e.target.value as EstadoProduccion)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="en_cola">En Cola de Almacén</option>
                <option value="bordando">Alistándolo / Preparando</option>
                <option value="completado">Listo para Despacho</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Estado de Envío
              </label>
              <select
                value={estadoEnvio}
                onChange={e => setEstadoEnvio(e.target.value as EstadoEnvio)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="pendiente">Pendiente en Taller</option>
                <option value="en_camino">En Camino / En Agencia</option>
                <option value="entregado">Entregado al Cliente</option>
              </select>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-2/3 py-3 px-4 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>

      {/* Modal Subagente de Mapa Shalom con Buscador Sincronizado */}
      {showShalomMapModal && (
        <div className="fixed inset-0 z-10000 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-2xl animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-cyan-400">📦</span>
                  <span>Mapa de Agencias Shalom (546 Sedes)</span>
                </h3>
                <p className="text-xs text-slate-400">Toca cualquier pin en el mapa para seleccionarla directamente</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShalomMapModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ShalomAgenciesMap
              agencies={shalomAgenciesList}
              selectedAgency={selectedShalomAgency}
              onSelectAgency={handleSelectShalomAgency}
              userLocation={userLocationShalom}
              onRequestLocation={triggerShalomGpsLookup}
              isLocating={isLocatingShalom}
              onClose={() => setShowShalomMapModal(false)}
              searchQuery={shalomSearchQuery}
              onSearchChange={setShalomSearchQuery}
            />
          </div>
        </div>
      )}

      {/* Modal Subagente de Mapa Olva con Buscador y 376 Sedes */}
      {showOlvaMapModal && (
        <div className="fixed inset-0 z-10000 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-2xl animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-amber-400">🚚</span>
                  <span>Mapa de Agencias Olva Courier (376 Sedes)</span>
                </h3>
                <p className="text-xs text-amber-200/70">Toca cualquier sede en el mapa para seleccionarla directamente</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOlvaMapModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <OlvaAgenciesMap
              agencies={olvaAgenciesList}
              selectedAgency={selectedOlvaAgency}
              onSelectAgency={handleSelectOlvaAgency}
              userLocation={userLocationOlva}
              onRequestLocation={triggerOlvaGpsLookup}
              isLocating={isLocatingOlva}
              onClose={() => setShowOlvaMapModal(false)}
              searchQuery={olvaSearchQuery}
              onSearchChange={setOlvaSearchQuery}
            />
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};
