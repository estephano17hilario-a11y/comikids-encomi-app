export interface Variant {
  id: string;
  size: string;
  color: string;
  stock: number;
  price?: number;
  cost?: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  categoryId: string;
  subCategoryId?: string;
  image?: string | null;
  color?: string;
  isPack?: boolean;
  packContent?: string;
  variants: Variant[];
  companyId?: string;
  isArchived?: boolean;
  createdAt?: number | string;
}

export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subCategories: SubCategory[];
}

export interface HistoryItem {
  id: number;
  type: 'sale' | 'restock' | 'production';
  productId: string;
  variantId: string;
  product: string;
  variant: string;
  qty: number;
  price: number;
  cost?: number;
  time: number;
  sessionDate?: number | null;
  sessionId?: number | null;
}

export interface Session {
  id: number;
  startTime: number;
  endTime: number;
  totalSold: number;
  totalRevenue: number;
  notes: string;
}

export interface MeshTheme {
  id: string;
  name: string;
  colors: string[];
  liveColors: string[];
}
