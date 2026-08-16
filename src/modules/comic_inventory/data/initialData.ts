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
    colors: ['#7c3aed', '#00f0ff', '#c026d3', '#ff2d87'],
    liveColors: ['#ff003c', '#ff7a00', '#ff1a5e', '#c0172f']
  },
  {
    id: 'neon',
    name: 'Neon Cyber',
    colors: ['#ff00d0', '#b000ff', '#005eff', '#00dfff'],
    liveColors: ['#ff2060', '#ffe000', '#ffa000', '#ff2828']
  },
  {
    id: 'emerald',
    name: 'Emerald City',
    colors: ['#00e088', '#00ffb3', '#00dfff', '#00fce4'],
    liveColors: ['#ffe200', '#ffaa00', '#ff7400', '#ff4c00']
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    colors: ['#556e90', '#7aa0c4', '#334e70', '#1e364f'],
    liveColors: ['#788090', '#566070', '#404855', '#252d35']
  },
  {
    id: 'sunset',
    name: 'Sunset Vibe',
    colors: ['#ffe500', '#ff9900', '#ff5000', '#ff3500'],
    liveColors: ['#e60000', '#a00000', '#700000', '#ee2222']
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: ['#bf00ff', '#e000ff', '#ff00e8', '#e000d0'],
    liveColors: ['#7000e0', '#8a00ff', '#a200ff', '#b822ff']
  },
  {
    id: 'aurora',
    name: 'Aurora Boreal',
    colors: ['#00ffa3', '#00cfff', '#9b00ff', '#ff00c8'],
    liveColors: ['#00ff88', '#00e0e0', '#6600ff', '#cc00aa']
  },
  {
    id: 'ocean',
    name: 'Ocean Depth',
    colors: ['#0077ff', '#0044cc', '#00ccff', '#005588'],
    liveColors: ['#00ffdd', '#00ccbb', '#009988', '#007766']
  },
  {
    id: 'volcanic',
    name: 'Volcanic Fire',
    colors: ['#ff6600', '#ff3300', '#ff9900', '#cc2200'],
    liveColors: ['#ff2200', '#dd0000', '#ff4400', '#ee1100']
  },
  {
    id: 'sakura',
    name: 'Sakura Dream',
    colors: ['#ff80c0', '#ff44aa', '#dd00aa', '#ff99cc'],
    liveColors: ['#ff1188', '#cc0077', '#ee0099', '#ff55bb']
  },
  {
    id: 'cyber_gold',
    name: 'Cyber Gold',
    colors: ['#ffd700', '#ffaa00', '#ff8800', '#ffe566'],
    liveColors: ['#ff6600', '#cc5500', '#ff4400', '#dd3300']
  },
  {
    id: 'toxic',
    name: 'Toxic Green',
    colors: ['#aaff00', '#77ee00', '#00ff55', '#ccff00'],
    liveColors: ['#00cc44', '#00aa33', '#ff4400', '#ff6600']
  }
];


