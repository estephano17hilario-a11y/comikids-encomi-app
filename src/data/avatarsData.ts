export interface AestheticAvatar {
  id: string;
  name: string;
  url: string;
  accentColor: string;
}

export const AESTHETIC_AVATARS: AestheticAvatar[] = [
  {
    id: 'av-bot-1',
    name: 'Cyber Bot Cyan',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ComiCyanBot&backgroundColor=06b6d4,3b82f6',
    accentColor: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'av-bot-2',
    name: 'Neon Spark Bot',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ComiNeonBot&backgroundColor=8b5cf6,ec4899',
    accentColor: 'from-purple-500 to-pink-500'
  },
  {
    id: 'av-bot-3',
    name: 'Turbo Gold Bot',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ComiFlashBot&backgroundColor=f59e0b,ef4444',
    accentColor: 'from-amber-400 to-orange-500'
  },
  {
    id: 'av-bot-4',
    name: 'Emerald Matrix',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ComiSparkBot&backgroundColor=10b981,06b6d4',
    accentColor: 'from-emerald-400 to-teal-500'
  },
  {
    id: 'av-shape-1',
    name: 'Cosmos Prisma',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=CosmosGem&backgroundColor=ec4899,8b5cf6',
    accentColor: 'from-pink-500 to-purple-600'
  },
  {
    id: 'av-shape-2',
    name: 'Orion Star',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=PrismaGold&backgroundColor=f59e0b,6366f1',
    accentColor: 'from-amber-400 to-indigo-500'
  },
  {
    id: 'av-identicon-1',
    name: 'Escudo Cyber',
    url: 'https://api.dicebear.com/7.x/identicon/svg?seed=CyberShield&backgroundColor=06b6d4,10b981',
    accentColor: 'from-cyan-500 to-emerald-500'
  },
  {
    id: 'av-bot-5',
    name: 'Tech Astro',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TechAstro&backgroundColor=6366f1,3b82f6',
    accentColor: 'from-indigo-500 to-blue-500'
  }
];

export function getRandomAvatar(seedName?: string): string {
  if (seedName) {
    const clean = encodeURIComponent(seedName.trim().replace(/\s+/g, '-'));
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}&backgroundColor=06b6d4,8b5cf6,ec4899,10b981,f59e0b`;
  }
  const index = Math.floor(Math.random() * AESTHETIC_AVATARS.length);
  return AESTHETIC_AVATARS[index].url;
}
