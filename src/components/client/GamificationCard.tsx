import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { calculateLevel, ACHIEVEMENTS_CATALOG } from '../../data/achievementsList';
import { Sparkles, Award, Lock, PackageCheck, Flame, Star, Zap, Truck, Package, Crown, Gem, Trophy, Rocket } from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Package,
  Zap,
  Truck,
  Crown,
  Gem,
  Trophy,
  Star,
  Rocket
};

export const GamificationCard: React.FC = () => {
  const { currentUser, triggerConfetti } = useAuth();
  const { pedidos } = useOrders();

  const xp = currentUser?.puntos_xp || 0;
  const levelInfo = calculateLevel(xp);
  const myOrdersCount = pedidos.filter(p => p.usuario_id === currentUser?.id).length;

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
              {currentUser?.nombre_completo || 'Clienta'} • Has completado <strong className="text-cyan-400 font-mono text-sm">{myOrdersCount}</strong> {myOrdersCount === 1 ? 'envío' : 'envíos'}
            </p>
          </div>

          <button
            onClick={triggerConfetti}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-amber-300 text-sm font-black transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="font-mono">{xp} XP</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400">Progreso de Rango</span>
            <span className="text-cyan-400 font-mono">
              {levelInfo.progressPercent}% ({levelInfo.xpToNext > 0 ? `Faltan ${levelInfo.xpToNext} XP` : '¡Rango Máximo!'})
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
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Award className="w-4 h-4 text-cyan-400" />
            Insignias de Despacho (Hitos)
          </h4>
          <span className="text-xs font-mono font-bold text-cyan-400">
            {ACHIEVEMENTS_CATALOG.filter(a => (a.reqCount ? myOrdersCount >= a.reqCount : xp >= a.puntosXp)).length} / {ACHIEVEMENTS_CATALOG.length} Desbloqueados
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {ACHIEVEMENTS_CATALOG.map((ach) => {
            const req = ach.reqCount || 1;
            const isUnlocked = ach.reqCount ? myOrdersCount >= ach.reqCount : xp >= ach.puntosXp;
            const remaining = Math.max(0, req - myOrdersCount);
            const progressPercent = Math.min(100, Math.round((myOrdersCount / req) * 100));
            const IconComponent = ICON_MAP[ach.icono] || PackageCheck;

            return (
              <div
                key={ach.codigo}
                className={`minimal-card p-5 transition-all flex flex-col sm:flex-row sm:items-center gap-4 ${
                  isUnlocked ? 'border-cyan-500/30 shadow-lg bg-cyan-500/[0.03]' : 'opacity-65'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      isUnlocked
                        ? `bg-gradient-to-tr ${ach.badgeColor} text-white shadow-cyan-500/25`
                        : 'bg-white/[0.05] text-slate-500 border border-white/10'
                    }`}
                  >
                    {isUnlocked ? <IconComponent className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                        <span>{ach.titulo}</span>
                        {isUnlocked && (
                          <span className="px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                            ✓ Desbloqueado
                          </span>
                        )}
                      </p>
                      <span className="text-xs font-mono font-black text-amber-300 shrink-0">+{ach.puntosXp} XP</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ach.descripcion}</p>

                    {!isUnlocked && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Progreso: <strong className="text-white font-mono">{myOrdersCount} / {req}</strong> envíos</span>
                          <span className="text-cyan-400 font-semibold">Faltan {remaining} {remaining === 1 ? 'envío' : 'envíos'}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
