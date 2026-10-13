import React, { useState, useEffect, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
// Las pestañas pesadas (gráficos, Yape, agencias, ajustes) se cargan al abrirlas
const ClientDirectory = lazy(() => import('../components/admin/ClientDirectory').then(m => ({ default: m.ClientDirectory })));
const VisionAnalyticsDashboard = lazy(() => import('../components/admin/VisionAnalyticsDashboard').then(m => ({ default: m.VisionAnalyticsDashboard })));
const CompanyAccountSettings = lazy(() => import('../components/admin/CompanyAccountSettings').then(m => ({ default: m.CompanyAccountSettings })));
const CompanyAgenciesTab = lazy(() => import('../components/admin/CompanyAgenciesTab').then(m => ({ default: m.CompanyAgenciesTab })));
const CompanyAchievementsTab = lazy(() => import('../components/admin/CompanyAchievementsTab').then(m => ({ default: m.CompanyAchievementsTab })));
const YapeSection = lazy(() => import('../modules/yape/YapeSection').then(m => ({ default: m.YapeSection })));
import { yapeReaderService } from '../services/yapeReaderService';
const EncomiAiSection = lazy(() => import('../components/client/EncomiAiSection').then(m => ({ default: m.EncomiAiSection })));
import { OrganicOrderFlow } from '../components/client/OrganicOrderFlow';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { ExecutiveBriefingModal } from '../components/admin/ExecutiveBriefingModal';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { Pedido } from '../types/database.types';
import { applyFuturisticTheme } from '../data/futuristicThemes';
import {
  ClipboardList,
  Users,
  BarChart3,
  Smartphone,
  Settings,
  LogOut,
  Sparkles,
  FileBarChart,
  Plus,
  X,
  Truck
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'estadisticas' | 'inventario' | 'agencias' | 'hitos' | 'ajustes' | 'encomi_ai';

export const AdminPortal: React.FC = () => {
  const { pedidos, tallerConfig, refreshData } = useOrders();
  const { currentEmpresa, empresaConfig, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');

  // Aplicar tema futurista guardado para la empresa
  useEffect(() => {
    const savedTheme = currentEmpresa?.tema_fondo || tallerConfig.tema_fondo || localStorage.getItem('incomi_futuristic_theme') || 'nspace';
    applyFuturisticTheme(savedTheme);
  }, [currentEmpresa?.tema_fondo, tallerConfig.tema_fondo]);

  const companyName = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'ComiKids';
  const sec = empresaConfig?.secciones_activas || {
    pedidos: true,
    agendas: true,
    estadisticas: true,
    inventario: true,
    agencias: true,
    hitos: true,
    ajustes: true,
    encomi_ai: true,
  };
  
  // El modo TikTok Live se eliminó junto con el inventario: si quedó una sesión abierta,
  // se cierra y se apaga el modo live del lector nativo de Yape (si no, seguiría marcando pagos como "Live").
  useEffect(() => {
    try {
      const raw = localStorage.getItem('incomi_live_session_state_v1');
      if (raw) {
        localStorage.removeItem('incomi_live_session_state_v1');
        if (JSON.parse(raw)?.isLive) yapeReaderService.setLiveMode(false);
      }
    } catch {
      // sin acceso a localStorage: nada que limpiar
    }
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

  const dockItems: { id: EmpresaTab; label: string; short?: string; icon: React.ElementType; activeClass: string; badge?: number }[] = [
    { id: 'pedidos' as EmpresaTab, label: 'Pedidos', icon: ClipboardList, activeClass: 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30', badge: pendingOrdersCount, visible: sec.pedidos !== false },
    { id: 'agendas' as EmpresaTab, label: 'Clientes', icon: Users, activeClass: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30', visible: sec.agendas !== false },
    { id: 'estadisticas' as EmpresaTab, label: 'Métricas', icon: BarChart3, activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/30', visible: sec.estadisticas !== false },
    { id: 'inventario' as EmpresaTab, label: 'Yape', icon: Smartphone, activeClass: 'bg-purple-600 text-white shadow-md shadow-purple-600/30', visible: Boolean(sec.inventario) && !empresaConfig?.desactivar_yape },
    { id: 'agencias' as EmpresaTab, label: 'Agencias', icon: Truck, activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30', visible: sec.agencias !== false },
    { id: 'encomi_ai' as EmpresaTab, label: 'IA', icon: Sparkles, activeClass: 'bg-linear-to-r from-purple-600 to-cyan-500 text-white shadow-md shadow-cyan-500/30', visible: sec.encomi_ai !== false },
  ].filter(item => item.visible);

  const isAnyAdminModalOpen = Boolean(
    showCreateOrderModal ||
    briefingConfig.show ||
    showLogoutConfirm ||
    showConfigModal
  );

  useEffect(() => {
    if (isAnyAdminModalOpen) {
      document.body.classList.add('has-active-modal');
      return () => {
        document.body.classList.remove('has-active-modal');
      };
    }
  }, [isAnyAdminModalOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Encabezado: marca + acciones principales */}
      <header className="w-full bg-slate-950/70 border-b border-white/10 px-3.5 sm:px-8 pt-safe-header pb-3 sticky top-0 z-30 backdrop-blur-2xl print:hidden shadow-xl app-top-header admin-top-header" data-no-print="true">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">

          {/* Marca */}
          <div className="flex items-center gap-2.5 min-w-0">
            {tallerConfig.logo_url ? (
              <img
                src={tallerConfig.logo_url}
                alt=""
                className="w-10 h-10 rounded-2xl object-cover bg-slate-900 border border-white/10 shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-lg shadow-lg shadow-cyan-500/25 shrink-0" aria-hidden="true">
                📦
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  {companyName}
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {pendingOrdersCount > 0
                  ? `${pendingOrdersCount} ${pendingOrdersCount === 1 ? 'pedido activo' : 'pedidos activos'}`
                  : 'Todo al día ✨'}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="min-h-10 px-3 sm:px-4 rounded-2xl bg-linear-to-tr from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs sm:text-sm font-black border border-pink-400/40 shadow-md shadow-pink-500/25 transition-all active:scale-95 flex items-center gap-1.5"
              title="Registrar un nuevo pedido"
            >
              <Plus className="w-4 h-4 stroke-[2.75]" />
              <span>Nuevo<span className="hidden sm:inline"> pedido</span></span>
            </button>

            <button
              onClick={() => setBriefingConfig({ show: true, mode: 'manual' })}
              className="min-h-10 min-w-10 px-2.5 sm:px-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              title="Informe del día"
              aria-label="Informe del día"
            >
              <FileBarChart className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Informe del día</span>
            </button>

            {sec.ajustes !== false && (
              <button
                onClick={() => setActiveTab('ajustes')}
                aria-current={activeTab === 'ajustes' ? 'page' : undefined}
                className={`min-h-10 min-w-10 flex items-center justify-center rounded-2xl border transition-all ${
                  activeTab === 'ajustes'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                }`}
                title="Ajustes de la empresa"
                aria-label="Ajustes de la empresa"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="min-h-10 min-w-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main
        className={`flex-1 w-full max-w-7xl mx-auto space-y-4 pb-32 print:hidden transition-all ${
          activeTab === 'inventario'
            ? 'px-2 sm:px-4 py-3'
            : activeTab === 'pedidos'
            ? 'px-3 sm:px-6 pt-1.5 sm:pt-2.5 pb-24'
            : 'px-4 sm:px-8 py-6'
        }`}
        data-no-print="true"
      >
        
        {/* Dynamic Section Rendering */}
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm" role="status">
              <span className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" aria-hidden="true" />
              <span>Cargando sección…</span>
            </div>
          }
        >
        <div className="transition-all duration-300">
          {activeTab === 'pedidos' && sec.pedidos !== false && <OrdersSmartManager />}
          {activeTab === 'agendas' && sec.agendas !== false && <ClientDirectory />}
          {activeTab === 'estadisticas' && sec.estadisticas !== false && <VisionAnalyticsDashboard />}
          {activeTab === 'inventario' && sec.inventario && !empresaConfig?.desactivar_yape && <YapeSection />}
          {activeTab === 'agencias' && sec.agencias !== false && (
            <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
              <CompanyAgenciesTab />
            </div>
          )}
          {activeTab === 'hitos' && sec.hitos !== false && <CompanyAchievementsTab />}
          {activeTab === 'ajustes' && sec.ajustes !== false && <CompanyAccountSettings />}
          {activeTab === 'encomi_ai' && sec.encomi_ai !== false && <EncomiAiSection isAdmin={true} />}
        </div>
        </Suspense>

      </main>

      {/* Barra de navegación inferior (celular y computadora) */}
      <nav
        aria-label="Secciones del panel"
        className="fixed bottom-safe left-0 right-0 mx-auto z-40 w-[calc(100%-1rem)] sm:w-11/12 max-w-3xl animate-slideUp print:hidden admin-floating-dock"
        data-no-print="true"
      >
        <div className="p-1.5 rounded-3xl bg-slate-950/90 border border-white/15 backdrop-blur-3xl shadow-2xl shadow-black/50 flex items-stretch justify-between gap-1">
          {dockItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 min-w-0 min-h-13 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-2 rounded-2xl text-[10.5px] sm:text-xs font-bold transition-all ${
                  isActive ? item.activeClass : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                  {item.badge ? (
                    <span className={`sm:hidden absolute -top-1.5 -right-3 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-black text-center ${
                      isActive ? 'bg-slate-950 text-cyan-300' : 'bg-cyan-500 text-slate-950'
                    }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate max-w-full leading-none tracking-tight">
                  <span className="sm:hidden">{item.short || item.label}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
                {item.badge ? (
                  <span className={`hidden sm:inline px-1.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-slate-950/80 text-cyan-300' : 'bg-cyan-500/25 text-cyan-300'
                  }`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
          <div role="dialog" aria-modal="true" aria-label="Registrar nuevo pedido" className="relative w-full max-w-2xl max-h-[96dvh] sm:max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-slate-950 border border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-scaleUp">
            {/* Header Modal */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-base">
                  📦
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Registrar nuevo pedido
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {companyName} • Shalom, Olva y motorizado
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateOrderModal(false);
                  refreshData();
                }}
                className="min-w-10 min-h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Cerrar"
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
