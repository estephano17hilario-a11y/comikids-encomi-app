import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { GeolocationProvider } from './context/GeolocationContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { ClientPortal } from './pages/ClientPortal';
import { OrderAlertModal } from './components/common/OrderAlertModal';

// Cada panel se descarga solo cuando se necesita: la clienta que registra un envío
// no baja el código del panel de empresa, Matrix ni la landing.
const AdminPortal = lazy(() => import('./pages/AdminPortal').then(m => ({ default: m.AdminPortal })));
const MatrixPortal = lazy(() => import('./pages/MatrixPortal').then(m => ({ default: m.MatrixPortal })));
const EncomiFunnelLanding = lazy(() => import('./components/funnel/EncomiFunnelLanding').then(m => ({ default: m.EncomiFunnelLanding })));

const ScreenLoading: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400 text-sm" role="status">
    <span className="w-9 h-9 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" aria-hidden="true" />
    <span>Cargando…</span>
  </div>
);

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
          <aside aria-label="Modo Matrix Master" className="fixed bottom-24 sm:bottom-auto sm:top-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.5rem)] sm:w-auto max-w-xl px-3 py-2 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="truncate">Administrando <strong>{impersonatedEmpresa.nombre}</strong></span>
            </span>
            <button
              onClick={stopImpersonation}
              className="min-h-9 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 shrink-0"
            >
              Volver a Matrix
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
    <FeedbackProvider>
      <GeolocationProvider>
        <AuthProvider>
          <OrderProvider>
            <Suspense fallback={<ScreenLoading />}>
              <MainAppContent />
            </Suspense>
          </OrderProvider>
        </AuthProvider>
      </GeolocationProvider>
    </FeedbackProvider>
  );
}

export default App;
