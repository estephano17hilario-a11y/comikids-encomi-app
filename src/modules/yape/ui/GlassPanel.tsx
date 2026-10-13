import React, { forwardRef, ReactNode, HTMLAttributes } from 'react';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  noHover?: boolean;
  blur?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className = '', noHover = false, blur = 'none', ...props }, ref) => {
    const blurClass =
      {
        none: 'bg-[#121212]/90',
        sm: 'backdrop-blur-sm bg-[#121212]/85',
        md: 'backdrop-blur-md bg-[#121212]/80',
        lg: 'backdrop-blur-lg bg-[#121212]/75',
        xl: 'backdrop-blur-xl bg-[#121212]/70',
        '2xl': 'backdrop-blur-2xl bg-[#121212]/65',
        '3xl': 'backdrop-blur-3xl bg-[#121212]/60'
      }[blur] || 'bg-[#121212]/90';

    return (
      <div
        ref={ref}
        className={`relative ${blurClass} border border-white/10 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden ${
          !noHover ? 'transition-transform duration-100 active:scale-[0.985]' : ''
        } ${className}`}
        {...props}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        {children}
      </div>
    );
  }
);
