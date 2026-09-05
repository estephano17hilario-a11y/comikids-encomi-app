import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ordersService } from '../../services/ordersService';
import {
  MetodoEnvio,
  CampoPersonalizadoAgencia,
  TallerConfig,
  Pedido,
  DiaSemana,
  BloqueRotuladoPersonalizado,
} from '../../types/database.types';
import { ShalomLabelPrint } from './ShalomLabelPrint';
import {
  DIAS_SEMANA_ORDEN,
  DIAS_SEMANA_LABELS,
  DIAS_SEMANA_ABREV,
  getAgencyDaysSummary,
} from '../../utils/agencyAvailability';
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
  ShieldCheck,
  Palette,
  Calendar,
  Clock,
  SlidersHorizontal,
  AlertTriangle,
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

  // Sub-sección activa dentro del editor de agencia (5 pestañas)
  const [activeEditorTab, setActiveEditorTab] = useState<'general' | 'disponibilidad' | 'datos' | 'mensaje' | 'rotulado'>('general');

  // Estados generales del formulario en edición
  const [nombreMetodo, setNombreMetodo] = useState('');
  const [descripcionMetodo, setDescripcionMetodo] = useState('');
  const [iconoMetodo, setIconoMetodo] = useState('Truck');
  const [fotoUrlMetodo, setFotoUrlMetodo] = useState('');
  const [camposList, setCamposList] = useState<CampoPersonalizadoAgencia[]>([]);
  const [mensajeComprobacion, setMensajeComprobacion] = useState('');

  // ==========================================
  // REQUERIMIENTO 2: DISPONIBILIDAD INTELIGENTE
  // ==========================================
  const [diasSemanaHabilitados, setDiasSemanaHabilitados] = useState<DiaSemana[]>([]);
  const [usarRangoFechas, setUsarRangoFechas] = useState(false);
  const [fechaInicioDisp, setFechaInicioDisp] = useState('');
  const [fechaFinDisp, setFechaFinDisp] = useState('');
  const [ocultarSiNoDisponible, setOcultarSiNoDisponible] = useState(false);
  const [restringirFechaEnvio, setRestringirFechaEnvio] = useState(true);
  const [mensajeDisponibilidad, setMensajeDisponibilidad] = useState('');

  // ==========================================
  // REQUERIMIENTO 1: RÓTULO 100% PERSONALIZABLE
  // ==========================================
  const [estiloRotulo, setEstiloRotulo] = useState<'estandar_oficial' | 'vision_modern' | 'eco_ink_saving' | ''>('');
  const [previewEstilo, setPreviewEstilo] = useState<'estandar_oficial' | 'vision_modern' | 'eco_ink_saving' | ''>('');

  // Logos y Encabezado
  const [mostrarLogoEmpresa, setMostrarLogoEmpresa] = useState(true);
  const [mostrarLogoAgencia, setMostrarLogoAgencia] = useState(true);
  const [subtituloCabecera, setSubtituloCabecera] = useState('');

  // Barcode y Tracking
  const [mostrarBarcode, setMostrarBarcode] = useState(true);
  const [mostrarTracking, setMostrarTracking] = useState(true);

  // Destino
  const [mostrarDestino, setMostrarDestino] = useState(true);
  const [tituloDestino, setTituloDestino] = useState('');

  // Destinatario
  const [incluirDestinatario, setIncluirDestinatario] = useState(true);
  const [tituloDestinatario, setTituloDestinatario] = useState('');
  const [mostrarBadgeModalidad, setMostrarBadgeModalidad] = useState(true);
  const [textoBadgeModalidad, setTextoBadgeModalidad] = useState('');
  const [mostrarClienteNombre, setMostrarClienteNombre] = useState(true);
  const [tituloClienteNombre, setTituloClienteNombre] = useState('');
  const [mostrarClienteDni, setMostrarClienteDni] = useState(true);
  const [tituloClienteDni, setTituloClienteDni] = useState('');
  const [tamanoDni, setTamanoDni] = useState<'normal' | 'grande' | 'gigante'>('gigante');
  const [mostrarClienteTelefono, setMostrarClienteTelefono] = useState(true);
  const [tituloClienteTelefono, setTituloClienteTelefono] = useState('');

  // Remitente
  const [incluirRemitente, setIncluirRemitente] = useState(true);
  const [tituloRemitente, setTituloRemitente] = useState('');
  const [usarRemitentePersonalizado, setUsarRemitentePersonalizado] = useState(false);
  const [customRemitenteNombre, setCustomRemitenteNombre] = useState('');
  const [customRemitenteRucDni, setCustomRemitenteRucDni] = useState('');
  const [customRemitenteCelular, setCustomRemitenteCelular] = useState('');
  const [customRemitenteOrigen, setCustomRemitenteOrigen] = useState('');
  const [customRemitenteObservaciones, setCustomRemitenteObservaciones] = useState('');
  const [mostrarRemitenteNombre, setMostrarRemitenteNombre] = useState(true);
  const [mostrarRemitenteRucDni, setMostrarRemitenteRucDni] = useState(true);
  const [mostrarRemitenteTelefono, setMostrarRemitenteTelefono] = useState(true);
  const [mostrarRemitenteOrigen, setMostrarRemitenteOrigen] = useState(true);

  // Etiquetas personalizadas de campos de formulario en rótulo
  const [etiquetasCampos, setEtiquetasCampos] = useState<Record<string, string>>({});

  // Bloques libres / notas especiales en rótulo
  const [bloquesPersonalizados, setBloquesPersonalizados] = useState<BloqueRotuladoPersonalizado[]>([]);
  const [newBloqueTitulo, setNewBloqueTitulo] = useState('');
  const [newBloqueContenido, setNewBloqueContenido] = useState('');
  const [newBloqueTipo, setNewBloqueTipo] = useState<'aviso' | 'nota' | 'destacado' | 'flete'>('aviso');
  const [newBloquePosicion, setNewBloquePosicion] = useState<'arriba' | 'medio' | 'abajo'>('medio');

  // Extras
  const [mostrarFechaSello, setMostrarFechaSello] = useState(true);
  const [textoSelloPersonalizado, setTextoSelloPersonalizado] = useState('');

  // Nuevo campo a solicitar a la clienta
  const [newCampoLabel, setNewCampoLabel] = useState('');
  const [newCampoPlaceholder, setNewCampoPlaceholder] = useState('');
  const [newCampoTipo, setNewCampoTipo] = useState<'texto' | 'telefono' | 'numero' | 'textarea'>('texto');
  const [newCampoRequerido, setNewCampoRequerido] = useState(false);
  const [newCampoRotulado, setNewCampoRotulado] = useState(true);
  const [newCampoComprobante, setNewCampoComprobante] = useState(true);

  // Referencias
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ocultar dock inferior cuando se abre algún modal
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

    // Mensaje WhatsApp
    setMensajeComprobacion(m.mensaje_comprobacion?.trim() || DEFAULT_STANDARD_RECEIPT(m.nombre));

    // Disponibilidad
    const disp = m.disponibilidad;
    setDiasSemanaHabilitados(disp?.dias_semana || []);
    setUsarRangoFechas(Boolean(disp?.usar_rango_fechas));
    setFechaInicioDisp(disp?.fecha_inicio || '');
    setFechaFinDisp(disp?.fecha_fin || '');
    setOcultarSiNoDisponible(Boolean(disp?.ocultar_si_no_disponible));
    setRestringirFechaEnvio(disp?.restringir_fecha_envio !== false);
    setMensajeDisponibilidad(disp?.mensaje_disponibilidad || '');

    // Rótulo Inteligente 100% Personalizable
    const cfg = m.config_rotulado;
    setEstiloRotulo(cfg?.estilo_rotulo || '');
    setPreviewEstilo(cfg?.estilo_rotulo || '');

    setMostrarLogoEmpresa(cfg?.mostrar_logo_empresa !== false);
    setMostrarLogoAgencia(cfg?.mostrar_logo_agencia !== false);
    setSubtituloCabecera(cfg?.subtitulo_cabecera || '');

    setMostrarBarcode(cfg?.mostrar_barcode !== false);
    setMostrarTracking(cfg?.mostrar_tracking !== false);

    setMostrarDestino(cfg?.mostrar_destino !== false);
    setTituloDestino(cfg?.titulo_destino || '');

    setIncluirDestinatario(cfg?.incluir_destinatario !== false);
    setTituloDestinatario(cfg?.titulo_destinatario || '');
    setMostrarBadgeModalidad(cfg?.mostrar_badge_modalidad !== false);
    setTextoBadgeModalidad(cfg?.texto_badge_modalidad || '');
    setMostrarClienteNombre(cfg?.mostrar_cliente_nombre !== false);
    setTituloClienteNombre(cfg?.titulo_cliente_nombre || '');
    setMostrarClienteDni(cfg?.mostrar_cliente_dni !== false);
    setTituloClienteDni(cfg?.titulo_cliente_dni || '');
    setTamanoDni(cfg?.tamano_dni || 'gigante');
    setMostrarClienteTelefono(cfg?.mostrar_cliente_telefono !== false);
    setTituloClienteTelefono(cfg?.titulo_cliente_telefono || '');

    setEtiquetasCampos(cfg?.etiquetas_campos || {});
    setBloquesPersonalizados(cfg?.bloques_personalizados || []);

    const remPers = cfg?.remitente_personalizado;
    setUsarRemitentePersonalizado(Boolean(remPers?.usar_personalizado));
    setCustomRemitenteNombre(remPers?.nombre || tallerConfig.remitente_default?.nombre || tallerConfig.nombre_taller || '');
    setCustomRemitenteRucDni(remPers?.ruc_dni || tallerConfig.remitente_default?.ruc_dni || tallerConfig.remitente_dni || tallerConfig.ruc_dni || '');
    setCustomRemitenteCelular(remPers?.celular || tallerConfig.remitente_default?.celular || tallerConfig.remitente_celular || tallerConfig.celular_taller || '');
    setCustomRemitenteOrigen(remPers?.direccion || tallerConfig.remitente_default?.direccion || tallerConfig.direccion_taller || '');
    setCustomRemitenteObservaciones(remPers?.observaciones || '');

    setIncluirRemitente(cfg?.incluir_remitente !== false);
    setTituloRemitente(cfg?.titulo_remitente || '');
    setMostrarRemitenteNombre(cfg?.mostrar_remitente_nombre !== false);
    setMostrarRemitenteRucDni(cfg?.mostrar_remitente_ruc_dni !== false);
    setMostrarRemitenteTelefono(cfg?.mostrar_remitente_telefono !== false);
    setMostrarRemitenteOrigen(cfg?.mostrar_remitente_origen !== false);

    setMostrarFechaSello(cfg?.mostrar_fecha_sello !== false);
    setTextoSelloPersonalizado(cfg?.texto_sello_personalizado || '');
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
        disponibilidad: {
          dias_semana: diasSemanaHabilitados.length > 0 ? diasSemanaHabilitados : undefined,
          usar_rango_fechas: usarRangoFechas,
          fecha_inicio: fechaInicioDisp.trim() || undefined,
          fecha_fin: fechaFinDisp.trim() || undefined,
          ocultar_si_no_disponible: ocultarSiNoDisponible,
          restringir_fecha_envio: restringirFechaEnvio,
          mensaje_disponibilidad: mensajeDisponibilidad.trim() || undefined,
        },
        config_rotulado: {
          estilo_rotulo: estiloRotulo ? (estiloRotulo as any) : undefined,
          mostrar_logo_empresa: mostrarLogoEmpresa,
          mostrar_logo_agencia: mostrarLogoAgencia,
          subtitulo_cabecera: subtituloCabecera.trim() || undefined,
          mostrar_barcode: mostrarBarcode,
          mostrar_tracking: mostrarTracking,
          mostrar_destino: mostrarDestino,
          titulo_destino: tituloDestino.trim() || undefined,
          incluir_destinatario: incluirDestinatario,
          titulo_destinatario: tituloDestinatario.trim() || undefined,
          mostrar_badge_modalidad: mostrarBadgeModalidad,
          texto_badge_modalidad: textoBadgeModalidad.trim() || undefined,
          mostrar_cliente_nombre: mostrarClienteNombre,
          titulo_cliente_nombre: tituloClienteNombre.trim() || undefined,
          mostrar_cliente_dni: mostrarClienteDni,
          titulo_cliente_dni: tituloClienteDni.trim() || undefined,
          tamano_dni: tamanoDni,
          mostrar_cliente_telefono: mostrarClienteTelefono,
          titulo_cliente_telefono: tituloClienteTelefono.trim() || undefined,
          incluir_campos_personalizados: true,
          campos_visibles: rotuladoVisibles,
          etiquetas_campos: etiquetasCampos,
          bloques_personalizados: bloquesPersonalizados,
          incluir_remitente: incluirRemitente,
          titulo_remitente: tituloRemitente.trim() || undefined,
          mostrar_remitente_nombre: mostrarRemitenteNombre,
          mostrar_remitente_ruc_dni: mostrarRemitenteRucDni,
          mostrar_remitente_telefono: mostrarRemitenteTelefono,
          mostrar_remitente_origen: mostrarRemitenteOrigen,
          remitente_personalizado: {
            usar_personalizado: usarRemitentePersonalizado,
            nombre: customRemitenteNombre.trim() || undefined,
            ruc_dni: customRemitenteRucDni.trim() || undefined,
            celular: customRemitenteCelular.trim() || undefined,
            direccion: customRemitenteOrigen.trim() || undefined,
            observaciones: customRemitenteObservaciones.trim() || undefined,
          },
          mostrar_fecha_sello: mostrarFechaSello,
          texto_sello_personalizado: textoSelloPersonalizado.trim() || undefined,
        },
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
          },
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
        },
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

  const handleToggleActivo = (m: MetodoEnvio) => {
    ordersService.updateShippingMethod(m.id, { activo: !m.activo });
    reloadMethods();
    notifySuccess(`Agencia "${m.nombre}" ${!m.activo ? 'activada' : 'desactivada'}.`);
  };

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

  // Presets rápidos para el rótulo
  const applyPresetRotulo = (preset: 'completo' | 'solo_destinatario' | 'eco_ahorro' | 'con_alertas') => {
    if (preset === 'completo') {
      setIncluirRemitente(true);
      setMostrarRemitenteNombre(true);
      setMostrarRemitenteRucDni(true);
      setMostrarRemitenteTelefono(true);
      setMostrarRemitenteOrigen(true);
      setIncluirDestinatario(true);
      setMostrarClienteNombre(true);
      setMostrarClienteDni(true);
      setMostrarClienteTelefono(true);
      setMostrarDestino(true);
      setMostrarBarcode(true);
      setMostrarTracking(true);
      setTamanoDni('gigante');
      notifySuccess('Preset "Completo Oficial" aplicado.');
    } else if (preset === 'solo_destinatario') {
      setIncluirRemitente(false);
      setIncluirDestinatario(true);
      setMostrarClienteNombre(true);
      setMostrarClienteDni(true);
      setMostrarClienteTelefono(true);
      setMostrarDestino(true);
      setMostrarBarcode(true);
      setTamanoDni('gigante');
      notifySuccess('Preset "Solo Destinatario" aplicado.');
    } else if (preset === 'eco_ahorro') {
      setEstiloRotulo('eco_ink_saving');
      setPreviewEstilo('eco_ink_saving');
      setTamanoDni('grande');
      setIncluirRemitente(true);
      setIncluirDestinatario(true);
      notifySuccess('Preset "Eco Ahorro Tinta" aplicado.');
    } else if (preset === 'con_alertas') {
      setBloquesPersonalizados([
        {
          id: 'b-fragil-' + Date.now().toString(36),
          titulo: '⚠️ ¡FRÁGIL! MANEJAR CON CUIDADO',
          contenido: 'Prendas delicadas bordadas. No golpear ni presionar.',
          tipo: 'aviso',
          posicion: 'medio',
        },
        {
          id: 'b-flete-' + Date.now().toString(36),
          titulo: '💰 FLETE PAGO DESTINO',
          contenido: 'Cliente abona el costo del envío al recoger en agencia.',
          tipo: 'flete',
          posicion: 'medio',
        },
      ]);
      notifySuccess('Preset "Con Alertas Especiales" aplicado.');
    }
  };

  // Agregar bloque personalizado de rótulo
  const handleAddBloque = () => {
    if (!newBloqueContenido.trim()) {
      alert('Ingresa el texto o aviso que saldrá en la etiqueta.');
      return;
    }
    const nuevo: BloqueRotuladoPersonalizado = {
      id: 'b-' + Date.now().toString(36),
      titulo: newBloqueTitulo.trim() || undefined,
      contenido: newBloqueContenido.trim(),
      tipo: newBloqueTipo,
      posicion: newBloquePosicion,
    };
    setBloquesPersonalizados(prev => [...prev, nuevo]);
    setNewBloqueTitulo('');
    setNewBloqueContenido('');
  };

  const handleDeleteBloque = (id: string) => {
    setBloquesPersonalizados(prev => prev.filter(b => b.id !== id));
  };

  // Inserción de variable en WhatsApp
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

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + token.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  // Agregar campo personalizado
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

  // Objeto reactivo en vivo para renderizado instantáneo en el editor
  const currentLiveMethod: MetodoEnvio = useMemo(() => {
    return {
      id: editingMethod?.id || 'met-live-edit',
      codigo: editingMethod?.codigo || 'agencia_custom',
      nombre: nombreMetodo || editingMethod?.nombre || 'Agencia',
      descripcion: descripcionMetodo,
      icono: iconoMetodo,
      foto_url: fotoUrlMetodo,
      tipo_formulario: editingMethod?.tipo_formulario || 'personalizado',
      activo: true,
      orden: 1,
      campos_personalizados: camposList,
      config_rotulado: {
        estilo_rotulo: (previewEstilo || estiloRotulo) ? ((previewEstilo || estiloRotulo) as any) : undefined,
        mostrar_logo_empresa: mostrarLogoEmpresa,
        mostrar_logo_agencia: mostrarLogoAgencia,
        subtitulo_cabecera: subtituloCabecera,
        mostrar_barcode: mostrarBarcode,
        mostrar_tracking: mostrarTracking,
        mostrar_destino: mostrarDestino,
        titulo_destino: tituloDestino,
        incluir_destinatario: incluirDestinatario,
        titulo_destinatario: tituloDestinatario,
        mostrar_badge_modalidad: mostrarBadgeModalidad,
        texto_badge_modalidad: textoBadgeModalidad,
        mostrar_cliente_nombre: mostrarClienteNombre,
        titulo_cliente_nombre: tituloClienteNombre,
        mostrar_cliente_dni: mostrarClienteDni,
        titulo_cliente_dni: tituloClienteDni,
        tamano_dni: tamanoDni,
        mostrar_cliente_telefono: mostrarClienteTelefono,
        titulo_cliente_telefono: tituloClienteTelefono,
        incluir_campos_personalizados: true,
        campos_visibles: camposList.filter(c => c.mostrar_en_rotulado).map(c => c.id),
        etiquetas_campos: etiquetasCampos,
        bloques_personalizados: bloquesPersonalizados,
        incluir_remitente: incluirRemitente,
        titulo_remitente: tituloRemitente,
        mostrar_remitente_nombre: mostrarRemitenteNombre,
        mostrar_remitente_ruc_dni: mostrarRemitenteRucDni,
        mostrar_remitente_telefono: mostrarRemitenteTelefono,
        mostrar_remitente_origen: mostrarRemitenteOrigen,
        remitente_personalizado: {
          usar_personalizado: usarRemitentePersonalizado,
          nombre: customRemitenteNombre.trim() || undefined,
          ruc_dni: customRemitenteRucDni.trim() || undefined,
          celular: customRemitenteCelular.trim() || undefined,
          direccion: customRemitenteOrigen.trim() || undefined,
          observaciones: customRemitenteObservaciones.trim() || undefined,
        },
        mostrar_fecha_sello: mostrarFechaSello,
        texto_sello_personalizado: textoSelloPersonalizado,
      },
    };
  }, [
    editingMethod, nombreMetodo, descripcionMetodo, iconoMetodo, fotoUrlMetodo,
    camposList, previewEstilo, estiloRotulo, mostrarLogoEmpresa, mostrarLogoAgencia,
    subtituloCabecera, mostrarBarcode, mostrarTracking, mostrarDestino, tituloDestino,
    incluirDestinatario, tituloDestinatario, mostrarBadgeModalidad, textoBadgeModalidad,
    mostrarClienteNombre, tituloClienteNombre, mostrarClienteDni, tituloClienteDni,
    tamanoDni, mostrarClienteTelefono, tituloClienteTelefono, etiquetasCampos,
    bloquesPersonalizados, incluirRemitente, tituloRemitente, mostrarRemitenteNombre,
    mostrarRemitenteRucDni, mostrarRemitenteTelefono, mostrarRemitenteOrigen,
    usarRemitentePersonalizado, customRemitenteNombre, customRemitenteRucDni,
    customRemitenteCelular, customRemitenteOrigen, customRemitenteObservaciones,
    mostrarFechaSello, textoSelloPersonalizado,
  ]);

  const mockPedido: Pedido = useMemo(() => ({
    id: 'ped-live-demo',
    codigo_seguimiento: 'ENCOMI-9428',
    usuario_id: 'usr-demo',
    usuario: {
      id: 'usr-demo',
      dni: '72384910',
      nombre_completo: 'María Fernanda Quispe Ramos',
      email_default: 'maria.quispe@ejemplo.com',
      telefono_default: '987654321',
      password_hash: '',
      rol: 'client',
      avatar_url: '',
      puntos_xp: 0,
      nivel: 1,
      created_at: new Date().toISOString(),
    },
    detalles_bordado: 'Paquete de muestra para verificación de rotulado',
    metodo_envio_codigo: editingMethod ? editingMethod.codigo : 'agencia_demo',
    metodo_envio_nombre: nombreMetodo || editingMethod?.nombre || 'Agencia Oficial',
    destino_detalle: editingMethod?.codigo === 'shalom'
      ? 'AGENCIA SHALOM - AV. MÉXICO 120, LA VICTORIA, LIMA'
      : editingMethod?.codigo === 'olva'
      ? 'SEDE OLVA COURIER - AV. LARCO 345, MIRAFLORES, LIMA'
      : 'AV. PRINCIPAL 456, INT. 201, SAN ISIDRO, LIMA',
    estado_produccion: 'completado',
    estado_envio: 'pendiente',
    campos_personalizados: camposList.reduce((acc, c) => {
      if (c.id.includes('dni') || c.label.toLowerCase().includes('dni')) acc[c.id] = '72384910';
      else if (c.id.includes('tel') || c.label.toLowerCase().includes('tel')) acc[c.id] = '987654321';
      else if (c.id.includes('dir') || c.label.toLowerCase().includes('dir')) acc[c.id] = 'Av. Los Próceres 789';
      else acc[c.id] = c.placeholder || 'Dato de prueba';
      return acc;
    }, {} as Record<string, string>),
    created_at: new Date().toISOString(),
  }), [editingMethod, nombreMetodo, camposList]);

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
              Personaliza qué días atiende cada agencia, el mensaje de WhatsApp y el rótulo de despacho 100% a tu medida.
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
          const daysSummary = getAgencyDaysSummary(m);

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
                {/* Header de la tarjeta */}
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

                {/* Resumen de configuración de datos, rótulo y días de despacho */}
                <div className="space-y-2">
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

                  {/* Badge resumen de Días de despacho */}
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{daysSummary}</span>
                    </div>
                    {m.disponibilidad?.ocultar_si_no_disponible && (
                      <span className="text-[8.5px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200 uppercase font-mono">
                        Auto-oculta
                      </span>
                    )}
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
                  <span>Configurar Agencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleActivo(m)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    m.activo
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                  title={m.activo ? 'Desactivar para clientas' : 'Activar para clientas'}
                >
                  <Check className="w-3.5 h-3.5" />
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
      {/* MODAL PRINCIPAL: EDITOR DE AGENCIA (5 PESTAÑAS + ESTUDIO VISUAL)          */}
      {/* ========================================================================= */}
      {editingMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-6xl rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
            
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
                    Días y fechas de despacho, datos a pedir, mensaje de WhatsApp y rótulo 100% personalizable en tiempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Abrir vista de impresión a pantalla completa"
                >
                  <Printer className="w-3.5 h-3.5 text-purple-300" />
                  <span className="hidden sm:inline">Imprimir Muestra</span>
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
            <div className="flex items-center gap-1.5 p-2 px-4 sm:px-6 bg-slate-950/40 border-b border-white/5 overflow-x-auto shrink-0">
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
                onClick={() => setActiveEditorTab('disponibilidad')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'disponibilidad'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>2. Días & Calendario</span>
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
                <span>3. Datos a Pedir ({camposList.length})</span>
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
                <span>4. Mensaje WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('rotulado')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeEditorTab === 'rotulado'
                    ? 'bg-pink-500 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>5. Rótulo 100% Personalizable</span>
              </button>
            </div>

            {/* Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
              
              {/* --- TAB 1: GENERAL & FOTO --- */}
              {activeEditorTab === 'general' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Foto o Logo de la Agencia</span>
                    </span>

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
                            <img src={p.url} alt="" className="w-4 h-4 object-contain" />
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        O pega la URL directa de la imagen / Sube un archivo:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={fotoUrlMetodo}
                          onChange={e => setFotoUrlMetodo(e.target.value)}
                          placeholder="https://ejemplo.com/logo.png"
                          className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Nombre de la Agencia *
                      </label>
                      <input
                        type="text"
                        value={nombreMetodo}
                        onChange={e => setNombreMetodo(e.target.value)}
                        placeholder="Ej. Shalom Courier, Olva, Transportes Flores"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Descripción o Subtítulo
                      </label>
                      <input
                        type="text"
                        value={descripcionMetodo}
                        onChange={e => setDescripcionMetodo(e.target.value)}
                        placeholder="Ej. Envíos a todo el Perú con recojo en agencia"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 2: DISPONIBILIDAD INTELIGENTE (DÍAS Y FECHAS) --- */}
              {activeEditorTab === 'disponibilidad' && (
                <div className="space-y-5 animate-fadeIn">
                  
                  {/* Card 1: Días de la semana habilitados */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-amber-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>Días de la Semana Habilitados para Despacho</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Configura qué días opera o sale encomienda por esta agencia.
                        </p>
                      </div>

                      {/* Presets de selección rápida de días */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDiasSemanaHabilitados([])}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer ${
                            diasSemanaHabilitados.length === 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 font-black'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          Todos los días
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiasSemanaHabilitados(['lunes', 'martes', 'miercoles', 'jueves', 'viernes'])}
                          className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                          Lun a Vie
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiasSemanaHabilitados(['miercoles', 'sabado'])}
                          className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                          Mié y Sáb
                        </button>
                      </div>
                    </div>

                    {/* Botones de Días de la semana */}
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-1">
                      {DIAS_SEMANA_ORDEN.map((dia) => {
                        const isSelected = diasSemanaHabilitados.length === 0 || diasSemanaHabilitados.includes(dia);
                        return (
                          <button
                            key={dia}
                            type="button"
                            onClick={() => {
                              if (diasSemanaHabilitados.length === 0) {
                                // Si estaban todos seleccionados por defecto, desmarcar solo este día
                                setDiasSemanaHabilitados(DIAS_SEMANA_ORDEN.filter(d => d !== dia));
                              } else if (diasSemanaHabilitados.includes(dia)) {
                                setDiasSemanaHabilitados(prev => prev.filter(d => d !== dia));
                              } else {
                                setDiasSemanaHabilitados(prev => [...prev, dia]);
                              }
                            }}
                            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-950/40'
                                : 'bg-slate-900/60 border-white/5 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <span className="text-xs font-black uppercase">{DIAS_SEMANA_ABREV[dia]}</span>
                            <span className="text-[9.5px] font-medium">{DIAS_SEMANA_LABELS[dia]}</span>
                            <span className={`w-2 h-2 rounded-full mt-0.5 ${isSelected ? 'bg-amber-400' : 'bg-slate-700'}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 2: Rango de Fechas (Entre qué día a qué día) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-bold text-cyan-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          <span>Habilitar solo entre un Rango de Fechas (Opcional)</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Ideal para campañas, convenios temporales o fechas específicas de entrega.
                        </p>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-cyan-300 select-none">
                        <input
                          type="checkbox"
                          checked={usarRangoFechas}
                          onChange={e => setUsarRangoFechas(e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-500 cursor-pointer"
                        />
                        <span>Activar Rango de Fechas</span>
                      </label>
                    </div>

                    {usarRangoFechas && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fadeIn">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            Fecha de Inicio (Disponible desde):
                          </label>
                          <input
                            type="date"
                            value={fechaInicioDisp}
                            onChange={e => setFechaInicioDisp(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            Fecha de Fin (Disponible hasta):
                          </label>
                          <input
                            type="date"
                            value={fechaFinDisp}
                            onChange={e => setFechaFinDisp(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Reglas Inteligentes de Selección y Visibilidad */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <span className="font-bold text-purple-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                      <span>Comportamiento Inteligente en el Formulario</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Switch Ocultar si no está disponible */}
                      <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900 border border-white/5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={ocultarSiNoDisponible}
                          onChange={e => setOcultarSiNoDisponible(e.target.checked)}
                          className="w-4 h-4 rounded text-purple-500 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <strong className="block text-slate-200 text-[11px]">Ocultar si no está disponible</strong>
                          <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                            Si está marcado, la agencia no aparecerá en el catálogo para clientas fuera de sus días de despacho.
                          </span>
                        </div>
                      </label>

                      {/* Switch Restringir selector de fecha */}
                      <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900 border border-white/5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={restringirFechaEnvio}
                          onChange={e => setRestringirFechaEnvio(e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-500 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <strong className="block text-slate-200 text-[11px]">Restringir fecha de envío inteligente</strong>
                          <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                            Al elegir esta agencia, la fecha deseada de envío se autocalibra y restringe a solo los días habilitados.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Mensaje Informativo de Disponibilidad (Opcional):
                      </label>
                      <input
                        type="text"
                        value={mensajeDisponibilidad}
                        onChange={e => setMensajeDisponibilidad(e.target.value)}
                        placeholder="Ej: Despachos exclusivamente los días Miércoles y Sábados"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* --- TAB 3: DATOS A PEDIR (CAMPOS PERSONALIZADOS) --- */}
              {activeEditorTab === 'datos' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-purple-400" />
                      <span>Campos Solicitados a la Clienta</span>
                    </span>

                    {camposList.length === 0 ? (
                      <p className="text-slate-500 text-xs italic py-2">No hay campos configurados aún.</p>
                    ) : (
                      <div className="space-y-2">
                        {camposList.map((campo) => (
                          <div
                            key={campo.id}
                            className="p-3 rounded-2xl bg-slate-900 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{campo.label}</span>
                                {campo.sistema && (
                                  <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    Base
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                Tipo: {campo.tipo} • Variable: <strong className="text-purple-300">{`{${campo.label}}`}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
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
                              >
                                <Tag className="w-3 h-3" />
                                <span>{campo.mostrar_en_rotulado ? '✓ En Rótulo' : 'Sin Rótulo'}</span>
                              </button>

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
                              >
                                <Eye className="w-3 h-3" />
                                <span>{campo.mostrar_en_comprobante ? '✓ Comprobante' : 'Oculto'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCampo(campo.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                                title="Eliminar este dato"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Añadir nuevo campo adicional */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30 space-y-3 mt-4">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Pregunta / Dato Adicional (ej: Usuario de TikTok, Color de Prenda, etc.)</span>
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
                            placeholder="Ej. Usuario de TikTok o Color de Prenda"
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
                            <option value="numero">Número / Documento</option>
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

              {/* --- TAB 4: MENSAJE WHATSAPP --- */}
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

                    {/* Chips de variables */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-cyan-500/20 space-y-2">
                      <div className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Toca una variable para insertarla donde esté tu cursor (sin escribir llaves):</span>
                      </div>

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
                            className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 border border-cyan-500/30 text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer"
                          >
                            + {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={8}
                      value={mensajeComprobacion}
                      onChange={e => setMensajeComprobacion(e.target.value)}
                      className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* --- TAB 5: RÓTULO 100% PERSONALIZABLE (ESTUDIO VISUAL CON LIVE PREVIEW LADO A LADO) --- */}
              {activeEditorTab === 'rotulado' && (
                <div className="space-y-5 animate-fadeIn">
                  
                  {/* BARRA SUPERIOR: PRESETS RÁPIDOS Y ESTILO */}
                  <div className="p-4 rounded-3xl bg-slate-950/90 border border-pink-500/30 space-y-3.5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-pink-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-pink-400" />
                          <span>Estudio Visual del Rótulo 100% Personalizable</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Todo lo que cambies aquí se refleja instantáneamente en la vista previa y en la impresión física.
                        </p>
                      </div>

                      {/* Presets de 1 solo clic */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold mr-1">Presets:</span>
                        <button
                          type="button"
                          onClick={() => applyPresetRotulo('completo')}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-bold transition-all cursor-pointer"
                        >
                          📦 Completo
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetRotulo('solo_destinatario')}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-white/10 text-purple-300 border border-purple-500/30 text-[10.5px] font-bold transition-all cursor-pointer"
                        >
                          ⚡ Solo Destinatario
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetRotulo('eco_ahorro')}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-white/10 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold transition-all cursor-pointer"
                        >
                          🌿 Eco Ahorro
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetRotulo('con_alertas')}
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-white/10 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold transition-all cursor-pointer"
                        >
                          ⚠️ Con Frágil
                        </button>
                      </div>
                    </div>

                    {/* Selector de Estilo Visual */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                      {[
                        { id: '', label: '🌐 Predeterminado Global', desc: 'Hereda de Configuración' },
                        { id: 'estandar_oficial', label: '🏷️ Estándar Oficial Encomi', desc: 'Alto contraste con DNI gigante' },
                        { id: 'vision_modern', label: '💎 Minimalista Vision', desc: 'Moderno, bordes y tipografía estilizada' },
                        { id: 'eco_ink_saving', label: '🌿 Compacto Eco Ahorro', desc: 'Monocromático, 80% ahorro tinta' },
                      ].map(st => {
                        const isSel = estiloRotulo === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setEstiloRotulo(st.id as any);
                              setPreviewEstilo(st.id as any);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSel
                                ? 'bg-pink-950/60 border-pink-400 text-white shadow-md'
                                : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className={`text-[11px] font-bold block ${isSel ? 'text-pink-300 font-black' : ''}`}>
                              {st.label}
                            </span>
                            <span className="text-[9.5px] text-slate-500 block mt-0.5">{st.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* GRID LADO A LADO: CONTROLES (IZQUIERDA) + LIVE PREVIEW (DERECHA) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* COLUMNA IZQUIERDA: CONTROLES Y PERSONALIZACIÓN 100% (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-4">
                      
                      {/* 1. Encabezado & Logos */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                          1. Encabezado, Logos y Tracking
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarLogoEmpresa}
                              onChange={e => setMostrarLogoEmpresa(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Logo de Empresa</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarLogoAgencia}
                              onChange={e => setMostrarLogoAgencia(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Logo de Agencia</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarBarcode}
                              onChange={e => setMostrarBarcode(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Código de Barras</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={mostrarTracking}
                              onChange={e => setMostrarTracking(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500"
                            />
                            <span>Texto de Tracking (#)</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            Subtítulo de Cabecera (Opcional):
                          </label>
                          <input
                            type="text"
                            value={subtituloCabecera}
                            onChange={e => setSubtituloCabecera(e.target.value)}
                            placeholder="Ej: Guía de Despacho Prioritaria o Envíos Seguros"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      {/* 2. Destino Oficial */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                            2. Banner de Destino / Sucursal
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-cyan-300 select-none">
                            <input
                              type="checkbox"
                              checked={mostrarDestino}
                              onChange={e => setMostrarDestino(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                            />
                            <span>Mostrar Destino</span>
                          </label>
                        </div>

                        {mostrarDestino && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Título del Recuadro de Destino:
                            </label>
                            <input
                              type="text"
                              value={tituloDestino}
                              onChange={e => setTituloDestino(e.target.value)}
                              placeholder="Ej: 📍 AGENCIA SHALOM RECOJO o 📍 DIRECCIÓN DE ENTREGA"
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        )}
                      </div>

                      {/* 3. Destinatario (Cliente) - 100% Personalizable */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider block">
                            3. Datos de Quién Recibe (Destinatario)
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-cyan-300 select-none">
                            <input
                              type="checkbox"
                              checked={incluirDestinatario}
                              onChange={e => setIncluirDestinatario(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                            />
                            <span>Incluir Sección Destinatario</span>
                          </label>
                        </div>

                        {incluirDestinatario && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                  Título de la Sección:
                                </label>
                                <input
                                  type="text"
                                  value={tituloDestinatario}
                                  onChange={e => setTituloDestinatario(e.target.value)}
                                  placeholder="DESTINATARIO (CLIENTE)"
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                  Badge de Modalidad (ej: RECOJO EN AGENCIA):
                                </label>
                                <input
                                  type="text"
                                  value={textoBadgeModalidad}
                                  onChange={e => setTextoBadgeModalidad(e.target.value)}
                                  placeholder="RECOJO EN AGENCIA"
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>
                            </div>

                            {/* Títulos individuales y tamaño de DNI */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-white/5">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-slate-400">Título para Nombre:</label>
                                  <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={mostrarClienteNombre}
                                      onChange={e => setMostrarClienteNombre(e.target.checked)}
                                      className="w-3 h-3 rounded"
                                    />
                                    <span>Ver</span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={tituloClienteNombre}
                                  onChange={e => setTituloClienteNombre(e.target.value)}
                                  placeholder="Nombre del Cliente:"
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-slate-400">Título para Teléfono:</label>
                                  <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={mostrarClienteTelefono}
                                      onChange={e => setMostrarClienteTelefono(e.target.checked)}
                                      className="w-3 h-3 rounded"
                                    />
                                    <span>Ver</span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={tituloClienteTelefono}
                                  onChange={e => setTituloClienteTelefono(e.target.value)}
                                  placeholder="📱 TELÉFONO / WHATSAPP:"
                                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </div>

                              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-900 border border-cyan-500/20">
                                <div className="sm:col-span-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-cyan-300">Título para DNI / Doc:</label>
                                    <label className="flex items-center gap-1 text-[10px] text-cyan-300 cursor-pointer font-bold">
                                      <input
                                        type="checkbox"
                                        checked={mostrarClienteDni}
                                        onChange={e => setMostrarClienteDni(e.target.checked)}
                                        className="w-3 h-3 rounded"
                                      />
                                      <span>Ver DNI</span>
                                    </label>
                                  </div>
                                  <input
                                    type="text"
                                    value={tituloClienteDni}
                                    onChange={e => setTituloClienteDni(e.target.value)}
                                    placeholder="🪪 DNI / DOC RECOJO:"
                                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-cyan-300 mb-1">Tamaño DNI:</label>
                                  <select
                                    value={tamanoDni}
                                    onChange={e => setTamanoDni(e.target.value as any)}
                                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-bold cursor-pointer"
                                  >
                                    <option value="normal">Normal (14px)</option>
                                    <option value="grande">Grande (18px)</option>
                                    <option value="gigante">Gigante (24px)</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Remitente (Emisor) */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                            4. Datos de Quién Envía (Remitente)
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-200 select-none">
                              <input
                                type="checkbox"
                                checked={incluirRemitente}
                                onChange={e => setIncluirRemitente(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-amber-500 cursor-pointer"
                              />
                              <span>Incluir Remitente</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-cyan-300 select-none">
                              <input
                                type="checkbox"
                                checked={usarRemitentePersonalizado}
                                onChange={e => setUsarRemitentePersonalizado(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                              />
                              <span>Datos Propios</span>
                            </label>
                          </div>
                        </div>

                        {incluirRemitente && (
                          <div className="space-y-2.5 pt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                Título de la Sección Remitente:
                              </label>
                              <input
                                type="text"
                                value={tituloRemitente}
                                onChange={e => setTituloRemitente(e.target.value)}
                                placeholder="REMITENTE OFICIAL:"
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            {usarRemitentePersonalizado && (
                              <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Nombre Emisor:</label>
                                  <input
                                    type="text"
                                    value={customRemitenteNombre}
                                    onChange={e => setCustomRemitenteNombre(e.target.value)}
                                    placeholder="ComiKids Envíos"
                                    className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">DNI/RUC:</label>
                                  <input
                                    type="text"
                                    value={customRemitenteRucDni}
                                    onChange={e => setCustomRemitenteRucDni(e.target.value)}
                                    placeholder="42020312"
                                    className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Celular:</label>
                                  <input
                                    type="text"
                                    value={customRemitenteCelular}
                                    onChange={e => setCustomRemitenteCelular(e.target.value)}
                                    placeholder="927781412"
                                    className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">Dirección Origen:</label>
                                  <input
                                    type="text"
                                    value={customRemitenteOrigen}
                                    onChange={e => setCustomRemitenteOrigen(e.target.value)}
                                    placeholder="Lima, Perú"
                                    className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 text-[10.5px] text-slate-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={mostrarRemitenteNombre}
                                  onChange={e => setMostrarRemitenteNombre(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-500"
                                />
                                <span>Ver Nombre</span>
                              </label>
                              <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 text-[10.5px] text-slate-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={mostrarRemitenteRucDni}
                                  onChange={e => setMostrarRemitenteRucDni(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-500"
                                />
                                <span>Ver DNI/RUC</span>
                              </label>
                              <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 text-[10.5px] text-slate-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={mostrarRemitenteTelefono}
                                  onChange={e => setMostrarRemitenteTelefono(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-500"
                                />
                                <span>Ver Celular</span>
                              </label>
                              <label className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 text-[10.5px] text-slate-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={mostrarRemitenteOrigen}
                                  onChange={e => setMostrarRemitenteOrigen(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-amber-500"
                                />
                                <span>Ver Origen</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 5. Etiquetas de Campos Personalizados */}
                      {camposList.length > 0 && (
                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                          <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                            5. Campos del Formulario y sus Etiquetas en el Rótulo
                          </span>
                          <div className="space-y-2">
                            {camposList.map((c) => (
                              <div
                                key={c.id}
                                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                  c.mostrar_en_rotulado ? 'bg-purple-950/30 border-purple-500/40' : 'bg-slate-900 border-white/5 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={c.mostrar_en_rotulado}
                                    onChange={() => {
                                      setCamposList(prev => prev.map(item => item.id === c.id ? { ...item, mostrar_en_rotulado: !item.mostrar_en_rotulado } : item));
                                    }}
                                    className="w-4 h-4 rounded text-purple-500 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-200 text-xs">{c.label}</span>
                                </div>

                                {c.mostrar_en_rotulado && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400">Texto en etiqueta:</span>
                                    <input
                                      type="text"
                                      value={etiquetasCampos[c.id] || ''}
                                      onChange={e => setEtiquetasCampos(prev => ({ ...prev, [c.id]: e.target.value }))}
                                      placeholder={c.label}
                                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-purple-200 font-bold w-36"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 6. Bloques Libres / Notas Especiales (100% Personalizable) */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-pink-300 uppercase tracking-wider block">
                            6. Avisos y Notas Libres en el Rótulo
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {bloquesPersonalizados.length} agregada(s)
                          </span>
                        </div>

                        {bloquesPersonalizados.length > 0 && (
                          <div className="space-y-2">
                            {bloquesPersonalizados.map((b) => (
                              <div
                                key={b.id}
                                className="p-2.5 rounded-xl bg-slate-900 border border-pink-500/30 flex items-center justify-between gap-2"
                              >
                                <div>
                                  {b.titulo && <span className="font-black text-xs text-pink-300 block">{b.titulo}</span>}
                                  <span className="text-xs text-slate-200">{b.contenido}</span>
                                  <span className="text-[9px] text-slate-400 uppercase font-mono block mt-0.5">
                                    Tipo: {b.tipo} • Posición: {b.posicion}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBloque(b.id)}
                                  className="p-1 text-rose-400 hover:text-rose-300 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Añadir nuevo bloque */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-white/5 space-y-2.5">
                          <span className="text-[10.5px] font-bold text-slate-300 block">
                            + Añadir Nuevo Bloque / Nota a la Etiqueta:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newBloqueTitulo}
                              onChange={e => setNewBloqueTitulo(e.target.value)}
                              placeholder="Título (ej: ⚠️ ¡FRÁGIL! o 💰 PAGO DESTINO)"
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                            <select
                              value={newBloqueTipo}
                              onChange={e => setNewBloqueTipo(e.target.value as any)}
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-bold cursor-pointer"
                            >
                              <option value="aviso">Aviso Amarillo (Frágil / Importante)</option>
                              <option value="flete">Flete Rojo (Pago en Destino)</option>
                              <option value="destacado">Destacado Púrpura (Prioritario)</option>
                              <option value="nota">Nota Simple (Gris Neutro)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newBloqueContenido}
                              onChange={e => setNewBloqueContenido(e.target.value)}
                              placeholder="Texto o instrucción (ej: Manejar con extremo cuidado, flete por pagar en agencia)"
                              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={handleAddBloque}
                              className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer shrink-0"
                            >
                              + Añadir
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 7. Pie de Página & Sello */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                            7. Pie de Página & Sello de Embalaje
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-cyan-300 select-none">
                            <input
                              type="checkbox"
                              checked={mostrarFechaSello}
                              onChange={e => setMostrarFechaSello(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-cyan-500 cursor-pointer"
                            />
                            <span>Mostrar Sello</span>
                          </label>
                        </div>

                        {mostrarFechaSello && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Texto del Sello de Calidad / Inspección:
                            </label>
                            <input
                              type="text"
                              value={textoSelloPersonalizado}
                              onChange={e => setTextoSelloPersonalizado(e.target.value)}
                              placeholder="Paquete Inspeccionado y Seguro"
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        )}
                      </div>

                    </div>

                    {/* COLUMNA DERECHA: VISTA PREVIA EN VIVO INTERACTIVA (lg:col-span-5) */}
                    <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-3">
                      <div className="p-4 rounded-3xl bg-slate-950 border border-purple-500/40 shadow-2xl space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                            <span className="text-xs font-black text-white uppercase tracking-wider">
                              Live Preview en Tiempo Real
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            ● SINCRONIZADO
                          </span>
                        </div>

                        {/* RENDERIZADO DEL RÓTULO EN VIVO */}
                        <div className="p-2 sm:p-3 rounded-2xl bg-slate-900/80 border border-white/5 flex justify-center shadow-inner overflow-x-auto max-h-[640px] overflow-y-auto">
                          <ShalomLabelPrint
                            pedido={mockPedido}
                            tallerConfig={tallerConfig}
                            customMethodOverride={currentLiveMethod}
                            estiloRotuloOverride={(previewEstilo || estiloRotulo) as any}
                          />
                        </div>

                        <div className="pt-2 flex items-center justify-between text-[10.5px] text-slate-400 border-t border-white/10">
                          <span>💡 Se actualiza en vivo al escribir</span>
                          <button
                            type="button"
                            onClick={() => setShowPreviewModal(true)}
                            className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                          >
                            Abrir pantalla completa
                          </button>
                        </div>
                      </div>
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
      {/* MODAL PREVISUALIZADOR DEL RÓTULO EN PANTALLA COMPLETA                     */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Previsualización del Rótulo Real ({nombreMetodo || editingMethod?.nombre || 'Agencia'})
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    100% idéntico a lo que saldrá en la impresora térmica / A4
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

            {/* Selector de estilo interactivo */}
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-purple-500/30 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1 shrink-0">
                <Palette className="w-3.5 h-3.5" />
                <span>Probar Estilo:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'estandar_oficial', label: '🏷️ Estándar Oficial' },
                  { id: 'vision_modern', label: '💎 Moderno Vision' },
                  { id: 'eco_ink_saving', label: '🌿 Eco Ahorro' },
                ].map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPreviewEstilo(st.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      (previewEstilo || estiloRotulo || 'estandar_oficial') === st.id
                        ? 'bg-purple-600 text-white shadow font-black'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Componente real de impresión */}
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-950/60 border border-white/5 flex justify-center shadow-inner overflow-x-auto">
              <ShalomLabelPrint
                pedido={mockPedido}
                tallerConfig={tallerConfig}
                customMethodOverride={currentLiveMethod}
                estiloRotuloOverride={((previewEstilo || estiloRotulo) as any) || undefined}
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <span className="text-[10.5px] text-slate-400 italic">
                * Los datos del emisor, destinatario y cajas reflejan exactamente tu configuración actual.
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Volver al Editor
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
                ℹ️ La nueva agencia se creará automáticamente con campos estándar (Nombre, Teléfono y Destino) y con el mensaje oficial de WhatsApp precargado. Luego podrás configurar sus días de despacho y personalizar su rótulo al 100%.
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
