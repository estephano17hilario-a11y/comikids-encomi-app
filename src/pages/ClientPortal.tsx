import React, { useState } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { ClientHUD } from '../components/client/ClientHUD';
import { ClientBottomNav, ClientSection } from '../components/client/ClientBottomNav';
import { OrderWizard } from '../components/client/OrderWizard';
import { OrderLiveTracker } from '../components/client/OrderLiveTracker';
import { GamificationCard } from '../components/client/GamificationCard';
import {
  PackagePlus,
  ClipboardList,
  Trophy,
  Package
} from 'lucide-react';

export const ClientPortal: React.FC = () => {
  const { pedidos } = useOrders();
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState<ClientSection>('crear_pedido');

  const myOrdersCount = pedidos.filter(p => p.usuario_id === currentUser?.id).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header / Player HUD */}
      {currentUser ? (
        <ClientHUD />
      ) : (
        <header className="glass-panel border-b border-cyan-500/20 px-4 py-3 sm:px-6 sticky top-0 z-40 backdrop-blur-xl shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-lg shadow-md shadow-cyan-500/20">
                📦
              </div>
              <div>
                <h1 className="text-base font-black text-white leading-tight">Encomi</h1>
                <p className="text-[10px] text-slate-400">Despacho de Mercadería (Shalom & Moto)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-2xl text-sm sm:text-base font-black bg-linear-to-r from-pink-500/30 via-purple-500/30 to-cyan-500/30 text-pink-200 border-2 border-pink-400/50 flex items-center gap-2 shadow-xl shadow-pink-500/25 tracking-wide">
                <span className="text-base sm:text-lg">📦</span>
                <span>ComiKids</span>
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Main Container con Espacios Optimizados */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 py-2 sm:py-3 pb-20 sm:pb-10 space-y-3.5">
        
        {/* Desktop Section Switcher Tabs */}
        {currentUser && (
          <div className="hidden sm:flex items-center justify-center">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
              
              <button
                onClick={() => setActiveSection('crear_pedido')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeSection === 'crear_pedido'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PackagePlus className="w-4 h-4" />
                <span>Nuevo Envío</span>
              </button>

              <button
                onClick={() => setActiveSection('mis_pedidos')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all relative ${
                  activeSection === 'mis_pedidos'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Mis Envíos</span>
                {myOrdersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-purple-600">
                    {myOrdersCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSection('mis_logros')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeSection === 'mis_logros'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Mis Logros & XP</span>
              </button>

            </div>
          </div>
        )}

        {/* Dynamic Section Content */}
        <div className="transition-all duration-300">
          {activeSection === 'crear_pedido' && (
            <OrderWizard onSuccess={() => setActiveSection('mis_pedidos')} />
          )}

          {activeSection === 'mis_pedidos' && (
            <OrderLiveTracker />
          )}

          {activeSection === 'mis_logros' && (
            <GamificationCard />
          )}
        </div>

      </main>

      {/* Mobile Bottom Navigation Dashboard */}
      {currentUser && (
        <ClientBottomNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          ordersCount={myOrdersCount}
        />
      )}

    </div>
  );
};
