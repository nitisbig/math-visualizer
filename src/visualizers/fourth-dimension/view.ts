// Shared drawing for the 4D widgets: drag-to-orbit and depth-shaded wireframes.
import { useRef, useState } from "react";
import { glow } from "../../lib/canvas";
import { C, alpha } from "../../lib/theme";
import type { Edge, Orbit, ScreenPoint } from "./math";

/** Edges are colored by the axis they run along: x red, y orange, z yellow, w blue. */
export const AXIS_COLORS = [C.x, C.y, C.z, C.blue] as const;
export const AXIS_TOKENS = ["x", "y", "z", "blue"] as const;

/** Drag on the canvas to turn the 3D shadow (an ordinary 3D rotation). */
export function useOrbit(initial: Orbit, pitchLimit = 1.45) {
  const [orbit, setOrbit] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const end = () => {
    last.current = null;
    setDragging(false);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      last.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!last.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      setOrbit((o) => ({ yaw: o.yaw + dx * 0.01, pitch: Math.max(-pitchLimit, Math.min(pitchLimit, o.pitch + dy * 0.01)) }));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
  return { orbit, setOrbit, dragging, handlers };
}

/** Near things bright, far things dim (between `far` and 1). */
export function depthShade(pts: ScreenPoint[], far = 0.35) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p.z);
    hi = Math.max(hi, p.z);
  }
  const span = hi - lo || 1;
  return (z: number) => far + (1 - far) * ((hi - z) / span);
}

type WireOpts = {
  width?: number;
  /** One color for every edge instead of the axis colors. */
  color?: string;
  glowBlur?: number;
  far?: number;
  /** Extra opacity multiplier per edge (e.g. to lift the moving edges). */
  emphasis?: (i: number) => number;
};

/** Far edges first, each tinted by depth; an optional soft glow pass per color. */
export function drawWire(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], edges: Edge[], opts: WireOpts = {}) {
  const { width = 2, color, glowBlur = 0, far = 0.35, emphasis } = opts;
  const shade = depthShade(pts, far);
  const order = edges.map((_, i) => i).sort((i, j) => mid(pts, edges[j]) - mid(pts, edges[i]));
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  if (glowBlur > 0) {
    const byColor = new Map<string, Edge[]>();
    for (const e of edges) {
      const c = color ?? AXIS_COLORS[e.axis];
      byColor.set(c, [...(byColor.get(c) ?? []), e]);
    }
    ctx.save();
    for (const [c, list] of byColor) {
      ctx.strokeStyle = alpha(c, 0.5);
      ctx.shadowColor = c;
      ctx.shadowBlur = glowBlur;
      ctx.beginPath();
      for (const e of list) {
        ctx.moveTo(pts[e.a].x, pts[e.a].y);
        ctx.lineTo(pts[e.b].x, pts[e.b].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const i of order) {
    const e = edges[i];
    const a = Math.min(1, shade(mid(pts, e)) * (emphasis?.(i) ?? 1));
    ctx.strokeStyle = alpha(color ?? AXIS_COLORS[e.axis], a);
    ctx.beginPath();
    ctx.moveTo(pts[e.a].x, pts[e.a].y);
    ctx.lineTo(pts[e.b].x, pts[e.b].y);
    ctx.stroke();
  }
}

const mid = (pts: ScreenPoint[], e: Edge) => (pts[e.a].z + pts[e.b].z) / 2;

/** Translucent filled polygons, far to near. */
export function drawFaces(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], faces: number[][], fill: string) {
  const depth = (f: number[]) => f.reduce((acc, i) => acc + pts[i].z, 0) / f.length;
  ctx.fillStyle = fill;
  for (const f of [...faces].sort((a, b) => depth(b) - depth(a))) {
    ctx.beginPath();
    f.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)));
    ctx.closePath();
    ctx.fill();
  }
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, blur = 10) {
  ctx.fillStyle = color;
  glow(ctx, color, blur, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Draws text runs left to right, each in its own color (e.g. a plane name "zw"). */
export function colorText(ctx: CanvasRenderingContext2D, runs: [string, string][], x: number, y: number) {
  ctx.textAlign = "left";
  for (const [text, color] of runs) {
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    x += ctx.measureText(text).width;
  }
  return x;
}
