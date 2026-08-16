import React, { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'indigo' | 'pink' | 'cyan' | 'rose' | 'white';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'indigo', className = '' }) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    white: 'bg-white/10 text-white border-white/20 backdrop-blur-md'
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border tracking-wide ${colors[color] || colors.indigo} ${className}`}>
      {children}
    </span>
  );
};
