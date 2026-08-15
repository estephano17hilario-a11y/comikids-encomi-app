import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
import { ClientDirectory } from '../components/admin/ClientDirectory';
import { VisionAnalyticsDashboard } from '../components/admin/VisionAnalyticsDashboard';
import { CompanyAccountSettings } from '../components/admin/CompanyAccountSettings';
import { EncomiAiSection } from '../components/client/EncomiAiSection';
import { OrganicOrderFlow } from '../components/client/OrganicOrderFlow';
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
  Plus,
  X
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'estadisticas' | 'comikids' | 'encomi_ai';

export const AdminPortal: React.FC = () => {
  const { pedidos, masterCode, tallerConfig, refreshData } = useOrders();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
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
      <header className="w-full bg-slate-950/90 border-b border-white/[0.08] px-3.5 sm:px-8 pt-8 pb-3 sm:pt-9 sm:pb-3.5 sticky top-0 z-30 backdrop-blur-2xl print:hidden transition-all shadow-xl" data-no-print="true">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-lg sm:text-xl shadow-lg shadow-cyan-500/25 shrink-0">
              📦
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  ComiKids
                </h1>
                <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase bg-pink-500/15 text-pink-300 border border-pink-500/20 shrink-0">
                  Panel Matriz
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                Clave: {masterCode}
              </p>
            </div>
          </div>

          {/* Quick Header Actions - Exactly on the same horizontal axis line */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Botón Circular + para Añadir Nuevo Pedido (Exclusivo ComiKids) */}
            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-linear-to-tr from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white border border-pink-400/40 shadow-md shadow-pink-500/25 transition-all cursor-pointer active:scale-90 flex items-center justify-center shrink-0"
              title="Registrar nuevo pedido (Interfaz clásica de cliente)"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            </button>

            <button
              onClick={() => setShowBriefingModal(true)}
              className="py-2 px-2.5 sm:px-3 rounded-2xl bg-linear-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Ver Informe Ejecutivo de Despachos"
            >
              <FileBarChart className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="hidden md:inline text-xs">Informe del Día</span>
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Configurar Datos del Remitente"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer shrink-0"
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

      {/* Modal Clásico de Registro de Pedido para ComiKids (Directo y Sin Salir) */}
      {showCreateOrderModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
          <div className="relative w-full max-w-2xl max-h-[92vh] rounded-3xl bg-slate-950 border border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
            {/* Header Modal */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-base">
                  📦
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Registrar Nuevo Envío (ComiKids)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Interfaz de despacho oficial para Shalom y Motorizado
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateOrderModal(false);
                  refreshData();
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Clásico de Registro */}
            <div className="flex-1 p-3 sm:p-5 overflow-y-auto bg-slate-950/80">
              <OrganicOrderFlow
                onSuccess={() => {
                  setShowCreateOrderModal(false);
                  refreshData();
                }}
              />
            </div>
          </div>
        </div>,
        document.body
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
