import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Pedido, MetodoEnvio, TallerConfig, EstadoProduccion, EstadoEnvio } from '../types/database.types';
import { ordersService } from '../services/ordersService';
import { soundService } from '../services/soundService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

interface OrderContextType {
  pedidos: Pedido[];
  shippingMethods: MetodoEnvio[];
  activeShippingMethods: MetodoEnvio[];
  tallerConfig: TallerConfig;
  loading: boolean;
  createPedido: (data: Omit<Pedido, 'id' | 'codigo_seguimiento' | 'created_at' | 'estado_produccion' | 'estado_envio'>) => Promise<Pedido>;
  updateEstadoProduccion: (pedidoId: string, nuevoEstado: EstadoProduccion) => Promise<Pedido | null>;
  updateEstadoEnvio: (pedidoId: string, nuevoEstado: EstadoEnvio) => Promise<Pedido | null>;
  addShippingMethod: (method: Omit<MetodoEnvio, 'id'>) => MetodoEnvio;
  updateShippingMethod: (id: string, updates: Partial<MetodoEnvio>) => void;
  deleteShippingMethod: (id: string) => void;
  updateTallerConfig: (config: Partial<TallerConfig>) => void;
  refreshData: () => Promise<void>;
  latestNewOrder: Pedido | null;
  clearLatestOrderAlert: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, role } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [shippingMethods, setShippingMethods] = useState<MetodoEnvio[]>(ordersService.getShippingMethods());
  const [tallerConfig, setTallerConfig] = useState<TallerConfig>(ordersService.getTallerConfig());
  const [loading, setLoading] = useState<boolean>(true);
  const [latestNewOrder, setLatestNewOrder] = useState<Pedido | null>(null);

  const refreshData = useCallback(async () => {
    try {
      // If empresa, get all orders. If client, get only their orders
      const userId = role === 'empresa' ? undefined : currentUser?.id;
      const fetched = await ordersService.getPedidos(userId);
      setPedidos(fetched);
      setShippingMethods(ordersService.getShippingMethods());
      setTallerConfig(ordersService.getTallerConfig());
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, role]);

  useEffect(() => {
    refreshData();

    if (isSupabaseConfigured && supabase) {
      const activeSupabase = supabase;
      const channel = activeSupabase
        .channel('incomi_realtime_v2')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pedidos' },
          async (payload) => {
            soundService.playNewOrderAlert();
            await refreshData();
            if (payload.new) {
              setLatestNewOrder(payload.new as Pedido);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pedidos' },
          async () => {
            await refreshData();
          }
        )
        .subscribe();

      return () => {
        activeSupabase.removeChannel(channel);
      };
    }
  }, [refreshData]);

  const handleCreatePedido = async (data: Omit<Pedido, 'id' | 'codigo_seguimiento' | 'created_at' | 'estado_produccion' | 'estado_envio'>) => {
    const created = await ordersService.createPedido(data);
    soundService.playNewOrderAlert();
    setLatestNewOrder(created);
    await refreshData();
    return created;
  };

  const handleUpdateEstadoProduccion = async (pedidoId: string, nuevoEstado: EstadoProduccion) => {
    const updated = await ordersService.updateEstadoProduccion(pedidoId, nuevoEstado);
    if (updated) {
      soundService.playStatusChangeSuccess();
      await refreshData();
    }
    return updated;
  };

  const handleUpdateEstadoEnvio = async (pedidoId: string, nuevoEstado: EstadoEnvio) => {
    const updated = await ordersService.updateEstadoEnvio(pedidoId, nuevoEstado);
    if (updated) {
      soundService.playStatusChangeSuccess();
      await refreshData();
    }
    return updated;
  };

  const handleAddShippingMethod = (method: Omit<MetodoEnvio, 'id'>) => {
    const newM = ordersService.addShippingMethod(method);
    setShippingMethods(ordersService.getShippingMethods());
    return newM;
  };

  const handleUpdateShippingMethod = (id: string, updates: Partial<MetodoEnvio>) => {
    ordersService.updateShippingMethod(id, updates);
    setShippingMethods(ordersService.getShippingMethods());
  };

  const handleDeleteShippingMethod = (id: string) => {
    ordersService.deleteShippingMethod(id);
    setShippingMethods(ordersService.getShippingMethods());
  };

  const handleUpdateTallerConfig = (config: Partial<TallerConfig>) => {
    const updated = ordersService.saveTallerConfig(config);
    setTallerConfig(updated);
  };

  const clearLatestOrderAlert = () => {
    setLatestNewOrder(null);
  };

  const activeShippingMethods = shippingMethods.filter(m => m.activo);

  return (
    <OrderContext.Provider
      value={{
        pedidos,
        shippingMethods,
        activeShippingMethods,
        tallerConfig,
        loading,
        createPedido: handleCreatePedido,
        updateEstadoProduccion: handleUpdateEstadoProduccion,
        updateEstadoEnvio: handleUpdateEstadoEnvio,
        addShippingMethod: handleAddShippingMethod,
        updateShippingMethod: handleUpdateShippingMethod,
        deleteShippingMethod: handleDeleteShippingMethod,
        updateTallerConfig: handleUpdateTallerConfig,
        refreshData,
        latestNewOrder,
        clearLatestOrderAlert
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders debe utilizarse dentro de OrderProvider');
  }
  return context;
};
