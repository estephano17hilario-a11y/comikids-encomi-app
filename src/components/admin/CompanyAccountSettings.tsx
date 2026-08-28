import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Colaborador, CompanyAchievement } from '../../types/database.types';
import { ChangePasswordModal } from './ChangePasswordModal';
import { EvolutionWhatsAppManager } from './EvolutionWhatsAppManager';
import { yapeReaderService } from '../../services/yapeReaderService';

import { evaluateShippingCutoff, formatFriendlyTime, formatFriendlyDate } from '../../utils/shippingCutoff';

import { Volume2, Clock, Calendar } from 'lucide-react';
import {
  Store,
  Users,
  KeyRound,
  Trophy,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Shield,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  Award,
  Crown,
  Flame,
  Gem,
  Package,
  Link,
  Copy,
  Megaphone,
  Save,
  Lock
} from 'lucide-react';

export const CompanyAccountSettings: React.FC = () => {
  const {
    tallerConfig,
    updateTallerConfig,
    colaboradores,
    saveColaborador,
    deleteColaborador,
    masterCode,
    saveMasterCode,
    companyAchievements,
    pedidos,
  } = useOrders();

  const { currentUser } = useAuth();

  // State for Access Code Edit
  const [newMasterCode, setNewMasterCode] = useState(masterCode);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // State for Remitente Settings (Olva Courier / Shalom / Despachos)
  const [remitenteDni, setRemitenteDni] = useState(tallerConfig.remitente_dni || tallerConfig.ruc_dni || '42020312');
  const [remitenteEmail, setRemitenteEmail] = useState(tallerConfig.remitente_email || 'comikidsperu@gmail.com');
  const [remitenteCelular, setRemitenteCelular] = useState(tallerConfig.remitente_celular || tallerConfig.celular_taller || '927781412');
  const [remitenteNombre, setRemitenteNombre] = useState(tallerConfig.nombre_taller || 'Comikids Envíos');
  const [remitenteSuccessMsg, setRemitenteSuccessMsg] = useState('');

  // State for Cutoff & Shipping Days Settings
  const [horaCorte, setHoraCorte] = useState(tallerConfig.hora_corte_envio_hoy || '18:00');
  const [diasDespacho, setDiasDespacho] = useState<string[]>(tallerConfig.dias_despacho_activos || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']);
  const [mensajeCorte, setMensajeCorte] = useState(tallerConfig.mensaje_corte_personalizado || '');
  const [cutoffSuccessMsg, setCutoffSuccessMsg] = useState('');

  // State for Custom Client Notice
  const [anuncioTexto, setAnuncioTexto] = useState(tallerConfig.anuncio_publico_clientes || '');
  const [anuncioSuccessMsg, setAnuncioSuccessMsg] = useState('');

  // State for Copy Link
  const [copiedLink, setCopiedLink] = useState(false);

  // State for Add Collaborator
  const [showAddColab, setShowAddColab] = useState(false);
  const [colabNombre, setColabNombre] = useState('');
  const [colabRol, setColabRol] = useState<Colaborador['rol']>('embalaje');
  const [colabTelefono, setColabTelefono] = useState('');
  const [colabEmail, setColabEmail] = useState('');

  const handleSaveRemitente = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig({
      nombre_taller: remitenteNombre.trim(),
      remitente_dni: remitenteDni.trim(),
      ruc_dni: remitenteDni.trim(),
      remitente_email: remitenteEmail.trim(),
      remitente_celular: remitenteCelular.trim(),
      celular_taller: remitenteCelular.trim(),
    });
    setRemitenteSuccessMsg('¡Datos de remitente actualizados exitosamente para Olva Courier y Shalom!');
    setTimeout(() => setRemitenteSuccessMsg(''), 4000);
  };

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const nextAchievement = companyAchievements.find(a => !a.unlocked);
  const unlockedCount = companyAchievements.filter(a => a.unlocked).length;

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

  const handleUpdateMasterCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterCode.trim()) return;
    const ok = saveMasterCode(newMasterCode.trim());
    if (ok) {
      setCodeSuccessMsg('¡Código de acceso actualizado exitosamente!');
      setTimeout(() => setCodeSuccessMsg(''), 4000);
    }
  };

  const handleSaveAnuncio = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig({
      anuncio_publico_clientes: anuncioTexto.trim() || undefined
    });
    setAnuncioSuccessMsg('¡Mensaje de aviso guardado y visible en el formulario de clientes!');
    setTimeout(() => setAnuncioSuccessMsg(''), 4000);
  };

  const handleSaveCutoffSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig({
      hora_corte_envio_hoy: horaCorte,
      dias_despacho_activos: diasDespacho,
      despacho_domingo_habilitado: diasDespacho.includes('domingo'),
      mensaje_corte_personalizado: mensajeCorte.trim() || undefined,
    });
    setCutoffSuccessMsg('¡Horarios de corte y días de despacho guardados con éxito!');
    setTimeout(() => setCutoffSuccessMsg(''), 4000);
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
    <div className="space-y-8 animate-fadeIn pb-24 text-slate-100">
      
      {/* Header Profile Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-3xl shadow-xl shadow-cyan-500/25">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {tallerConfig.nombre_taller || 'Encomi Envíos'}
              </h2>
              <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Cuenta Matriz
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              RUC/DNI: <strong className="font-mono text-white">{tallerConfig.ruc_dni || '061625'}</strong> • {tallerConfig.ciudad_origen}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-2xl border border-white/10">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Despachos Completados</span>
            <strong className="text-lg font-black text-emerald-400 font-mono">{deliveredCount} entregas</strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-lg font-bold">
            🏆
          </div>
        </div>
      </div>

      {/* --- SECCIÓN EVOLUTION WHATSAPP MASTER & MULTI-TENANT --- */}
      <EvolutionWhatsAppManager />

      {/* --- SECCIÓN 0: LECTOR DE VOZ YAPE NATIVO (WAKELOCK + TTS) --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-2xl space-y-4 shadow-xl">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>Lector de Pagos Yape por Voz</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Nativo Android
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Anuncia los pagos de Yape por altavoz en tiempo real, incluso con la pantalla apagada o la app cerrada.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
            <span>⚙️ Requisito indispensable de Android:</span>
          </div>
          <p className="leading-relaxed">
            Debes otorgar el permiso de <strong>Acceso a Notificaciones</strong> a la app Encomi. Al tocar el botón de abajo se abrirá la configuración del sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={() => yapeReaderService.requestPermission()}
          className="w-full py-3 px-5 rounded-2xl bg-linear-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Volume2 className="w-4 h-4" />
          <span>Activar / Abrir Ajustes de Acceso a Notificaciones</span>
        </button>
      </div>

      {/* --- SECCIÓN 0: LINK OFICIAL ÚNICO PARA CLIENTES --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl">
              <Link className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Link Oficial para Clientes (Nuevos & Recurrentes)</h3>
              <p className="text-xs text-slate-300">
                Comparte este link único. Al ingresar, cualquier cliente (nuevo o con pedidos) irá directo a registrar su nuevo envío.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link de Registro'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs font-mono text-cyan-300 overflow-x-auto">
          <span className="truncate">{publicOrderUrl}</span>
          <span className="text-[10px] text-slate-500 shrink-0 font-sans uppercase font-bold">Enlace Único Oficial</span>
        </div>
      </div>

      {/* --- SECCIÓN REMITENTE: DATOS OFICIALES DE QUIEN ENVÍA (OLVA / SHALOM) --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-yellow-500/30 bg-yellow-950/15 backdrop-blur-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>Datos del Remitente Oficial (Olva Courier / Shalom)</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                Quien Envía
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Configura los datos del remitente que se utilizarán en las guías y comprobantes de Olva Courier y Shalom.
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
                placeholder="Comikids Envíos"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                🪪 DNI / RUC (Remitente)
              </label>
              <input
                type="text"
                required
                value={remitenteDni}
                onChange={e => setRemitenteDni(e.target.value)}
                placeholder="42020312"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-yellow-300 font-mono font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                📧 Correo Electrónico (Remitente)
              </label>
              <input
                type="email"
                required
                value={remitenteEmail}
                onChange={e => setRemitenteEmail(e.target.value)}
                placeholder="comikidsperu@gmail.com"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-yellow-400 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                📱 Celular / Teléfono (Remitente)
              </label>
              <input
                type="text"
                required
                value={remitenteCelular}
                onChange={e => setRemitenteCelular(e.target.value)}
                placeholder="927781412"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-yellow-300 font-mono font-bold focus:outline-none focus:border-yellow-400 shadow-inner"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <span className="text-[11px] text-slate-400">
              ✓ Estos datos se sincronizan automáticamente en el engranaje de ComiKids.
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

      {/* --- SECCIÓN HORARIO DE CORTE Y DÍAS DE DESPACHO --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-indigo-500/30 bg-indigo-950/10 backdrop-blur-2xl space-y-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Horario Límite de Envío Hoy & Días de Despacho</h3>
              <p className="text-xs text-slate-300">
                Controla el plazo máximo para enviar paquetes el mismo día y restringe la selección de fechas pasadas
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Regla de Corte Activa
          </span>
        </div>

        <form onSubmit={handleSaveCutoffSettings} className="space-y-4">
          {/* Hora de Corte + Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              ⏰ Hora Límite de Corte para Despachar Hoy *
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="time"
                required
                value={horaCorte}
                onChange={e => setHoraCorte(e.target.value)}
                className="px-4 py-2.5 bg-slate-950/90 border border-indigo-500/50 rounded-2xl text-sm font-mono font-bold text-indigo-200 focus:outline-none focus:border-indigo-400 shadow-inner"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {['12:00', '14:00', '16:00', '18:00', '20:00'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHoraCorte(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                      horaCorte === t
                        ? 'bg-indigo-600 text-white border border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {formatFriendlyTime(t)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Días Semanales Habilitados */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              📅 Días de la Semana con Envíos Habilitados
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[
                { key: 'lunes', label: 'Lunes' },
                { key: 'martes', label: 'Martes' },
                { key: 'miercoles', label: 'Miércoles' },
                { key: 'jueves', label: 'Jueves' },
                { key: 'viernes', label: 'Viernes' },
                { key: 'sabado', label: 'Sábado' },
                { key: 'domingo', label: 'Domingo' },
              ].map(day => {
                const currentDays = diasDespacho.map(d => d.toLowerCase());
                const isActive = currentDays.includes(day.key);

                const toggleDay = () => {
                  let updated: string[];
                  if (isActive) {
                    updated = currentDays.filter(d => d !== day.key);
                    if (updated.length === 0) updated = ['lunes'];
                  } else {
                    updated = [...currentDays, day.key];
                  }
                  setDiasDespacho(updated);
                };

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={toggleDay}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400'
                        : 'bg-white/4 text-slate-500 hover:text-slate-300 border border-white/8'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mensaje de Corte Personalizado */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              💬 Mensaje de Explicación al Cliente si se Supera el Corte (Opcional)
            </label>
            <textarea
              rows={2}
              value={mensajeCorte}
              onChange={e => setMensajeCorte(e.target.value)}
              placeholder="Ej. El corte para envíos de hoy era hasta las 2:00 PM. Los nuevos pedidos se programan para el siguiente día hábil."
              className="w-full p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors shadow-inner"
            />
          </div>

          {/* Monitor en Vivo de Corte */}
          {(() => {
            const cutoffEval = evaluateShippingCutoff({
              hora_corte_envio_hoy: horaCorte,
              dias_despacho_activos: diasDespacho,
              despacho_domingo_habilitado: diasDespacho.includes('domingo'),
              mensaje_corte_personalizado: mensajeCorte,
            });
            return (
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cutoffEval.isPastCutoff ? '⏰' : '⚡'}</span>
                  <div>
                    <span className="font-bold text-white text-xs sm:text-sm block">
                      {cutoffEval.isPastCutoff ? 'Plazo de Hoy Finalizado' : 'Envíos para Hoy Disponibles'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Hora actual en Perú: <strong className="text-indigo-300 font-mono">{cutoffEval.currentTimeStr}</strong> • Corte: <strong className="text-amber-300 font-mono">{formatFriendlyTime(horaCorte)}</strong>
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
              ✓ Los formularios de clientes y el bot de WhatsApp respetarán automáticamente esta regla.
            </span>

            <button
              type="submit"
              className="py-2.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Reglas de Despacho</span>
            </button>
          </div>
        </form>

        {cutoffSuccessMsg && (
          <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
            ✓ {cutoffSuccessMsg}
          </p>
        )}
      </div>

      {/* --- SECCIÓN AVISO: MENSAJE PERSONALIZADO EN EL FORMULARIO --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-amber-500/30 bg-amber-950/10 backdrop-blur-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Aviso / Anuncio Público para Clientes</h3>
            <p className="text-xs text-slate-300">
              Personaliza el mensaje destacado que ven los clientes al abrir el formulario de despacho
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveAnuncio} className="space-y-3">
          <textarea
            rows={3}
            value={anuncioTexto}
            onChange={e => setAnuncioTexto(e.target.value)}
            placeholder="Ej. ¡Atención clientes! Recuerda que todos los pedidos registrados antes de las 4:00 PM salen en el despacho de hoy 🚚✨"
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

      {/* --- SECCIÓN 1: CÓDIGO MAESTRO DE ACCESO --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Número / Código de Acceso a la Empresa</h3>
            <p className="text-xs text-slate-400">
              Número secreto para acceder directamente al panel de administración desde la pantalla inicial
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
            Actualizar Código de Acceso
          </button>
        </form>

        {codeSuccessMsg && (
          <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 animate-fadeIn">
            ✓ {codeSuccessMsg}
          </p>
        )}
      </div>

      {/* --- SECCIÓN SEGURIDAD: CAMBIAR CONTRASEÑA DE LA CUENTA COMIKIDS --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-pink-500/30 bg-pink-950/10 backdrop-blur-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Seguridad & Contraseña de la Cuenta</h3>
              <p className="text-xs text-slate-300">
                Cambia la contraseña maestra de acceso para la cuenta de administración de ComiKids
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

      {/* --- SECCIÓN 2: COLABORADORES DE LA EMPRESA --- */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Equipo y Colaboradores del Taller</h3>
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

        {/* Add Collaborator Box */}
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
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30"
                >
                  Guardar Colaborador
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List of Collaborators */}
        {colaboradores.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-950/60 border border-white/5 text-center space-y-2">
            <p className="text-xs text-slate-500">No hay colaboradores registrados aún.</p>
            <button
              onClick={() => setShowAddColab(true)}
              className="text-xs text-purple-400 hover:underline font-bold"
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

      {/* --- SECCIÓN 3: LOGROS DE LA EMPRESA (HASTA 10,000 PEDIDOS) --- */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-6 shadow-2xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-amber-500/20">
              👑
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Logros & Hitos de Empresa (Meta 10,000 Pedidos)
              </h3>
              <p className="text-xs text-slate-400">
                Insignias oficiales de crecimiento corporativo alcanzadas por ComiKids
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/10">
            <span className="text-xs font-bold text-slate-400">Insignias Desbloqueadas:</span>
            <strong className="text-sm font-mono font-black text-amber-400">
              {unlockedCount} / {companyAchievements.length}
            </strong>
          </div>
        </div>

        {/* Milestones Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyAchievements.map(ach => (
            <div
              key={ach.id}
              className={`p-5 rounded-3xl border transition-all space-y-3 ${
                ach.unlocked
                  ? 'bg-linear-to-tr from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/10'
                  : 'bg-slate-950/60 border-white/6 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${
                    ach.unlocked ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {ach.unlocked ? '🏆' : '🔒'}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">{ach.titulo}</h4>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      Meta: {ach.meta_pedidos.toLocaleString()} pedidos
                    </span>
                  </div>
                </div>

                {ach.unlocked && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Completado
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {ach.descripcion}
              </p>

              {/* Progress mini bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Progreso:</span>
                  <span>{Math.min(deliveredCount, ach.meta_pedidos)} / {ach.meta_pedidos}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ach.unlocked ? 'bg-amber-400' : 'bg-slate-700'}`}
                    style={{ width: `${Math.min(100, Math.round((deliveredCount / ach.meta_pedidos) * 100))}%` }}
                  />
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>

      {/* Modal de Cambio de Contraseña */}
      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}

    </div>
  );
};
