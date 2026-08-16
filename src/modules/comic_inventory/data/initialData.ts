import { Category, Product, MeshTheme } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_1',
    name: 'Ropa',
    icon: 'Shirt',
    subCategories: [
      { id: 'sub_1', name: 'Poleras' },
      { id: 'sub_2', name: 'Pantalones' },
      { id: 'sub_3', name: 'Pijamas' },
      { id: 'sub_4', name: 'Íntimo' }
    ]
  },
  {
    id: 'cat_2',
    name: 'Zapatillas',
    icon: 'Footprints',
    subCategories: [
      { id: 'sub_5', name: 'Urbanas' },
      { id: 'sub_6', name: 'Deportivas' }
    ]
  },
  {
    id: 'cat_3',
    name: 'Tecnología',
    icon: 'Cpu',
    subCategories: [
      { id: 'sub_7', name: 'Accesorios' },
      { id: 'sub_8', name: 'Audio' }
    ]
  },
  {
    id: 'cat_4',
    name: 'Hogar',
    icon: 'Home',
    subCategories: [
      { id: 'sub_9', name: 'Deco' },
      { id: 'sub_10', name: 'Cocina' }
    ]
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_101',
    name: 'Pijama Seda Luxury',
    categoryId: 'cat_1',
    subCategoryId: 'sub_3',
    price: 120,
    cost: 55,
    image: null,
    color: 'bg-pink-600',
    variants: [
      { id: '101-S-R', size: 'S', color: 'Rosa', stock: 12, price: 120, cost: 55 },
      { id: '101-M-R', size: 'M', color: 'Rosa', stock: 8, price: 120, cost: 55 },
      { id: '101-L-R', size: 'L', color: 'Rosa', stock: 10, price: 130, cost: 60 },
      { id: '101-S-N', size: 'S', color: 'Negro', stock: 5, price: 120, cost: 55 }
    ]
  },
  {
    id: 'prod_102',
    name: 'Sneakers Urban X',
    categoryId: 'cat_2',
    subCategoryId: 'sub_5',
    price: 250,
    cost: 110,
    image: null,
    color: 'bg-slate-600',
    variants: [
      { id: '102-38-B', size: '38', color: 'Blanco', stock: 20, price: 250, cost: 110 },
      { id: '102-40-B', size: '40', color: 'Blanco', stock: 15, price: 250, cost: 110 },
      { id: '102-42-N', size: '42', color: 'Negro', stock: 4, price: 250, cost: 110 }
    ]
  },
  {
    id: 'prod_103',
    name: 'Polera Oversize',
    categoryId: 'cat_1',
    subCategoryId: 'sub_1',
    price: 85,
    cost: 38,
    image: null,
    color: 'bg-blue-600',
    variants: [
      { id: '103-L-A', size: 'L', color: 'Azul', stock: 30, price: 85, cost: 38 },
      { id: '103-XL-A', size: 'XL', color: 'Azul', stock: 10, price: 85, cost: 38 }
    ]
  }
];

export const MESH_THEMES: MeshTheme[] = [
  {
    id: 'matrix',
    name: 'Matrix Vision',
    colors: ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899'],
    liveColors: ['#e11d48', '#f97316', '#be123c', '#7f1d1d']
  },
  {
    id: 'neon',
    name: 'Neon Cyber',
    colors: ['#db2777', '#7c3aed', '#2563eb', '#0891b2'],
    liveColors: ['#f43f5e', '#fbbf24', '#f59e0b', '#dc2626']
  },
  {
    id: 'emerald',
    name: 'Emerald City',
    colors: ['#059669', '#10b981', '#06b6d4', '#14b8a6'],
    liveColors: ['#fbbf24', '#f59e0b', '#d97706', '#b45309']
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    colors: ['#334155', '#475569', '#1e293b', '#0f172a'],
    liveColors: ['#4b5563', '#374151', '#1f2937', '#111827']
  },
  {
    id: 'sunset',
    name: 'Sunset Vibe',
    colors: ['#f59e0b', '#d97706', '#ea580c', '#c2410c'],
    liveColors: ['#991b1b', '#7f1d1d', '#450a0a', '#b91c1c']
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: ['#7e22ce', '#9333ea', '#c026d3', '#a21caf'],
    liveColors: ['#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed']
  }
];
