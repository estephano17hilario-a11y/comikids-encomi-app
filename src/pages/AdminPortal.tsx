import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
import { ClientDirectory } from '../components/admin/ClientDirectory';
import { VisionAnalyticsDashboard } from '../components/admin/VisionAnalyticsDashboard';
import { CompanyAccountSettings } from '../components/admin/CompanyAccountSettings';
import { CompanyAchievementsTab } from '../components/admin/CompanyAchievementsTab';
import { ComicInventoryApp } from '../modules/comic_inventory/ComicInventoryApp';
import { liveSessionService, LiveSessionState } from '../services/liveSessionService';
import { EncomiAiSection } from '../components/client/EncomiAiSection';
import { OrganicOrderFlow } from '../components/client/OrganicOrderFlow';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { ExecutiveBriefingModal } from '../components/admin/ExecutiveBriefingModal';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { Pedido } from '../types/database.types';
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
  X,
  Trophy,
  Sliders
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'estadisticas' | 'inventario' | 'hitos' | 'ajustes' | 'encomi_ai';

export const AdminPortal: React.FC = () => {
  const { pedidos, masterCode, tallerConfig, refreshData } = useOrders();
  const { currentUser, currentEmpresa, empresaConfig, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');

  const companyName = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids';
  const sec = empresaConfig?.secciones_activas || {
    pedidos: true,
    agendas: true,
    estadisticas: true,
    inventario: true,
    hitos: true,
    ajustes: true,
    encomi_ai: true,
  };
  
  // Estado de sesión Live sincronizado
  const [liveState, setLiveState] = useState<LiveSessionState>(() => liveSessionService.getState());
  useEffect(() => {
    return liveSessionService.subscribe(setLiveState);
  }, []);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Estado Inteligente del Modal de Resumen / Briefing (Apertura manual vía botón de informe)
  const [briefingConfig, setBriefingConfig] = useState<{
    show: boolean;
    mode: 'new_orders' | 'daily_closing' | 'manual';
    newOrders?: Pedido[];
    referenceDate?: string;
  }>({ show: false, mode: 'manual' });


  const pendingOrdersCount = pedidos.filter(p => p.estado_envio !== 'entregado').length;


  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Vision Header */}
      <header className="w-full bg-slate-950/90 border-b border-white/8 px-3.5 sm:px-8 pt-8 pb-3 sm:pt-9 sm:pb-3.5 sticky top-0 z-30 backdrop-blur-2xl print:hidden transition-all shadow-xl" data-no-print="true">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-lg sm:text-xl shadow-lg shadow-cyan-500/25 shrink-0">
              📦
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  {companyName}
                </h1>
                {liveState.isLive ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                    En Live 🔴
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase bg-pink-500/15 text-pink-300 border border-pink-500/20 shrink-0">
                    Panel Empresa
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                {liveState.isLive ? `Live Activo • S/ ${liveState.revenue.toLocaleString()}` : 'Panel de Gestión'}
              </p>
            </div>
          </div>

          {/* Quick Header Actions - Exactly on the same horizontal axis line */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Botón Circular + para Añadir Nuevo Pedido */}
            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-linear-to-tr from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white border border-pink-400/40 shadow-md shadow-pink-500/25 transition-all cursor-pointer active:scale-90 flex items-center justify-center shrink-0"
              title="Registrar nuevo pedido (Interfaz clásica de cliente)"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            </button>

            <button
              onClick={() => setBriefingConfig({ show: true, mode: 'manual' })}
              className="py-2 px-2.5 sm:px-3 rounded-2xl bg-linear-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Ver Informe Ejecutivo de Despachos"
            >
              <FileBarChart className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="hidden md:inline text-xs">Informe del Día</span>
            </button>

            <button
              onClick={() => setActiveTab('ajustes')}
              className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 ${
                activeTab === 'ajustes'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Ajustes de la Empresa"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main
        className={`flex-1 w-full max-w-7xl mx-auto space-y-4 pb-28 print:hidden transition-all ${
          activeTab === 'inventario'
            ? 'px-2 sm:px-4 py-3'
            : activeTab === 'pedidos'
            ? 'px-3 sm:px-6 pt-1.5 sm:pt-2.5 pb-24'
            : 'px-4 sm:px-8 py-6'
        }`}
        data-no-print="true"
      >
        
        {/* Dynamic Section Rendering */}
        <div className="transition-all duration-300">
          {activeTab === 'pedidos' && sec.pedidos !== false && <OrdersSmartManager />}
          {activeTab === 'agendas' && sec.agendas !== false && <ClientDirectory />}
          {activeTab === 'estadisticas' && sec.estadisticas !== false && <VisionAnalyticsDashboard />}
          {activeTab === 'inventario' && sec.inventario && (
            <div>
              <ComicInventoryApp />
            </div>
          )}
          {activeTab === 'hitos' && sec.hitos !== false && <CompanyAchievementsTab />}
          {activeTab === 'ajustes' && sec.ajustes !== false && <CompanyAccountSettings />}
          {activeTab === 'encomi_ai' && sec.encomi_ai !== false && <EncomiAiSection isAdmin={true} />}
        </div>

      </main>

      {/* --- FLOATING APPLE VISION BOTTOM DOCK --- */}
      <div className="fixed bottom-3 sm:bottom-6 left-0 right-0 mx-auto z-40 w-[calc(100%-1.25rem)] sm:w-11/12 max-w-2xl animate-slideUp print:hidden admin-floating-dock" data-no-print="true">
        <div className="p-1 sm:p-1.5 rounded-2xl sm:rounded-3xl bg-slate-900/95 border border-white/15 backdrop-blur-3xl shadow-2xl shadow-cyan-500/20 flex items-center justify-between gap-1 overflow-x-auto">
          
          {/* 1. Pedidos To-Do */}
          {sec.pedidos !== false && (
            <button
              onClick={() => setActiveTab('pedidos')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'pedidos'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Pedidos</span>
              {pendingOrdersCount > 0 && (
                <span className={`px-1 py-0.2 rounded-full text-[9px] font-black shrink-0 ${
                  activeTab === 'pedidos' ? 'bg-slate-950 text-cyan-300' : 'bg-cyan-500/30 text-cyan-300'
                }`}>
                  {pendingOrdersCount}
                </span>
              )}
            </button>
          )}

          {/* 2. Agendas CRM */}
          {sec.agendas !== false && (
            <button
              onClick={() => setActiveTab('agendas')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'agendas'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Agendas</span>
            </button>
          )}

          {/* 3. Estadísticas Vision */}
          {sec.estadisticas !== false && (
            <button
              onClick={() => setActiveTab('estadisticas')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'estadisticas'
                  ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Métricas</span>
            </button>
          )}

          {/* 4. Inventario / Catálogo */}
          {sec.inventario && (
            <button
              onClick={() => setActiveTab('inventario')}
              className={`relative flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'inventario'
                  ? 'bg-linear-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Inventario</span>
              {liveState.isLive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-900"></span>
                </span>
              )}
            </button>
          )}

          {/* 5. Hitos y Logros de Empresa (Pestaña propia) */}
          {sec.hitos !== false && (
            <button
              onClick={() => setActiveTab('hitos')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'hitos'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-amber-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Hitos</span>
            </button>
          )}

          {/* 6. Ajustes de la Empresa (Reformulada) */}
          {sec.ajustes !== false && (
            <button
              onClick={() => setActiveTab('ajustes')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'ajustes'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">Ajustes</span>
            </button>
          )}

          {/* 7. Encomi AI (Admin Ilimitado) */}
          {sec.encomi_ai !== false && (
            <button
              onClick={() => setActiveTab('encomi_ai')}
              className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 sm:py-2.5 sm:px-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                activeTab === 'encomi_ai'
                  ? 'bg-linear-to-r from-purple-600 to-cyan-500 text-white shadow-md shadow-cyan-500/30'
                  : 'text-cyan-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
              <span className="truncate max-w-full">IA</span>
            </button>
          )}

        </div>
      </div>

      {/* Taller Config Modal */}
      {showConfigModal && (
        <TallerConfigModal onClose={() => setShowConfigModal(false)} />
      )}

      {/* Executive Briefing Modal (Al entrar si hay nuevos pedidos, a las 23:59 o bajo demanda) */}
      {briefingConfig.show && (
        <ExecutiveBriefingModal
          pedidos={pedidos}
          mode={briefingConfig.mode}
          newOrders={briefingConfig.newOrders}
          referenceDate={briefingConfig.referenceDate}
          onClose={() => setBriefingConfig(prev => ({ ...prev, show: false }))}
          onNavigateToOrders={() => {
            setBriefingConfig(prev => ({ ...prev, show: false }));
            setActiveTab('pedidos');
          }}
          onNavigateToStats={() => {
            setBriefingConfig(prev => ({ ...prev, show: false }));
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
