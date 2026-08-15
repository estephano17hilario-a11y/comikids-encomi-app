import React, { useState } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { OrdersSmartManager } from '../components/admin/OrdersSmartManager';
import { ClientDirectory } from '../components/admin/ClientDirectory';
import { ShippingAgenciesManager } from '../components/admin/ShippingAgenciesManager';
import { VisionAnalyticsDashboard } from '../components/admin/VisionAnalyticsDashboard';
import { CompanyAccountSettings } from '../components/admin/CompanyAccountSettings';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import {
  ClipboardList,
  Users,
  Layers,
  BarChart3,
  Store,
  Settings,
  LogOut,
  Sparkles,
  Shield
} from 'lucide-react';

export type EmpresaTab = 'pedidos' | 'agendas' | 'agencias' | 'estadisticas' | 'cuenta';

export const AdminPortal: React.FC = () => {
  const { pedidos, masterCode } = useOrders();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('pedidos');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const pendingOrdersCount = pedidos.filter(p => p.estado_envio !== 'entregado').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Vision Glassmorphism Header */}
      <header className="w-full bg-slate-950/80 border-b border-white/[0.08] px-4 py-3 sm:px-8 sticky top-0 z-40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/25">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  ComiKids Almacén
                </h1>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                  Empresa Matriz
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden xs:block">
                Clave de Acceso: {masterCode}
              </p>
            </div>
          </div>

          {/* Desktop Big Tabs (Apple Vision Style) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-white/[0.04] p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-inner">
            
            {/* 1. Pedidos To-Do */}
            <button
              onClick={() => setActiveTab('pedidos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'pedidos'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Pedidos To-Do</span>
              {pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950 text-cyan-300">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            {/* 2. Agendas CRM */}
            <button
              onClick={() => setActiveTab('agendas')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'agendas'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Agendas & Caseras</span>
            </button>

            {/* 3. Agencias & Rutas */}
            <button
              onClick={() => setActiveTab('agencias')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'agencias'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Agencias & Envíos</span>
            </button>

            {/* 4. Estadísticas Vision */}
            <button
              onClick={() => setActiveTab('estadisticas')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'estadisticas'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Estadísticas Vision</span>
            </button>

            {/* 5. Cuenta ComiKids */}
            <button
              onClick={() => setActiveTab('cuenta')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'cuenta'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Cuenta ComiKids</span>
            </button>

          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Mobile Horizontal Sub-Nav */}
        <div className="flex lg:hidden items-center bg-white/[0.05] p-1.5 rounded-2xl border border-white/10 overflow-x-auto gap-1 text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'pedidos' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            📋 Pedidos ({pendingOrdersCount})
          </button>

          <button
            onClick={() => setActiveTab('agendas')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'agendas' ? 'bg-purple-600 text-white font-black' : 'text-slate-400'
            }`}
          >
            👥 Agendas
          </button>

          <button
            onClick={() => setActiveTab('agencias')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'agencias' ? 'bg-pink-600 text-white font-black' : 'text-slate-400'
            }`}
          >
            🚚 Agencias
          </button>

          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'estadisticas' ? 'bg-blue-600 text-white font-black' : 'text-slate-400'
            }`}
          >
            📊 Estadísticas
          </button>

          <button
            onClick={() => setActiveTab('cuenta')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'cuenta' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            ⚙️ Cuenta
          </button>
        </div>

        {/* Dynamic Section Rendering */}
        <div className="transition-all duration-300">
          {activeTab === 'pedidos' && <OrdersSmartManager />}
          {activeTab === 'agendas' && <ClientDirectory />}
          {activeTab === 'agencias' && <ShippingAgenciesManager />}
          {activeTab === 'estadisticas' && <VisionAnalyticsDashboard />}
          {activeTab === 'cuenta' && <CompanyAccountSettings />}
        </div>

      </main>

      {/* Taller Config Modal */}
      {showConfigModal && (
        <TallerConfigModal onClose={() => setShowConfigModal(false)} />
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
