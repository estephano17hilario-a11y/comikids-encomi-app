import React, { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
import { ClientDirectory } from '../components/admin/ClientDirectory';
import { VisionAnalyticsDashboard } from '../components/admin/VisionAnalyticsDashboard';
import { CompanyAccountSettings } from '../components/admin/CompanyAccountSettings';
import { EncomiAiAdminMasterTab } from '../components/admin/EncomiAiAdminMasterTab';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { ExecutiveBriefingModal } from '../components/admin/ExecutiveBriefingModal';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import {
  ClipboardList,
  Users,
  BarChart3,
  Store,
  Settings,
  LogOut,
  Sparkles,
  FileBarChart,
  Crown,
  KeyRound
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'estadisticas' | 'comikids' | 'encomi_ai';

export const AdminPortal: React.FC = () => {
  const { pedidos, masterCode, saveMasterCode, tallerConfig } = useOrders();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass, setNewPass] = useState(masterCode);
  const [passSuccess, setPassSuccess] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Informe completo y profesional al entrar (una vez por sesión)
  const [showBriefingModal, setShowBriefingModal] = useState(() => {
    const hasSeen = sessionStorage.getItem('incomi_briefing_seen_v1');
    if (!hasSeen) {
      sessionStorage.setItem('incomi_briefing_seen_v1', 'true');
      return true;
    }
    return false;
  });

  const pendingOrdersCount = pedidos.filter(p => p.estado_envio !== 'entregado').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Vision Header */}
      <header className="w-full bg-slate-950/80 border-b border-white/[0.08] px-4 py-3 sm:px-8 sticky top-0 z-30 backdrop-blur-2xl print:hidden" data-no-print="true">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/25">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-tight">
                  {tallerConfig.nombre_taller || 'Encomi Envíos'}
                </h1>
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                  Empresa Matriz
                </span>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono hidden xs:flex items-center gap-1 cursor-pointer transition-colors"
                title="Haga clic para cambiar la clave de acceso"
              >
                <KeyRound className="w-3 h-3 text-cyan-400" />
                <span>Clave: {masterCode}</span>
                <span className="text-[9px] text-slate-500 underline">(Cambiar)</span>
              </button>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBriefingModal(true)}
              className="py-2 px-3 rounded-2xl bg-linear-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ver Informe Ejecutivo de Despachos"
            >
              <FileBarChart className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Informe del Día</span>
            </button>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-cyan-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Cambiar Contraseña de Acceso"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Configurar Datos del Remitente"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6 pb-28 print:hidden" data-no-print="true">
        
        {/* Dynamic Section Rendering */}
        <div className="transition-all duration-300">
          {activeTab === 'pedidos' && <OrdersSmartManager />}
          {activeTab === 'agendas' && <ClientDirectory />}
          {activeTab === 'estadisticas' && <VisionAnalyticsDashboard />}
          {activeTab === 'comikids' && <CompanyAccountSettings />}
          {activeTab === 'encomi_ai' && <EncomiAiAdminMasterTab />}
        </div>

      </main>

      {/* --- FLOATING APPLE VISION BOTTOM DOCK --- */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl animate-slideUp print:hidden" data-no-print="true">
        <div className="p-2 rounded-3xl bg-slate-900/90 border-2 border-white/15 backdrop-blur-3xl shadow-2xl shadow-cyan-500/20 flex items-center justify-around gap-1 sm:gap-2">
          
          {/* 1. Pedidos */}
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'pedidos'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="truncate">Pedidos</span>
            {pendingOrdersCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                activeTab === 'pedidos' ? 'bg-slate-950 text-cyan-300' : 'bg-cyan-500/30 text-cyan-300'
              }`}>
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* 2. Agendas CRM */}
          <button
            onClick={() => setActiveTab('agendas')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'agendas'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Clientas</span>
          </button>

          {/* 3. Estadísticas Vision */}
          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'estadisticas'
                ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Métricas</span>
          </button>

          {/* 4. ComiKids (Sección Oficial) */}
          <button
            onClick={() => setActiveTab('comikids')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'comikids'
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 scale-105'
                : 'text-pink-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span className="truncate">ComiKids</span>
          </button>

          {/* 5. Encomi AI Master (Ilimitado 👑) */}
          <button
            onClick={() => setActiveTab('encomi_ai')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'encomi_ai'
                ? 'bg-linear-to-r from-amber-500 to-purple-600 text-white shadow-lg shadow-amber-500/30 scale-105'
                : 'text-amber-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Crown className="w-4 h-4 shrink-0" />
            <span className="truncate">AI Master</span>
          </button>

        </div>
      </div>

      {/* Taller Config Modal */}
      {showConfigModal && (
        <TallerConfigModal onClose={() => setShowConfigModal(false)} />
      )}

      {/* Executive Briefing Modal (Al entrar o bajo demanda) */}
      {showBriefingModal && (
        <ExecutiveBriefingModal
          pedidos={pedidos}
          onClose={() => setShowBriefingModal(false)}
          onNavigateToOrders={() => {
            setShowBriefingModal(false);
            setActiveTab('pedidos');
          }}
          onNavigateToStats={() => {
            setShowBriefingModal(false);
            setActiveTab('estadisticas');
          }}
        />
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logout();
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {/* Cambiar Clave de Acceso Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border-2 border-cyan-500/50 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-black text-white">Cambiar Contraseña de Acceso</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Esta clave protege el acceso a la cuenta y panel de administración de ComiKids:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPass.trim()) return;
                saveMasterCode(newPass.trim());
                setPassSuccess('¡Contraseña de ComiKids actualizada exitosamente!');
                setTimeout(() => {
                  setPassSuccess('');
                  setShowPasswordModal(false);
                }, 2000);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Nueva clave..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/20 text-center font-mono text-lg text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
              />

              {passSuccess && (
                <p className="text-xs text-emerald-400 text-center font-bold bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  {passSuccess}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/20"
                >
                  Guardar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
