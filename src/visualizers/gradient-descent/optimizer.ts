// Gradient descent (optionally with momentum) on vectors of any length.

export type Status = "running" | "converged" | "diverged";

export type OptState = {
  p: number[];
  /** Velocity (momentum buffer). */
  v: number[];
  iter: number;
  status: Status;
};

export type OptConfig = {
  lr: number;
  /** Momentum β in [0, 1). 0 = plain gradient descent. */
  beta?: number;
  /** |∇| below this counts as converged. */
  tol?: number;
  /** |p| above this counts as diverged. */
  limit?: number;
};

export function init(p: number[]): OptState {
  return { p: [...p], v: p.map(() => 0), iter: 0, status: "running" };
}

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

/** Central-difference gradient, for functions without an analytic one. */
export function numGrad(f: (p: number[]) => number, p: number[], h = 1e-5): number[] {
  return p.map((_, i) => {
    const a = [...p];
    const b = [...p];
    a[i] += h;
    b[i] -= h;
    return (f(a) - f(b)) / (2 * h);
  });
}

/** One update: v ← βv + ∇f(p),  p ← p − ηv. */
export function step(s: OptState, grad: (p: number[]) => number[], cfg: OptConfig): OptState {
  if (s.status !== "running") return s;
  const { lr, beta = 0, tol = 1e-4, limit = 1e4 } = cfg;
  const g = grad(s.p);
  const v = s.v.map((vi, i) => beta * vi + g[i]);
  const p = s.p.map((pi, i) => pi - lr * v[i]);

  let status: Status = "running";
  if (!p.every(Number.isFinite) || norm(p) > limit) status = "diverged";
  else if (norm(grad(p)) < tol && norm(v) * lr < tol) status = "converged";
  return { p, v, iter: s.iter + 1, status };
}

/** Runs until converged, diverged, or `maxIter` steps. Returns every state visited. */
export function run(p0: number[], grad: (p: number[]) => number[], cfg: OptConfig, maxIter = 1000): OptState[] {
  const out = [init(p0)];
  while (out.length <= maxIter && out[out.length - 1].status === "running") {
    out.push(step(out[out.length - 1], grad, cfg));
  }
  return out;
}
