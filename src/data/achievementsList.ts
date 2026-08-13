export interface AchievementDefinition {
  codigo: string;
  titulo: string;
  descripcion: string;
  icono: string;
  puntosXp: number;
  badgeColor: string;
  reqCount?: number;
}

export const ACHIEVEMENTS_CATALOG: AchievementDefinition[] = [
  {
    codigo: 'primer_bordado',
    titulo: 'Primer Bordado ✨',
    descripcion: 'Realizaste tu primer pedido personalizado en Incomi.',
    icono: 'Sparkles',
    puntosXp: 50,
    badgeColor: 'from-pink-500 to-rose-500',
    reqCount: 1,
  },
  {
    codigo: 'cliente_frecuente',
    titulo: 'Cliente Frecuente 🧵',
    descripcion: 'Has confiado 5 veces en nuestras manos artesanas.',
    icono: 'Heart',
    puntosXp: 150,
    badgeColor: 'from-purple-500 to-indigo-500',
    reqCount: 5,
  },
  {
    codigo: 'incomi_lover',
    titulo: 'Lover de Incomi 👑',
    descripcion: '¡10 pedidos legendarios! Eres parte de la familia Incomi.',
    icono: 'Crown',
    puntosXp: 300,
    badgeColor: 'from-amber-400 to-orange-500',
    reqCount: 10,
  },
  {
    codigo: 'envio_nacional',
    titulo: 'Viajera Shalom 📦',
    descripcion: 'Hiciste tu primer envío a provincia por Agencia Shalom.',
    icono: 'PackageCheck',
    puntosXp: 80,
    badgeColor: 'from-cyan-500 to-blue-500',
  },
  {
    codigo: 'coleccionista_estilo',
    titulo: 'Icono de Estilo 🎨',
    descripcion: 'Bordaste prendas con más de 4 combinaciones de colores.',
    icono: 'Palette',
    puntosXp: 100,
    badgeColor: 'from-emerald-400 to-teal-500',
  }
];

export const LEVEL_TIERS = [
  { nivel: 1, nombre: 'Novata de la Aguja 🪡', minXp: 0, maxXp: 200, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  { nivel: 2, nombre: 'Bordado Lover 💖', minXp: 200, maxXp: 500, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  { nivel: 3, nombre: 'Embajadora Incomi ⭐', minXp: 500, maxXp: 1000, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  { nivel: 4, nombre: 'Reina del Estilo 👑', minXp: 1000, maxXp: 2500, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
];

export function calculateLevel(xp: number) {
  const currentTier = LEVEL_TIERS.slice().reverse().find(t => xp >= t.minXp) || LEVEL_TIERS[0];
  const nextTier = LEVEL_TIERS.find(t => t.nivel === currentTier.nivel + 1);
  
  const xpInLevel = xp - currentTier.minXp;
  const xpNeededForNext = nextTier ? nextTier.minXp - currentTier.minXp : 1000;
  const progressPercent = nextTier 
    ? Math.min(100, Math.round((xpInLevel / xpNeededForNext) * 100))
    : 100;

  return {
    ...currentTier,
    progressPercent,
    xpTotal: xp,
    nextTierName: nextTier ? nextTier.nombre : 'Nivel Máximo Alcanzado 🏆',
    xpToNext: nextTier ? nextTier.minXp - xp : 0
  };
}
