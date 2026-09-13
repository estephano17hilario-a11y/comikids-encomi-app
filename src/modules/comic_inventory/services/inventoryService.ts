import { Product, Category, HistoryItem, Session } from '../types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'comic_inventory_products_v2',
  CATEGORIES: 'comic_inventory_categories_v2',
  HISTORY: 'comic_inventory_history_v2',
  SESSIONS: 'comic_inventory_sessions_v2',
  PREFERENCES: 'comic_inventory_preferences_v2'
};

export class InventoryService {
  getProducts(empresaId?: string): Product[] {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.PRODUCTS}_${empresaId}`
      : STORAGE_KEYS.PRODUCTS;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    
    if (empresaId && empresaId !== 'empresa-master-comikids') {
      return [];
    }
    this.saveProducts(INITIAL_PRODUCTS, empresaId);
    return INITIAL_PRODUCTS;
  }

  saveProducts(products: Product[], empresaId?: string): void {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.PRODUCTS}_${empresaId}`
      : STORAGE_KEYS.PRODUCTS;
    try {
      localStorage.setItem(key, JSON.stringify(products));
    } catch (e) {
      console.warn('Error guardando productos en LocalStorage:', e);
    }
  }

  getCategories(empresaId?: string): Category[] {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.CATEGORIES}_${empresaId}`
      : STORAGE_KEYS.CATEGORIES;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    if (empresaId && empresaId !== 'empresa-master-comikids') {
      return [];
    }
    this.saveCategories(INITIAL_CATEGORIES, empresaId);
    return INITIAL_CATEGORIES;
  }

  saveCategories(categories: Category[], empresaId?: string): void {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.CATEGORIES}_${empresaId}`
      : STORAGE_KEYS.CATEGORIES;
    try {
      localStorage.setItem(key, JSON.stringify(categories));
    } catch (e) {
      console.warn('Error guardando categorías en LocalStorage:', e);
    }
  }

  getHistory(empresaId?: string): HistoryItem[] {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.HISTORY}_${empresaId}`
      : STORAGE_KEYS.HISTORY;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  saveHistory(history: HistoryItem[], empresaId?: string): void {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.HISTORY}_${empresaId}`
      : STORAGE_KEYS.HISTORY;
    try {
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.warn('Error guardando historial:', e);
    }
  }

  getSessions(empresaId?: string): Session[] {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.SESSIONS}_${empresaId}`
      : STORAGE_KEYS.SESSIONS;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  saveSessions(sessions: Session[], empresaId?: string): void {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.SESSIONS}_${empresaId}`
      : STORAGE_KEYS.SESSIONS;
    try {
      localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Error guardando sesiones:', e);
    }
  }

  getThemePreference(empresaId?: string): string {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.PREFERENCES}_${empresaId}`
      : STORAGE_KEYS.PREFERENCES;
    try {
      return localStorage.getItem(key) || 'matrix';
    } catch {
      return 'matrix';
    }
  }

  saveThemePreference(themeId: string, empresaId?: string): void {
    const key = empresaId && empresaId !== 'empresa-master-comikids'
      ? `${STORAGE_KEYS.PREFERENCES}_${empresaId}`
      : STORAGE_KEYS.PREFERENCES;
    try {
      localStorage.setItem(key, themeId);
    } catch {}
  }
}

export const inventoryService = new InventoryService();
