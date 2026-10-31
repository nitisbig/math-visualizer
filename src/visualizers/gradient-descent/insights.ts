// Live one-line explanations for the gradient descent widgets.
// Near a minimum with curvature k, one plain step scales the distance to the
// bottom by r = 1 − ηk, and that one number decides how the run behaves.
import { fmt, fmtSig } from "../../lib/format";
import type { Fn1, Fn2 } from "./functions";
import type { OptState } from "./optimizer";

export type Regime = "crawl" | "smooth" | "jump" | "zigzag" | "diverge";

export function regime(lr: number, k: number): Regime {
  const r = 1 - lr * k;
  if (Math.abs(r) > 1) return "diverge";
  if (Math.abs(r) < 0.05) return "jump";
  if (r < 0) return "zigzag";
  if (r > 0.85) return "crawl";
  return "smooth";
}

/** f″ by central difference of f′. */
export function curvature1D(fn: Fn1, x: number, h = 1e-4): number {
  return (fn.df(x + h) - fn.df(x - h)) / (2 * h);
}

const nearestBy = <T>(items: T[], d: (t: T) => number) =>
  items.reduce((best, t) => (d(t) < d(best) ? t : best));

const pct = (v: number) => `${Math.round(v * 100)}%`;

function settled(values: number[], at: number) {
  if (values.length < 2) return "";
  return at <= Math.min(...values) + 1e-6
    ? " It found the deeper minimum."
    : " It stopped in the shallower minimum: gradient descent only feels the local slope.";
}

export function insight1D(fn: Fn1, lr: number, s: OptState): string {
  const x = s.p[0];
  if (s.status === "diverged") return `η = ${fmtSig(lr)} is too large: every step overshoots by more than it corrects, so the ball flies off.`;
  const m = nearestBy(fn.minima, (v) => Math.abs(v - x));
  if (s.status === "converged") {
    return `Converged in ${s.iter} steps.` + settled(fn.minima.map(fn.f), fn.f(m));
  }
  const k = curvature1D(fn, m);
  const r = 1 - lr * k;
  const ek = fmt(lr * k, 2);
  switch (regime(lr, k)) {
    case "diverge":
      return `η × curvature = ${ek}, above 2: each step overshoots more than the last. Expect it to blow up.`;
    case "jump":
      return `η × curvature ≈ 1: near the bottom a single step lands almost exactly on the minimum.`;
    case "zigzag":
      return `η × curvature = ${ek}: each step jumps past the bottom and lands ${pct(-r)} as far out on the other side, so it zig-zags in.`;
    case "crawl":
      return `Tiny steps: near the bottom each one closes only ${pct(1 - r)} of the remaining gap, so the ball crawls.`;
    default:
      return `Each step closes about ${pct(1 - r)} of the remaining gap: a steady roll into the minimum.`;
  }
}

/** Eigenvalues [λmin, λmax] of the Hessian, from central differences of the gradient. */
export function hessianEig(fn: Fn2, x: number, y: number, h = 1e-4): [number, number] {
  const [ax, ay] = fn.grad(x + h, y);
  const [bx, by] = fn.grad(x - h, y);
  const [cx, cy] = fn.grad(x, y + h);
  const [dx, dy] = fn.grad(x, y - h);
  const hxx = (ax - bx) / (2 * h);
  const hyy = (cy - dy) / (2 * h);
  const hxy = ((ay - by) / (2 * h) + (cx - dx) / (2 * h)) / 2;
  const t = (hxx + hyy) / 2;
  const q = Math.sqrt(Math.max(0, t * t - (hxx * hyy - hxy * hxy)));
  return [t - q, t + q];
}

export function insight2D(fn: Fn2, lr: number, beta: number, s: OptState, maxSteps: number): string {
  const [x, y] = s.p;
  if (s.status === "diverged") return `η = ${fmtSig(lr)} is too large for the steepest wall: the ball overshoots further every step and escapes. Lower η.`;
  const [mx, my] = nearestBy(fn.minima, ([a, b]) => Math.hypot(a - x, b - y));
  if (s.status === "converged") {
    const tip = beta === 0 && s.iter > 150 ? " Try momentum to get there faster." : "";
    return `Converged in ${s.iter} steps.` + settled(fn.minima.map(([a, b]) => fn.f(a, b)), fn.f(mx, my)) + tip;
  }
  if (s.iter >= maxSteps) return `Still going after ${maxSteps} steps: the flat direction is too slow at this η.`;

  const [lo, hi] = hessianEig(fn, mx, my);
  const ratio = hi / Math.max(lo, 1e-9);
  const steep = `the surface is ${Math.round(ratio)}× steeper one way than the other`;
  if (beta > 0) {
    const coast = fn.minima.length > 1 ? " and can coast over a shallow dip into a deeper one" : "";
    return `Momentum keeps ${pct(beta)} of its velocity each step, so it builds speed along gentle slopes, damps the zig-zag${coast}.`;
  }
  if (lr * hi > 2) return `η × steepest curvature = ${fmt(lr * hi, 2)}, above 2: steps across the steep direction grow each time. This will diverge.`;
  if (lr * hi > 1 && ratio > 3) return `Steps overshoot across the steep direction (zig-zag) while crawling along the flat one: ${steep}.`;
  if (ratio > 3) return `Safe steps, but ${steep}: the flat direction closes only ${pct(lr * lo)} of its gap per step.`;
  return `Each step closes about ${pct(Math.min(1, lr * lo))} of the gap to the bottom.`;
}
