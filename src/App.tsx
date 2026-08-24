import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { GeolocationProvider } from './context/GeolocationContext';
import { ClientPortal } from './pages/ClientPortal';
import { AdminPortal } from './pages/AdminPortal';
import { OrderAlertModal } from './components/common/OrderAlertModal';
import { EncomiFunnelLanding } from './components/funnel/EncomiFunnelLanding';

const MainAppContent: React.FC = () => {
  const { role } = useAuth();

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

  if (role === 'empresa') {
    return (
      <>
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
