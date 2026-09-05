export interface FuturisticTheme {
  id: string;
  name: string;
  category: 'cosmos' | 'cyberpunk' | 'vision_glass' | 'minimal_luxury' | 'aurora_quantum' | 'matrix_tech';
  categoryLabel: string;
  description: string;
  badge?: string;
  previewGradient: string;
  backgroundStyle: {
    backgroundColor: string;
    backgroundImage: string;
    backgroundAttachment?: string;
  };
  accentColor: string;
  accentSecondary: string;
  glowColor: string;
  cardBg: string;
  cardBorder: string;
}

export const THEME_CATEGORIES = [
  { id: 'all', label: '✨ Todos los Estilos', icon: 'Sparkles' },
  { id: 'vision_glass', label: '🍏 Apple Vision Glass', icon: 'Layers' },
  { id: 'cyberpunk', label: '⚡ Cyberpunk & Neón', icon: 'Zap' },
  { id: 'cosmos', label: '🌌 Cosmos & Galaxia', icon: 'Globe' },
  { id: 'minimal_luxury', label: '💎 Minimal & Titanio', icon: 'Shield' },
  { id: 'aurora_quantum', label: '🔮 Aurora Cuántica', icon: 'Compass' },
  { id: 'matrix_tech', label: '🤖 Matrix & High-Tech', icon: 'Cpu' },
] as const;

export const FUTURISTIC_THEMES: FuturisticTheme[] = [
  // --- 1. APPLE VISION PRO & GLASS ---
  {
    id: 'vision-obsidian',
    name: 'VisionOS Obsidian Dark',
    category: 'vision_glass',
    categoryLabel: 'Apple Vision Glass',
    description: 'Profundidad espacial en negro obsidiana con reflejos cristalinos de alta gama.',
    badge: 'Recomendado',
    previewGradient: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #090d16 60%, #020408 100%)',
    backgroundStyle: {
      backgroundColor: '#030712',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.12) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.9) 0px, #030712 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#38bdf8',
    accentSecondary: '#818cf8',
    glowColor: 'rgba(56, 189, 248, 0.35)',
    cardBg: 'rgba(15, 23, 42, 0.75)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
  },
  {
    id: 'vision-quartz',
    name: 'Holographic Quartz',
    category: 'vision_glass',
    categoryLabel: 'Apple Vision Glass',
    description: 'Efecto traslúcido con destellos azul turquesa y violeta espacial.',
    badge: 'Pro',
    previewGradient: 'linear-gradient(135deg, #0b192c 0%, #1e3e62 50%, #000000 100%)',
    backgroundStyle: {
      backgroundColor: '#050a14',
      backgroundImage: 'radial-gradient(ellipse at top left, rgba(6, 182, 212, 0.18) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(168, 85, 247, 0.15) 0%, transparent 60%), linear-gradient(180deg, #070d1a 0%, #03060c 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#06b6d4',
    accentSecondary: '#a855f7',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    cardBg: 'rgba(10, 18, 36, 0.7)',
    cardBorder: 'rgba(6, 182, 212, 0.25)',
  },
  {
    id: 'vision-titanium',
    name: 'Titanium Dark Mirror',
    category: 'vision_glass',
    categoryLabel: 'Apple Vision Glass',
    description: 'Acabado metálico cepillado con reflejos de titanio espacial gris humo.',
    badge: 'VIP',
    previewGradient: 'linear-gradient(135deg, #27272a 0%, #18181b 50%, #09090b 100%)',
    backgroundStyle: {
      backgroundColor: '#09090b',
      backgroundImage: 'radial-gradient(at 100% 0%, rgba(161, 161, 170, 0.12) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(82, 82, 91, 0.15) 0px, transparent 50%), linear-gradient(180deg, #121215 0%, #09090b 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#e4e4e7',
    accentSecondary: '#a1a1aa',
    glowColor: 'rgba(228, 228, 231, 0.25)',
    cardBg: 'rgba(24, 24, 27, 0.8)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
  },

  // --- 2. CYBERPUNK & NEÓN ---
  {
    id: 'cyber-neo-tokyo',
    name: 'Neo Tokyo 2099',
    category: 'cyberpunk',
    categoryLabel: 'Cyberpunk & Neón',
    description: 'Luces de neón magenta y cian brillante inspiradas en rascacielos futuristas.',
    badge: 'Nuevo',
    previewGradient: 'linear-gradient(135deg, #ff007f 0%, #7928ca 50%, #00f0ff 100%)',
    backgroundStyle: {
      backgroundColor: '#070312',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 0, 128, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(0, 240, 255, 0.16) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(121, 40, 202, 0.12) 0%, transparent 60%), #070312',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#ff007f',
    accentSecondary: '#00f0ff',
    glowColor: 'rgba(255, 0, 127, 0.45)',
    cardBg: 'rgba(18, 10, 36, 0.8)',
    cardBorder: 'rgba(255, 0, 127, 0.3)',
  },
  {
    id: 'cyber-synthwave-sunset',
    name: 'Synthwave Sunset 80s',
    category: 'cyberpunk',
    categoryLabel: 'Cyberpunk & Neón',
    description: 'Atardecer retrofuturista con gradientes naranja fuego, púrpura y magenta.',
    badge: 'Popular',
    previewGradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
    backgroundStyle: {
      backgroundColor: '#0c0517',
      backgroundImage: 'radial-gradient(at 50% 0%, rgba(249, 115, 22, 0.18) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.16) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%), #0c0517',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#f97316',
    accentSecondary: '#ec4899',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    cardBg: 'rgba(23, 10, 38, 0.8)',
    cardBorder: 'rgba(236, 72, 153, 0.3)',
  },
  {
    id: 'cyber-acid-blade',
    name: 'Acid Cyber Blade',
    category: 'cyberpunk',
    categoryLabel: 'Cyberpunk & Neón',
    description: 'Verde tóxico hiperbrillante y destellos cian sobre una base de asfalto oscuro.',
    badge: 'Futurista',
    previewGradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #022c22 100%)',
    backgroundStyle: {
      backgroundColor: '#030e0a',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.2) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.15) 0px, transparent 50%), linear-gradient(180deg, #051912 0%, #030e0a 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#10b981',
    accentSecondary: '#06b6d4',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    cardBg: 'rgba(6, 26, 19, 0.8)',
    cardBorder: 'rgba(16, 185, 129, 0.3)',
  },

  // --- 3. COSMOS & GALAXIA ---
  {
    id: 'cosmos-deep-space',
    name: 'Andromeda Deep Space',
    category: 'cosmos',
    categoryLabel: 'Cosmos & Galaxia',
    description: 'Inmensidad del espacio profundo con polvo interestelar azul y nebulosas violeta.',
    badge: 'Ultra',
    previewGradient: 'radial-gradient(circle at 30% 30%, #3b0764 0%, #0f172a 60%, #020617 100%)',
    backgroundStyle: {
      backgroundColor: '#020617',
      backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(126, 34, 206, 0.22) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(30, 58, 138, 0.25) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(14, 165, 233, 0.12) 0%, transparent 40%), #020617',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#a855f7',
    accentSecondary: '#38bdf8',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    cardBg: 'rgba(15, 23, 42, 0.8)',
    cardBorder: 'rgba(168, 85, 247, 0.25)',
  },
  {
    id: 'cosmos-supernova-gold',
    name: 'Supernova Golden Flare',
    category: 'cosmos',
    categoryLabel: 'Cosmos & Galaxia',
    description: 'Explosión estelar dorada con destellos ámbar y energía cósmica pura.',
    badge: 'Lujoso',
    previewGradient: 'linear-gradient(135deg, #eab308 0%, #b45309 50%, #1e1b4b 100%)',
    backgroundStyle: {
      backgroundColor: '#0b0803',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(234, 179, 8, 0.2) 0%, transparent 60%), radial-gradient(circle at 10% 100%, rgba(180, 83, 9, 0.18) 0%, transparent 50%), linear-gradient(180deg, #181206 0%, #080602 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#facc15',
    accentSecondary: '#f59e0b',
    glowColor: 'rgba(250, 204, 21, 0.4)',
    cardBg: 'rgba(26, 20, 8, 0.8)',
    cardBorder: 'rgba(250, 204, 21, 0.3)',
  },
  {
    id: 'cosmos-black-hole',
    name: 'Event Horizon Dark Void',
    category: 'cosmos',
    categoryLabel: 'Cosmos & Galaxia',
    description: 'Negro absoluto estelar con un sutil halo azul eléctrico en los bordes.',
    badge: 'Minimal',
    previewGradient: 'radial-gradient(circle, #001220 0%, #000000 80%)',
    backgroundStyle: {
      backgroundColor: '#000000',
      backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(2, 132, 199, 0.16) 0%, transparent 60%), radial-gradient(circle at 50% 100%, rgba(79, 70, 229, 0.12) 0%, transparent 50%), #000000',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#38bdf8',
    accentSecondary: '#6366f1',
    glowColor: 'rgba(56, 189, 248, 0.3)',
    cardBg: 'rgba(10, 10, 15, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
  },

  // --- 4. MINIMALISMO FUTURISTA & TITANIO ---
  {
    id: 'minimal-carbon-stealth',
    name: 'Carbon Stealth Fiber',
    category: 'minimal_luxury',
    categoryLabel: 'Minimal & Titanio',
    description: 'Textura oscura aeroespacial de fibra de carbono mate con acentos cian sutiles.',
    badge: 'Stealth',
    previewGradient: 'linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)',
    backgroundStyle: {
      backgroundColor: '#0a0a0a',
      backgroundImage: 'radial-gradient(#262626 1px, transparent 1px), radial-gradient(#171717 1px, #0a0a0a 1px)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#22d3ee',
    accentSecondary: '#94a3b8',
    glowColor: 'rgba(34, 211, 238, 0.3)',
    cardBg: 'rgba(18, 18, 18, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
  },
  {
    id: 'minimal-liquid-mercury',
    name: 'Liquid Mercury Silver',
    category: 'minimal_luxury',
    categoryLabel: 'Minimal & Titanio',
    description: 'Fluidez de metal líquido plateado con bordes nítidos y alto contraste.',
    badge: 'Elegante',
    previewGradient: 'linear-gradient(135deg, #64748b 0%, #334155 50%, #0f172a 100%)',
    backgroundStyle: {
      backgroundColor: '#0b0f19',
      backgroundImage: 'radial-gradient(at 0% 50%, rgba(148, 163, 184, 0.12) 0px, transparent 50%), radial-gradient(at 100% 50%, rgba(203, 213, 225, 0.1) 0px, transparent 50%), linear-gradient(180deg, #111827 0%, #0b0f19 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#cbd5e1',
    accentSecondary: '#64748b',
    glowColor: 'rgba(203, 213, 225, 0.3)',
    cardBg: 'rgba(17, 24, 39, 0.8)',
    cardBorder: 'rgba(255, 255, 255, 0.14)',
  },

  // --- 5. AURORA CUÁNTICA ---
  {
    id: 'aurora-nordic-borealis',
    name: 'Nordic Aurora Borealis',
    category: 'aurora_quantum',
    categoryLabel: 'Aurora Cuántica',
    description: 'Ondas ondulantes de luz boreal verde esmeralda y violeta ártico.',
    badge: 'Mágico',
    previewGradient: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #4338ca 100%)',
    backgroundStyle: {
      backgroundColor: '#02130e',
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(16, 185, 129, 0.22) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(99, 102, 241, 0.2) 0%, transparent 60%), radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.15) 0%, transparent 60%), #02130e',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#10b981',
    accentSecondary: '#6366f1',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    cardBg: 'rgba(4, 30, 22, 0.8)',
    cardBorder: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'aurora-quantum-flux',
    name: 'Quantum Flux Turquoise',
    category: 'aurora_quantum',
    categoryLabel: 'Aurora Cuántica',
    description: 'Fluctuación cuántica brillante con tonos aguamarina, cian y azul cobalto.',
    badge: 'Hiperactivo',
    previewGradient: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 50%, #1e1b4b 100%)',
    backgroundStyle: {
      backgroundColor: '#040d1a',
      backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(6, 182, 212, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(37, 99, 235, 0.2) 0%, transparent 55%), #040d1a',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#06b6d4',
    accentSecondary: '#3b82f6',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    cardBg: 'rgba(8, 22, 44, 0.8)',
    cardBorder: 'rgba(6, 182, 212, 0.3)',
  },

  // --- 6. MATRIX & HIGH-TECH CORE ---
  {
    id: 'matrix-terminal-core',
    name: 'Matrix Core Green Terminal',
    category: 'matrix_tech',
    categoryLabel: 'Matrix & High-Tech',
    description: 'Verde fósforo de terminal militar con microrejilla digital de precisión.',
    badge: 'Clásico',
    previewGradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 50%, #052e16 100%)',
    backgroundStyle: {
      backgroundColor: '#020f06',
      backgroundImage: 'radial-gradient(rgba(34, 197, 94, 0.15) 1px, transparent 1px), linear-gradient(180deg, #03170a 0%, #020f06 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#22c55e',
    accentSecondary: '#4ade80',
    glowColor: 'rgba(34, 197, 94, 0.45)',
    cardBg: 'rgba(3, 24, 11, 0.85)',
    cardBorder: 'rgba(34, 197, 94, 0.3)',
  },
  {
    id: 'matrix-quantum-blue',
    name: 'Quantum Data Center Blue',
    category: 'matrix_tech',
    categoryLabel: 'Matrix & High-Tech',
    description: 'Arquitectura de servidores cuánticos en azul zafiro e interfaz neural.',
    badge: 'Potente',
    previewGradient: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #030712 100%)',
    backgroundStyle: {
      backgroundColor: '#030a17',
      backgroundImage: 'radial-gradient(at 50% 0%, rgba(29, 78, 216, 0.22) 0px, transparent 60%), radial-gradient(at 100% 100%, rgba(30, 64, 175, 0.18) 0px, transparent 50%), #030a17',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#3b82f6',
    accentSecondary: '#60a5fa',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    cardBg: 'rgba(6, 17, 36, 0.85)',
    cardBorder: 'rgba(59, 130, 246, 0.3)',
  }
];

export const getThemeById = (id?: string): FuturisticTheme => {
  return FUTURISTIC_THEMES.find(t => t.id === id) || FUTURISTIC_THEMES[0];
};

/**
 * Aplica el tema seleccionado al DOM (body, html, css variables)
 */
export const applyFuturisticTheme = (themeId: string) => {
  const theme = getThemeById(themeId);
  if (typeof document === 'undefined') return;

  const body = document.body;
  const root = document.documentElement;

  // Aplicar estilos de fondo
  body.style.backgroundColor = theme.backgroundStyle.backgroundColor;
  body.style.backgroundImage = theme.backgroundStyle.backgroundImage;
  if (theme.backgroundStyle.backgroundAttachment) {
    body.style.backgroundAttachment = theme.backgroundStyle.backgroundAttachment;
  }

  // Inyectar variables CSS para que los componentes usen los colores dinámicos
  root.style.setProperty('--futuristic-accent', theme.accentColor);
  root.style.setProperty('--futuristic-accent-sec', theme.accentSecondary);
  root.style.setProperty('--futuristic-glow', theme.glowColor);
  root.style.setProperty('--futuristic-card-bg', theme.cardBg);
  root.style.setProperty('--futuristic-card-border', theme.cardBorder);

  // Persistir en LocalStorage
  try {
    localStorage.setItem('incomi_futuristic_theme', theme.id);
  } catch {
    // Ignorar si cookies/storage restringido
  }
};
