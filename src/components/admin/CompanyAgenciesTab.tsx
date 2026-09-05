import React, { useState, useEffect, useRef } from 'react';
import { ordersService } from '../../services/ordersService';
import { MetodoEnvio, CampoPersonalizadoAgencia, TallerConfig } from '../../types/database.types';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Lock,
  Tag,
  FileText,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  MapPin,
  Send,
  Eye,
  Sliders,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Layers,
  HelpCircle,
  Printer,
  ShieldCheck
} from 'lucide-react';

const LOGO_PRESETS = [
  { label: 'Shalom Oficial', url: '/Shalom-Courier-Logo.webp' },
  { label: 'Olva Courier', url: '/Olva-Courier-Logo.svg' },
  { label: 'Motorizado', url: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
  { label: 'ComiKids / Encomi', url: '/Comikids.png' },
  { label: 'Transportes Flores', url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=120&auto=format&fit=crop&q=60' },
  { label: 'Marvisur Carga', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=120&auto=format&fit=crop&q=60' },
  { label: 'Carhua Express', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=120&auto=format&fit=crop&q=60' },
];

const DEFAULT_STANDARD_RECEIPT = (nombreAgencia: string) => `✨ *COMPROBANTE DE ENVÍO - ${nombreAgencia.toUpperCase()}* 📦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Orden:* {orden}
👤 *Cliente:* {cliente}
🪪 *DNI / Doc:* {dni}
📱 *WhatsApp:* {telefono}
🚚 *Modalidad:* {modalidad}
📅 *Fecha de Envío:* {fecha}

📍 *Destino Oficial:*
{destino}`;

export const CompanyAgenciesTab: React.FC = () => {
  const [methods, setMethods] = useState<MetodoEnvio[]>(() => ordersService.getShippingMethods());
  const [tallerConfig] = useState<TallerConfig>(() => ordersService.getTallerConfig());

  // Estados de modales
  const [editingMethod, setEditingMethod] = useState<MetodoEnvio | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sub-sección activa dentro del editor de agencia
  const [activeEditorTab, setActiveEditorTab] = useState<'general' | 'datos' | 'mensaje' | 'rotulado'>('general');

  // Estados del formulario en edición
  const [nombreMetodo, setNombreMetodo] = useState('');
  const [descripcionMetodo, setDescripcionMetodo] = useState('');
  const [iconoMetodo, setIconoMetodo] = useState('Truck');
  const [fotoUrlMetodo, setFotoUrlMetodo] = useState('');
  const [camposList, setCamposList] = useState<CampoPersonalizadoAgencia[]>([]);
  const [mensajeComprobacion, setMensajeComprobacion] = useState('');

  // Configuración de rotulado inteligente
  const [incluirRemitente, setIncluirRemitente] = useState(true);
  const [mostrarRemitenteNombre, setMostrarRemitenteNombre] = useState(true);
  const [mostrarRemitenteRucDni, setMostrarRemitenteRucDni] = useState(true);
  const [mostrarRemitenteTelefono, setMostrarRemitenteTelefono] = useState(true);
  const [mostrarRemitenteOrigen, setMostrarRemitenteOrigen] = useState(true);

  const [incluirDestinatario, setIncluirDestinatario] = useState(true);
  const [mostrarClienteNombre, setMostrarClienteNombre] = useState(true);
  const [mostrarClienteDni, setMostrarClienteDni] = useState(true);
  const [mostrarClienteTelefono, setMostrarClienteTelefono] = useState(true);
  const [mostrarClienteDestino, setMostrarClienteDestino] = useState(true);
  const [mostrarBarcode, setMostrarBarcode] = useState(true);
  const [mostrarFechaSello, setMostrarFechaSello] = useState(true);

  // Nuevo campo a solicitar
  const [newCampoLabel, setNewCampoLabel] = useState('');
  const [newCampoPlaceholder, setNewCampoPlaceholder] = useState('');
  const [newCampoTipo, setNewCampoTipo] = useState<'texto' | 'telefono' | 'numero' | 'textarea'>('texto');
  const [newCampoRequerido, setNewCampoRequerido] = useState(false);
  const [newCampoRotulado, setNewCampoRotulado] = useState(true);
  const [newCampoComprobante, setNewCampoComprobante] = useState(true);

  // Referencia al textarea del mensaje para insertar variables en la posición del cursor
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // REQUERIMIENTO: Ocultar el selector de secciones (dock inferior) cuando se abre el modal
  useEffect(() => {
    const isAnyModalOpen = Boolean(editingMethod || showCreateModal || showPreviewModal);
    if (isAnyModalOpen) {
      document.body.classList.add('hide-admin-dock');
    } else {
      document.body.classList.remove('hide-admin-dock');
    }
    return () => {
      document.body.classList.remove('hide-admin-dock');
    };
  }, [editingMethod, showCreateModal, showPreviewModal]);

  const reloadMethods = () => {
    setMethods(ordersService.getShippingMethods());
  };

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const notifyError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4500);
  };

  // Abrir editor de agencia
  const handleOpenEdit = (m: MetodoEnvio) => {
    setEditingMethod(m);
    setActiveEditorTab('general');
    setNombreMetodo(m.nombre);
    setDescripcionMetodo(m.descripcion || '');
    setIconoMetodo(m.icono || 'Truck');
    setFotoUrlMetodo(m.foto_url || '');
    setCamposList(m.campos_personalizados || []);

    // REQUERIMIENTO: Mensaje por defecto pre-cargado si está vacío
    setMensajeComprobacion(m.mensaje_comprobacion?.trim() || DEFAULT_STANDARD_RECEIPT(m.nombre));

    // Configuración de rotulado
    const cfg = m.config_rotulado;
    setIncluirRemitente(cfg?.incluir_remitente !== false);
    setMostrarRemitenteNombre(cfg?.mostrar_remitente_nombre !== false);
    setMostrarRemitenteRucDni(cfg?.mostrar_remitente_ruc_dni !== false);
    setMostrarRemitenteTelefono(cfg?.mostrar_remitente_telefono !== false);
    setMostrarRemitenteOrigen(cfg?.mostrar_remitente_origen !== false);

    setIncluirDestinatario(cfg?.incluir_destinatario !== false);
    setMostrarClienteNombre(cfg?.mostrar_cliente_nombre !== false);
    setMostrarClienteDni(cfg?.mostrar_cliente_dni !== false);
    setMostrarClienteTelefono(cfg?.mostrar_cliente_telefono !== false);
    setMostrarClienteDestino(cfg?.mostrar_cliente_destino !== false);
    setMostrarBarcode(cfg?.mostrar_barcode !== false);
    setMostrarFechaSello(cfg?.mostrar_fecha_sello !== false);
  };

  // Guardar agencia editada
  const handleSaveMethod = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingMethod) return;

    try {
      const rotuladoVisibles = camposList
        .filter(c => c.mostrar_en_rotulado)
        .map(c => c.id);

      ordersService.updateShippingMethod(editingMethod.id, {
        nombre: nombreMetodo.trim() || editingMethod.nombre,
        descripcion: descripcionMetodo.trim(),
        icono: iconoMetodo,
        foto_url: fotoUrlMetodo.trim() || undefined,
        campos_personalizados: camposList,
        mensaje_comprobacion: mensajeComprobacion.trim() || undefined,
        config_rotulado: {
          incluir_campos_personalizados: true,
          campos_visibles: rotuladoVisibles,
          incluir_remitente: incluirRemitente,
          mostrar_remitente_nombre: mostrarRemitenteNombre,
          mostrar_remitente_ruc_dni: mostrarRemitenteRucDni,
          mostrar_remitente_telefono: mostrarRemitenteTelefono,
          mostrar_remitente_origen: mostrarRemitenteOrigen,
          incluir_destinatario: incluirDestinatario,
          mostrar_cliente_nombre: mostrarClienteNombre,
          mostrar_cliente_dni: mostrarClienteDni,
          mostrar_cliente_telefono: mostrarClienteTelefono,
          mostrar_cliente_destino: mostrarClienteDestino,
          mostrar_barcode: mostrarBarcode,
          mostrar_fecha_sello: mostrarFechaSello,
        }
      });

      reloadMethods();
      setEditingMethod(null);
      notifySuccess(`¡Agencia "${nombreMetodo}" actualizada exitosamente!`);
    } catch (err: any) {
      notifyError(err.message || 'Error al guardar la agencia');
    }
  };

  // Crear nueva agencia
  const handleCreateNewAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreMetodo.trim()) {
      notifyError('Ingresa un nombre para la nueva agencia.');
      return;
    }

    try {
      const newM = ordersService.addShippingMethod({
        codigo: 'agencia_' + Date.now().toString(36),
        nombre: nombreMetodo.trim(),
        descripcion: descripcionMetodo.trim() || 'Servicio de entrega y despacho',
        icono: iconoMetodo,
        foto_url: fotoUrlMetodo.trim() || undefined,
        tipo_formulario: 'personalizado',
        activo: true,
        orden: methods.length + 1,
        es_sistema: false,
        campos_personalizados: [
          {
            id: 'c-nom-' + Date.now().toString(36),
            label: 'Nombres y Apellidos de quien recibe',
            placeholder: 'Ej: María Ramos',
            tipo: 'texto',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          },
          {
            id: 'c-tel-' + Date.now().toString(36),
            label: 'Teléfono de contacto / WhatsApp',
            placeholder: '9 dígitos',
            tipo: 'telefono',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          },
          {
            id: 'c-dir-' + Date.now().toString(36),
            label: 'Dirección o Agencia de Destino',
            placeholder: 'Indica la sede o dirección',
            tipo: 'texto',
            requerido: true,
            mostrar_en_rotulado: true,
            mostrar_en_comprobante: true,
            sistema: false,
          }
        ],
        mensaje_comprobacion: DEFAULT_STANDARD_RECEIPT(nombreMetodo.trim()),
        config_rotulado: {
          incluir_campos_personalizados: true,
          campos_visibles: [],
          incluir_remitente: true,
          mostrar_remitente_nombre: true,
          mostrar_remitente_ruc_dni: true,
          mostrar_remitente_telefono: true,
          mostrar_remitente_origen: true,
          incluir_destinatario: true,
          mostrar_cliente_nombre: true,
          mostrar_cliente_dni: true,
          mostrar_cliente_telefono: true,
          mostrar_cliente_destino: true,
          mostrar_barcode: true,
          mostrar_fecha_sello: true,
        }
      });

      reloadMethods();
      setShowCreateModal(false);
      setNombreMetodo('');
      setDescripcionMetodo('');
      setFotoUrlMetodo('');
      notifySuccess(`¡Nueva agencia "${newM.nombre}" creada con éxito!`);
    } catch (err: any) {
      notifyError(err.message || 'Error al crear la agencia');
    }
  };

  // Alternar estado activo
  const handleToggleActivo = (m: MetodoEnvio) => {
    ordersService.updateShippingMethod(m.id, { activo: !m.activo });
    reloadMethods();
    notifySuccess(`Agencia "${m.nombre}" ${!m.activo ? 'activada' : 'desactivada'}.`);
  };

  // Eliminar agencia
  const handleDeleteMethod = (m: MetodoEnvio) => {
    if (m.es_sistema || m.id === 'met-shalom' || m.id === 'met-olva' || m.codigo === 'shalom' || m.codigo === 'olva') {
      alert('⚠️ Seguridad del Sistema: Las agencias base oficiales (Shalom y Olva) no se pueden eliminar.');
      return;
    }

    if (confirm(`¿Estás seguro de eliminar la agencia "${m.nombre}"?`)) {
      ordersService.deleteShippingMethod(m.id);
      reloadMethods();
      notifySuccess(`Agencia "${m.nombre}" eliminada.`);
    }
  };

  // REQUERIMIENTO: Inserción automática de variable al hacer click sin escribir llaves a mano
  const insertVariableIntoMessage = (varName: string) => {
    const token = `{${varName}}`;
    if (!textareaRef.current) {
      setMensajeComprobacion(prev => prev + ' ' + token);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentVal = textarea.value;

    const before = currentVal.substring(0, start);
    const after = currentVal.substring(end, currentVal.length);

    const newVal = before + token + after;
    setMensajeComprobacion(newVal);

    // Restaurar cursor justo después del token insertado
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + token.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  // REQUERIMIENTO: Agregar campo personalizado con variable lista
  const handleAddCampo = () => {
    if (!newCampoLabel.trim()) {
      alert('Ingresa el nombre del dato que pedirás a la clienta (ej: Usuario TikTok, Referencia, etc.)');
      return;
    }

    const nuevo: CampoPersonalizadoAgencia = {
      id: 'c-' + Date.now().toString(36),
      label: newCampoLabel.trim(),
      placeholder: newCampoPlaceholder.trim() || undefined,
      tipo: newCampoTipo,
      requerido: newCampoRequerido,
      mostrar_en_rotulado: newCampoRotulado,
      mostrar_en_comprobante: newCampoComprobante,
      sistema: false,
    };

    setCamposList(prev => [...prev, nuevo]);
    setNewCampoLabel('');
    setNewCampoPlaceholder('');
    setNewCampoTipo('texto');
    setNewCampoRequerido(false);
    setNewCampoRotulado(true);
    setNewCampoComprobante(true);
  };

  const handleDeleteCampo = (campoId: string) => {
    const target = camposList.find(c => c.id === campoId);
    if (target?.sistema) {
      alert('Este dato es obligatorio y base para el funcionamiento de esta agencia.');
      return;
    }
    setCamposList(prev => prev.filter(c => c.id !== campoId));
  };

  // Subir archivo de foto
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFotoUrlMetodo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* Header del Espacio Agencias */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shadow-md shadow-cyan-500/10">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Gestión Total de Agencias y Métodos de Envío
            </h2>
            <p className="text-xs text-slate-400">
              Personaliza qué datos se solicitan, fotos/logos, el mensaje de WhatsApp y el rótulo de despacho con previsualizador.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadMethods}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all cursor-pointer"
            title="Recargar agencias"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNombreMetodo('');
              setDescripcionMetodo('');
              setIconoMetodo('Truck');
              setFotoUrlMetodo('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nueva Agencia</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Agencias Existentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map((m) => {
          const isSystem = Boolean(m.es_sistema || m.id === 'met-shalom' || m.id === 'met-olva' || m.codigo === 'shalom' || m.codigo === 'olva');
          const totalCampos = m.campos_personalizados?.length || 0;
          const totalRotulado = m.campos_personalizados?.filter(c => c.mostrar_en_rotulado)?.length || 0;

          return (
            <div
              key={m.id}
              className={`p-5 rounded-3xl border transition-all space-y-4 relative flex flex-col justify-between ${
                m.activo
                  ? 'bg-slate-900/80 border-white/10 hover:border-cyan-500/50 shadow-lg'
                  : 'bg-slate-950/80 border-white/5 opacity-60'
              }`}
            >
              <div className="space-y-3">
                {/* Header de la tarjeta con Logo/Foto de la agencia */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold border border-white/10 bg-slate-950 overflow-hidden shrink-0 shadow-inner">
                      {m.foto_url ? (
                        <img src={m.foto_url} alt={m.nombre} className="w-full h-full object-contain p-1.5" />
                      ) : m.codigo === 'shalom' ? (
                        <img src="/Shalom-Courier-Logo.webp" alt="Shalom" className="w-full h-full object-contain p-1.5" />
                      ) : m.codigo === 'olva' ? (
                        <img src="/Olva-Courier-Logo.svg" alt="Olva" className="w-full h-full object-contain p-1.5" />
                      ) : (
                        <div className="text-cyan-400">
                          <Truck className="w-7 h-7" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-base leading-tight">
                        {m.nombre}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {m.descripcion || 'Sin descripción'}
                      </p>
                      <span className={`text-[10px] font-bold ${m.activo ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {m.activo ? '● Activa para clientas' : '○ Desactivada'}
                      </span>
                    </div>
                  </div>

                  {/* Badge Sistema vs Personalizada */}
                  <div className="shrink-0">
                    {isSystem ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        <span>SISTEMA</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                        <span>PERSONALIZADA</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Resumen de configuración de datos y rótulo */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    <span className="block text-[9px] text-slate-400 uppercase font-mono">Datos a pedir:</span>
                    <span className="text-xs font-black">{totalCampos} campos</span>
                  </div>
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    <span className="block text-[9px] text-slate-400 uppercase font-mono">En Rótulo:</span>
                    <span className="text-xs font-black">{totalRotulado} campos</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(m)}
                  className="flex-1 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Configurar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleActivo(m)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    m.activo
                      ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                  title={m.activo ? 'Desactivar para clientes' : 'Habilitar para clientes'}
                >
                  {m.activo ? 'Desactivar' : 'Activar'}
                </button>

                {!isSystem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMethod(m)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                    title="Eliminar agencia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL CONFIGURACIÓN COMPLETA DE AGENCIA (CAMPOS, FOTO, MENSAJE, ROTULADO) */}
      {/* ========================================================================= */}
      {editingMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 flex flex-col max-h-[94vh] overflow-hidden">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {fotoUrlMetodo ? (
                    <img src={fotoUrlMetodo} alt={nombreMetodo} className="w-full h-full object-contain p-1" />
                  ) : editingMethod.codigo === 'shalom' ? (
                    <img src="/Shalom-Courier-Logo.webp" alt="Shalom" className="w-full h-full object-contain p-1" />
                  ) : editingMethod.codigo === 'olva' ? (
                    <img src="/Olva-Courier-Logo.svg" alt="Olva" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Truck className="w-6 h-6 text-cyan-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>Configurar {editingMethod.nombre}</span>
                    {editingMethod.es_sistema && (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                        Oficial del Sistema
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ajusta la foto, los datos a pedir a la clienta, el mensaje de WhatsApp y el rótulo de despacho.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* BOTÓN PREVISUALIZAR RÓTULO */}
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Ver cómo quedará la etiqueta de despacho impresa con datos ficticios"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-300" />
                  <span className="hidden sm:inline">Previsualizar Rótulo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingMethod(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pestañas de Navegación del Editor */}
            <div className="flex items-center gap-1 p-2 px-4 sm:px-6 bg-slate-950/40 border-b border-white/5 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveEditorTab('general')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'general'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>1. Foto & Nombre</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('datos')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'datos'
                    ? 'bg-purple-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>2. Datos a Pedir ({camposList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('mensaje')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'mensaje'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>3. Mensaje WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('rotulado')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'rotulado'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>4. Rótulo Inteligente</span>
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
              
              {/* --- TAB 1: GENERAL & FOTO --- */}
              {activeEditorTab === 'general' && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Foto / Logo de la Agencia */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Foto o Logo de la Agencia</span>
                    </span>

                    {/* Presets rápidos */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                        Elige un logo predeterminado:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {LOGO_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setFotoUrlMetodo(p.url)}
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                              fotoUrlMetodo === p.url
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <img src={p.url} alt={p.label} className="w-4 h-4 object-contain rounded" />
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subida o URL personalizada */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Subir imagen desde tu dispositivo:
                        </label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-400 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-cyan-400" />
                          <span>Seleccionar Foto o Logo</span>
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          O pegar enlace URL de la imagen:
                        </label>
                        <input
                          type="url"
                          value={fotoUrlMetodo}
                          onChange={e => setFotoUrlMetodo(e.target.value)}
                          placeholder="https://ejemplo.com/logo.png"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Preview de la foto */}
                    {fotoUrlMetodo && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                        <img src={fotoUrlMetodo} alt="Preview" className="w-12 h-12 object-contain bg-white/5 p-1 rounded-lg" />
                        <div className="flex-1">
                          <span className="text-[11px] font-bold text-cyan-300 block">Foto de Agencia Seleccionada</span>
                          <span className="text-[10px] text-slate-400 truncate block max-w-md">{fotoUrlMetodo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFotoUrlMetodo('')}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Quitar foto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nombre y Descripción */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <span>Nombre y Descripción para las Clientas</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Nombre Público de la Agencia / Servicio *
                        </label>
                        <input
                          type="text"
                          required
                          value={nombreMetodo}
                          onChange={e => setNombreMetodo(e.target.value)}
                          placeholder="Ej. Motorizado Express o Transportes Flores"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Descripción breve
                        </label>
                        <input
                          type="text"
                          value={descripcionMetodo}
                          onChange={e => setDescripcionMetodo(e.target.value)}
                          placeholder="Ej. Entrega a domicilio o en sede central"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 2: DATOS SOLICITADOS A LA CLIENTA --- */}
              {activeEditorTab === 'datos' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-purple-400" />
                          <span>Datos que se le pedirán a la clienta al elegir esta agencia</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Puedes marcar si el dato es obligatorio, si debe imprimirse en el rótulo y si debe verse en el comprobante.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-full shrink-0 self-start">
                        {camposList.length} datos activos
                      </span>
                    </div>

                    {/* Lista de campos configurados */}
                    <div className="space-y-2">
                      {camposList.map((campo) => (
                        <div
                          key={campo.id}
                          className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            campo.sistema
                              ? 'bg-slate-900/90 border-amber-500/30 text-white'
                              : 'bg-slate-900/60 border-white/10 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs shrink-0">
                              {campo.tipo === 'telefono' ? <Smartphone className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs">{campo.label}</span>
                                {campo.sistema && (
                                  <span className="text-[9px] font-black text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
                                    Base Oficial
                                  </span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${campo.requerido ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-white/5 text-slate-400'}`}>
                                  {campo.requerido ? 'Obligatorio' : 'Opcional'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Tipo: {campo.tipo} • Variable: <strong className="text-cyan-300">{`{${campo.label}}`}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Switches de Control */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                            {/* Toggle Obligatorio */}
                            {!campo.sistema && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCamposList(prev => prev.map(c => c.id === campo.id ? { ...c, requerido: !c.requerido } : c));
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                                  campo.requerido ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-white/5 text-slate-400 border-white/10'
                                }`}
                              >
                                {campo.requerido ? '★ Obligatorio' : 'Opcional'}
                              </button>
                            )}

                            {/* Switch: Imprimir en Rótulo */}
                            <button
                              type="button"
                              onClick={() => {
                                setCamposList(prev => prev.map(c => c.id === campo.id ? { ...c, mostrar_en_rotulado: !c.mostrar_en_rotulado } : c));
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                campo.mostrar_en_rotulado
                                  ? 'bg-purple-500/20 text-purple-200 border-purple-400/40 hover:bg-purple-500/30'
                                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                              }`}
                              title="Hacer que este dato se imprima en la etiqueta / rótulo"
                            >
                              <Tag className="w-3 h-3" />
                              <span>{campo.mostrar_en_rotulado ? '✓ En Rótulo' : 'Sin Rótulo'}</span>
                            </button>

                            {/* Switch: Mostrar en Comprobante */}
                            <button
                              type="button"
                              onClick={() => {
                                setCamposList(prev => prev.map(c => c.id === campo.id ? { ...c, mostrar_en_comprobante: !c.mostrar_en_comprobante } : c));
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                campo.mostrar_en_comprobante
                                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 hover:bg-cyan-500/30'
                                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                              }`}
                              title="Mostrar este dato en el comprobante que recibe la clienta"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{campo.mostrar_en_comprobante ? '✓ Comprobante' : 'Oculto'}</span>
                            </button>

                            {/* Eliminar campo si no es de sistema */}
                            {!campo.sistema ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteCampo(campo.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                                title="Eliminar este dato"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="p-1.5 text-slate-600 cursor-not-allowed" title="Campo protegido del sistema">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Añadir nuevo campo */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30 space-y-3 mt-4">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Nuevo Dato a Solicitar (ej: Usuario de TikTok, Referencia, etc.)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            Nombre de la Pregunta / Campo *
                          </label>
                          <input
                            type="text"
                            value={newCampoLabel}
                            onChange={e => setNewCampoLabel(e.target.value)}
                            placeholder="Ej. Usuario de TikTok o Referencia de Domicilio"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-purple-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            Tipo de Entrada
                          </label>
                          <select
                            value={newCampoTipo}
                            onChange={e => setNewCampoTipo(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
                          >
                            <option value="texto">Texto Simple</option>
                            <option value="telefono">Teléfono / WhatsApp</option>
                            <option value="numero">Número / DNI</option>
                            <option value="textarea">Texto Largo / Referencia</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px] select-none">
                            <input
                              type="checkbox"
                              checked={newCampoRequerido}
                              onChange={e => setNewCampoRequerido(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-purple-500 cursor-pointer"
                            />
                            <span>Obligatorio</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-purple-300 text-[11px] select-none font-bold">
                            <input
                              type="checkbox"
                              checked={newCampoRotulado}
                              onChange={e => setNewCampoRotulado(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-purple-500 cursor-pointer"
                            />
                            <span>Imprimir en Rótulo</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300 text-[11px] select-none font-bold">
                            <input
                              type="checkbox"
                              checked={newCampoComprobante}
                              onChange={e => setNewCampoComprobante(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                            />
                            <span>Ver en Comprobante</span>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddCampo}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Dato a la Agencia</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* --- TAB 3: MENSAJE DEL COMPROBANTE WHATSAPP --- */}
              {activeEditorTab === 'mensaje' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Send className="w-4 h-4 text-emerald-400" />
                        <span>Mensaje de Comprobante para WhatsApp</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setMensajeComprobacion(DEFAULT_STANDARD_RECEIPT(nombreMetodo || editingMethod.nombre))}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                      >
                        Restaurar Plantilla Oficial
                      </button>
                    </div>

                    {/* REQUERIMIENTO: Inserción de variables con chips/pastillas sin escribir llaves a mano */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-cyan-500/20 space-y-2">
                      <div className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Toca una variable para insertarla donde esté tu cursor (sin escribir llaves):</span>
                      </div>

                      {/* Variables base */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { key: 'cliente', label: '👤 Cliente' },
                          { key: 'dni', label: '🪪 DNI' },
                          { key: 'telefono', label: '📱 Teléfono' },
                          { key: 'modalidad', label: '🚚 Modalidad' },
                          { key: 'destino', label: '📍 Destino' },
                          { key: 'fecha', label: '📅 Fecha' },
                          { key: 'orden', label: '🏷️ Orden' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => insertVariableIntoMessage(item.key)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 border border-cyan-500/30 text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                          >
                            + {item.label}
                          </button>
                        ))}
                      </div>

                      {/* Variables dinámicas de campos personalizados */}
                      {camposList.length > 0 && (
                        <div className="pt-2 border-t border-white/5 space-y-1">
                          <span className="text-[10px] text-purple-300 font-bold block">
                            Variables de campos que creaste en esta agencia:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {camposList.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => insertVariableIntoMessage(c.label)}
                                className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-500 hover:text-white text-purple-200 border border-purple-500/30 text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                              >
                                + {`{${c.label}}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Textarea del mensaje */}
                    <textarea
                      ref={textareaRef}
                      rows={8}
                      value={mensajeComprobacion}
                      onChange={e => setMensajeComprobacion(e.target.value)}
                      className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[10.5px] text-slate-400 space-y-1">
                      <p>
                        💡 <strong>Tranquilidad:</strong> Si no incluyes alguna variable en el texto, cualquier dato completado por la clienta con la opción <em>"Ver en Comprobante"</em> se anexará automáticamente al final para que nunca se pierda nada.
                      </p>
                      <p className="italic text-[10px]">
                        * El pie oficial de Encomi con el link de la app se adjunta automáticamente al final del mensaje de WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 4: ROTULADO INTELIGENTE ESTRATÉGICO --- */}
              {activeEditorTab === 'rotulado' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Printer className="w-4 h-4 text-amber-400" />
                          <span>Configuración Inteligente del Rótulo de Despacho</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Decide estratégicamente qué información se imprimirá en las etiquetas físicas para esta agencia.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-950/50 transition-all cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Previsualizar en Vivo</span>
                      </button>
                    </div>

                    {/* BLOQUE 1: DATOS DE QUIEN LO ENVÍA (REMITENTE) */}
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          <span>Datos de Quién lo Envía (Remitente Oficial)</span>
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-200 select-none">
                          <input
                            type="checkbox"
                            checked={incluirRemitente}
                            onChange={e => setIncluirRemitente(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-amber-500 cursor-pointer"
                          />
                          <span>Incluir Remitente en Etiqueta</span>
                        </label>
                      </div>

                      {incluirRemitente && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarRemitenteNombre}
                              onChange={e => setMostrarRemitenteNombre(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-amber-500"
                            />
                            <span>Nombre Empresa</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarRemitenteRucDni}
                              onChange={e => setMostrarRemitenteRucDni(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-amber-500"
                            />
                            <span>DNI / RUC</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarRemitenteTelefono}
                              onChange={e => setMostrarRemitenteTelefono(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-amber-500"
                            />
                            <span>Celular</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarRemitenteOrigen}
                              onChange={e => setMostrarRemitenteOrigen(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-amber-500"
                            />
                            <span>Dirección Origen</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* BLOQUE 2: DATOS DE QUIEN LO RECIBE (DESTINATARIO) */}
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-cyan-400" />
                          <span>Datos de Quién lo Recibe (Destinatario)</span>
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-cyan-200 select-none">
                          <input
                            type="checkbox"
                            checked={incluirDestinatario}
                            onChange={e => setIncluirDestinatario(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                          />
                          <span>Incluir Destinatario</span>
                        </label>
                      </div>

                      {incluirDestinatario && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarClienteNombre}
                              onChange={e => setMostrarClienteNombre(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Nombre de Clienta</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarClienteDni}
                              onChange={e => setMostrarClienteDni(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>DNI Gigante</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarClienteTelefono}
                              onChange={e => setMostrarClienteTelefono(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Teléfono</span>
                          </label>

                          <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarClienteDestino}
                              onChange={e => setMostrarClienteDestino(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Destino / Sucursal</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* BLOQUE 3: CAMPOS PERSONALIZADOS EN EL RÓTULO */}
                    {camposList.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-purple-500/20 space-y-2">
                        <span className="text-xs font-bold text-purple-300 block">
                          Campos adicionales que se imprimirán en el rótulo:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {camposList.map((c) => (
                            <label
                              key={c.id}
                              className={`flex items-center justify-between p-2 rounded-xl border text-[11px] cursor-pointer transition-all ${
                                c.mostrar_en_rotulado
                                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                                  : 'bg-slate-950 border-white/5 text-slate-400'
                              }`}
                            >
                              <span className="font-bold">{c.label}</span>
                              <input
                                type="checkbox"
                                checked={c.mostrar_en_rotulado}
                                onChange={() => {
                                  setCamposList(prev => prev.map(item => item.id === c.id ? { ...item, mostrar_en_rotulado: !item.mostrar_en_rotulado } : item));
                                }}
                                className="w-3.5 h-3.5 rounded text-purple-500"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* BLOQUE 4: EXTRAS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={mostrarBarcode}
                          onChange={e => setMostrarBarcode(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-cyan-500"
                        />
                        <span>Código de Barras Simulado</span>
                      </label>

                      <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={mostrarFechaSello}
                          onChange={e => setMostrarFechaSello(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-cyan-500"
                        />
                        <span>Fecha y Sello de Embalaje</span>
                      </label>
                    </div>

                  </div>
                </div>
              )}

            </div>

            {/* Footer con Acciones */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-white/10 bg-slate-950/90 shrink-0 gap-3">
              <button
                type="button"
                onClick={() => setEditingMethod(null)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Rótulo Muestra</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveMethod()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PREVISUALIZADOR DEL RÓTULO EN VIVO CON DATOS FICTICIOS REALES      */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Previsualización del Rótulo ({nombreMetodo || 'Agencia'})
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Así se imprimirá la etiqueta física térmica / A4 con datos de prueba
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MOCKUP ETIQUETA TÉRMICA REALISTA (BLANCO CON TINTA NEGRA) */}
            <div className="bg-white text-slate-950 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-slate-400 shadow-2xl space-y-3 font-sans text-xs select-none">
              
              {/* Header de la etiqueta */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <div className="flex items-center gap-2">
                  <img
                    src={tallerConfig.logo_url || '/Comikids.png'}
                    alt="Logo Empresa"
                    className="w-9 h-9 object-contain rounded-lg border border-slate-200"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
                  />
                  <div>
                    <h4 className="font-black text-sm uppercase leading-none">
                      {tallerConfig.nombre_taller || 'ComiKids Envíos'}
                    </h4>
                    <span className="text-[9px] text-slate-600 font-bold">DESPACHO OFICIAL</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px] uppercase">
                    {fotoUrlMetodo && <img src={fotoUrlMetodo} alt="Logo" className="h-3 w-auto object-contain invert" />}
                    <span>{nombreMetodo || 'AGENCIA'}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-700 block mt-0.5">
                    #CMK-7842
                  </span>
                </div>
              </div>

              {/* Código de barras simulado */}
              {mostrarBarcode && (
                <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-300 text-center space-y-0.5">
                  <div className="flex justify-center items-center gap-0.5 h-7">
                    {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
                      <div key={i} className="bg-slate-950 h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="font-mono text-[9px] font-black tracking-widest text-slate-800">
                    ⭐ #CMK-7842-SH ⭐
                  </span>
                </div>
              )}

              {/* Destino Destacado */}
              {mostrarClienteDestino && (
                <div className="p-2.5 rounded-xl bg-slate-100 border-2 border-slate-900 text-center">
                  <span className="text-[9px] font-black uppercase text-slate-600 tracking-wider block">
                    DESTINO OFICIAL DE RECOJO / ENTREGA:
                  </span>
                  <span className="font-black text-sm sm:text-base uppercase text-slate-950 block leading-tight mt-0.5">
                    AV. MÉXICO CO - LA VICTORIA, LIMA
                  </span>
                </div>
              )}

              {/* SECCIÓN DESTINATARIO */}
              {incluirDestinatario && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="text-[10px] font-black uppercase text-slate-700">
                      👤 DESTINATARIO (CLIENTE)
                    </span>
                    <span className="text-[9px] font-bold text-slate-600">RECOJO PRESENCIAL</span>
                  </div>

                  {mostrarClienteNombre && (
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Nombre Completo:</span>
                      <span className="font-black text-base uppercase text-slate-950 block leading-tight">
                        MILAGROS JANET AMPUERO
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-300">
                    {mostrarClienteDni && (
                      <div>
                        <span className="text-[8px] font-black uppercase text-slate-500 block">DNI / DOC:</span>
                        <span className="font-mono font-black text-lg text-slate-950 block leading-none">
                          72345678
                        </span>
                      </div>
                    )}
                    {mostrarClienteTelefono && (
                      <div className="text-right">
                        <span className="text-[8px] font-black uppercase text-slate-500 block">TELÉFONO:</span>
                        <span className="font-mono font-bold text-sm text-slate-900 block leading-none">
                          +51 987 654 321
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Campos personalizados en el rótulo */}
                  {camposList.filter(c => c.mostrar_en_rotulado).length > 0 && (
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200">
                      {camposList.filter(c => c.mostrar_en_rotulado).map(c => (
                        <div key={c.id} className="p-1 rounded bg-white border border-slate-200 text-[10px]">
                          <span className="text-[8px] font-bold text-slate-500 uppercase block">{c.label}:</span>
                          <span className="font-black text-slate-900 block truncate">
                            {c.placeholder || '@comikids_pe'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN REMITENTE */}
              {incluirRemitente && (
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-[10px] space-y-0.5">
                  <div className="font-black uppercase text-slate-800 flex items-center justify-between mb-0.5">
                    <span>REMITENTE OFICIAL:</span>
                    {mostrarRemitenteNombre && (
                      <span className="font-bold text-slate-950">{tallerConfig.nombre_taller || 'ComiKids Envíos'}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-slate-700">
                    {mostrarRemitenteRucDni && (
                      <p><span className="font-bold">DNI/RUC:</span> {tallerConfig.remitente_dni || tallerConfig.ruc_dni || '42020312'}</p>
                    )}
                    {mostrarRemitenteTelefono && (
                      <p><span className="font-bold">Celular:</span> {tallerConfig.remitente_celular || '927781412'}</p>
                    )}
                  </div>
                  {mostrarRemitenteOrigen && (
                    <p className="text-slate-600 text-[9px]"><span className="font-bold">Origen:</span> {tallerConfig.direccion_taller || 'Lima, Perú'}</p>
                  )}
                </div>
              )}

              {/* Pie de paquete */}
              {mostrarFechaSello && (
                <div className="border-t border-dashed border-slate-400 pt-1.5 flex items-center justify-between text-[9px] text-slate-600 font-bold">
                  <span>📦 Paquete Seguro Encomi</span>
                  <span>Impreso: {new Date().toLocaleDateString('es-PE')}</span>
                </div>
              )}

            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Entendido, volver a editar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CREAR NUEVA AGENCIA                                                */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-cyan-500/40 p-6 sm:p-7 shadow-2xl shadow-cyan-950/50 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Crear Nueva Agencia de Envío
                  </h3>
                  <p className="text-xs text-slate-400">Añade transportes, couriers o modalidades personalizadas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewAgency} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nombre de la Agencia o Servicio *
                </label>
                <input
                  type="text"
                  required
                  value={nombreMetodo}
                  onChange={e => setNombreMetodo(e.target.value)}
                  placeholder="Ej. Transportes Flores, Marvisur o Chaski"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Descripción para los clientes
                </label>
                <input
                  type="text"
                  value={descripcionMetodo}
                  onChange={e => setDescripcionMetodo(e.target.value)}
                  placeholder="Ej. Despachos interprovinciales por terminal terrestre"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Logo / Foto (Opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={fotoUrlMetodo}
                    onChange={e => setFotoUrlMetodo(e.target.value)}
                    placeholder="Enlace URL del logo..."
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 transition-colors cursor-pointer"
                    title="Subir archivo"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-[11px] leading-relaxed">
                ℹ️ La nueva agencia se creará automáticamente con campos estándar (Nombre, Teléfono y Destino) y con el mensaje oficial de WhatsApp precargado. Luego podrás añadirle campos como "Usuario de TikTok" con variables de un solo click y configurar su rótulo.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  Crear Agencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
