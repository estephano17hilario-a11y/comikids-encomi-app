// Temas de fondo de la sección Yape (antes vivían en el módulo de inventario)
export interface MeshTheme {
  id: string;
  name: string;
  colors: string[];
  liveColors: string[];
}

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

// Se mantiene la misma clave de guardado que usaba el inventario para no perder el tema elegido
const PREFERENCES_KEY = 'comic_inventory_preferences_v2';

const themeKey = (empresaId?: string) =>
  empresaId && empresaId !== 'empresa-master-comikids' ? `${PREFERENCES_KEY}_${empresaId}` : PREFERENCES_KEY;

export const getThemePreference = (empresaId?: string): string => {
  try {
    return localStorage.getItem(themeKey(empresaId)) || 'matrix';
  } catch {
    return 'matrix';
  }
};

export const saveThemePreference = (themeId: string, empresaId?: string): void => {
  try {
    localStorage.setItem(themeKey(empresaId), themeId);
  } catch {}
};
