export interface AestheticAvatar {
  id: string;
  name: string;
  url: string;
  accentColor: string;
}

export const AESTHETIC_AVATARS: AestheticAvatar[] = [
  {
    id: 'av-1',
    name: 'Costurera Chic',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-pink-500 to-rose-500'
  },
  {
    id: 'av-2',
    name: 'Artesana Boho',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-purple-500 to-indigo-500'
  },
  {
    id: 'av-3',
    name: 'Bordadora Vintage',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-amber-400 to-orange-500'
  },
  {
    id: 'av-4',
    name: 'Diseñadora Glam',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'av-5',
    name: 'Estilo Kawaii',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-emerald-400 to-teal-500'
  },
  {
    id: 'av-6',
    name: 'Moda Urbana',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-fuchsia-500 to-pink-500'
  },
  {
    id: 'av-7',
    name: 'Creadora Soft',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-violet-500 to-purple-600'
  },
  {
    id: 'av-8',
    name: 'Reina del Bordado',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    accentColor: 'from-rose-400 to-red-500'
  }
];

export function getRandomAvatar(): string {
  const index = Math.floor(Math.random() * AESTHETIC_AVATARS.length);
  return AESTHETIC_AVATARS[index].url;
}
