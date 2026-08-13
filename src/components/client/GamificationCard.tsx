import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { calculateLevel } from '../../data/achievementsList';
import { Sparkles, Award, Lock, Crown, PackageCheck, Flame, Truck } from 'lucide-react';

const LOGISTICS_ACHIEVEMENTS = [
  {
    codigo: 'primer_envio',
    titulo: 'Primer Envío 📦',
    descripcion: 'Registraste tu primer despacho de mercadería.',
    puntosXp: 50,
    badgeColor: 'from-cyan-500 to-blue-500'
  },
  {
    codigo: 'cliente_frecuente',
    titulo: 'Despachadora Frecuente 🚚',
    descripcion: 'Has realizado 5 envíos nacionales con nosotros.',
    puntosXp: 150,
    badgeColor: 'from-purple-500 to-indigo-500'
  },
  {
    codigo: 'incomi_lover',
    titulo: 'Socia de Élite 👑',
    descripcion: '¡10 despachos de mercadería impecables!',
    puntosXp: 300,
    badgeColor: 'from-amber-400 to-orange-500'
  }
];

export const GamificationCard: React.FC = () => {
  const { currentUser, triggerConfetti } = useAuth();

  const xp = currentUser?.puntos_xp || 0;
  const levelInfo = calculateLevel(xp);

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      
      {/* Header Card */}
      <div className="minimal-card p-6 sm:p-8 space-y-6">
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-cyan-500 text-white shadow-md flex items-center gap-1">
                <Flame className="w-4 h-4 fill-current" />
                Nivel {levelInfo.nivel}
              </span>
              <h3 className="text-xl font-black text-white">
                {levelInfo.nombre}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {currentUser?.nombre_completo || 'Clienta'} • Programa VIP de Envíos
            </p>
          </div>

          <button
            onClick={triggerConfetti}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-amber-300 text-sm font-black transition-all active:scale-95 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="font-mono">{xp} XP</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400">Progreso de Nivel</span>
            <span className="text-cyan-400 font-mono">
              {levelInfo.progressPercent}% ({levelInfo.xpToNext > 0 ? `Faltan ${levelInfo.xpToNext} XP` : '¡Máximo Nivel!'})
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-white/[0.05] overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-pink-500 transition-all duration-700 shadow-md shadow-cyan-500/30"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>

      </div>

      {/* Badges List */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-2 flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" />
          Insignias de Despacho
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {LOGISTICS_ACHIEVEMENTS.map((ach) => {
            const isUnlocked = xp >= ach.puntosXp;
            return (
              <div
                key={ach.codigo}
                className={`minimal-card p-5 transition-all flex items-center gap-4 ${
                  isUnlocked ? 'border-cyan-500/30 shadow-lg' : 'opacity-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isUnlocked
                      ? `bg-gradient-to-tr ${ach.badgeColor} text-white shadow-lg`
                      : 'bg-white/[0.05] text-slate-600'
                  }`}
                >
                  {isUnlocked ? <PackageCheck className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white truncate">{ach.titulo}</p>
                    <span className="text-xs font-mono font-black text-amber-300">+{ach.puntosXp} XP</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{ach.descripcion}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
