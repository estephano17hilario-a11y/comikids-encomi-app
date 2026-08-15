import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario, UserRole } from '../types/database.types';
import { ordersService } from '../services/ordersService';
import confetti from 'canvas-confetti';

interface AuthContextType {
  currentUser: Usuario | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (dni: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (nombre: string, dni: string, edad: number, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (newPass: string) => Promise<boolean>;
  updateProfile: (updates: Partial<Usuario>) => Promise<boolean>;
  updateAdditionalData: (data: { genero?: 'masculino' | 'femenino' | 'otro'; edad?: number; motivo_compra?: 'uso_personal' | 'emprender' | 'empresa' }) => Promise<boolean>;
  refreshUser: () => void;
  triggerConfetti: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'incomi_auth_user_v2';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  const login = async (dni: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const result = await ordersService.loginUser(dni, pass);
    if (result.user) {
      setCurrentUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error || 'Error al iniciar sesión' };
  };

  const register = async (nombre: string, dni: string, edad: number, pass: string): Promise<{ success: boolean; error?: string }> => {
    const result = await ordersService.registerUser(nombre, dni, edad, pass);
    if (result.user) {
      setCurrentUser(result.user);
      triggerConfetti();
      return { success: true };
    }
    return { success: false, error: result.error || 'Error al crear cuenta' };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('incomi_current_receipt_order');
    localStorage.removeItem('incomi_saved_phone');
    localStorage.removeItem('incomi_saved_fullname');
    localStorage.removeItem('incomi_saved_doc');
    localStorage.removeItem('incomi_saved_district');
    localStorage.removeItem('incomi_saved_address');
    localStorage.removeItem('incomi_saved_reference');
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  const updatePassword = async (newPass: string): Promise<boolean> => {
    if (!currentUser) return false;
    const ok = await ordersService.changePassword(currentUser.id, newPass);
    if (ok) {
      setCurrentUser(prev => prev ? { ...prev, password_hash: newPass } : null);
    }
    return ok;
  };

  const updateProfile = async (updates: Partial<Usuario>): Promise<boolean> => {
    if (!currentUser) return false;
    const updated = await ordersService.updateUserProfile(currentUser.id, updates);
    if (updated) {
      setCurrentUser(updated);
      // Sincronizar con claves de autocompletado si existen
      if (updates.nombre_completo) localStorage.setItem('incomi_saved_fullname', updates.nombre_completo);
      if (updates.telefono_default) localStorage.setItem('incomi_saved_phone', updates.telefono_default);
      if (updates.dni_default) localStorage.setItem('incomi_saved_doc', updates.dni_default);
      if (updates.distrito_default) localStorage.setItem('incomi_saved_district', updates.distrito_default);
      if (updates.direccion_default) localStorage.setItem('incomi_saved_address', updates.direccion_default);
      if (updates.referencia_default) localStorage.setItem('incomi_saved_reference', updates.referencia_default);
      triggerConfetti();
      return true;
    }
    return false;
  };

  const updateAdditionalData = async (data: {
    genero?: 'masculino' | 'femenino' | 'otro';
    edad?: number;
    motivo_compra?: 'uso_personal' | 'emprender' | 'empresa';
  }): Promise<boolean> => {
    if (!currentUser) return false;
    const updates: Partial<Usuario> = {
      ...data,
      datos_adicionales_completados: true,
      puntos_xp: (currentUser.puntos_xp || 0) + (currentUser.datos_adicionales_completados ? 0 : 50),
    };
    const updated = await ordersService.updateUserProfile(currentUser.id, updates);
    if (updated) {
      setCurrentUser(updated);
      triggerConfetti();
      return true;
    }
    return false;
  };

  const refreshUser = () => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw));
      } catch {}
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.rol || null,
        isAuthenticated: Boolean(currentUser),
        login,
        register,
        logout,
        updatePassword,
        updateProfile,
        updateAdditionalData,
        refreshUser,
        triggerConfetti,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
