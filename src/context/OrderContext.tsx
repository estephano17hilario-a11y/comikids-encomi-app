import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  Pedido,
  MetodoEnvio,
  TallerConfig,
  EstadoProduccion,
  EstadoEnvio,
  Colaborador,
  CompanyAchievement,
  MotorizadoDistrictConfig,
  ShalomAgency
} from '../types/database.types';
import { ordersService } from '../services/ordersService';
import { soundService } from '../services/soundService';
import { NativeNotificationService } from '../services/nativeNotificationService';
import { WidgetService } from '../services/widgetService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

interface OrderContextType {
  pedidos: Pedido[];
  shippingMethods: MetodoEnvio[];
  activeShippingMethods: MetodoEnvio[];
  tallerConfig: TallerConfig;
  colaboradores: Colaborador[];
  motorizadoDistricts: MotorizadoDistrictConfig[];
  customShalomAgencies: ShalomAgency[];
  companyAchievements: CompanyAchievement[];
  masterCode: string;
  loading: boolean;
  createPedido: (data: Omit<Pedido, 'id' | 'codigo_seguimiento' | 'created_at' | 'estado_produccion' | 'estado_envio'>) => Promise<Pedido>;
  updatePedido: (pedidoId: string, updates: Partial<Pedido>) => Promise<Pedido | null>;
  deletePedido: (pedidoId: string) => Promise<boolean>;
  deleteMultiplePedidos: (pedidoIds: string[]) => Promise<boolean>;
  updateMultipleEstados: (pedidoIds: string[], estadoEnvio: EstadoEnvio, estadoProduccion?: EstadoProduccion) => Promise<void>;
  updateEstadoProduccion: (pedidoId: string, nuevoEstado: EstadoProduccion) => Promise<Pedido | null>;
  updateEstadoEnvio: (pedidoId: string, nuevoEstado: EstadoEnvio) => Promise<Pedido | null>;
  addShippingMethod: (method: Omit<MetodoEnvio, 'id'>) => MetodoEnvio;
  updateShippingMethod: (id: string, updates: Partial<MetodoEnvio>) => void;
  deleteShippingMethod: (id: string) => void;
  saveColaborador: (colab: Omit<Colaborador, 'id' | 'created_at'> & { id?: string }) => void;
  deleteColaborador: (id: string) => void;
  saveMasterCode: (code: string) => boolean;
  saveCustomShalomAgency: (agency: ShalomAgency) => void;
  deleteCustomShalomAgency: (id: string | number) => void;
  saveMotorizadoDistrict: (district: MotorizadoDistrictConfig) => void;
  updateTallerConfig: (config: Partial<TallerConfig>) => void;
  deleteUser: (userId: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  latestNewOrder: Pedido | null;
  clearLatestOrderAlert: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, role, currentEmpresa, impersonatedEmpresa } = useAuth();
  const activeEmpresaId = currentEmpresa?.id || (role === 'empresa' ? currentUser?.id : 'empresa-master-comikids');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [shippingMethods, setShippingMethods] = useState<MetodoEnvio[]>(() => ordersService.getShippingMethods(activeEmpresaId));
  const [tallerConfig, setTallerConfig] = useState<TallerConfig>(() => ordersService.getTallerConfig(activeEmpresaId, currentEmpresa));
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(() => ordersService.getColaboradores(activeEmpresaId));
  const [motorizadoDistricts, setMotorizadoDistricts] = useState<MotorizadoDistrictConfig[]>(() => ordersService.getMotorizadoDistricts(activeEmpresaId));
  const [customShalomAgencies, setCustomShalomAgencies] = useState<ShalomAgency[]>(() => ordersService.getCustomShalomAgencies(activeEmpresaId));
  const [masterCode, setMasterCodeState] = useState<string>(ordersService.getMasterCode());
  const [loading, setLoading] = useState<boolean>(true);
  const [latestNewOrder, setLatestNewOrder] = useState<Pedido | null>(null);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const companyAchievements = ordersService.getCompanyAchievements(deliveredCount);

  const refreshData = useCallback(async () => {
    try {
      // If empresa, get orders for that specific empresa. If client, get only their personal orders
      const isEmpresaRole = role === 'empresa' || Boolean(impersonatedEmpresa);
      const userId = isEmpresaRole ? undefined : currentUser?.id;
      const userDni = isEmpresaRole ? undefined : currentUser?.dni;
      const empresaFilterId = isEmpresaRole ? activeEmpresaId : undefined;

      const fetched = await ordersService.getPedidos(empresaFilterId, userId, userDni);
      setPedidos(fetched);
      setShippingMethods(ordersService.getShippingMethods(activeEmpresaId));
      setTallerConfig(ordersService.getTallerConfig(activeEmpresaId, currentEmpresa));
      setColaboradores(ordersService.getColaboradores(activeEmpresaId));
      setMotorizadoDistricts(ordersService.getMotorizadoDistricts(activeEmpresaId));
      setCustomShalomAgencies(ordersService.getCustomShalomAgencies(activeEmpresaId));
      setMasterCodeState(ordersService.getMasterCode());

      // Sincronizar Widget Nativo de Android con contadores y tarjetas de pedidos
      const almacenCount = fetched.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length;
      const alistandoCount = fetched.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length;
      const rutaCount = fetched.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length;

      const activePendingOrders = fetched
        .filter(p => p.estado_envio !== 'entregado')
        .slice(0, 5)
        .map(p => ({
          codigo: p.codigo_seguimiento,
          nombre: p.usuario?.nombre_completo || 'Cliente',
          telefono: p.usuario?.telefono_default || (p.usuario as any)?.telefono || '',
          destino: p.destino_detalle || 'Destino',
          estado: p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')
            ? 'En Ruta'
            : p.estado_produccion === 'bordando'
            ? 'Alistando'
            : 'Almacén'
        }));

      WidgetService.updateCounts(almacenCount, alistandoCount, rutaCount, activePendingOrders);

      // Detectar nuevos pedidos que llegaron desde otro dispositivo
      if (!isInitialLoadRef.current) {
        const nowMs = Date.now();
        const newOrders = fetched.filter(p => 
          !knownOrderIdsRef.current.has(p.id) &&
          (p.created_at ? (nowMs - new Date(p.created_at).getTime() < 120000) : false)
        );
        if (newOrders.length > 0) {
          soundService.playNewOrderAlert();
          for (const newP of newOrders) {
            setLatestNewOrder(newP);
            NativeNotificationService.notifyNewOrder(
              newP.codigo_seguimiento,
              newP.usuario?.nombre_completo || 'Cliente',
              newP.destino_detalle || 'Destino'
            );
          }
        }
      } else {
        isInitialLoadRef.current = false;
      }

      knownOrderIdsRef.current = new Set(fetched.map(p => p.id));

      // Sincronizar configuración del taller en la nube para la empresa activa
      const remoteTallerConfig = await ordersService.fetchTallerConfig(activeEmpresaId, currentEmpresa);
      if (remoteTallerConfig) {
        setTallerConfig(remoteTallerConfig);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, currentUser?.dni, role, activeEmpresaId, currentEmpresa, impersonatedEmpresa]);


  useEffect(() => {
    NativeNotificationService.requestPermissions();
    refreshData();

    // Eventos de entrada/salida de la app (cambio de visibilidad y focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // BroadcastChannel para sincronización instantánea (0ms) entre pestañas y dispositivos
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('incomi_orders_sync_channel');
        broadcastChannel.onmessage = async (event) => {
          if (event.data?.type === 'NEW_ORDER') {
            const incomingOrder = event.data?.pedido;
            // Solo alertar si el pedido pertenece a la empresa activa
            if (!incomingOrder?.empresa_id || incomingOrder.empresa_id === activeEmpresaId) {
              soundService.playNewOrderAlert();
              await refreshData();
              if (incomingOrder) {
                setLatestNewOrder(incomingOrder);
              }
            }
          } else if (event.data?.type === 'UPDATE_ORDER') {
            await refreshData();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel fallback:', e);
    }

    // Polling de sincronización periódica cada 10 segundos
    const fastSyncInterval = setInterval(() => {
      refreshData();
    }, 10000);

    // Supabase Realtime Channel
    let activeChannel: any = null;
    if (isSupabaseConfigured && supabase) {
      const activeSupabase = supabase;
      activeChannel = activeSupabase
        .channel('incomi_realtime_orders_v5')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pedidos' },
          async (payload) => {
            const newP = payload.new as Pedido;
            if (!newP?.empresa_id || newP.empresa_id === activeEmpresaId) {
              soundService.playNewOrderAlert();
              await refreshData();
              if (newP) {
                setLatestNewOrder(newP);
                NativeNotificationService.notifyNewOrder(
                  newP.codigo_seguimiento,
                  newP.usuario?.nombre_completo || 'Cliente',
                  newP.destino_detalle || 'Destino'
                );
              }
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
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'pedidos' },
          async () => {
            await refreshData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'taller_config' },
          async () => {
            const remoteConfig = await ordersService.fetchTallerConfig(activeEmpresaId, currentEmpresa);
            if (remoteConfig) {
              setTallerConfig(remoteConfig);
            }
          }
        )
        .subscribe();

    }

    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(fastSyncInterval);
      if (broadcastChannel) broadcastChannel.close();
      if (activeChannel && supabase) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [refreshData, activeEmpresaId]);

  const handleCreatePedido = async (data: Omit<Pedido, 'id' | 'codigo_seguimiento' | 'created_at' | 'estado_produccion' | 'estado_envio'>) => {
    const payloadWithEmpresa = {
      ...data,
      empresa_id: data.empresa_id || activeEmpresaId || 'empresa-master-comikids',
    };
    const created = await ordersService.createPedido(payloadWithEmpresa);
    soundService.playNewOrderAlert();
    NativeNotificationService.notifyNewOrder(
      created.codigo_seguimiento,
      created.usuario?.nombre_completo || 'Cliente',
      created.destino_detalle || 'Destino'
    );

    // Notificar instantáneamente a todas las pestañas abiertas
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('incomi_orders_sync_channel');
        bc.postMessage({ type: 'NEW_ORDER', pedido: created });
        bc.close();
      }
    } catch {}

    setPedidos(prev => [created, ...prev.filter(p => p.id !== created.id)]);
    setLatestNewOrder(created);
    // Sincronizar en segundo plano sin demorar la respuesta inmediata al usuario
    refreshData().catch(e => console.warn('Background refreshData warn:', e));
    return created;
  };

  const handleUpdatePedido = async (pedidoId: string, updates: Partial<Pedido>) => {
    const updated = await ordersService.updatePedido(pedidoId, updates);
    if (updated) {
      soundService.playStatusChangeSuccess();
      await refreshData();
    }
    return updated;
  };

  const handleDeletePedido = async (pedidoId: string) => {
    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    const ok = await ordersService.deletePedido(pedidoId);
    if (ok) {
      soundService.playStatusChangeSuccess();
      await refreshData();
    }
    return ok;
  };

  const handleDeleteMultiplePedidos = async (pedidoIds: string[]) => {
    const setIds = new Set(pedidoIds);
    setPedidos(prev => prev.filter(p => !setIds.has(p.id)));
    const ok = await ordersService.deleteMultiplePedidos(pedidoIds);
    if (ok) {
      soundService.playStatusChangeSuccess();
      await refreshData();
    }
    return ok;
  };

  const handleUpdateMultipleEstados = async (pedidoIds: string[], estadoEnvio: EstadoEnvio, estadoProduccion?: EstadoProduccion) => {
    await ordersService.updateMultipleEstados(pedidoIds, estadoEnvio, estadoProduccion);
    soundService.playStatusChangeSuccess();
    await refreshData();
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
    const newM = ordersService.addShippingMethod(method, activeEmpresaId);
    setShippingMethods(ordersService.getShippingMethods(activeEmpresaId));
    return newM;
  };

  const handleUpdateShippingMethod = (id: string, updates: Partial<MetodoEnvio>) => {
    ordersService.updateShippingMethod(id, updates, activeEmpresaId);
    setShippingMethods(ordersService.getShippingMethods(activeEmpresaId));
  };

  const handleDeleteShippingMethod = (id: string) => {
    ordersService.deleteShippingMethod(id, activeEmpresaId);
    setShippingMethods(ordersService.getShippingMethods(activeEmpresaId));
  };

  const handleSaveColaborador = (colab: Omit<Colaborador, 'id' | 'created_at'> & { id?: string }) => {
    ordersService.saveColaborador(colab, activeEmpresaId);
    setColaboradores(ordersService.getColaboradores(activeEmpresaId));
  };

  const handleDeleteColaborador = (id: string) => {
    ordersService.deleteColaborador(id, activeEmpresaId);
    setColaboradores(ordersService.getColaboradores(activeEmpresaId));
  };

  const handleSaveMasterCode = (code: string) => {
    const ok = ordersService.setMasterCode(code);
    if (ok) setMasterCodeState(code);
    return ok;
  };

  const handleSaveCustomShalomAgency = (agency: ShalomAgency) => {
    ordersService.saveCustomShalomAgency(agency, activeEmpresaId);
    setCustomShalomAgencies(ordersService.getCustomShalomAgencies(activeEmpresaId));
  };

  const handleDeleteCustomShalomAgency = (id: string | number) => {
    ordersService.deleteCustomShalomAgency(id, activeEmpresaId);
    setCustomShalomAgencies(ordersService.getCustomShalomAgencies(activeEmpresaId));
  };

  const handleSaveMotorizadoDistrict = (district: MotorizadoDistrictConfig) => {
    ordersService.saveMotorizadoDistrict(district, activeEmpresaId);
    setMotorizadoDistricts(ordersService.getMotorizadoDistricts(activeEmpresaId));
  };

  const handleUpdateTallerConfig = async (config: Partial<TallerConfig>) => {
    const updated = await ordersService.saveTallerConfig(config, activeEmpresaId);
    setTallerConfig(updated);
    await refreshData();
  };


  const handleDeleteUser = async (userId: string): Promise<boolean> => {
    const success = await ordersService.deleteUser(userId);
    if (success) {
      await refreshData();
    }
    return success;
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
        colaboradores,
        motorizadoDistricts,
        customShalomAgencies,
        companyAchievements,
        masterCode,
        loading,
        createPedido: handleCreatePedido,
        updatePedido: handleUpdatePedido,
        deletePedido: handleDeletePedido,
        deleteMultiplePedidos: handleDeleteMultiplePedidos,
        updateMultipleEstados: handleUpdateMultipleEstados,
        updateEstadoProduccion: handleUpdateEstadoProduccion,
        updateEstadoEnvio: handleUpdateEstadoEnvio,
        addShippingMethod: handleAddShippingMethod,
        updateShippingMethod: handleUpdateShippingMethod,
        deleteShippingMethod: handleDeleteShippingMethod,
        saveColaborador: handleSaveColaborador,
        deleteColaborador: handleDeleteColaborador,
        saveMasterCode: handleSaveMasterCode,
        saveCustomShalomAgency: handleSaveCustomShalomAgency,
        deleteCustomShalomAgency: handleDeleteCustomShalomAgency,
        saveMotorizadoDistrict: handleSaveMotorizadoDistrict,
        updateTallerConfig: handleUpdateTallerConfig,
        deleteUser: handleDeleteUser,
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
