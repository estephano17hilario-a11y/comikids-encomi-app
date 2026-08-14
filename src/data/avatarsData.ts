export interface AestheticAvatar {
  id: string;
  name: string;
  url: string;
  accentColor: string;
}

export const AESTHETIC_AVATARS: AestheticAvatar[] = [
  {
    id: 'av-1',
    name: 'Logística Cyan',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiCyan&backgroundColor=06b6d4,3b82f6',
    accentColor: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'av-2',
    name: 'Despacho Púrpura',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiPurple&backgroundColor=8b5cf6,6366f1',
    accentColor: 'from-purple-500 to-indigo-500'
  },
  {
    id: 'av-3',
    name: 'Oro Vip',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiGold&backgroundColor=f59e0b,ea580c',
    accentColor: 'from-amber-400 to-orange-500'
  },
  {
    id: 'av-4',
    name: 'Express Esmeralda',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiGreen&backgroundColor=10b981,0d9488',
    accentColor: 'from-emerald-400 to-teal-500'
  },
  {
    id: 'av-5',
    name: 'Socia Diamante',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiPink&backgroundColor=ec4899,f43f5e',
    accentColor: 'from-pink-500 to-rose-500'
  },
  {
    id: 'av-6',
    name: 'Gobernanza Soft',
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=IncomiIndigo&backgroundColor=6366f1,4f46e5',
    accentColor: 'from-indigo-500 to-blue-600'
  }
];

export function getRandomAvatar(): string {
  const index = Math.floor(Math.random() * AESTHETIC_AVATARS.length);
  return AESTHETIC_AVATARS[index].url;
}
