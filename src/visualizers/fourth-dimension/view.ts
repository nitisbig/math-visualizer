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

/**
 * Far edges first, each tinted and thinned by depth, so the shape reads in 3D.
 * The optional glow is a cheap halo: wide faint strokes per color, no shadowBlur.
 */
export function drawWire(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], edges: Edge[], opts: WireOpts = {}) {
  const { width = 2, color, glowBlur = 0, far = 0.35, emphasis } = opts;
  const shade = depthShade(pts, far);
  const order = edges.map((_, i) => i).sort((i, j) => mid(pts, edges[j]) - mid(pts, edges[i]));
  ctx.lineCap = "round";
  if (glowBlur > 0) {
    const byColor = new Map<string, Edge[]>();
    for (const e of edges) {
      const c = color ?? AXIS_COLORS[e.axis];
      byColor.set(c, [...(byColor.get(c) ?? []), e]);
    }
    for (const [c, list] of byColor) {
      ctx.beginPath();
      for (const e of list) {
        ctx.moveTo(pts[e.a].x, pts[e.a].y);
        ctx.lineTo(pts[e.b].x, pts[e.b].y);
      }
      for (const [k, a] of [
        [0.9, 0.06],
        [0.45, 0.12],
      ]) {
        ctx.strokeStyle = alpha(c, a);
        ctx.lineWidth = width + glowBlur * k;
        ctx.stroke();
      }
    }
  }
  for (const i of order) {
    const e = edges[i];
    const d = shade(mid(pts, e));
    ctx.strokeStyle = alpha(color ?? AXIS_COLORS[e.axis], Math.min(1, d * (emphasis?.(i) ?? 1)));
    ctx.lineWidth = width * (0.55 + 0.6 * d);
    ctx.beginPath();
    ctx.moveTo(pts[e.a].x, pts[e.a].y);
    ctx.lineTo(pts[e.b].x, pts[e.b].y);
    ctx.stroke();
  }
}

const mid = (pts: ScreenPoint[], e: Edge) => (pts[e.a].z + pts[e.b].z) / 2;

/**
 * Translucent faces, far to near. Faces turned toward the viewer are brighter
 * (projected area as a cheap stand-in for Lambert shading), near ones more so.
 */
export function drawFaces(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], faces: number[][], color: string, opacity = 0.14) {
  const depth = (f: number[]) => f.reduce((acc, i) => acc + pts[i].z, 0) / f.length;
  const area = (f: number[]) => {
    let s = 0;
    for (let k = 0; k < f.length; k++) {
      const p = pts[f[k]];
      const q = pts[f[(k + 1) % f.length]];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s) / 2;
  };
  const areas = faces.map(area);
  const maxArea = Math.max(1e-9, ...areas);
  const shade = depthShade(pts, 0.5);
  const order = faces.map((_, i) => i).sort((i, j) => depth(faces[j]) - depth(faces[i]));
  for (const i of order) {
    const f = faces[i];
    const facing = Math.sqrt(areas[i] / maxArea);
    ctx.fillStyle = alpha(color, opacity * (0.35 + 0.9 * facing) * shade(depth(f)));
    ctx.beginPath();
    f.forEach((v, k) => (k ? ctx.lineTo(pts[v].x, pts[v].y) : ctx.moveTo(pts[v].x, pts[v].y)));
    ctx.closePath();
    ctx.fill();
  }
}

/** A corner: bigger and brighter when near, smaller and dimmer when far. */
export function depthDots(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], r: number, color: string) {
  const shade = depthShade(pts, 0.4);
  for (const p of pts) {
    const d = shade(p.z);
    ctx.fillStyle = alpha(color, 0.35 + 0.65 * d);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (0.6 + 0.6 * d), 0, Math.PI * 2);
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
