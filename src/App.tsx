import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
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

  // By default, everyone (new visitor or logged in client) sees the seamless organic portal
  return (
    <>
      <ClientPortal />
      <OrderAlertModal />
    </>
  );
};

export function App() {
  return (
    <AuthProvider>
      <OrderProvider>
        <MainAppContent />
      </OrderProvider>
    </AuthProvider>
  );
}

export default App;
