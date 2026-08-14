import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { calculateLevel } from '../../data/achievementsList';
import { Sparkles, LogOut, Flame } from 'lucide-react';
import { LogoutConfirmModal } from '../common/LogoutConfirmModal';

export const ClientHUD: React.FC = () => {
  const { currentUser, logout, triggerConfetti } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  if (!currentUser) return null;

  const xp = currentUser.puntos_xp || 0;
  const levelInfo = calculateLevel(xp);

  return (
    <>
      <header className="w-full bg-slate-950/80 border-b border-white/[0.08] px-4 py-4 sm:px-8 sticky top-0 z-40 backdrop-blur-2xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          
          {/* Avatar + Name */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={currentUser.avatar_url}
                alt={currentUser.nombre_completo}
                className="w-13 h-13 rounded-2xl object-cover border border-white/20 shadow-xl"
              />
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-lg bg-cyan-500 text-white text-[10px] font-black shadow-md">
                Nv.{levelInfo.nivel}
              </span>
            </div>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                {currentUser.nombre_completo}
              </h2>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>📱 {currentUser.dni}</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-semibold">{levelInfo.nombre}</span>
              </p>
            </div>
          </div>

          {/* Brand & XP & Logout */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl text-sm sm:text-base font-black bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-cyan-500/30 text-pink-200 border-2 border-pink-400/50 shadow-xl shadow-pink-500/25">
              <span className="text-base sm:text-lg">🧵</span>
              <span>ComiKids</span>
            </span>

            <button
              onClick={triggerConfetti}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-amber-300 text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-sm"
              title="Celebrar mis puntos XP"
            >
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="font-mono font-black">{xp} XP</span>
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </header>

      {showLogoutModal && (
        <LogoutConfirmModal
          onConfirm={() => {
            setShowLogoutModal(false);
            logout();
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
};
