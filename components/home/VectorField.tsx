'use client';

// A slowly rotating 3D point cloud drawn on a 2D canvas: every point is a
// "chunk", clusters are concepts. The active query point flies to its cluster
// and wires itself to its nearest neighbours — the product, visualised.
import { useEffect, useRef } from 'react';
import { cssVar, useTheme } from '@/lib/client/theme';
import { CLUSTERS } from './demoData';

interface Point {
  x: number;
  y: number;
  z: number;
  c: number; // cluster index, -1 for background noise
  r: number;
}

function gaussian(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Deterministic PRNG so server and client agree and the cloud is stable.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCloud(): Point[] {
  const rand = mulberry32(7);
  const pts: Point[] = [];
  CLUSTERS.forEach((cl, c) => {
    for (let i = 0; i < 46; i++) {
      pts.push({
        x: cl.center[0] + gaussian(rand) * 0.17,
        y: cl.center[1] + gaussian(rand) * 0.17,
        z: cl.center[2] + gaussian(rand) * 0.17,
        c,
        r: 0.7 + rand() * 1.1,
      });
    }
  });
  for (let i = 0; i < 90; i++) {
    pts.push({ x: rand() * 2.4 - 1.2, y: rand() * 2.4 - 1.2, z: rand() * 2.4 - 1.2, c: -1, r: 0.5 + rand() * 0.8 });
  }
  return pts;
}

export function VectorField({ active, className = '' }: { active: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const colorsRef = useRef<string[]>([]);
  const theme = useTheme();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    colorsRef.current = [
      ...CLUSTERS.map((c) => cssVar(c.color, '#a996ff')),
      cssVar('--faint', '#6b6682'),
      cssVar('--text', '#f2f0f9'),
      cssVar('--surface', '#12101c'),
      cssVar('--lime', '#c8f34a'),
    ];
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cloud = buildCloud();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let t = 0;
    let last = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    // The query point eases between cluster centres.
    const q = { x: 0, y: 0, z: 0, from: [0, 0, 0], to: [...CLUSTERS[0].center], start: 0, shown: -1 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove);
    const onVisibility = () => {
      if (!document.hidden && visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    function rotate(x: number, y: number, z: number, ay: number, ax: number) {
      const cy = Math.cos(ay);
      const sy = Math.sin(ay);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      return { x: x1, y: y * cx - z1 * sx, z: y * sx + z1 * cx };
    }

    function frame(now: number) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) t += dt;
      draw(now);
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    function draw(now: number) {
      if (!ctx) return;
      const colors = colorsRef.current;
      const faint = colors[CLUSTERS.length] ?? '#6b6682';
      const text = colors[CLUSTERS.length + 1] ?? '#fff';
      const surface = colors[CLUSTERS.length + 2] ?? '#111';
      const lime = colors[CLUSTERS.length + 3] ?? '#c8f34a';

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const ay = t * 0.12 + mouse.x * 0.45;
      const ax = -0.28 + mouse.y * 0.22;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width, height) * 0.62;
      const cx = width / 2;
      const cy = height / 2;
      const camera = 3;
      const project = (p: { x: number; y: number; z: number }) => {
        const r = rotate(p.x, p.y, p.z, ay, ax);
        const k = camera / (camera + r.z);
        return { sx: cx + r.x * scale * k * 0.9, sy: cy + r.y * scale * k * 0.9, k, depth: r.z };
      };

      // Retarget the query when the active cluster changes.
      const active = activeRef.current;
      if (q.shown !== active) {
        q.from = [q.x, q.y, q.z];
        q.to = [...CLUSTERS[active].center];
        q.to[0] += 0.12;
        q.to[1] -= 0.1;
        q.start = now;
        q.shown = active;
      }
      const travel = Math.min(1, (now - q.start) / 1100);
      const ease = 1 - Math.pow(1 - travel, 4);
      q.x = q.from[0] + (q.to[0] - q.from[0]) * ease;
      q.y = q.from[1] + (q.to[1] - q.from[1]) * ease - Math.sin(ease * Math.PI) * 0.25;
      q.z = q.from[2] + (q.to[2] - q.from[2]) * ease;
      const wire = Math.max(0, Math.min(1, (now - q.start - 900) / 700));

      const projected = cloud.map((p) => ({ p, ...project(p) }));
      projected.sort((a, b) => b.depth - a.depth);

      // Nearest neighbours of the query (in 3D, like the real HNSW lookup).
      const neighbours = cloud
        .map((p, i) => ({ i, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 7);
      const qp = project(q);

      for (const { p, sx, sy, k } of projected) {
        const isActive = p.c === active;
        const color = p.c < 0 ? faint : colors[p.c] ?? faint;
        const alpha = Math.max(0.08, Math.min(1, (k - 0.55) * 1.6)) * (p.c < 0 ? 0.5 : isActive ? 1 : 0.7);
        const radius = p.r * k * (isActive ? 2.8 : 2.1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        if (isActive && wire > 0) {
          ctx.globalAlpha = alpha * 0.18 * wire;
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Wires from the query to its neighbours.
      ctx.lineWidth = 1.2;
      neighbours.forEach((n, idx) => {
        const target = project(cloud[n.i]);
        const grow = Math.max(0, Math.min(1, wire * 1.6 - idx * 0.12));
        if (grow <= 0) return;
        const ex = qp.sx + (target.sx - qp.sx) * grow;
        const ey = qp.sy + (target.sy - qp.sy) * grow;
        const g = ctx.createLinearGradient(qp.sx, qp.sy, ex, ey);
        g.addColorStop(0, lime);
        g.addColorStop(1, colors[active] ?? lime);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(qp.sx, qp.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });

      // The query point: a lime core with an expanding ring.
      const pulse = ((now / 1400) % 1 + 1) % 1;
      ctx.globalAlpha = 0.5 * (1 - pulse);
      ctx.strokeStyle = lime;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(qp.sx, qp.sy, 6 + pulse * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = lime;
      ctx.shadowColor = lime;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(qp.sx, qp.sy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Labels on the three nearest chunks.
      if (wire > 0.35) {
        const labels = CLUSTERS[active].labels;
        const fontSize = width < 520 ? 10.5 : 12;
        ctx.font = `500 ${fontSize}px ui-monospace, 'JetBrains Mono', Menlo, monospace`;
        neighbours.slice(0, 3).forEach((n, idx) => {
          const pos = project(cloud[n.i]);
          const label = labels[idx % labels.length];
          const a = Math.max(0, Math.min(1, (wire - 0.35 - idx * 0.12) * 3));
          if (a <= 0) return;
          const w = ctx.measureText(label).width + 16;
          const h = fontSize + 12;
          const lx = Math.min(width - w - 6, Math.max(6, pos.sx + 12));
          const ly = Math.min(height - h - 6, Math.max(6, pos.sy - h - 6 - idx * 4));
          ctx.globalAlpha = 0.92 * a;
          ctx.fillStyle = surface;
          ctx.beginPath();
          ctx.roundRect(lx, ly, w, h, h / 2);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.strokeStyle = colors[active] ?? lime;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = text;
          ctx.fillText(label, lx + 8, ly + h / 2 + fontSize / 2.9);
        });
      }
      ctx.globalAlpha = 1;
    }

    raf = requestAnimationFrame(frame);
    if (reduce) draw(performance.now() + 5000);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
