import React, { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
import { ClientDirectory } from '../components/admin/ClientDirectory';
import { VisionAnalyticsDashboard } from '../components/admin/VisionAnalyticsDashboard';
import { CompanyAccountSettings } from '../components/admin/CompanyAccountSettings';
import { EncomiAiSection } from '../components/client/EncomiAiSection';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { ExecutiveBriefingModal } from '../components/admin/ExecutiveBriefingModal';
import { QuickOrderModal } from '../components/admin/QuickOrderModal';
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
  PlusCircle
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'estadisticas' | 'comikids' | 'encomi_ai';

export const AdminPortal: React.FC = () => {
  const { pedidos, masterCode, tallerConfig } = useOrders();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
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
      <header className="w-full bg-slate-950/85 border-b border-white/[0.08] px-4 pt-10 pb-4 sm:pt-12 sm:pb-4 sm:px-8 sticky top-0 z-30 backdrop-blur-2xl print:hidden transition-all shadow-xl" data-no-print="true">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/25">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-tight">
                  ComiKids
                </h1>
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-pink-500/15 text-pink-300 border border-pink-500/20">
                  Panel Matriz
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden xs:block">
                Clave de Acceso: {masterCode}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            
            {/* Botón Chiquito para Añadir Nuevo Pedido Directamente desde ComiKids */}
            <button
              onClick={() => setShowQuickOrder(true)}
              className="py-2 px-3 sm:px-3.5 rounded-2xl bg-linear-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-pink-600/30 transition-all cursor-pointer active:scale-95"
              title="Añadir un nuevo pedido manualmente"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nuevo Pedido</span>
            </button>

            <button
              onClick={() => setShowBriefingModal(true)}
              className="py-2 px-3 rounded-2xl bg-linear-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ver Informe Ejecutivo de Despachos"
            >
              <FileBarChart className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Informe del Día</span>
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
          {activeTab === 'encomi_ai' && <EncomiAiSection isAdmin={true} />}
        </div>

      </main>

      {/* --- FLOATING APPLE VISION BOTTOM DOCK --- */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl animate-slideUp print:hidden" data-no-print="true">
        <div className="p-2 rounded-3xl bg-slate-900/90 border-2 border-white/15 backdrop-blur-3xl shadow-2xl shadow-cyan-500/20 flex items-center justify-around gap-1 sm:gap-2">
          
          {/* 1. Pedidos To-Do */}
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
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
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'agendas'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Agendas</span>
          </button>

          {/* 3. Estadísticas Vision */}
          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'estadisticas'
                ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Métricas</span>
          </button>

          {/* 4. Sección ComiKids */}
          <button
            onClick={() => setActiveTab('comikids')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'comikids'
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span className="truncate">ComiKids</span>
          </button>

          {/* 5. Encomi AI (Admin Ilimitado) */}
          <button
            onClick={() => setActiveTab('encomi_ai')}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
              activeTab === 'encomi_ai'
                ? 'bg-linear-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-105'
                : 'text-cyan-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="truncate">Encomi AI</span>
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

      {/* Quick Order Modal para Añadir Pedidos desde ComiKids */}
      {showQuickOrder && (
        <QuickOrderModal onClose={() => setShowQuickOrder(false)} />
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

    </div>
  );
};
