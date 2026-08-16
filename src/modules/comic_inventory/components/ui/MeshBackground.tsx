import React, { memo, useEffect, useRef } from 'react';
import { MeshTheme } from '../../types';

interface MeshBackgroundProps {
  isLiveMode: boolean;
  theme: MeshTheme;
}

interface Orb {
  x: number;
  y: number;
  r: number;
  color: string;
  speed: number;
  phase: number;
  rStr?: string;
}

export const MeshBackground: React.FC<MeshBackgroundProps> = memo(({ isLiveMode, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      ctx.scale(scale, scale);
    };

    window.addEventListener('resize', resize);
    resize();

    const currentColors = isLiveMode ? theme.liveColors : theme.colors;

    const orbs: Orb[] = [
      { x: 0.1, y: 0.2, r: 0.5, color: currentColors[0], speed: 0.0004, phase: 0 },
      { x: 0.9, y: 0.8, r: 0.6, color: currentColors[1], speed: 0.0006, phase: 2 },
      { x: 0.8, y: 0.2, r: 0.4, color: currentColors[2], speed: 0.0003, phase: 4 },
      { x: 0.2, y: 0.8, r: 0.5, color: currentColors[3], speed: 0.0005, phase: 6 }
    ];

    const parsedOrbs = orbs.map((orb) => {
      const hex = orb.color;
      const r = parseInt(hex.slice(1, 3), 16) || 100;
      const g = parseInt(hex.slice(3, 5), 16) || 100;
      const b = parseInt(hex.slice(5, 7), 16) || 200;
      return {
        ...orb,
        rStr: `${r}, ${g}, ${b}`
      };
    });

    const render = () => {
      time += 0.8;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.fillStyle = '#020204';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'screen';

      parsedOrbs.forEach((orb) => {
        const movementX = Math.sin(time * orb.speed + orb.phase) * 0.12;
        const movementY = Math.cos(time * orb.speed + orb.phase) * 0.12;

        const x = (orb.x + movementX) * w;
        const y = (orb.y + movementY) * h;
        const radius = Math.max(w, h) * orb.r;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${orb.rStr}, 0.15)`);
        gradient.addColorStop(0.5, `rgba(${orb.rStr}, 0.04)`);
        gradient.addColorStop(1, `rgba(${orb.rStr}, 0)`);

        ctx.fillStyle = gradient;

        const startX = Math.max(0, x - radius);
        const startY = Math.max(0, y - radius);
        const rectW = Math.min(w - startX, radius * 2);
        const rectH = Math.min(h - startY, radius * 2);

        if (rectW > 0 && rectH > 0) {
          ctx.fillRect(startX, startY, rectW, rectH);
        }
      });

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLiveMode, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ease-in-out"
      style={{ zIndex: 0, width: '100%', height: '100%' }}
    />
  );
});
