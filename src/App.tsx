import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { GeolocationProvider } from './context/GeolocationContext';
import { ClientPortal } from './pages/ClientPortal';
import { AdminPortal } from './pages/AdminPortal';
import { OrderAlertModal } from './components/common/OrderAlertModal';

const MainAppContent: React.FC = () => {
  const { role } = useAuth();

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
