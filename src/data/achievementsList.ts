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
    codigo: 'envio_1',
    titulo: '1er Envío 📦',
    descripcion: 'Realizaste tu primer despacho de mercadería con éxito.',
    icono: 'Package',
    puntosXp: 50,
    badgeColor: 'from-cyan-500 to-blue-500',
    reqCount: 1,
  },
  {
    codigo: 'envio_3',
    titulo: '3 Envíos ⚡',
    descripcion: 'Has completado 3 despachos confiando en Comikids.',
    icono: 'Zap',
    puntosXp: 100,
    badgeColor: 'from-blue-500 to-indigo-500',
    reqCount: 3,
  },
  {
    codigo: 'envio_5',
    titulo: '5 Envíos 🚚',
    descripcion: 'Has realizado 5 despachos de mercadería.',
    icono: 'Truck',
    puntosXp: 180,
    badgeColor: 'from-indigo-500 to-purple-500',
    reqCount: 5,
  },
  {
    codigo: 'envio_10',
    titulo: '10 Envíos 👑',
    descripcion: '¡10 despachos completados! Eres cliente preferencial.',
    icono: 'Crown',
    puntosXp: 350,
    badgeColor: 'from-purple-500 to-pink-500',
    reqCount: 10,
  },
  {
    codigo: 'envio_20',
    titulo: '20 Envíos 💎',
    descripcion: '20 despachos exitosos en todo el país.',
    icono: 'Gem',
    puntosXp: 600,
    badgeColor: 'from-pink-500 to-rose-500',
    reqCount: 20,
  },
  {
    codigo: 'envio_30',
    titulo: '30 Envíos 🏆',
    descripcion: '30 despachos de mercadería impecables.',
    icono: 'Trophy',
    puntosXp: 1000,
    badgeColor: 'from-amber-400 to-orange-500',
    reqCount: 30,
  },
  {
    codigo: 'envio_50',
    titulo: '50 Envíos 🌟',
    descripcion: '¡Medio centenar de despachos! Socia de Élite.',
    icono: 'Star',
    puntosXp: 1800,
    badgeColor: 'from-emerald-400 to-teal-500',
    reqCount: 50,
  },
  {
    codigo: 'envio_100',
    titulo: '100 Envíos 🚀',
    descripcion: '¡100 despachos legendarios! Rango Máximo Master.',
    icono: 'Rocket',
    puntosXp: 4000,
    badgeColor: 'from-cyan-400 via-purple-500 to-amber-400',
    reqCount: 100,
  },
];

export const LEVEL_TIERS = [
  { nivel: 1, nombre: 'Cliente Inicial 📦', minXp: 0, maxXp: 100, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  { nivel: 2, nombre: 'Cliente Frecuente 🚚', minXp: 100, maxXp: 350, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  { nivel: 3, nombre: 'Cliente VIP 👑', minXp: 350, maxXp: 1000, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  { nivel: 4, nombre: 'Socia Diamante 💎', minXp: 1000, maxXp: 2500, color: 'text-amber-300', border: 'border-amber-400/30', bg: 'bg-amber-400/10' },
  { nivel: 5, nombre: 'Master Legendario 🚀', minXp: 2500, maxXp: 6000, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
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
