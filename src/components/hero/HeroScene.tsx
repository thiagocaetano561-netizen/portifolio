"use client";

import { useEffect, useRef } from "react";

type V3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedron(): { v: V3[]; e: Array<[number, number]> } {
  const v: V3[] = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  const e: Array<[number, number]> = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const [a, b] = [v[i]!, v[j]!];
      if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 0.01) e.push([i, j]);
    }
  return { v, e };
}

function lattice(n: number): { v: V3[]; e: Array<[number, number]> } {
  // grade cúbica n×n×n: estrutura de dados flutuante
  const v: V3[] = [];
  const idx = (x: number, y: number, z: number) => x * n * n + y * n + z;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) v.push([x - (n - 1) / 2, y - (n - 1) / 2, z - (n - 1) / 2]);
  const e: Array<[number, number]> = [];
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        if (x + 1 < n) e.push([idx(x, y, z), idx(x + 1, y, z)]);
        if (y + 1 < n) e.push([idx(x, y, z), idx(x, y + 1, z)]);
        if (z + 1 < n) e.push([idx(x, y, z), idx(x, y, z + 1)]);
      }
  return { v, e };
}

interface Body {
  shape: { v: V3[]; e: Array<[number, number]> };
  pos: V3;
  scale: number;
  speed: V3;
  alpha: number;
}

/**
 * Cena nativa do hero: estruturas geométricas em wireframe girando devagar,
 * partículas luminosas e leve paralaxe. Decorativa (aria-hidden), limitada a
 * ~30 fps, pausada fora da tela e estática com movimento reduzido.
 * Variante "void": ambiente misterioso, mais escuro e com falhas de luz.
 */
export function HeroScene({ variant = "hero", className = "" }: { variant?: "hero" | "void"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isVoid = variant === "void";

    const bodies: Body[] = isVoid
      ? [
          { shape: lattice(4), pos: [0, 0, 7], scale: 1.6, speed: [0.06, 0.09, 0], alpha: 0.32 },
          { shape: icosahedron(), pos: [-4.5, -1.5, 9], scale: 0.9, speed: [0.12, 0.05, 0.03], alpha: 0.22 },
          { shape: icosahedron(), pos: [4.8, 1.8, 10], scale: 1.1, speed: [-0.04, 0.1, 0.02], alpha: 0.18 },
        ]
      : [
          { shape: icosahedron(), pos: [3.2, -0.2, 8], scale: 1.55, speed: [0.05, 0.08, 0.01], alpha: 0.42 },
          { shape: lattice(3), pos: [5.8, 2.6, 11], scale: 0.9, speed: [0.07, 0.04, 0.02], alpha: 0.22 },
          { shape: icosahedron(), pos: [-5.5, -2.8, 13], scale: 0.7, speed: [0.03, 0.11, 0], alpha: 0.16 },
        ];

    const particles = Array.from({ length: isVoid ? 50 : 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7,
      s: 0.2 + Math.random() * 0.8,
    }));

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const f = Math.min(w, h) * 0.9;
      const flicker = isVoid ? (Math.sin(t * 7.3) > 0.97 ? 0.35 : 1) : 1;

      for (const b of bodies) {
        const [ax, ay, az] = [b.speed[0] * t, b.speed[1] * t, b.speed[2] * t];
        const [cx, sx] = [Math.cos(ax), Math.sin(ax)];
        const [cy, sy] = [Math.cos(ay), Math.sin(ay)];
        const [cz, sz] = [Math.cos(az), Math.sin(az)];
        const proj = b.shape.v.map(([x0, y0, z0]) => {
          let x = x0 * b.scale;
          let y = y0 * b.scale;
          let z = z0 * b.scale;
          [y, z] = [y * cx - z * sx, y * sx + z * cx];
          [x, z] = [x * cy + z * sy, -x * sy + z * cy];
          [x, y] = [x * cz - y * sz, x * sz + y * cz];
          const px = x + b.pos[0] + mx * 0.35;
          const py = y + b.pos[1] + my * 0.25;
          const pz = z + b.pos[2];
          return [w / 2 + (px / pz) * f, h / 2 + (py / pz) * f, pz] as const;
        });
        ctx.lineWidth = 1;
        for (const [i, j] of b.shape.e) {
          const p = proj[i]!;
          const q = proj[j]!;
          const depth = Math.max(0.15, Math.min(1, (14 - (p[2] + q[2]) / 2) / 8));
          ctx.strokeStyle = `rgba(112, 224, 177, ${b.alpha * depth * flicker})`;
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
          ctx.stroke();
        }
        for (const p of proj) {
          const r = Math.max(0.6, 2.4 - p[2] * 0.12);
          ctx.fillStyle = `rgba(54, 217, 154, ${Math.min(0.9, b.alpha * 1.8) * flicker})`;
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const p of particles) {
        const y = ((p.y - t * 0.006 * p.s) % 1 + 1) % 1;
        const x = p.x + Math.sin(t * 0.2 + p.y * 9) * 0.004 + mx * 0.006 * p.z;
        const a = 0.15 + 0.45 * p.z * (0.5 + 0.5 * Math.sin(t * p.s * 1.7 + p.x * 20));
        ctx.fillStyle = isVoid ? `rgba(203, 188, 255, ${a * 0.6})` : `rgba(160, 240, 205, ${a * 0.55})`;
        ctx.fillRect(x * w, y * h, 1.4 * p.z + 0.4, 1.4 * p.z + 0.4);
      }
    };

    let raf = 0;
    let last = 0;
    let visible = true;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.visibilityState !== "visible") return;
      if (now - last < 33) return; // ~30 fps
      last = now;
      draw((now - start) / 1000);
    };
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(canvas);

    if (reduced) draw(12);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [variant]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
