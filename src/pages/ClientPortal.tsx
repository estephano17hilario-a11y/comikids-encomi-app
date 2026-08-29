import React, { useState, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { ClientHUD } from '../components/client/ClientHUD';
import { ClientBottomNav, ClientSection } from '../components/client/ClientBottomNav';
import { OrganicOrderFlow } from '../components/client/OrganicOrderFlow';
import { OrderWizard } from '../components/client/OrderWizard';
import { OrderLiveTracker } from '../components/client/OrderLiveTracker';
import { GamificationCard } from '../components/client/GamificationCard';
import { EncomiAiSection } from '../components/client/EncomiAiSection';
import {
  PackagePlus,
  ClipboardList,
  Trophy,
  Package,
  Sparkles
} from 'lucide-react';

export const ClientPortal: React.FC = () => {
  const { pedidos } = useOrders();
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState<ClientSection>('crear_pedido');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'nuevo_envio' || urlParams.get('nuevo') === 'true') {
        localStorage.removeItem('incomi_current_receipt_order');
        setActiveSection('crear_pedido');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const myOrdersCount = pedidos.filter(p => p.usuario_id === currentUser?.id).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header / Player HUD */}
      {currentUser ? (
        <ClientHUD />
      ) : (
        <header className="glass-panel border-b border-cyan-500/20 px-4 pt-10 pb-4 sm:pt-12 sm:pb-4 sm:px-6 sticky top-0 z-10 backdrop-blur-xl shadow-lg transition-all">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Ícono de Encomi: Abre WhatsApp de Encomi directamente */}
              <a
                href="https://wa.me/51927781412?text=Hola%20Encomi%2C%20deseo%20m%C3%A1s%20informaci%C3%B3n%20sobre%20los%20env%C3%ADos"
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir WhatsApp oficial de Encomi"
                className="w-9 h-9 rounded-2xl bg-linear-to-tr from-cyan-500 via-blue-600 to-pink-500 flex items-center justify-center text-lg shadow-md shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                📦
              </a>

              {/* Nombre de Encomi: Redirige al Funnel */}
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/?funnel=encomi';
                }}
                title="Ir al Funnel oficial de Encomi"
                className="text-left cursor-pointer group"
              >
                <h1 className="text-base font-black text-white leading-tight group-hover:text-cyan-300 transition-colors">
                  Encomi
                </h1>
                <p className="text-[10px] text-slate-400 group-hover:text-slate-300">
                  Despacho de Mercadería (Shalom & Moto)
                </p>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-2xl text-sm sm:text-base font-black bg-linear-to-r from-pink-500/30 via-purple-500/30 to-cyan-500/30 text-pink-200 border-2 border-pink-400/50 flex items-center gap-2 shadow-xl shadow-pink-500/25 tracking-wide">
                <img src="/Comikids.png" alt="ComiKids" className="w-6 h-6 object-contain" />
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

              <button
                onClick={() => setActiveSection('encomi_ai')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeSection === 'encomi_ai'
                    ? 'bg-linear-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-cyan-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Encomi AI</span>
              </button>

            </div>
          </div>
        )}

        {/* Dynamic Section Content */}
        <div className="transition-all duration-300">
          {activeSection === 'crear_pedido' && (
            <OrganicOrderFlow />
          )}

          {activeSection === 'mis_pedidos' && (
            <OrderLiveTracker />
          )}

          {activeSection === 'mis_logros' && (
            <GamificationCard />
          )}

          {activeSection === 'encomi_ai' && (
            <EncomiAiSection />
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
