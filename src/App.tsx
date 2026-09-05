import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { GeolocationProvider } from './context/GeolocationContext';
import { ClientPortal } from './pages/ClientPortal';
import { AdminPortal } from './pages/AdminPortal';
import { OrderAlertModal } from './components/common/OrderAlertModal';
import { EncomiFunnelLanding } from './components/funnel/EncomiFunnelLanding';

import { MatrixPortal } from './pages/MatrixPortal';

const MainAppContent: React.FC = () => {
  const { role, impersonatedEmpresa, stopImpersonation } = useAuth();

  // Detección de ruta para el Funnel Interactivo Encomi 2026
  const isFunnelRoute = typeof window !== 'undefined' && (
    window.location.search.includes('funnel=encomi') ||
    window.location.search.includes('funnel=true') ||
    window.location.pathname === '/encomi' ||
    window.location.hash.includes('encomi') ||
    window.location.hash.includes('funnel')
  );

  if (isFunnelRoute) {
    return <EncomiFunnelLanding />;
  }

  // 1. Si el rol es Matrix y no está impersonando una empresa, mostrar la central Matrix
  if (role === 'matrix' && !impersonatedEmpresa) {
    return <MatrixPortal />;
  }

  // 2. Si el rol es empresa (o está impersonando una empresa desde Matrix)
  if (role === 'empresa') {
    return (
      <>
        {impersonatedEmpresa && (
          <aside aria-label="Banner de modo Matrix Master" className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-3 shadow-2xl backdrop-blur-md animate-bounce">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>⚡ Modo Matrix Master: Administrando <strong>{impersonatedEmpresa.nombre}</strong></span>
            </span>
            <button
              onClick={stopImpersonation}
              className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Volver a Matrix Central
            </button>
          </aside>
        )}
        <AdminPortal />
        <OrderAlertModal />
      </>
    );
  }

  // Clientes y usuarios regulares solo ven el portal de envíos sin alertas administrativas
  return (
    <ClientPortal />
  );
};

export function App() {
  return (
    <GeolocationProvider>
      <AuthProvider>
        <OrderProvider>
          <MainAppContent />
        </OrderProvider>
      </AuthProvider>
    </GeolocationProvider>
  );
}

export default App;
