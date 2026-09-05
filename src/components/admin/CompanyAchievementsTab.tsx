import React from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Crown, Award, Flame, Gem, Sparkles, CheckCircle2 } from 'lucide-react';

export const CompanyAchievementsTab: React.FC = () => {
  const { companyAchievements, pedidos, tallerConfig } = useOrders();
  const { currentEmpresa } = useAuth();

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const unlockedCount = companyAchievements.filter(a => a.unlocked).length;
  const companyName = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids';

  return (
    <div className="space-y-6 animate-fadeIn pb-24 text-slate-100 max-w-6xl mx-auto">
      
      {/* Header Hitos y Logros */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-950 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-amber-500/25">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Logros & Hitos de {companyName}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Meta 10,000 Envíos
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Insignias oficiales de volumen y crecimiento corporativo alcanzadas por la empresa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-2xl border border-amber-500/25 shrink-0 shadow-inner">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Insignias Desbloqueadas</span>
            <strong className="text-base sm:text-lg font-black text-amber-400 font-mono">
              {unlockedCount} / {companyAchievements.length}
            </strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
            👑
          </div>
        </div>
      </div>

      {/* KPI Resumen de Progreso */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/8 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Entregas</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{deliveredCount.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/8 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Próximo Objetivo</span>
            <span className="text-sm font-black text-cyan-300">
              {companyAchievements.find(a => !a.unlocked)?.titulo || '¡Todos Completados! 🎉'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/8 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nivel de Reputación</span>
            <span className="text-2xl font-black text-amber-300 font-mono">
              {deliveredCount >= 5000 ? 'Diamante 💎' : deliveredCount >= 1000 ? 'Oro 🥇' : deliveredCount >= 200 ? 'Plata 🥈' : 'Bronce 🥉'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid de Insignias e Hitos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companyAchievements.map(ach => (
          <div
            key={ach.id}
            className={`p-6 rounded-3xl border transition-all space-y-3 relative overflow-hidden ${
              ach.unlocked
                ? 'bg-gradient-to-tr from-amber-500/15 via-slate-900/90 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/10'
                : 'bg-slate-950/60 border-white/6 opacity-65'
            }`}
          >
            {ach.unlocked && (
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />
            )}

            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-md ${
                  ach.unlocked ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-500'
                }`}>
                  {ach.unlocked ? '🏆' : '🔒'}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{ach.titulo}</h4>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    Meta: {ach.meta_pedidos.toLocaleString()} pedidos
                  </span>
                </div>
              </div>

              {ach.unlocked && (
                <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  Desbloqueado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed min-h-[36px]">
              {ach.descripcion}
            </p>

            {/* Barra de Progreso */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Progreso hacia la meta:</span>
                <span className="font-bold text-white">
                  {Math.min(deliveredCount, ach.meta_pedidos).toLocaleString()} / {ach.meta_pedidos.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 border border-white/6 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ach.unlocked ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-slate-700'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((deliveredCount / ach.meta_pedidos) * 100))}%` }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
