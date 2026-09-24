'use client';

import { useEffect, useRef } from 'react';

type Levels = () => { mic: number; sun: number };

/**
 * The Sun: the logo's golden-hour disc rising over shimmering water. It
 * breathes at rest, swells with the traveler's voice (mic level), and
 * sends ripples across the water when the concierge speaks. Reduced motion
 * gets a still sunrise.
 */
export function SunOrb({ levels, size = 220, active = true }: { levels?: Levels; size?: number; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const levelsRef = useRef(levels);
  useEffect(() => {
    levelsRef.current = levels;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let mic = 0;
    let sun = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const read = active ? levelsRef.current?.() : undefined;
      // Ease levels so the orb swells instead of jittering.
      mic += ((read?.mic ?? 0) - mic) * 0.18;
      sun += ((read?.sun ?? 0) - sun) * 0.14;
      const w = size;
      const h = size;
      const horizon = h * 0.62;
      const breath = still ? 0 : Math.sin(t * 1.3) * 0.015;
      const r = w * (0.27 + breath + mic * 0.07 + sun * 0.035);
      const cx = w / 2;
      const rise = still ? 0 : Math.sin(t * 0.35) * 2;
      const cy = horizon - r * 0.28 + rise;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.clip();

      // Sky: near-black to a warm ember at the horizon.
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#0b0706');
      sky.addColorStop(0.7, '#2a1208');
      sky.addColorStop(1, `rgba(242,107,42,${0.35 + sun * 0.25})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      // Glow behind the disc.
      const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.2);
      glow.addColorStop(0, `rgba(247,197,72,${0.35 + mic * 0.3})`);
      glow.addColorStop(1, 'rgba(247,197,72,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, horizon);

      // The disc, cut by horizon bands like the logo's "o".
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizon);
      ctx.clip();
      const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
      disc.addColorStop(0, '#f7c548');
      disc.addColorStop(0.55, '#f26b2a');
      disc.addColorStop(1, '#e4577e');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0b06';
      for (let i = 0; i < 4; i++) {
        const y = cy + r * (0.12 + i * 0.2) + (still ? 0 : Math.sin(t * 0.8 + i) * 0.6);
        ctx.fillRect(cx - r, y, r * 2, 1.2 + i * 1.1);
      }
      ctx.restore();

      // Water.
      const sea = ctx.createLinearGradient(0, horizon, 0, h);
      sea.addColorStop(0, '#1b0d08');
      sea.addColorStop(1, '#050505');
      ctx.fillStyle = sea;
      ctx.fillRect(0, horizon, w, h - horizon);

      // Reflection: shimmering strokes that widen and ripple when the sun speaks.
      const rows = 14;
      for (let i = 0; i < rows; i++) {
        const p = i / rows;
        const y = horizon + 3 + p * (h - horizon - 6);
        const wobble = still ? 0 : Math.sin(t * 2.4 + i * 0.9) * (3 + sun * 10) * (0.4 + p);
        const half = r * (1 - p * 0.55) * (0.55 + 0.45 * Math.abs(Math.sin(t * 1.7 + i * 1.3))) + sun * 12 * p;
        const alpha = (0.75 - p * 0.6) * (0.6 + mic * 0.4);
        const grad = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
        grad.addColorStop(0, 'rgba(242,107,42,0)');
        grad.addColorStop(0.5, `rgba(247,197,72,${alpha})`);
        grad.addColorStop(1, 'rgba(242,107,42,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - half + wobble, y, half * 2, 1.4 + p * 1.6);
      }

      // Horizon line.
      ctx.fillStyle = 'rgba(247,197,72,0.45)';
      ctx.fillRect(0, horizon, w, 1);
      ctx.restore();

      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, active]);

  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} className="rounded-full shadow-[0_0_60px_-10px_rgba(242,107,42,0.55)]" />;
}
