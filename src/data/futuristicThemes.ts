export interface FuturisticTheme {
  id: 'nspace' | 'modern-black' | 'modern-white' | 'pink-space';
  name: string;
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
  textColor?: string;
}

export const FUTURISTIC_THEMES: FuturisticTheme[] = [
  // 1. NSPACE (Neon Space & Cyber Cosmos)
  {
    id: 'nspace',
    name: '✨ NSPACE (Neon Space)',
    categoryLabel: 'Cyber Cosmos',
    description: 'Profundidad espacial galáctica con cian neón, violeta cuántico y reflejos de alta fidelidad.',
    badge: 'Recomendado',
    previewGradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #a855f7 100%)',
    backgroundStyle: {
      backgroundColor: '#040714',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(6, 182, 212, 0.16) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.16) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.92) 0px, #040714 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#06b6d4',
    accentSecondary: '#a855f7',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    cardBg: 'rgba(10, 16, 32, 0.85)',
    cardBorder: 'rgba(6, 182, 212, 0.25)',
    textColor: '#f8fafc',
  },

  // 2. MODERN BLACK (Titanium OLED Stealth)
  {
    id: 'modern-black',
    name: '🖤 Modern Black',
    categoryLabel: 'Titanium OLED',
    description: 'Negro absoluto OLED con texturas minimalistas de titanio y sutiles bordes de acero platino.',
    badge: 'OLED Pro',
    previewGradient: 'linear-gradient(135deg, #27272a 0%, #18181b 50%, #000000 100%)',
    backgroundStyle: {
      backgroundColor: '#000000',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.06) 0%, transparent 60%), radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.05) 0px, transparent 50%), linear-gradient(180deg, #09090b 0%, #000000 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#f1f5f9',
    accentSecondary: '#38bdf8',
    glowColor: 'rgba(255, 255, 255, 0.25)',
    cardBg: 'rgba(14, 14, 18, 0.92)',
    cardBorder: 'rgba(255, 255, 255, 0.14)',
    textColor: '#f8fafc',
  },

  // 3. MODERN WHITE (Apple Vision Crisp Light)
  {
    id: 'modern-white',
    name: '🤍 Modern White',
    categoryLabel: 'Vision Light Glass',
    description: 'Estética cristalina de día ultra luminosa, alto contraste, sombras suaves y elegancia pura.',
    badge: 'Light Mode',
    previewGradient: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 50%, #bae6fd 100%)',
    backgroundStyle: {
      backgroundColor: '#f1f5f9',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#0284c7',
    accentSecondary: '#6366f1',
    glowColor: 'rgba(2, 132, 199, 0.28)',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardBorder: 'rgba(15, 23, 42, 0.12)',
    textColor: '#0f172a',
  },

  // 4. ROSADO SPACE (Cyber Pink Nebula)
  {
    id: 'pink-space',
    name: '🌸 Rosado Space',
    categoryLabel: 'Nebula Cyber Rose',
    description: 'Aura futurista de nebulosa rosa intenso, destellos magenta y violeta espacial de alta gama.',
    badge: 'Vibrante',
    previewGradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #8b5cf6 100%)',
    backgroundStyle: {
      backgroundColor: '#0c030f',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(244, 63, 94, 0.18) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.12) 0%, transparent 60%), #0c030f',
      backgroundAttachment: 'fixed',
    },
    accentColor: '#ec4899',
    accentSecondary: '#f43f5e',
    glowColor: 'rgba(236, 72, 153, 0.5)',
    cardBg: 'rgba(24, 8, 30, 0.88)',
    cardBorder: 'rgba(236, 72, 153, 0.32)',
    textColor: '#f8fafc',
  }
];

export const getThemeById = (id?: string): FuturisticTheme => {
  if (!id) return FUTURISTIC_THEMES[0];
  // Soporte de compatibilidad hacia atrás
  if (id.includes('white') || id === 'minimal-liquid-mercury') return FUTURISTIC_THEMES[2];
  if (id.includes('black') || id === 'minimal-carbon-stealth' || id === 'vision-titanium' || id === 'cosmos-black-hole') return FUTURISTIC_THEMES[1];
  if (id.includes('pink') || id.includes('rose') || id === 'cyber-neo-tokyo' || id === 'cyber-synthwave-sunset') return FUTURISTIC_THEMES[3];
  return FUTURISTIC_THEMES.find(t => t.id === id) || FUTURISTIC_THEMES[0];
};

/**
 * Aplica el tema seleccionado al DOM (body, html, css variables y clases de tema)
 */
export const applyFuturisticTheme = (themeId: string) => {
  const theme = getThemeById(themeId);
  if (typeof document === 'undefined') return;

  const body = document.body;
  const root = document.documentElement;

  // Actualizar clases de tema en root y body
  const allThemeClasses = ['theme-nspace', 'theme-modern-black', 'theme-modern-white', 'theme-pink-space'];
  root.classList.remove(...allThemeClasses);
  body.classList.remove(...allThemeClasses);

  root.classList.add(`theme-${theme.id}`);
  body.classList.add(`theme-${theme.id}`);

  // Aplicar estilos de fondo
  body.style.backgroundColor = theme.backgroundStyle.backgroundColor;
  body.style.backgroundImage = theme.backgroundStyle.backgroundImage;
  if (theme.backgroundStyle.backgroundAttachment) {
    body.style.backgroundAttachment = theme.backgroundStyle.backgroundAttachment;
  }
  body.style.color = theme.textColor || '#f8fafc';

  // Inyectar variables CSS para que los componentes usen los colores dinámicos
  root.style.setProperty('--futuristic-accent', theme.accentColor);
  root.style.setProperty('--futuristic-accent-sec', theme.accentSecondary);
  root.style.setProperty('--futuristic-glow', theme.glowColor);
  root.style.setProperty('--futuristic-card-bg', theme.cardBg);
  root.style.setProperty('--futuristic-card-border', theme.cardBorder);
  root.style.setProperty('--bg-main', theme.backgroundStyle.backgroundColor);
  root.style.setProperty('--text-main', theme.textColor || '#f8fafc');

  // Persistir en LocalStorage
  try {
    localStorage.setItem('incomi_futuristic_theme', theme.id);
  } catch {}
};
