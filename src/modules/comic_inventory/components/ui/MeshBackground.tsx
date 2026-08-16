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

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      // Reset transform to avoid double scaling on rerenders
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const resizeObserver = new ResizeObserver(() => resize());
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    resize();

    const currentColors = isLiveMode ? theme.liveColors : theme.colors;

    const orbs: Orb[] = [
      { x: 0.15, y: 0.2,  r: 0.55, color: currentColors[0], speed: 0.0004, phase: 0 },
      { x: 0.85, y: 0.75, r: 0.60, color: currentColors[1], speed: 0.0006, phase: 2 },
      { x: 0.75, y: 0.15, r: 0.45, color: currentColors[2], speed: 0.0003, phase: 4 },
      { x: 0.25, y: 0.85, r: 0.50, color: currentColors[3], speed: 0.0005, phase: 6 }
    ];

    const parsedOrbs = orbs.map((orb) => {
      const hex = orb.color;
      const r = parseInt(hex.slice(1, 3), 16) || 100;
      const g = parseInt(hex.slice(3, 5), 16) || 100;
      const b = parseInt(hex.slice(5, 7), 16) || 200;
      return { ...orb, rStr: `${r}, ${g}, ${b}` };
    });

    const render = () => {
      time += 0.8;

      const parent = canvas.parentElement;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent ? parent.clientWidth : canvas.width / scale;
      const h = parent ? parent.clientHeight : canvas.height / scale;

      // Fill background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#020204';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'screen';

      parsedOrbs.forEach((orb) => {
        const movementX = Math.sin(time * orb.speed + orb.phase) * 0.1;
        const movementY = Math.cos(time * orb.speed + orb.phase) * 0.1;

        const x = (orb.x + movementX) * w;
        const y = (orb.y + movementY) * h;
        const radius = Math.max(w, h) * orb.r;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0,   `rgba(${orb.rStr}, 0.18)`);
        gradient.addColorStop(0.5, `rgba(${orb.rStr}, 0.05)`);
        gradient.addColorStop(1,   `rgba(${orb.rStr}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      });

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLiveMode, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 0,
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
});
