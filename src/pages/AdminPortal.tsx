import React, { useState } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { KanbanBoard } from '../components/admin/KanbanBoard';
import { EmbroideryQueue } from '../components/admin/EmbroideryQueue';
import { ShippingMethodsManager } from '../components/admin/ShippingMethodsManager';
import { TallerConfigModal } from '../components/admin/TallerConfigModal';
import { ChangePasswordModal } from '../components/admin/ChangePasswordModal';
import {
  KanbanSquare,
  Boxes,
  Layers,
  Settings,
  KeyRound,
  LogOut,
  Store,
  Package
} from 'lucide-react';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';

export type EmpresaTab = 'kanban' | 'packages' | 'shipping' | 'settings';

export const AdminPortal: React.FC = () => {
  const { pedidos, shippingMethods } = useOrders();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<EmpresaTab>('kanban');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const pendingOrdersCount = pedidos.filter(p => p.estado_produccion === 'en_cola').length;
  const packagingCount = pedidos.filter(p => p.estado_produccion === 'bordando').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Minimalist Empresa Header */}
      <header className="w-full bg-slate-950/80 border-b border-white/[0.08] px-4 py-4 sm:px-8 sticky top-0 z-40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Comikids Almacén
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                  Empresa Master
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden xs:block">
                DNI: {currentUser?.dni}
              </p>
            </div>
          </div>

          {/* Desktop Big Tabs */}
          <div className="hidden md:flex items-center gap-2 bg-white/[0.04] p-1.5 rounded-2xl border border-white/10">
            
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all relative ${
                activeTab === 'kanban'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KanbanSquare className="w-4 h-4" />
              <span>Tablero To-Do</span>
              {pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-cyan-600 shadow">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('packages')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all relative ${
                activeTab === 'packages'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Cola de Embalaje</span>
              {packagingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-purple-600 shadow">
                  {packagingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('shipping')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'shipping'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Destinos de Envío</span>
            </button>

          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-amber-300 border border-white/10 transition-colors"
              title="Cambiar Contraseña Empresa"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-colors"
              title="Datos del Remitente Shalom"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2.5 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24 md:pb-12 space-y-6">
        
        {/* Mobile Sub-Nav */}
        <div className="flex md:hidden items-center justify-around bg-white/[0.05] p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-center ${
              activeTab === 'kanban' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400'
            }`}
          >
            Tablero ({pedidos.length})
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-center ${
              activeTab === 'packages' ? 'bg-purple-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Embalaje ({packagingCount})
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-center ${
              activeTab === 'shipping' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Destinos
          </button>
        </div>

        {/* Tab Views */}
        <div className="transition-all duration-300">
          {activeTab === 'kanban' && <KanbanBoard />}
          {activeTab === 'packages' && <EmbroideryQueue />}
          {activeTab === 'shipping' && <ShippingMethodsManager />}
        </div>

      </main>

      {/* Modals */}
      {showConfigModal && (
        <TallerConfigModal onClose={() => setShowConfigModal(false)} />
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

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
