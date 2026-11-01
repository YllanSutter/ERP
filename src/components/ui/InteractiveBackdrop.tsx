import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Fond animé : étoiles qui dérivent et grille qui s'allume au survol.
// Remplit son parent positionné ; couleurs surchargeables par className via les variables --bd-*.
const THEME =
  '[--bd-bg:#f6f7f9] [--bd-line:rgba(15,23,42,0.09)] [--bd-star:rgba(15,23,42,0.32)] [--bd-accent:#d9971f] [--bd-grid:rgba(15,23,42,0.02)] ' +
  'dark:[--bd-bg:#0e1012] dark:[--bd-line:rgba(255,255,255,0.07)] dark:[--bd-star:rgba(255,255,255,0.4)] dark:[--bd-accent:#f2b441] dark:[--bd-grid:rgba(255,255,255,0.018)]';
const FALLOFF = [1, 0.55, 0.25]; // intensité de la case survolée puis des anneaux voisins
const FADE_MS = 650;
const FRAME_MS = 1000 / 30;

type Star = { x: number; y: number; r: number; vx: number; vy: number; phase: number; accent: boolean };

export function InteractiveBackdrop({ className, cellSize = 18 }: { className?: string; cellSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cells = new Map<string, number>();
    let stars: Star[] = [];
    let rect = canvas.getBoundingClientRect();
    let ratio = 1;
    let frame = 0;
    let last = 0;
    let pointer: { x: number; y: number } | null = null;
    const animated = () => !reduced.matches && !document.hidden;

    const resize = () => {
      rect = canvas.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      stars = Array.from({ length: Math.round((rect.width * rect.height) / 11000) }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: 0.6 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        phase: Math.random() * Math.PI * 2,
        accent: Math.random() < 0.03,
      }));
      cells.clear();
      draw();
      schedule();
    };

    const light = (cx: number, cy: number) => {
      const n = FALLOFF.length - 1;
      for (let dx = -n; dx <= n; dx++)
        for (let dy = -n; dy <= n; dy++) {
          const v = FALLOFF[Math.max(Math.abs(dx), Math.abs(dy))];
          const key = `${cx + dx},${cy + dy}`;
          if ((cells.get(key) ?? 0) < v) cells.set(key, v);
        }
    };

    const move = (e: PointerEvent) => {
      if (!animated() || e.pointerType === 'touch') return;
      rect = canvas.getBoundingClientRect();
      const to = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (to.x < 0 || to.y < 0 || to.x > rect.width || to.y > rect.height) { pointer = null; return; }
      const from = pointer ?? to;
      // Interpole les mouvements rapides pour laisser une traînée continue.
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (cellSize / 2)));
      for (let s = 1; s <= steps; s++)
        light(Math.floor((from.x + ((to.x - from.x) * s) / steps) / cellSize), Math.floor((from.y + ((to.y - from.y) * s) / steps) / cellSize));
      pointer = to;
      schedule();
    };

    const draw = () => {
      const css = getComputedStyle(canvas);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      // Chaque case allumée trace son bord haut/gauche et celui de ses voisines bas/droite.
      const h = new Map<string, number>();
      const v = new Map<string, number>();
      const keep = (map: Map<string, number>, key: string, a: number) => (map.get(key) ?? 0) < a && map.set(key, a);
      for (const [key, a] of cells) {
        const [x, y] = key.split(',').map(Number);
        keep(h, key, a); keep(h, `${x},${y + 1}`, a);
        keep(v, key, a); keep(v, `${x + 1},${y}`, a);
      }
      ctx.fillStyle = css.getPropertyValue('--bd-line');
      for (const [key, a] of h) { const [x, y] = key.split(',').map(Number); ctx.globalAlpha = a; ctx.fillRect(x * cellSize, y * cellSize, cellSize + 1, 1); }
      for (const [key, a] of v) { const [x, y] = key.split(',').map(Number); ctx.globalAlpha = a; ctx.fillRect(x * cellSize, y * cellSize, 1, cellSize + 1); }
      const starColor = css.getPropertyValue('--bd-star');
      const accent = css.getPropertyValue('--bd-accent');
      for (const s of stars) {
        ctx.globalAlpha = animated() ? 0.55 + 0.45 * Math.sin(s.phase) ** 2 : 0.8;
        ctx.fillStyle = s.accent ? accent : starColor;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.accent ? s.r + 0.4 : s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (last && now - last < FRAME_MS - 4) return schedule();
      const dt = last ? Math.min(100, now - last) : FRAME_MS;
      last = now;
      for (const s of stars) {
        s.x = (s.x + (s.vx * dt) / 1000 + rect.width) % rect.width;
        s.y = (s.y + (s.vy * dt) / 1000 + rect.height) % rect.height;
        s.phase += dt / 1400;
      }
      const fade = Math.exp(-dt / FADE_MS);
      for (const [key, a] of cells) a * fade < 0.02 ? cells.delete(key) : cells.set(key, a * fade);
      draw();
      schedule();
    };

    function schedule() {
      if (!frame && animated()) frame = requestAnimationFrame(tick);
      else if (!animated()) { last = 0; draw(); }
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const themeObserver = new MutationObserver(draw); // redessine les couleurs au changement de thème
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', schedule);
      reduced.removeEventListener('change', schedule);
      cancelAnimationFrame(frame);
    };
  }, [cellSize]);

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-[var(--bd-bg)]', THEME, className)}>
      <div
        className="absolute inset-0 [background-image:linear-gradient(var(--bd-grid)_1px,transparent_1px),linear-gradient(90deg,var(--bd-grid)_1px,transparent_1px)]"
        style={{ backgroundSize: `${cellSize}px ${cellSize}px` }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
