import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { calculateLevel } from '../../data/achievementsList';
import { Sparkles, LogOut, Edit3 } from 'lucide-react';
import { LogoutConfirmModal } from '../common/LogoutConfirmModal';
import { AdditionalDataModal } from './AdditionalDataModal';
import { EditProfileModal } from './EditProfileModal';

export const ClientHUD: React.FC = () => {
  const { currentUser, logout, triggerConfetti } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAdditionalDataModal, setShowAdditionalDataModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  if (!currentUser) return null;

  const xp = currentUser.puntos_xp || 0;
  const levelInfo = calculateLevel(xp);
  const hasCompletedAdditionalData = Boolean(currentUser.datos_adicionales_completados);

  return (
    <>
      <header className="w-full bg-slate-950/85 border-b border-white/8 px-4 pt-10 pb-4 sm:pt-12 sm:pb-4 sm:px-8 sticky top-0 z-40 backdrop-blur-2xl transition-all shadow-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Avatar + Name (Clickeable para editar perfil y predeterminados) */}
          <button
            type="button"
            onClick={() => setShowEditProfileModal(true)}
            className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 active:scale-[0.99] transition-all group cursor-pointer"
            title="Toca para editar tus datos predeterminados"
          >
            <div className="relative shrink-0">
              {currentUser.avatar_url && !currentUser.avatar_url.includes('unsplash') ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.nombre_completo}
                  className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl object-cover border border-cyan-400/40 group-hover:border-cyan-400 shadow-xl transition-colors bg-slate-900"
                />
              ) : (
                <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-indigo-600 border border-cyan-400/40 flex items-center justify-center text-white font-black text-base sm:text-lg shadow-xl shadow-cyan-500/20 group-hover:border-cyan-400 transition-all">
                  {(currentUser.nombre_completo || 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-lg bg-cyan-500 text-white text-[9px] sm:text-[10px] font-black shadow-md">
                Nv.{levelInfo.nivel}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-black text-white whitespace-nowrap tracking-tight group-hover:text-cyan-300 transition-colors">
                  {(() => {
                    const words = (currentUser.nombre_completo || '').trim().split(/\s+/);
                    return words.slice(0, 2).join(' ') || currentUser.nombre_completo;
                  })()}
                </h2>
                <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
              </div>
              <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1 mt-0.5 whitespace-nowrap">
                <span>✨ {levelInfo.nombre}</span>
              </p>
            </div>
          </button>

          {/* XP & Datos Adicionales & Logout */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Botón de Datos Adicionales con Urgencia o Modo Edición */}
            {!hasCompletedAdditionalData ? (
              <div className="relative flex flex-col items-center">
                {/* Tooltip "¡DALE CLICK!" */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
                  <div className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap shadow-lg shadow-amber-500/50">
                    ¡DALE CLICK! 👆
                  </div>
                  <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-amber-400" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdditionalDataModal(true)}
                  style={{ animationDuration: '0.5s' }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 border-2 border-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow-xl shadow-amber-500/50 active:scale-95 animate-pulse transition-all cursor-pointer ring-4 ring-amber-400/40"
                  title="¡Completar datos adicionales importantes!"
                >
                  <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center font-black text-xs shrink-0 shadow">
                    !
                  </span>
                  <span>DATOS</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdditionalDataModal(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Editar mis datos adicionales"
              >
                <span className="text-xs">📋</span>
                <span className="hidden sm:inline">Mis Datos</span>
              </button>
            )}

            {/* XP Badge */}
            <button
              type="button"
              onClick={triggerConfetti}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/9 border border-white/10 text-amber-300 text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Celebrar mis puntos XP"
            >
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="font-mono font-black">{xp} XP</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </header>

      {/* Modal de Datos Adicionales Importantes */}
      {showAdditionalDataModal && (
        <AdditionalDataModal onClose={() => setShowAdditionalDataModal(false)} />
      )}

      {/* Modal de Edición de Perfil & Predeterminados */}
      {showEditProfileModal && (
        <EditProfileModal onClose={() => setShowEditProfileModal(false)} />
      )}

      {/* Modal de Confirmación de Logout */}
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
