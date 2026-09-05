import React, { useState, useEffect } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Colaborador, HorarioDiaDespacho } from '../../types/database.types';
import { ChangePasswordModal } from './ChangePasswordModal';
import { CompanyAgenciesTab } from './CompanyAgenciesTab';
import { CompanyAchievementsTab } from './CompanyAchievementsTab';
import {
  evaluateShippingCutoff,
  formatFriendlyTime,
  formatFriendlyDate,
  DIAS_SEMANA_NOMBRES
} from '../../utils/shippingCutoff';
import {
  FUTURISTIC_THEMES,
  THEME_CATEGORIES,
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
  Link,
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
  ShieldCheck
} from 'lucide-react';

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
  } = useOrders();

  const { currentUser, currentEmpresa } = useAuth();

  // Subpestañas requeridas: Agencias | Ajustes | Logros
  const [activeSubTab, setActiveSubTab] = useState<'agencias' | 'ajustes' | 'logros'>('agencias');

  // Nombre y código de entrada de la empresa
  const companyName = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids';
  const companyCode = currentEmpresa?.numero_entrada || masterCode || '061625';

  // 1. Estado para Código / Número de Acceso
  const [newMasterCode, setNewMasterCode] = useState(companyCode);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  useEffect(() => {
    setNewMasterCode(companyCode);
  }, [companyCode]);

  // 2. Estado para Datos de Remitente Oficial (Olva Courier / Shalom / Agencias)
  const [remitenteDni, setRemitenteDni] = useState(tallerConfig.remitente_dni || tallerConfig.ruc_dni || tallerConfig.remitente_default?.ruc_dni || '42020312');
  const [remitenteEmail, setRemitenteEmail] = useState(tallerConfig.remitente_email || 'comikidsperu@gmail.com');
  const [remitenteCelular, setRemitenteCelular] = useState(tallerConfig.remitente_celular || tallerConfig.celular_taller || tallerConfig.remitente_default?.celular || '927781412');
  const [remitenteNombre, setRemitenteNombre] = useState(tallerConfig.nombre_taller || tallerConfig.remitente_default?.nombre || companyName);
  const [remitenteDireccion, setRemitenteDireccion] = useState(tallerConfig.remitente_default?.direccion || tallerConfig.direccion_taller || 'Lima, Perú');
  const [remitenteObservaciones, setRemitenteObservaciones] = useState(tallerConfig.remitente_default?.observaciones || '');
  const [remitenteSuccessMsg, setRemitenteSuccessMsg] = useState('');

  // Estado para Estilo Predeterminado de Rótulos de Envío
  const [estiloRotuloDefault, setEstiloRotuloDefault] = useState<'estandar_oficial' | 'vision_modern' | 'eco_ink_saving'>(
    tallerConfig.estilo_rotulo_default || 'estandar_oficial'
  );
  const [rotuloSuccessMsg, setRotuloSuccessMsg] = useState('');

  // 3. Estado para Horario Límite y Días de Despacho POR DÍA
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
  const [companyLogoUrl, setCompanyLogoUrl] = useState(currentEmpresa?.logo_url || tallerConfig.logo_url || '/Comikids.png');
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');
  const logoFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // 8. Estado de Temas Futuristas Categorizados
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return currentEmpresa?.tema_fondo || tallerConfig.tema_fondo || (typeof localStorage !== 'undefined' ? localStorage.getItem('incomi_futuristic_theme') : '') || 'vision-obsidian';
  });
  const [selectedThemeCategory, setSelectedThemeCategory] = useState<string>('all');
  const [themeSuccessMsg, setThemeSuccessMsg] = useState('');

  const handleSaveLogo = (newUrl: string) => {
    const trimmed = newUrl.trim();
    setCompanyLogoUrl(trimmed);
    updateTallerConfig({ logo_url: trimmed });
    if (currentEmpresa) {
      currentEmpresa.logo_url = trimmed;
    }
    setLogoSuccessMsg('¡Foto de perfil / logo oficial actualizado con éxito!');
    setTimeout(() => setLogoSuccessMsg(''), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleSaveLogo(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    applyFuturisticTheme(themeId);
    updateTallerConfig({ tema_fondo: themeId });
    if (currentEmpresa) {
      currentEmpresa.tema_fondo = themeId;
    }
    setThemeSuccessMsg('¡Tema futurista aplicado en tiempo real!');
    setTimeout(() => setThemeSuccessMsg(''), 3500);
  };

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;

  const publicOrderUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?action=nuevo_envio`
    : 'https://comikids-encomi.web.app/?action=nuevo_envio';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicOrderUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleSaveRemitente = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig({
      nombre_taller: remitenteNombre.trim(),
      remitente_dni: remitenteDni.trim(),
      ruc_dni: remitenteDni.trim(),
      remitente_email: remitenteEmail.trim(),
      remitente_celular: remitenteCelular.trim(),
      celular_taller: remitenteCelular.trim(),
      direccion_taller: remitenteDireccion.trim(),
      remitente_default: {
        nombre: remitenteNombre.trim(),
        ruc_dni: remitenteDni.trim(),
        celular: remitenteCelular.trim(),
        direccion: remitenteDireccion.trim(),
        observaciones: remitenteObservaciones.trim(),
      }
    });
    setRemitenteSuccessMsg('¡Datos de remitente guardados exitosamente para todas las agencias y rótulos!');
    setTimeout(() => setRemitenteSuccessMsg(''), 4000);
  };

  const handleSaveEstiloRotulo = (style: 'estandar_oficial' | 'vision_modern' | 'eco_ink_saving') => {
    setEstiloRotuloDefault(style);
    updateTallerConfig({
      estilo_rotulo_default: style
    });
    const styleName =
      style === 'estandar_oficial' ? 'Estándar Oficial Encomi' :
      style === 'vision_modern' ? 'Moderno Minimalista Vision' :
      'Compacto Eco Ultra-Ahorro';
    setRotuloSuccessMsg(`¡Estilo predeterminado de rótulos cambiado a "${styleName}"!`);
    setTimeout(() => setRotuloSuccessMsg(''), 4000);
  };

  const handleSaveCutoffSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const activeDays = DIAS_SEMANA_ORDEN.filter(d => horariosPorDia[d]?.activo);
    updateTallerConfig({
      hora_corte_envio_hoy: horaCorteGeneral,
      dias_despacho_activos: activeDays,
      despacho_domingo_habilitado: activeDays.includes('domingo'),
      mensaje_corte_personalizado: mensajeCorteGeneral.trim() || undefined,
      horarios_por_dia: horariosPorDia,
    });
    setCutoffSuccessMsg('¡Horarios de despacho por día y mensajes personalizados guardados con éxito!');
    setTimeout(() => setCutoffSuccessMsg(''), 4000);
  };

  const handleSaveAnuncio = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig({
      anuncio_publico_clientes: anuncioTexto.trim() || undefined
    });
    setAnuncioSuccessMsg('¡Mensaje de aviso guardado y visible en el formulario de clientes!');
    setTimeout(() => setAnuncioSuccessMsg(''), 4000);
  };

  const handleUpdateMasterCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterCode.trim()) return;
    const ok = saveMasterCode(newMasterCode.trim());
    if (ok) {
      setCodeSuccessMsg('¡Código de acceso actualizado exitosamente!');
      setTimeout(() => setCodeSuccessMsg(''), 4000);
    }
  };

  const handleSaveColaborador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabNombre.trim()) return;

    saveColaborador({
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

  return (
    <div className="space-y-6 animate-fadeIn pb-24 text-slate-100 max-w-6xl mx-auto">
      
      {/* Header Perfil de la Empresa */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 border-2 border-white/20 flex items-center justify-center overflow-hidden shadow-xl shadow-cyan-500/25 shrink-0">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyName}
                className="w-full h-full object-contain p-1.5"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
              />
            ) : (
              <span className="text-3xl">🏢</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {companyName}
              </h2>
              <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Ajustes de Empresa
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Código de Entrada: <strong className="font-mono text-cyan-300">{companyCode}</strong> • {tallerConfig.ciudad_origen || 'LIMA'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Despachos Entregados</span>
            <strong className="text-lg font-black text-emerald-400 font-mono">{deliveredCount.toLocaleString()}</strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-lg font-bold">
            📦
          </div>
        </div>
      </div>

      {/* 3 ESPACIOS EXCLUSIVOS: AGENCIAS | AJUSTES | LOGROS */}
      <div className="p-1.5 rounded-3xl bg-slate-950/90 border border-white/15 backdrop-blur-2xl shadow-2xl flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('agencias')}
          className={`flex-1 min-w-[150px] py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeSubTab === 'agencias'
              ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-xl shadow-cyan-500/30 border border-cyan-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>🏢 Agencias y Motorizado</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ajustes')}
          className={`flex-1 min-w-[150px] py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeSubTab === 'ajustes'
              ? 'bg-linear-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-xl shadow-amber-400/30 border border-amber-300'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>⚙️ Ajustes de Cuenta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logros')}
          className={`flex-1 min-w-[150px] py-3.5 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            activeSubTab === 'logros'
              ? 'bg-linear-to-r from-pink-500 to-purple-600 text-white shadow-xl shadow-pink-500/30 border border-pink-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>🏆 Logros e Hitos</span>
        </button>
      </div>

      {/* --- SUBTAB 1: AGENCIAS Y MOTORIZADO --- */}
      {activeSubTab === 'agencias' && (
        <div className="animate-fadeIn">
          <CompanyAgenciesTab />
        </div>
      )}

      {/* --- SUBTAB 3: LOGROS E HITOS --- */}
      {activeSubTab === 'logros' && (
        <div className="animate-fadeIn">
          <CompanyAchievementsTab />
        </div>
      )}

      {/* --- SUBTAB 2: AJUSTES DE CUENTA (LAS 7 SECCIONES) --- */}
      {activeSubTab === 'ajustes' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* ALERTA DE ÉXITO GENERAL */}
          {logoSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{logoSuccessMsg}</span>
            </div>
          )}
          {themeSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{themeSuccessMsg}</span>
            </div>
          )}

          {/* 1. FOTO DE PERFIL Y LOGO OFICIAL DE LA EMPRESA */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-pink-500/30 bg-pink-950/15 backdrop-blur-2xl space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xl shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Foto de Perfil y Logo Oficial de la Empresa</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-pink-500/20 text-pink-300 border border-pink-500/30">
                      Branding en Link
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Aparecerá en la esquina superior derecha del link personalizado de tus clientes y en tus rótulos de despacho.
                  </p>
                </div>
              </div>

              {/* Previsualización en vivo cómo lo ve el cliente */}
              <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-950/80 border border-pink-500/30 shadow-inner shrink-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase pl-2">Vista cliente:</span>
                <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-pink-500/25 via-purple-500/25 to-cyan-500/25 text-pink-200 border border-pink-400/40 flex items-center gap-2 shadow-md">
                  <img
                    src={companyLogoUrl || '/Comikids.png'}
                    alt={companyName}
                    className="w-5 h-5 object-contain rounded"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
                  />
                  <span>{companyName}</span>
                </span>
              </div>
            </div>

            {/* Presets rápidos */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                Logos y emblemas recomendados:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: 'ComiKids Oficial', url: '/Comikids.png' },
                  { label: 'Encomi Express', url: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
                  { label: 'Emblema Dorado VIP', url: 'https://cdn-icons-png.flaticon.com/512/1040/1040230.png' },
                  { label: 'Taller Confección', url: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png' },
                  { label: 'Boutique Kids', url: 'https://cdn-icons-png.flaticon.com/512/10008/10008778.png' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSaveLogo(preset.url)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      companyLogoUrl === preset.url
                        ? 'bg-pink-500/20 border-pink-400 text-pink-200 shadow-md'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="w-4 h-4 object-contain rounded" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subir imagen propia o URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Subir logo desde tu dispositivo:
                </label>
                <input
                  type="file"
                  ref={logoFileInputRef}
                  accept="image/*"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-white/10 hover:border-pink-400 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-pink-400" />
                  <span>Subir Foto de Perfil o Logo</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  O pegar enlace directo URL del logo:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={companyLogoUrl}
                    onChange={e => setCompanyLogoUrl(e.target.value)}
                    placeholder="https://ejemplo.com/mi-logo.png"
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-pink-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveLogo(companyLogoUrl)}
                    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CATÁLOGO DE TEMAS DE FONDO FUTURISTAS (CATEGORIZADOS) */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-purple-500/30 bg-purple-950/15 backdrop-blur-2xl space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xl shrink-0">
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Temas de Fondo Futuristas para tu Empresa</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      En Vivo 60 FPS
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Elige el estilo visual moderno que más te guste. Se aplica inmediatamente a toda la aplicación.
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Tema Actual: <strong className="text-white">{getThemeById(currentThemeId).name}</strong>
              </span>
            </div>

            {/* Filtro por Categorías */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {THEME_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedThemeCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    selectedThemeCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-md font-black shadow-purple-950/50'
                      : 'bg-slate-900 border border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grid de Temas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {FUTURISTIC_THEMES
                .filter(t => selectedThemeCategory === 'all' || t.category === selectedThemeCategory)
                .map((theme) => {
                  const isSelected = currentThemeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-2 border-purple-400 shadow-xl shadow-purple-950/60 scale-[1.02]'
                          : 'bg-slate-950/80 border-white/10 hover:border-white/20 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Preview Swatch */}
                      <div
                        className="h-16 rounded-xl border border-white/10 relative overflow-hidden flex items-center justify-center shadow-inner"
                        style={{ background: theme.previewGradient }}
                      >
                        {isSelected && (
                          <span className="px-2.5 py-1 rounded-full bg-slate-950/90 text-purple-300 border border-purple-400 font-black text-[10px] uppercase flex items-center gap-1 shadow-lg">
                            <Check className="w-3 h-3 text-purple-400" />
                            <span>Tema Activo</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <h4 className="font-black text-white text-xs leading-tight group-hover:text-purple-300 transition-colors">
                            {theme.name}
                          </h4>
                          {theme.badge && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                              {theme.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {theme.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] text-slate-500 font-mono">
                        <span>{theme.categoryLabel}</span>
                        <span className={`font-bold ${isSelected ? 'text-purple-400 font-sans' : 'text-slate-400 font-sans'}`}>
                          {isSelected ? '✓ Aplicado' : 'Toca para aplicar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 3. LINK OFICIAL PARA CLIENTES */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Link Oficial para Clientes</h3>
                  <p className="text-xs text-slate-300">
                    Comparte este link único. Tus clientes irán directo a registrar su nuevo pedido o envío
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link Oficial'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs font-mono text-cyan-300 overflow-x-auto">
              <span className="truncate">{publicOrderUrl}</span>
              <span className="text-[10px] text-slate-500 shrink-0 font-sans uppercase font-bold">Enlace Activo</span>
            </div>
          </div>

          {/* 2. DATOS DE REMITENTE OFICIAL OLVA COURIER SHALOM Y RÓTULOS */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-yellow-500/30 bg-yellow-950/15 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xl">
                🏢
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>Datos de Remitente Oficial (Olva Courier, Shalom & Rótulos)</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    Quién Envía • 100% Personalizable
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Datos oficiales de quien envía que se sincronizan con las guías, comprobantes y rótulos de despacho de todas las agencias.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRemitente} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                    Nombre Comercial / Remitente
                  </label>
                  <input
                    type="text"
                    required
                    value={remitenteNombre}
                    onChange={e => setRemitenteNombre(e.target.value)}
                    placeholder="Nombre del Remitente"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>

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
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-yellow-300 font-mono font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                    📧 Correo Electrónico Remitente
                  </label>
                  <input
                    type="email"
                    required
                    value={remitenteEmail}
                    onChange={e => setRemitenteEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                    📱 Celular / Teléfono Remitente
                  </label>
                  <input
                    type="text"
                    required
                    value={remitenteCelular}
                    onChange={e => setRemitenteCelular(e.target.value)}
                    placeholder="999 999 999"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-yellow-300 font-mono font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                    📍 Dirección de Origen / Taller
                  </label>
                  <input
                    type="text"
                    value={remitenteDireccion}
                    onChange={e => setRemitenteDireccion(e.target.value)}
                    placeholder="Ej. Jr. Gamarra 1234, La Victoria, Lima"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                    📝 Observaciones / Notas Predeterminadas en Rótulos
                  </label>
                  <input
                    type="text"
                    value={remitenteObservaciones}
                    onChange={e => setRemitenteObservaciones(e.target.value)}
                    placeholder="Ej. Paquete Frágil - Entregar con Cuidado"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-yellow-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
                <span className="text-[11px] text-slate-400">
                  ✓ Estos datos se usan como remitente predeterminado en todas tus agencias y rótulos térmicos/A4.
                </span>

                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-yellow-400/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Datos de Remitente</span>
                </button>
              </div>
            </form>

            {remitenteSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
                ✓ {remitenteSuccessMsg}
              </p>
            )}
          </div>

          {/* 2.5 SELECTOR DE ESTILO PREDETERMINADO DE RÓTULOS (TÉRMICA / A4) */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-emerald-500/30 bg-emerald-950/15 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Estilo Predeterminado de Rótulos de Despacho</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      Impresión Térmica & A4
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Elige el diseño visual que se usará para imprimir los rótulos de paquetes. Cada agencia puede heredar este estilo o usar uno propio.
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Estilo Activo: <strong className="text-white">
                  {estiloRotuloDefault === 'estandar_oficial' ? 'Estándar Oficial Encomi' : estiloRotuloDefault === 'vision_modern' ? 'Moderno Minimalista Vision' : 'Compacto Eco Ultra-Ahorro'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                {
                  id: 'estandar_oficial' as const,
                  title: '🏷️ Estándar Oficial Encomi',
                  badge: 'Recomendado',
                  badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                  desc: 'Diseño corporativo con código de barras legible, recuadros contrastados claros y orden oficial para couriers peruanos.',
                  previewBg: 'bg-slate-900 border-emerald-500/40'
                },
                {
                  id: 'vision_modern' as const,
                  title: '✨ Moderno Minimalista Vision',
                  badge: 'Diseño Premium',
                  badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                  desc: 'Esquinas redondeadas, tipografía moderna con badges destacados y acentos visuales limpios de alta estética.',
                  previewBg: 'bg-slate-900 border-cyan-500/40'
                },
                {
                  id: 'eco_ink_saving' as const,
                  title: '🌱 Compacto Eco Ultra-Ahorro',
                  badge: 'Ahorro Tinta',
                  badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  desc: 'Bordes finos de 1px sin rellenos pesados ni fondos oscuros. Máxima velocidad y vida útil para cabezales térmicos.',
                  previewBg: 'bg-slate-900 border-amber-500/40'
                }
              ].map((style) => {
                const isSelected = estiloRotuloDefault === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => handleSaveEstiloRotulo(style.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group overflow-hidden ${
                      isSelected
                        ? 'bg-slate-900 border-2 border-emerald-400 shadow-xl shadow-emerald-950/60 scale-[1.02]'
                        : 'bg-slate-950/80 border-white/10 hover:border-white/25 hover:bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <h4 className="font-black text-white text-xs leading-tight group-hover:text-emerald-300 transition-colors">
                          {style.title}
                        </h4>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${style.badgeClass}`}>
                          {style.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {style.desc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                      <span className="text-slate-500 font-mono">Formato Térmica 80mm / A4</span>
                      <span className={`font-bold flex items-center gap-1 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Predeterminado</span>
                          </>
                        ) : (
                          'Toca para elegir'
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {rotuloSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{rotuloSuccessMsg}</span>
              </p>
            )}
          </div>

          {/* 3. HORARIO LÍMITE DE ENVÍO HOY Y DÍAS DE DESPACHO (CONFIGURACIÓN POR DÍA) */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-indigo-500/30 bg-indigo-950/10 backdrop-blur-2xl space-y-5 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Horario Límite de Envío Hoy & Días de Despacho (Por Día)</h3>
                  <p className="text-xs text-slate-300">
                    Configura la hora de corte de despacho POR CADA DÍA y añade mensajes personalizados opcionales
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Reglas por Día
              </span>
            </div>

            <form onSubmit={handleSaveCutoffSettings} className="space-y-5">
              
              {/* Lista Dinámica por Día */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  📅 Horario de Corte y Mensaje Específico para Cada Día
                </label>

                <div className="space-y-2.5">
                  {DIAS_SEMANA_ORDEN.map(diaKey => {
                    const diaInfo = horariosPorDia[diaKey] || {
                      dia: diaKey,
                      activo: true,
                      hora_corte: '18:00',
                      mensaje_personalizado: '',
                    };
                    const diaNombre = DIAS_SEMANA_NOMBRES[diaKey] || diaKey;

                    const toggleDay = () => {
                      setHorariosPorDia(prev => ({
                        ...prev,
                        [diaKey]: {
                          ...diaInfo,
                          activo: !diaInfo.activo,
                        }
                      }));
                    };

                    const updateHora = (val: string) => {
                      setHorariosPorDia(prev => ({
                        ...prev,
                        [diaKey]: {
                          ...diaInfo,
                          hora_corte: val,
                        }
                      }));
                    };

                    const updateMensaje = (val: string) => {
                      setHorariosPorDia(prev => ({
                        ...prev,
                        [diaKey]: {
                          ...diaInfo,
                          mensaje_personalizado: val,
                        }
                      }));
                    };

                    return (
                      <div
                        key={diaKey}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          diaInfo.activo
                            ? 'bg-slate-950/80 border-indigo-500/30 shadow-md'
                            : 'bg-slate-950/40 border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={toggleDay}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all cursor-pointer shrink-0 ${
                                diaInfo.activo
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                              title={diaInfo.activo ? 'Desactivar este día' : 'Activar este día'}
                            >
                              {diaInfo.activo ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white capitalize">{diaNombre}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  diaInfo.activo
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                                }`}>
                                  {diaInfo.activo ? 'Despacho Habilitado' : 'No se Despacha'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {diaInfo.activo
                                  ? `Hora límite de corte: ${formatFriendlyTime(diaInfo.hora_corte || '18:00')}`
                                  : 'Los clientes no podrán programar envíos para este día.'}
                              </span>
                            </div>
                          </div>

                          {diaInfo.activo && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="text-xs text-slate-400 font-bold">Límite:</label>
                              <input
                                type="time"
                                value={diaInfo.hora_corte || '18:00'}
                                onChange={e => updateHora(e.target.value)}
                                className="px-3 py-1.5 bg-slate-900 border border-indigo-500/40 rounded-xl text-xs font-mono font-bold text-indigo-200 focus:outline-none focus:border-indigo-400 shadow-inner cursor-pointer"
                              />

                              <div className="flex items-center gap-1">
                                {['12:00', '14:00', '16:00', '18:00', '20:00'].map(preset => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => updateHora(preset)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                                      diaInfo.hora_corte === preset
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white/5 hover:bg-white/10 text-slate-400'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {diaInfo.activo && (
                          <div className="mt-2.5 pt-2.5 border-t border-white/5 space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              💬 Mensaje personalizado opcional para los {diaNombre}:
                            </label>
                            <input
                              type="text"
                              value={diaInfo.mensaje_personalizado || ''}
                              onChange={e => updateMensaje(e.target.value)}
                              placeholder={`Ej. ¡Los ${diaNombre} despachamos express antes de las ${diaInfo.hora_corte || '18:00'}!`}
                              className="w-full px-3.5 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Banner de Estado de Corte en Vivo */}
              {(() => {
                const cutoffEval = evaluateShippingCutoff(tallerConfig);
                return (
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${cutoffEval.isPastCutoff ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {cutoffEval.isPastCutoff ? 'Plazo de Hoy Finalizado' : 'Envíos para Hoy Disponibles'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Hora actual en Perú: <strong className="text-indigo-300 font-mono">{cutoffEval.currentTimeStr}</strong> • Corte: <strong className="text-amber-300 font-mono">{formatFriendlyTime(cutoffEval.cutoffTime)}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                        cutoffEval.isPastCutoff
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        Próximo Despacho: {formatFriendlyDate(cutoffEval.minAvailableDateYMD)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
                <span className="text-[11px] text-slate-400">
                  ✓ El formulario público de clientes respetará la hora límite de cada día.
                </span>

                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Horarios por Día</span>
                </button>
              </div>
            </form>

            {cutoffSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
                ✓ {cutoffSuccessMsg}
              </p>
            )}
          </div>

          {/* 4. AVISO / ANUNCIO PÚBLICO */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-amber-500/30 bg-amber-950/10 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Aviso / Anuncio Público para Clientes</h3>
                <p className="text-xs text-slate-300">
                  Personaliza el mensaje destacado que ven tus clientes al abrir el formulario de despacho
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAnuncio} className="space-y-3">
              <textarea
                rows={3}
                value={anuncioTexto}
                onChange={e => setAnuncioTexto(e.target.value)}
                placeholder="Ej. ¡Atención! Recuerda que todos los pedidos registrados antes de las 4:00 PM salen en el despacho de hoy 🚚✨"
                className="w-full p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
              />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-400">
                  {anuncioTexto.trim() ? '✓ Anuncio activo para tus clientes' : 'Sin anuncio personalizado'}
                </span>

                <div className="flex gap-2">
                  {anuncioTexto.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnuncioTexto('');
                        updateTallerConfig({ anuncio_publico_clientes: undefined });
                        setAnuncioSuccessMsg('Anuncio eliminado.');
                        setTimeout(() => setAnuncioSuccessMsg(''), 3000);
                      }}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Quitar Aviso
                    </button>
                  )}

                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Mensaje de Aviso</span>
                  </button>
                </div>
              </div>
            </form>

            {anuncioSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
                ✓ {anuncioSuccessMsg}
              </p>
            )}
          </div>

          {/* 5. NÚMERO CÓDIGO DE ACCESO A LA EMPRESA */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Número / Código de Acceso a la Empresa</h3>
                <p className="text-xs text-slate-400">
                  Número de entrada para iniciar sesión directamente en este panel desde la pantalla principal
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateMasterCode} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  required
                  value={newMasterCode}
                  onChange={e => setNewMasterCode(e.target.value)}
                  placeholder="Ej. 061625"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-mono text-cyan-300 font-black text-center focus:outline-none focus:border-amber-500 tracking-widest"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Actualizar Código de Entrada
              </button>
            </form>

            {codeSuccessMsg && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
                ✓ {codeSuccessMsg}
              </p>
            )}
          </div>

          {/* 6. SEGURIDAD Y CONTRASEÑA DE LA CUENTA */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-pink-500/30 bg-pink-950/10 backdrop-blur-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Seguridad & Contraseña de la Cuenta</h3>
                  <p className="text-xs text-slate-300">
                    Cambia la contraseña maestra de acceso para la cuenta de administración
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChangePasswordModal(true)}
                className="py-2.5 px-5 rounded-2xl bg-linear-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-pink-600/25 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <KeyRound className="w-4 h-4" />
                <span>Cambiar Contraseña</span>
              </button>
            </div>
          </div>

          {/* 7. EQUIPO Y COLABORADORES DE TALLER */}
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Equipo y Colaboradores de Taller</h3>
                  <p className="text-xs text-slate-400">
                    Personal autorizado para gestionar embalaje, despachos y atención
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddColab(true)}
                className="py-2.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Colaborador</span>
              </button>
            </div>

            {/* Caja para Añadir Colaborador */}
            {showAddColab && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl space-y-4 animate-slideDown">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h4 className="text-sm font-black text-white">Nuevo Miembro del Taller</h4>
                  <button onClick={() => setShowAddColab(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveColaborador} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Valeria Gómez"
                      value={colabNombre}
                      onChange={e => setColabNombre(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Rol / Función</label>
                    <select
                      value={colabRol}
                      onChange={e => setColabRol(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="embalaje">📦 Embalaje & Despacho</option>
                      <option value="atencion">💬 Atención a Clientes</option>
                      <option value="motorizado">🛵 Motorizado Local</option>
                      <option value="administrador">🛡️ Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono (Opcional)</label>
                    <input
                      type="tel"
                      placeholder="987 654 321"
                      value={colabTelefono}
                      onChange={e => setColabTelefono(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddColab(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      Guardar Colaborador
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de Colaboradores */}
            {colaboradores.length === 0 ? (
              <div className="p-8 rounded-3xl bg-slate-950/60 border border-white/5 text-center space-y-2">
                <p className="text-xs text-slate-500">No hay colaboradores registrados aún.</p>
                <button
                  onClick={() => setShowAddColab(true)}
                  className="text-xs text-purple-400 hover:underline font-bold cursor-pointer"
                >
                  + Agregar el primer miembro
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {colaboradores.map(c => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-black text-sm shrink-0">
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">{c.nombre}</h5>
                        <span className="text-[10px] font-semibold text-purple-400 capitalize block">
                          {c.rol === 'embalaje' ? '📦 Embalaje' : c.rol === 'atencion' ? '💬 Atención' : c.rol === 'motorizado' ? '🛵 Motorizado' : '🛡️ Admin'}
                        </span>
                        {c.telefono && (
                          <span className="text-[10px] font-mono text-slate-400 block">{c.telefono}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteColaborador(c.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      title="Eliminar colaborador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Cambio de Contraseña */}
      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}

    </div>
  );
};
