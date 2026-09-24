import React, { useState, useEffect, useRef } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Colaborador, HorarioDiaDespacho } from '../../types/database.types';
import { ChangePasswordModal } from './ChangePasswordModal';
import { CompanyAgenciesTab } from './CompanyAgenciesTab';
import {
  evaluateShippingCutoff,
  formatFriendlyTime,
  formatFriendlyDate,
  DIAS_SEMANA_NOMBRES
} from '../../utils/shippingCutoff';
import {
  FUTURISTIC_THEMES,
  applyFuturisticTheme,
  getThemeById
} from '../../data/futuristicThemes';

import {
  Users,
  KeyRound,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Calendar,
  Link as LinkIcon,
  Copy,
  Megaphone,
  Save,
  Lock,
  Building2,
  CheckCircle2,
  Sparkles,
  Award,
  Sliders,
  Image as ImageIcon,
  Upload,
  Palette,
  Printer,
  FileText,
  Layers,
  ShieldCheck,
  Smartphone,
  QrCode,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Camera,
  Truck,
  HelpCircle,
  ExternalLink,
  CreditCard,
  Zap,
  Info,
  BadgeAlert,
  MessageCircle,
  Share2,
  Edit3,
  CheckCheck
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';
import { ordersService } from '../../services/ordersService';

const DIAS_SEMANA_ORDEN: HorarioDiaDespacho['dia'][] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export const CompanyAccountSettings: React.FC = () => {
  const {
    tallerConfig,
    updateTallerConfig,
    colaboradores,
    saveColaborador,
    deleteColaborador,
    masterCode,
    saveMasterCode,
    pedidos,
    shippingMethods,
  } = useOrders();

  const { currentUser, currentEmpresa } = useAuth();

  // Partición Principal: "Personalizar Empresa" vs "Personalizar Cuenta y Seguridad"
  const [mainTab, setMainTab] = useState<'empresa' | 'cuenta'>('empresa');

  // Sección activa dentro de Personalizar Empresa (Controlada exclusivamente por el HUD de Jugador)
  const [activeAccordion, setActiveAccordion] = useState<
    'remitente' | 'rotulo' | 'horario' | 'anuncio' | 'temas' | 'agencias' | 'whatsapp' | null
  >('remitente');

  const toggleAccordion = (section: 'remitente' | 'rotulo' | 'horario' | 'anuncio' | 'temas' | 'agencias' | 'whatsapp') => {
    setActiveAccordion(prev => (prev === section ? null : section));
  };

  // Nombre y código de entrada de la empresa
  const isComikidsAccount = currentEmpresa?.id === 'empresa-master-comikids';
  const companyName = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids';
  const companyCode = currentEmpresa?.numero_entrada || masterCode || '061625';

  // 1. Estado para Código / Número de Acceso
  const [newMasterCode, setNewMasterCode] = useState(companyCode);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Verificación de cuenta Matrix Maestra (Solo matrix4012 / 963097777 ve la sección de sub-QR)
  const isMainMatrixAccount = Boolean(
    currentUser?.dni === '963097777' ||
    currentUser?.dni === '061625' ||
    currentUser?.rol === 'matrix' ||
    currentEmpresa?.numero_entrada === '963097777' ||
    currentEmpresa?.telefono_contacto === '963097777' ||
    currentEmpresa?.telefono_contacto === '51963097777' ||
    currentUser?.nombre_completo?.toLowerCase().includes('matrix4012')
  );

  // Sub-QR de WhatsApp de la cuenta de empresa
  const subInstance = currentEmpresa?.config?.vps_instance_name || currentEmpresa?.sub_instance || tallerConfig?.copilot_sub_instance || 'tenant_Comikids_tienda';
  const initialPhone = (currentEmpresa?.telefono_contacto && currentEmpresa.telefono_contacto !== '51963097546')
    ? currentEmpresa.telefono_contacto
    : (tallerConfig?.copilot_owner_phone || tallerConfig?.whatsapp_pedidos || '51927781412');
  const [liveSenderPhone, setLiveSenderPhone] = useState<string>(initialPhone);
  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close'>('close');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSuccessMsg, setQrSuccessMsg] = useState('');

  const verifyLivePhoneStatus = async (silent = false) => {
    if (!silent) setIsVerifyingPhone(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/${subInstance}/status`);
      const json = await res.json().catch(() => ({}));
      if (json.success && json.data) {
        const state = json.data.state || 'close';
        setConnectionState(state);
        const ownerPhone = json.data.ownerPhone;
        if (ownerPhone) {
          setLiveSenderPhone(ownerPhone);
          if (currentEmpresa?.id) {
            ordersService.syncEmpresaConnectedPhone(subInstance, ownerPhone);
          }
          if (tallerConfig.copilot_owner_phone !== ownerPhone) {
            updateTallerConfig({
              copilot_owner_phone: ownerPhone,
              whatsapp_pedidos: ownerPhone,
              celular_taller: `+${ownerPhone}`,
            });
          }
          return { state, ownerPhone };
        }
      }
    } catch (e) {
      console.warn('[VERIFY LIVE PHONE ERROR]', e);
    } finally {
      if (!silent) setIsVerifyingPhone(false);
    }
    return null;
  };

  useEffect(() => {
    if (isMainMatrixAccount) {
      verifyLivePhoneStatus(true);
    }
  }, [subInstance, isMainMatrixAccount]);

  // Polling automático mientras el modal de QR esté abierto
  useEffect(() => {
    if (!showQrModal || !isMainMatrixAccount) return;

    const interval = setInterval(async () => {
      const res = await verifyLivePhoneStatus(true);
      if (res?.state === 'open' && res?.ownerPhone) {
        clearInterval(interval);
        setQrSuccessMsg(`¡WhatsApp vinculado con éxito al número +${res.ownerPhone}!`);
        setTimeout(() => {
          setShowQrModal(false);
          setQrSuccessMsg('');
        }, 1800);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showQrModal, subInstance, isMainMatrixAccount]);

  const handleOpenQrModal = async () => {
    setQrLoading(true);
    setShowQrModal(true);
    setQrBase64(null);
    setQrSuccessMsg('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/${subInstance}/qr`);
      const json = await res.json().catch(() => ({}));
      if (json.success && (json.data?.qrcode?.base64 || json.data?.base64)) {
        setQrBase64(json.data.qrcode?.base64 || json.data.base64);
      } else {
        alert('No se pudo generar el código QR. Intenta nuevamente.');
      }
    } catch (e: any) {
      alert(`Error obteniendo QR: ${e.message}`);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    setNewMasterCode(companyCode);
  }, [companyCode]);

  // 2. Estado para Datos de Empresa y Remitente Oficial
  const [nombreEmpresaInterno, setNombreEmpresaInterno] = useState(currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids');
  const [remitenteNombre, setRemitenteNombre] = useState(tallerConfig.remitente_default?.nombre || tallerConfig.nombre_taller || companyName);
  const [whatsappReceptor, setWhatsappReceptor] = useState(tallerConfig.whatsapp_pedidos || tallerConfig.celular_taller || currentEmpresa?.telefono_contacto || '927781412');
  const [remitenteDni, setRemitenteDni] = useState(tallerConfig.remitente_dni || tallerConfig.ruc_dni || tallerConfig.remitente_default?.ruc_dni || '42020312');
  const [remitenteEmail, setRemitenteEmail] = useState(tallerConfig.remitente_email || 'comikidsperu@gmail.com');
  const [remitenteCelular, setRemitenteCelular] = useState(tallerConfig.remitente_celular || tallerConfig.celular_taller || tallerConfig.remitente_default?.celular || '927781412');
  const [remitenteDireccion, setRemitenteDireccion] = useState(tallerConfig.remitente_default?.direccion || tallerConfig.direccion_taller || 'Lima, Perú');
  const [remitenteObservaciones, setRemitenteObservaciones] = useState(tallerConfig.remitente_default?.observaciones || '');
  const [remitenteSuccessMsg, setRemitenteSuccessMsg] = useState('');

  // Estado para Estilo Predeterminado de Rótulos de Envío
  const [estiloRotuloDefault, setEstiloRotuloDefault] = useState<'estandar_oficial' | 'vision_modern' | 'eco_ink_saving'>(
    tallerConfig.estilo_rotulo_default || 'estandar_oficial'
  );
  const [rotuloSuccessMsg, setRotuloSuccessMsg] = useState('');

  // 3. Estado para Horario Límite y Días de Despacho PREDETERMINADOS (Global de Empresa)
  const [horaCorteGeneral, setHoraCorteGeneral] = useState(tallerConfig.hora_corte_envio_hoy || '18:00');
  const [mensajeCorteGeneral, setMensajeCorteGeneral] = useState(tallerConfig.mensaje_corte_personalizado || '');
  const [cutoffSuccessMsg, setCutoffSuccessMsg] = useState('');

  // Horarios configurados por día de la semana
  const [horariosPorDia, setHorariosPorDia] = useState<Record<string, HorarioDiaDespacho>>(() => {
    const existing = tallerConfig.horarios_por_dia || {};
    const defaultDias = (tallerConfig.dias_despacho_activos || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']).map(d => d.toLowerCase());
    const defaultCorte = tallerConfig.hora_corte_envio_hoy || '18:00';

    const initial: Record<string, HorarioDiaDespacho> = {};
    DIAS_SEMANA_ORDEN.forEach(dia => {
      if (existing[dia]) {
        initial[dia] = { ...existing[dia] };
      } else {
        initial[dia] = {
          dia,
          activo: defaultDias.includes(dia),
          hora_corte: dia === 'sabado' ? '14:00' : defaultCorte,
          mensaje_personalizado: dia === 'sabado' ? 'Los sábados despachamos hasta las 2:00 PM' : '',
        };
      }
    });
    return initial;
  });

  // 4. Estado para Mensaje de Aviso / Anuncio Público
  const [anuncioTexto, setAnuncioTexto] = useState(tallerConfig.anuncio_publico_clientes || '');
  const [anuncioSuccessMsg, setAnuncioSuccessMsg] = useState('');

  // 5. Estado para Copiar Link Oficial de Clientes
  const [copiedLink, setCopiedLink] = useState(false);

  // 6. Estado para Agregar Colaborador
  const [showAddColab, setShowAddColab] = useState(false);
  const [colabNombre, setColabNombre] = useState('');
  const [colabRol, setColabRol] = useState<Colaborador['rol']>('embalaje');
  const [colabTelefono, setColabTelefono] = useState('');
  const [colabEmail, setColabEmail] = useState('');

  // 7. Estado de Foto de Perfil / Logo Oficial de la Empresa
  const initialLogo = currentEmpresa?.logo_url || tallerConfig.logo_url || (isComikidsAccount ? '/Comikids.png' : '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(initialLogo);
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // 8. Estado de 4 Temas Exclusivos
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return currentEmpresa?.tema_fondo || tallerConfig.tema_fondo || (typeof localStorage !== 'undefined' ? localStorage.getItem('incomi_futuristic_theme') : '') || 'nspace';
  });
  const [themeSuccessMsg, setThemeSuccessMsg] = useState('');

  // Sincronización del tema actual al cargar
  useEffect(() => {
    const saved = currentEmpresa?.tema_fondo || tallerConfig.tema_fondo || localStorage.getItem('incomi_futuristic_theme') || 'nspace';
    setCurrentThemeId(saved);
    applyFuturisticTheme(saved);
  }, [currentEmpresa?.tema_fondo, tallerConfig.tema_fondo]);

  // Guardar Foto de Perfil / Logo de forma persistente
  const handleSaveLogo = async (newUrl: string) => {
    setIsUploadingLogo(true);
    const trimmed = newUrl.trim();
    setCompanyLogoUrl(trimmed);
    
    await updateTallerConfig({ logo_url: trimmed });
    
    if (currentEmpresa) {
      currentEmpresa.logo_url = trimmed;
    }
    
    setIsUploadingLogo(false);
    setLogoSuccessMsg('¡Foto de perfil / logo oficial guardado exitosamente en base de datos!');
    setTimeout(() => setLogoSuccessMsg(''), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('La imagen no debe superar los 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleSaveLogo(result);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyTheme = async (themeId: 'nspace' | 'modern-black' | 'modern-white' | 'pink-space') => {
    setCurrentThemeId(themeId);
    applyFuturisticTheme(themeId);
    await updateTallerConfig({ tema_fondo: themeId });
    if (currentEmpresa) {
      currentEmpresa.tema_fondo = themeId;
    }
    setThemeSuccessMsg(`¡Tema "${getThemeById(themeId).name}" aplicado con éxito a toda la web!`);
    setTimeout(() => setThemeSuccessMsg(''), 3500);
  };

  const handleSaveMasterCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterCode.trim()) return;
    try {
      await saveMasterCode(newMasterCode.trim());
      if (currentEmpresa) {
        currentEmpresa.numero_entrada = newMasterCode.trim();
      }
      setCodeSuccessMsg('¡Código de acceso / entrada de la empresa actualizado correctamente!');
      setTimeout(() => setCodeSuccessMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al guardar código');
    }
  };

  const handleSaveRemitente = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWhatsapp = whatsappReceptor.trim().replace(/[^0-9]/g, '');
    
    await updateTallerConfig({
      nombre_taller: remitenteNombre.trim(),
      ruc_dni: remitenteDni.trim(),
      celular_taller: remitenteCelular.trim(),
      whatsapp_pedidos: cleanWhatsapp || remitenteCelular.trim(),
      remitente_dni: remitenteDni.trim(),
      remitente_email: remitenteEmail.trim(),
      remitente_celular: remitenteCelular.trim(),
      direccion_taller: remitenteDireccion.trim(),
      remitente_default: {
        nombre: remitenteNombre.trim(),
        ruc_dni: remitenteDni.trim(),
        celular: remitenteCelular.trim(),
        direccion: remitenteDireccion.trim(),
        observaciones: remitenteObservaciones.trim(),
      }
    });

    if (currentEmpresa) {
      currentEmpresa.nombre = nombreEmpresaInterno.trim();
      currentEmpresa.telefono_contacto = cleanWhatsapp || remitenteCelular.trim();
      
      const allEmps = ordersService.getEmpresas();
      const updatedEmps = allEmps.map(emp => {
        if (emp.id === currentEmpresa.id) {
          return {
            ...emp,
            nombre: nombreEmpresaInterno.trim(),
            telefono_contacto: cleanWhatsapp || remitenteCelular.trim(),
          };
        }
        return emp;
      });
      ordersService.saveEmpresas(updatedEmps);
    }

    setRemitenteSuccessMsg('¡Datos de empresa, remitente y WhatsApp receptor guardados con éxito!');
    setTimeout(() => setRemitenteSuccessMsg(''), 4000);
  };

  const handleSaveEstiloRotulo = async (estilo: 'estandar_oficial' | 'vision_modern' | 'eco_ink_saving') => {
    setEstiloRotuloDefault(estilo);
    await updateTallerConfig({ estilo_rotulo_default: estilo });
    setRotuloSuccessMsg('¡Estilo predeterminado de rótulos actualizado!');
    setTimeout(() => setRotuloSuccessMsg(''), 3000);
  };

  const handleSaveCutoff = async (e: React.FormEvent) => {
    e.preventDefault();
    const diasActivos = Object.entries(horariosPorDia)
      .filter(([_, conf]) => conf.activo)
      .map(([dia]) => dia);

    await updateTallerConfig({
      hora_corte_envio_hoy: horaCorteGeneral,
      dias_despacho_activos: diasActivos,
      despacho_domingo_habilitado: horariosPorDia['domingo']?.activo || false,
      mensaje_corte_personalizado: mensajeCorteGeneral.trim() || undefined,
      horarios_por_dia: horariosPorDia,
    });
    setCutoffSuccessMsg('¡Horario de despacho predeterminado guardado con éxito!');
    setTimeout(() => setCutoffSuccessMsg(''), 3500);
  };

  const handleSaveAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTallerConfig({
      anuncio_publico_clientes: anuncioTexto.trim() || undefined,
    });
    setAnuncioSuccessMsg('¡Anuncio público para clientes actualizado con éxito!');
    setTimeout(() => setAnuncioSuccessMsg(''), 3500);
  };

  const handleAddColaboradorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabNombre.trim()) return;

    saveColaborador({
      id: 'colab_' + Date.now().toString(36),
      nombre: colabNombre.trim(),
      rol: colabRol,
      telefono: colabTelefono.trim() || undefined,
      email: colabEmail.trim() || undefined,
      activo: true,
    });

    setColabNombre('');
    setColabTelefono('');
    setColabEmail('');
    setShowAddColab(false);
  };

  // URL Distintiva de Clientes para esta Empresa
  const originUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://comikids-encomi-app.vercel.app';
  const publicOrderUrl = isComikidsAccount
    ? originUrl
    : `${originUrl}/?empresa=${encodeURIComponent(companyCode)}`;

  const shareText = encodeURIComponent(`¡Hola! 👋 Puedes registrar tu pedido y datos de envío de forma rápida y segura en nuestro portal oficial aquí:\n\n🔗 ${publicOrderUrl}\n\n✨ Tus datos se guardarán al instante y tu comprobante se enviará directamente a nuestro WhatsApp.`);
  const shareWhatsAppUrl = `https://wa.me/?text=${shareText}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicOrderUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Información de Facturación / Próximo Pago
  const proximoPagoDisplay = currentEmpresa?.proximo_pago || '28 de Octubre, 2026';
  const planDisplay = currentEmpresa?.plan_suscripcion || 'Plan Pro Empresa 2026';

  const activeTheme = getThemeById(currentThemeId);
  const activeAgenciesCount = shippingMethods.filter(m => m.activo).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fadeIn">
      
      {/* =========================================================================
          TOP BANNER: INDICADOR PRÓXIMO PAGO & SELECTOR DE PESTAÑA PRINCIPAL
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl bg-slate-900/90 border border-white/10 backdrop-blur-2xl shadow-2xl">
        
        {/* Switch Principal: Personalizar Empresa vs Cuenta & Seguridad */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => setMainTab('empresa')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              mainTab === 'empresa'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Personalizar Empresa</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('cuenta')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              mainTab === 'cuenta'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Cuenta & Seguridad</span>
          </button>
        </div>

        {/* Indicador Superior de Próximo Pago */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-950/60 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-left leading-tight">
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400 block">
                🗓️ Próximo Pago
              </span>
              <strong className="text-xs font-bold text-white tracking-tight">
                {proximoPagoDisplay}
              </strong>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            {planDisplay}
          </span>
        </div>

      </div>

      {/* =========================================================================
          PESTAÑA 1: PERSONALIZAR EMPRESA (HUD INTERACTIVO EXCLUSIVO)
          ========================================================================= */}
      {mainTab === 'empresa' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* 🎮 HUD DE JUGADOR (DASHBOARD MODULAR) */}
          <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-cyan-500/40 bg-slate-950/85 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
            
            {/* Top Row: Avatar + Nombre Clickable (Abre Panel de Nombre) + Recuadro de Link Distintivo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-5 border-b border-white/10 items-center">
              
              {/* Identidad de la Empresa (Clickable para editar nombre/remitente) */}
              <div className="lg:col-span-5 flex items-center gap-3.5">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-slate-900 border-2 border-cyan-400/60 p-1 shadow-lg shadow-cyan-500/20 overflow-hidden flex items-center justify-center relative">
                    {companyLogoUrl ? (
                      <img
                        src={companyLogoUrl}
                        alt="Logo Empresa"
                        className="w-full h-full object-contain rounded-xl sm:rounded-2xl"
                        onError={() => setCompanyLogoUrl('')}
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-linear-to-tr from-cyan-500 to-pink-500 flex items-center justify-center text-white text-2xl font-black">
                        {companyName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Botón 1-Click para subir/cambiar Logo */}
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/40 transition-all cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center"
                    title="Subir o Cambiar Foto de Perfil / Logo Oficial"
                  >
                    <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Título y Nombre Clickable */}
                <div className="text-left flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveAccordion('remitente')}
                    className="group/name text-left block w-full focus:outline-none cursor-pointer"
                    title="Toca para cambiar el nombre y datos de la empresa"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover/name:text-cyan-300 transition-colors truncate">
                        {nombreEmpresaInterno || companyName}
                      </h2>
                      <Edit3 className="w-4 h-4 text-cyan-400 opacity-60 group-hover/name:opacity-100 group-hover/name:translate-x-0.5 transition-all" />
                    </div>
                  </button>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      ID: {companyCode}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono truncate">
                      {remitenteNombre !== companyName ? `Rótulo: ${remitenteNombre}` : 'Portal Oficial'}
                    </span>
                  </div>

                  {/* Subir foto de perfil / logo */}
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="mt-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{companyLogoUrl ? 'Cambiar logo oficial' : 'Subir logo oficial'}</span>
                  </button>
                </div>
              </div>

              {/* 🔗 RECUADRO DE ENLACE DISTINTIVO PARA CLIENTES DE ESTA EMPRESA */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3 sm:p-3.5 space-y-2 shadow-inner">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 uppercase tracking-wide">
                    <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Enlace Distintivo de Envíos para tus Clientas</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ⚡ Link Exclusivo
                  </span>
                </div>

                {/* Input readonly con URL completa */}
                <div className="flex items-center gap-2 bg-slate-950/90 border border-white/10 rounded-xl px-3 py-2">
                  <span className="text-xs font-mono text-cyan-200 truncate flex-1 select-all font-semibold">
                    {publicOrderUrl}
                  </span>
                </div>

                {/* Botones de Acción: Copiar, Compartir por WhatsApp y Probar */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                      copiedLink
                        ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 scale-[1.02]'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25 active:scale-95'
                    }`}
                  >
                    {copiedLink ? <CheckCheck className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link'}</span>
                  </button>

                  <a
                    href={shareWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[150px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar por WhatsApp</span>
                  </a>

                  <a
                    href={publicOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title="Probar enlace en nueva pestaña"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

            </div>

            {/* Banner de Éxito de Logo si se acaba de guardar */}
            {logoSuccessMsg && (
              <div className="mt-3 p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-slideDownSmooth">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{logoSuccessMsg}</span>
              </div>
            )}

            {/* 🕹️ HUD TOUCH STATS GRID (TOCA CUALQUIER ITEM PARA DESPLEGAR SU CONFIGURACIÓN DIRECTAMENTE ABAJO) */}
            <div className="pt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2.5">
                ⚡ Toca un módulo del HUD para desplegar y editar:
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                
                {/* 1. Badge Remitente & Nombre */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('remitente')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'remitente'
                      ? 'bg-amber-500/25 border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.03] ring-1 ring-amber-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-amber-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🏢</span>
                    <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">Nombre</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Toca para cambiar el nombre</strong>
                    <span className="text-[10px] text-amber-200/80 font-mono block truncate mt-0.5">{remitenteNombre}</span>
                  </div>
                </button>

                {/* 2. Badge Estilo de Rótulo */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('rotulo')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'rotulo'
                      ? 'bg-pink-500/25 border-pink-400 shadow-lg shadow-pink-500/20 scale-[1.03] ring-1 ring-pink-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-pink-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🏷️</span>
                    <span className="text-[9px] font-black uppercase text-pink-400 tracking-wider">Rótulo</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Editar Rotulado</strong>
                    <span className="text-[10px] text-pink-200/80 block truncate mt-0.5">
                      {estiloRotuloDefault === 'estandar_oficial' ? 'Estándar A4' : estiloRotuloDefault === 'vision_modern' ? 'Vision Modern' : 'Eco Ahorro'}
                    </span>
                  </div>
                </button>

                {/* 3. Badge Horario Base */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('horario')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'horario'
                      ? 'bg-cyan-500/25 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.03] ring-1 ring-cyan-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-cyan-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">⏰</span>
                    <span className="text-[9px] font-black uppercase text-cyan-400 tracking-wider">Horario</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Editar Programación</strong>
                    <span className="text-[10px] text-cyan-200/80 font-mono block truncate mt-0.5">Corte: {horaCorteGeneral} hrs</span>
                  </div>
                </button>

                {/* 4. Badge Anuncio Público */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('anuncio')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'anuncio'
                      ? 'bg-rose-500/25 border-rose-400 shadow-lg shadow-rose-500/20 scale-[1.03] ring-1 ring-rose-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-rose-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">📢</span>
                    <span className="text-[9px] font-black uppercase text-rose-400 tracking-wider">Anuncio</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Editar Anuncio</strong>
                    <span className="text-[10px] text-rose-200/80 block truncate mt-0.5">
                      {anuncioTexto ? 'Activo en Web' : 'Sin Aviso'}
                    </span>
                  </div>
                </button>

                {/* 5. Badge Tema Visual */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('temas')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'temas'
                      ? 'bg-purple-500/25 border-purple-400 shadow-lg shadow-purple-500/20 scale-[1.03] ring-1 ring-purple-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-purple-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🎨</span>
                    <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider">Temas</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Editar Temas</strong>
                    <span className="text-[10px] text-purple-200/80 block truncate mt-0.5">{activeTheme.name}</span>
                  </div>
                </button>

                {/* 6. Badge Agencias Hub */}
                <button
                  type="button"
                  onClick={() => toggleAccordion('agencias')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    activeAccordion === 'agencias'
                      ? 'bg-emerald-500/25 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.03] ring-1 ring-emerald-400'
                      : 'bg-slate-900/70 hover:bg-slate-900 border-white/10 hover:border-emerald-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🚚</span>
                    <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Agencias</span>
                  </div>
                  <div>
                    <strong className="text-xs text-white block font-black leading-tight">Editar Agencias</strong>
                    <span className="text-[10px] text-emerald-200/80 block truncate mt-0.5">{activeAgenciesCount} Activas</span>
                  </div>
                </button>

              </div>
            </div>

          </div>

          {/* =========================================================================
              PANEL EXPANDIDO ACTIVO (SOLO SE MUESTRA EL MÓDULO SELECCIONADO EN EL HUD)
              ========================================================================= */}

          {/* 1. PANEL: DATOS DE EMPRESA Y REMITENTE OFICIAL */}
          {activeAccordion === 'remitente' && (
            <div className="rounded-3xl border border-amber-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-5 animate-slideDownSmooth">
              
              {/* Header de la sección */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0">
                    🏢
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Datos de Empresa y Remitente Oficial</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Quién Envía
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Nombres, DNI/RUC, teléfono de despacho y número de WhatsApp receptor de pedidos
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* 💡 RECUADRO EXPLICATIVO REQUERIDO */}
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <strong className="block font-black text-amber-300 text-sm">
                    ¿Para qué sirve esta configuración?
                  </strong>
                  <p className="text-[12px] leading-relaxed text-amber-100/90">
                    Aquí defines los datos con los que tu empresa opera. El <strong>Nombre Comercial / Remitente</strong> saldrá impreso en los rótulos oficiales de Shalom, Olva y comprobantes de tus clientas. El <strong>Nombre de Empresa en el Sistema</strong> es tu identificador interno en el panel. Además, el <strong>WhatsApp Receptor de Pedidos</strong> es el número infalible al que llegarán todos los pedidos y comprobantes generados desde tu enlace.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveRemitente} className="space-y-5">
                
                {/* 2 RECUADROS DE NOMBRES DIFERENCIADOS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/70 border border-amber-500/20">
                  
                  {/* Recuadro 1: Nombre Comercial Remitente */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-amber-300 uppercase tracking-wide">
                      🏷️ Nombre Comercial / Remitente Oficial (Para Rótulos)
                    </label>
                    <input
                      type="text"
                      required
                      value={remitenteNombre}
                      onChange={e => setRemitenteNombre(e.target.value)}
                      placeholder="Ej: ComiKids Store Oficial"
                      className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      📦 Este nombre aparecerá impreso en los rótulos de Shalom, Olva Courier y transportes.
                    </span>
                  </div>

                  {/* Recuadro 2: Nombre de la Empresa en el Sistema */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-200 uppercase tracking-wide">
                      🏢 Nombre de la Empresa en el Sistema
                    </label>
                    <input
                      type="text"
                      required
                      value={nombreEmpresaInterno}
                      onChange={e => setNombreEmpresaInterno(e.target.value)}
                      placeholder="Ej: Mi Taller Textil VIP"
                      className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                    <span className="text-[11px] text-amber-400/90 font-medium block">
                      ⚠️ Este nombre es interno para tu sistema y NO saldrá en el rotulado.
                    </span>
                  </div>

                </div>

                {/* WHATSAPP RECEPTOR DE PEDIDOS INFALIBLE */}
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                  <label className="block text-xs font-black text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp / Celular de Recepción de Pedidos y Comprobantes</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400">
                      +51 (Perú)
                    </span>
                    <input
                      type="tel"
                      required
                      value={whatsappReceptor}
                      onChange={e => setWhatsappReceptor(e.target.value)}
                      placeholder="Ej: 927781412"
                      className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 shadow-inner"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-200/80 block">
                    ⚡ <strong>Recepción Infalible:</strong> Al registrar un pedido, la clienta será enviada a este número de WhatsApp con su mensaje y comprobante listo.
                  </span>
                </div>

                {/* OTROS DATOS DE DESPACHO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      🪪 DNI / RUC del Remitente
                    </label>
                    <input
                      type="text"
                      required
                      value={remitenteDni}
                      onChange={e => setRemitenteDni(e.target.value)}
                      placeholder="DNI o RUC"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      📱 Celular del Remitente (Despacho)
                    </label>
                    <input
                      type="tel"
                      required
                      value={remitenteCelular}
                      onChange={e => setRemitenteCelular(e.target.value)}
                      placeholder="9 dígitos"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      📧 Correo Electrónico Remitente
                    </label>
                    <input
                      type="email"
                      value={remitenteEmail}
                      onChange={e => setRemitenteEmail(e.target.value)}
                      placeholder="contacto@tuempresa.com"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      📍 Dirección de Origen / Taller
                    </label>
                    <input
                      type="text"
                      value={remitenteDireccion}
                      onChange={e => setRemitenteDireccion(e.target.value)}
                      placeholder="Av. Principal 123, Distrito, Ciudad"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <button
                    type="submit"
                    className="py-3 px-7 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <Save className="w-4 h-4 text-slate-950" />
                    <span>Guardar Todos los Datos</span>
                  </button>
                  {remitenteSuccessMsg && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/80 px-3.5 py-1.5 rounded-xl border border-emerald-500/30">
                      <Check className="w-4 h-4" />
                      {remitenteSuccessMsg}
                    </span>
                  )}
                </div>
              </form>

            </div>
          )}

          {/* 2. PANEL: ESTILO PREDETERMINADO DE RÓTULOS */}
          {activeAccordion === 'rotulo' && (
            <div className="rounded-3xl border border-pink-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-5 animate-slideDownSmooth">
              
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center text-xl shrink-0">
                    🏷️
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Estilo Predeterminado de Rótulos de Envío</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-pink-400/20 text-pink-300 border border-pink-400/30">
                        Impresión 60FPS
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Formato visual para generar las etiquetas de despacho para Shalom, Olva y transportes
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-pink-950/40 border border-pink-500/40 text-xs text-pink-200 flex items-start gap-3">
                <Info className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-black text-pink-300">
                    ¿Para qué sirve este ajuste?
                  </strong>
                  <p className="text-[12px] leading-relaxed text-pink-100/90">
                    Define la plantilla visual con la que se imprimirán los rótulos cuando le des click a "Imprimir Rótulo" en tus pedidos. Puedes alternar entre formato apaisado horizontal tradicional, el moderno Apple Vision o el modo de ultra-ahorro de tinta según tu tipo de impresora.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Opción 1: Estándar Oficial */}
                <div
                  onClick={() => handleSaveEstiloRotulo('estandar_oficial')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    estiloRotuloDefault === 'estandar_oficial'
                      ? 'bg-pink-500/20 border-pink-400 shadow-xl shadow-pink-500/20 scale-[1.02]'
                      : 'bg-slate-900 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        1. Estándar Oficial A4
                      </span>
                      {estiloRotuloDefault === 'estandar_oficial' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-pink-500 text-slate-950">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Formato apaisado horizontal tradicional, óptimo para 6 rótulos por hoja A4 en Shalom y Olva.
                    </p>
                  </div>
                  <div className="h-14 bg-white rounded-xl p-2 border border-slate-400 flex flex-col justify-between text-[8px] text-black font-sans">
                    <div className="flex justify-between font-bold border-b pb-0.5">
                      <span>{remitenteNombre}</span>
                      <span>SHALOM</span>
                    </div>
                    <div className="font-mono font-bold text-center text-[10px]">🪪 DNI RECOJO: {remitenteDni}</div>
                  </div>
                </div>

                {/* Opción 2: Apple Vision Modern */}
                <div
                  onClick={() => handleSaveEstiloRotulo('vision_modern')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    estiloRotuloDefault === 'vision_modern'
                      ? 'bg-purple-500/20 border-purple-400 shadow-xl shadow-purple-500/20 scale-[1.02]'
                      : 'bg-slate-900 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        2. Apple Vision Modern
                      </span>
                      {estiloRotuloDefault === 'vision_modern' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500 text-white">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Formato vertical moderno de alto impacto visual, bordes curvos y tipografía jerárquica limpia.
                    </p>
                  </div>
                  <div className="h-14 bg-slate-950 text-white rounded-xl p-2 border border-purple-400 flex flex-col justify-between text-[8px]">
                    <div className="flex justify-between font-black text-cyan-300">
                      <span>VISION DISPATCH</span>
                      <span>#{companyCode}</span>
                    </div>
                    <div className="bg-purple-900/60 text-center rounded py-0.5 text-[9px] font-bold">DESTINO OFICIAL</div>
                  </div>
                </div>

                {/* Opción 3: Eco Ink Saving */}
                <div
                  onClick={() => handleSaveEstiloRotulo('eco_ink_saving')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    estiloRotuloDefault === 'eco_ink_saving'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                      : 'bg-slate-900 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        3. Eco Ultra-Ahorro
                      </span>
                      {estiloRotuloDefault === 'eco_ink_saving' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500 text-slate-950">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Diseño 100% lineal sin fondos negros ni rellenos pesados. Maximiza el ahorro de tinta al 75%.
                    </p>
                  </div>
                  <div className="h-14 bg-white text-black rounded-xl p-2 border-2 border-dashed border-black flex flex-col justify-between text-[8px] font-mono">
                    <div className="flex justify-between font-black">
                      <span>[ECO DESPACHO]</span>
                      <span>#ENV-2026</span>
                    </div>
                    <div className="border border-black text-center py-0.5 font-black text-[9px]">DNI: {remitenteDni}</div>
                  </div>
                </div>

              </div>

              {rotuloSuccessMsg && (
                <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{rotuloSuccessMsg}</span>
                </div>
              )}

            </div>
          )}

          {/* 3. PANEL: HORARIO LÍMITE Y PROGRAMACIÓN DE DESPACHO */}
          {activeAccordion === 'horario' && (
            <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-5 animate-slideDownSmooth">
              
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl shrink-0">
                    ⏰
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Horario Límite y Programación de Despacho</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                        Horario Base Empresa
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Hora de corte diaria y días en que realizas envíos que heredarán tus agencias
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-start gap-3">
                <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-black text-cyan-300">
                    ¿Para qué sirve la Programación y Horario Base?
                  </strong>
                  <p className="text-[12px] leading-relaxed text-cyan-100/90">
                    Informa a tus clientes exactamente a qué hora sale el lote de despachos del día. Todas las agencias de envío que configures en <strong>"Modo Horario Predeterminado"</strong> usarán estos días y horas de corte automáticamente.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveCutoff} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      Hora Límite de Corte de Hoy (Predeterminada)
                    </label>
                    <input
                      type="time"
                      value={horaCorteGeneral}
                      onChange={e => setHoraCorteGeneral(e.target.value)}
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                      Mensaje Informativo de Corte (Opcional)
                    </label>
                    <input
                      type="text"
                      value={mensajeCorteGeneral}
                      onChange={e => setMensajeCorteGeneral(e.target.value)}
                      placeholder="Ej: Pedidos confirmados después de las 6:00 PM salen mañana"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400 shadow-inner"
                    />
                  </div>
                </div>

                {/* Días de Despacho Activos */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">
                    Días Habilitados para Despacho General:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {DIAS_SEMANA_ORDEN.map(dia => {
                      const isActivo = horariosPorDia[dia]?.activo;
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => {
                            setHorariosPorDia(prev => ({
                              ...prev,
                              [dia]: {
                                ...prev[dia],
                                activo: !prev[dia]?.activo,
                                hora_corte: prev[dia]?.hora_corte || horaCorteGeneral,
                              }
                            }));
                          }}
                          className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isActivo
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950/40 scale-[1.02]'
                              : 'bg-slate-900/60 border-white/5 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span className="text-xs font-black uppercase">{dia.slice(0, 3)}</span>
                          <span className={`w-2 h-2 rounded-full ${isActivo ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-slate-950" />
                    <span>Guardar Horario Predeterminado</span>
                  </button>
                  {cutoffSuccessMsg && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {cutoffSuccessMsg}
                    </span>
                  )}
                </div>
              </form>

            </div>
          )}

          {/* 4. PANEL: ANUNCIO PÚBLICO PARA CLIENTES */}
          {activeAccordion === 'anuncio' && (
            <div className="rounded-3xl border border-rose-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-5 animate-slideDownSmooth">
              
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl shrink-0">
                    📢
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Aviso y Anuncio Público para Clientes</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-400/20 text-rose-300 border border-rose-400/30">
                        Banner Superior
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mensaje destacado que verán tus clientes en la parte superior del formulario de envíos
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
                <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-black text-rose-300">
                    ¿Para qué sirve el Anuncio Público?
                  </strong>
                  <p className="text-[12px] leading-relaxed text-rose-100/90">
                    Úsalo para comunicar promociones especiales (ej. "¡Envíos gratis por compras mayores a S/ 150!"), feriados, promociones de temporada o avisos urgentes sobre despachos a todos los compradores que abran tu enlace.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveAnuncio} className="space-y-4">
                <textarea
                  rows={3}
                  value={anuncioTexto}
                  onChange={e => setAnuncioTexto(e.target.value)}
                  placeholder="Ej: 🚀 ¡Envíos gratis por compras mayores a S/ 150! Los pedidos de hoy salen a las 6:00 PM puntual."
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-rose-400 shadow-inner"
                />

                {anuncioTexto && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200">
                    <span className="text-[10px] uppercase font-black text-rose-400 block mb-1">Vista Previa para tus Clientes:</span>
                    <p className="font-medium leading-relaxed">{anuncioTexto}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Anuncio</span>
                  </button>
                  {anuncioSuccessMsg && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {anuncioSuccessMsg}
                    </span>
                  )}
                </div>
              </form>

            </div>
          )}

          {/* 5. PANEL: PERSONALIZACIÓN DE TEMAS */}
          {activeAccordion === 'temas' && (
            <div className="rounded-3xl border border-purple-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-5 animate-slideDownSmooth">
              
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl shrink-0">
                    🎨
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Personalización de Temas (4 Estilos Oficiales)</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                        Transformación Visual
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cambia la atmósfera de tu aplicación entre los 4 estilos exclusivos: NSpace, Modern Black, Modern White y Rosado Space
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-xs text-purple-200 flex items-start gap-3">
                <Palette className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-black text-purple-300">
                    ¿Para qué sirve el Selector de Temas?
                  </strong>
                  <p className="text-[12px] leading-relaxed text-purple-100/90">
                    Aplica instantáneamente un tema global a toda la experiencia web. Tanto tu panel de administración como el formulario que ven tus clientas adaptarán sus fondos, contrastes y colores de acento en tiempo real a 60 FPS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {FUTURISTIC_THEMES.map(theme => {
                  const isCurrent = currentThemeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleApplyTheme(theme.id)}
                      className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'bg-purple-500/20 border-cyan-400 shadow-xl shadow-cyan-500/25 scale-[1.03]'
                          : 'bg-slate-900/80 border-white/10 hover:border-white/30 hover:scale-[1.01]'
                      }`}
                    >
                      <div>
                        <div
                          className="h-16 rounded-2xl w-full mb-3 shadow-inner flex items-center justify-center text-xl relative overflow-hidden"
                          style={{ background: theme.previewGradient }}
                        >
                          <span className="relative z-10 font-black text-white drop-shadow-md text-sm">
                            {theme.badge || 'Tema'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-sm text-white font-black">{theme.name}</strong>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-400 text-slate-950">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {theme.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                          isCurrent
                            ? 'bg-cyan-400 text-slate-950 shadow-md'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        {isCurrent ? '✓ Tema Seleccionado' : 'Activar Tema'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {themeSuccessMsg && (
                <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{themeSuccessMsg}</span>
                </div>
              )}

            </div>
          )}

          {/* 6. PANEL: AGENCIAS DE ENVÍO Y DESPACHO */}
          {activeAccordion === 'agencias' && (
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-4 sm:p-6 space-y-4 animate-slideDownSmooth">
              
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                    🚚
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Agencias de Envío y Despacho</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        {activeAgenciesCount} Agencias Activas
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Administra Shalom, Olva Courier, Motorizado Express y agencias personalizadas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <CompanyAgenciesTab />

            </div>
          )}

          {/* 7. PANEL: WHATSAPP SUB-QR (SOLO MATRIX 963097777) */}
          {activeAccordion === 'whatsapp' && isMainMatrixAccount && (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-2xl shadow-2xl p-5 sm:p-7 space-y-4 animate-slideDownSmooth">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Línea WhatsApp Oficial / Sub Código QR</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        Solo Master Matrix4012
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Gestión de sub-instancia de WhatsApp para envíos y notificaciones automáticas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAccordion(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimizar panel"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-slate-300">
                  Número vinculado para enviar comprobantes y estados automáticos desde el bot.
                </p>
                <button
                  type="button"
                  onClick={handleOpenQrModal}
                  className="py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Escanear / Vincular Sub QR</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-500/20">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sub-Instancia Asignada</span>
                  <span className="text-xs font-mono font-bold text-emerald-300">{subInstance}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Teléfono Emisor Oficial</span>
                    <button
                      type="button"
                      onClick={() => verifyLivePhoneStatus(false)}
                      disabled={isVerifyingPhone}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isVerifyingPhone ? 'animate-spin' : ''}`} />
                      <span>Verificar</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-emerald-300">+{liveSenderPhone || initialPhone}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      connectionState === 'open'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : connectionState === 'connecting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {connectionState === 'open' ? '🟢 Conectado' : connectionState === 'connecting' ? '🟡 Conectando' : '🔴 Desconectado'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: PERSONALIZAR CUENTA Y SEGURIDAD (CÓDIGO, EQUIPO, CLAVE)
          ========================================================================= */}
      {mainTab === 'cuenta' && (
        <div className="space-y-5 animate-fadeIn">
          
          {/* 1. CÓDIGO DE ENTRADA / ACCESO DE LA EMPRESA */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>Código / Número de Acceso de la Empresa</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                    ID Exclusivo
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Tu número de entrada al sistema y el código con el que tus clientes acceden a tu enlace.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveMasterCode} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  required
                  value={newMasterCode}
                  onChange={e => setNewMasterCode(e.target.value)}
                  placeholder="Número de Entrada"
                  className="flex-1 p-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-base font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                />
                <button
                  type="submit"
                  className="py-3.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Actualizar Código</span>
                </button>
              </div>
              {codeSuccessMsg && (
                <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{codeSuccessMsg}</span>
                </div>
              )}
            </form>
          </div>

          {/* 2. SEGURIDAD Y CAMBIO DE CONTRASEÑA */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center text-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Seguridad y Contraseña</h3>
                  <p className="text-xs text-slate-400">
                    Cambia la contraseña maestra de acceso para este panel empresarial
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChangePasswordModal(true)}
                className="py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black flex items-center gap-2 border border-white/15 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Cambiar Contraseña</span>
              </button>
            </div>
          </div>

          {/* 3. GESTIÓN DE EQUIPO Y COLABORADORES */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Equipo y Colaboradores ({colaboradores.length})</h3>
                  <p className="text-xs text-slate-400">
                    Asigna miembros del taller para embalaje, bordado o gestión de envíos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddColab(true)}
                className="py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir Colaborador</span>
              </button>
            </div>

            {colaboradores.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-white/5 text-center text-slate-500 text-xs">
                No hay colaboradores registrados aún. Añade tu equipo para asignar tareas de producción.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {colaboradores.map(c => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div>
                      <strong className="text-xs font-bold text-white block">{c.nombre}</strong>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-block mt-0.5">
                        {c.rol}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteColaborador(c.id)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                      title="Eliminar colaborador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}

      {/* MODAL PARA AGREGAR COLABORADOR */}
      {showAddColab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-950 border border-white/10 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Nuevo Colaborador</span>
              </h3>
              <button
                onClick={() => setShowAddColab(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddColaboradorSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={colabNombre}
                  onChange={e => setColabNombre(e.target.value)}
                  placeholder="Ej: Carlos Sánchez"
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Rol / Cargo</label>
                <select
                  value={colabRol}
                  onChange={e => setColabRol(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="embalaje">Embalaje y Despacho</option>
                  <option value="bordado">Costura y Bordado</option>
                  <option value="atencion">Atención al Cliente</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddColab(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CÓDIGO QR WHATSAPP (SOLO MATRIX) */}
      {showQrModal && isMainMatrixAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-950 border border-emerald-500/40 p-5 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Escanear WhatsApp QR</span>
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-300">Generando código QR...</span>
              </div>
            ) : qrBase64 ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-2xl inline-block shadow-xl">
                  <img src={qrBase64} alt="QR WhatsApp" className="w-52 h-52 object-contain" />
                </div>
                <p className="text-xs text-slate-400">
                  Abre WhatsApp en tu teléfono &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                </p>
              </div>
            ) : (
              <p className="text-xs text-rose-400 py-6">No se pudo cargar el código QR.</p>
            )}

            {qrSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-bold">
                {qrSuccessMsg}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
