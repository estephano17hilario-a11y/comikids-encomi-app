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
    colors: ['#6d28d9', '#06e6ff', '#a855f7', '#f72585'],
    liveColors: ['#ff0050', '#ff6b00', '#e11d48', '#9b1c1c']
  },
  {
    id: 'neon',
    name: 'Neon Cyber',
    colors: ['#f000b8', '#9b00ff', '#0055ff', '#00c8ff'],
    liveColors: ['#ff2056', '#ffd000', '#ff8c00', '#ff2020']
  },
  {
    id: 'emerald',
    name: 'Emerald City',
    colors: ['#00c875', '#00f5a0', '#00c8ff', '#00e5d0'],
    liveColors: ['#ffd000', '#ff9900', '#ff6600', '#e65c00']
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    colors: ['#4b6584', '#6a8dad', '#2d4a6b', '#1a2f4a'],
    liveColors: ['#6b7280', '#4b5563', '#374151', '#1f2937']
  },
  {
    id: 'sunset',
    name: 'Sunset Vibe',
    colors: ['#ffd000', '#ff8800', '#ff4400', '#e83000'],
    liveColors: ['#cc0000', '#8b0000', '#5c0000', '#d41919']
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: ['#a800ff', '#cc00ff', '#f000d0', '#c700b8'],
    liveColors: ['#6200c4', '#7700e6', '#8f00ff', '#9f1fff']
  }
];

