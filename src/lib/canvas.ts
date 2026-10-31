import { useEffect, useRef, type DependencyList } from "react";

export type Size = { w: number; h: number };
export type DrawFn = (ctx: CanvasRenderingContext2D, size: Size) => void;

/**
 * A DPR-aware canvas that redraws on resize and whenever `deps` change.
 * Size it with CSS (width: 100% + aspect-ratio); drawing happens in CSS pixels.
 */
export function useCanvas(draw: DrawFn, deps: DependencyList) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const sizeRef = useRef<Size>({ w: 0, h: 0 });

  const paint = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || sizeRef.current.w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
    drawRef.current(ctx, sizeRef.current);
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: width, h: height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      paint();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(paint, deps);

  return { ref, size: sizeRef, redraw: paint };
}

/** Calls `tick(dtSeconds)` every frame while `running` is true. */
export function useRaf(tick: (dt: number) => void, running: boolean) {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!running) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      tickRef.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Linear map from a domain to a pixel range, with its inverse. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0);
  const f = (v: number) => r0 + (v - d0) * k;
  f.invert = (p: number) => d0 + (p - r0) / k;
  return f;
}
export type Scale = ReturnType<typeof scale>;

/** Pointer position in CSS pixels relative to the canvas. */
export function pointerPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** Runs `fn` twice: once as a soft glow, once crisp. Keeps glow a highlight, not a wash. */
export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number, fn: () => void) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
  fn();
}

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  head = 8,
) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const h = Math.min(head, len * 0.6);
  line(ctx, x0, y0, x1, y1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45));
  ctx.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** Faint dot grid, the only allowed background texture. */
export function dotGrid(ctx: CanvasRenderingContext2D, { w, h }: Size, spacing = 32, color = "rgba(245,247,250,0.07)") {
  ctx.fillStyle = color;
  for (let x = spacing / 2; x < w; x += spacing) {
    for (let y = spacing / 2; y < h; y += spacing) {
      ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
  }
}

/** Axis lines through the origin (clamped to the frame), with optional ticks. */
export function axes(
  ctx: CanvasRenderingContext2D,
  sx: Scale,
  sy: Scale,
  size: Size,
  opts: { color: string; ticks?: { x?: number[]; y?: number[] }; label?: string; font?: string } ,
) {
  const x0 = Math.max(0, Math.min(size.w, sx(0)));
  const y0 = Math.max(0, Math.min(size.h, sy(0)));
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = 1;
  line(ctx, 0, y0, size.w, y0);
  line(ctx, x0, 0, x0, size.h);
  if (!opts.ticks) return;
  ctx.fillStyle = opts.label ?? opts.color;
  ctx.font = opts.font ?? "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const t of opts.ticks.x ?? []) {
    const x = sx(t);
    line(ctx, x, y0 - 3, x, y0 + 3);
    ctx.fillText(fmtTick(t), x, y0 + 6);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of opts.ticks.y ?? []) {
    const y = sy(t);
    line(ctx, x0 - 3, y, x0 + 3, y);
    ctx.fillText(fmtTick(t), x0 - 6, y);
  }
}

function fmtTick(t: number) {
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}
