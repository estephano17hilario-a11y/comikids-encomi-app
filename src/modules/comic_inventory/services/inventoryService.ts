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
  getProducts(): Product[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.saveProducts(INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  }

  saveProducts(products: Product[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.warn('Error guardando productos en LocalStorage:', e);
    }
  }

  getCategories(): Category[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.saveCategories(INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  }

  saveCategories(categories: Category[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn('Error guardando categorías en LocalStorage:', e);
    }
  }

  getHistory(): HistoryItem[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  saveHistory(history: HistoryItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('Error guardando historial:', e);
    }
  }

  getSessions(): Session[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  saveSessions(sessions: Session[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Error guardando sesiones:', e);
    }
  }

  getThemePreference(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.PREFERENCES) || 'matrix';
    } catch {
      return 'matrix';
    }
  }

  saveThemePreference(themeId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, themeId);
    } catch {}
  }
}

export const inventoryService = new InventoryService();
