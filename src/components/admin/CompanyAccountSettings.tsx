import React, { useState } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Colaborador, CompanyAchievement } from '../../types/database.types';
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
  Package
} from 'lucide-react';

export const CompanyAccountSettings: React.FC = () => {
  const {
    tallerConfig,
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

  // State for Add Collaborator
  const [showAddColab, setShowAddColab] = useState(false);
  const [colabNombre, setColabNombre] = useState('');
  const [colabRol, setColabRol] = useState<Colaborador['rol']>('embalaje');
  const [colabTelefono, setColabTelefono] = useState('');
  const [colabEmail, setColabEmail] = useState('');

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const nextAchievement = companyAchievements.find(a => !a.unlocked);
  const unlockedCount = companyAchievements.filter(a => a.unlocked).length;

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
                {tallerConfig.nombre_taller || 'Comikids Bordados & Estilo'}
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
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Rol en el Taller</label>
                <select
                  value={colabRol}
                  onChange={e => setColabRol(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="administrador">Administrador Matriz</option>
                  <option value="embalaje">Embalaje y Preparación</option>
                  <option value="atencion">Atención WhatsApp</option>
                  <option value="motorizado">Motorizado de Ruta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono / Celular</label>
                <input
                  type="text"
                  placeholder="Ej. 912 345 678"
                  value={colabTelefono}
                  onChange={e => setColabTelefono(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddColab(false)}
                  className="py-2.5 px-4 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black"
                >
                  Guardar Colaborador
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Collaborator Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colaboradores.map(colab => {
            const roleBadge = colab.rol === 'administrador'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              : colab.rol === 'embalaje'
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              : colab.rol === 'motorizado'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

            return (
              <div
                key={colab.id}
                className="p-5 rounded-3xl glass-panel border border-white/10 space-y-3 shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-white">{colab.nombre}</h4>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${roleBadge}`}>
                        {colab.rol}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteColaborador(colab.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Eliminar Colaborador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {colab.telefono && (
                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{colab.telefono}</span>
                    </p>
                  )}
                </div>

                <span className="text-[10px] text-emerald-400 font-bold">
                  ● Cuenta activa
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- SECCIÓN 3: LOGROS DE LA EMPRESA (HASTA 10,000 PEDIDOS) --- */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 backdrop-blur-2xl space-y-6 shadow-2xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-amber-500/20">
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
                  ? 'bg-gradient-to-tr from-amber-500/15 via-slate-900 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/10'
                  : 'bg-slate-950/60 border-white/[0.06] opacity-60'
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

    </div>
  );
};
