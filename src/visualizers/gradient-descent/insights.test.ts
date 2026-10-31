import { describe, expect, it } from "vitest";
import { FN1, FN2 } from "./functions";
import { curvature1D, hessianEig, insight1D, insight2D, regime } from "./insights";
import { init, run } from "./optimizer";

describe("regime", () => {
  it("classifies η·k the way the 1D page describes it", () => {
    expect(regime(0.1, 1)).toBe("crawl");
    expect(regime(0.5, 1)).toBe("smooth");
    expect(regime(1.0, 1)).toBe("jump");
    expect(regime(1.8, 1)).toBe("zigzag");
    expect(regime(2.2, 1)).toBe("diverge");
  });
});

describe("curvature and Hessian", () => {
  it("bowl has curvature 1", () => {
    expect(curvature1D(FN1.bowl, 0)).toBeCloseTo(1, 6);
  });
  it("narrow valley has eigenvalues 0.2 and 4", () => {
    const [lo, hi] = hessianEig(FN2.valley, 0, 0);
    expect(lo).toBeCloseTo(0.2, 5);
    expect(hi).toBeCloseTo(4, 5);
  });
});

describe("insight1D", () => {
  it("names the zig-zag and the blow-up", () => {
    expect(insight1D(FN1.bowl, 1.8, init([2.6]))).toMatch(/zig-zag/);
    expect(insight1D(FN1.bowl, 2.2, init([2.6]))).toMatch(/above 2/);
  });
  it("reports divergence and convergence from the run", () => {
    const grad = (p: number[]) => [FN1.bowl.df(p[0])];
    const blown = run([2.6], grad, { lr: 2.2, tol: 1e-3, limit: 8 });
    expect(insight1D(FN1.bowl, 2.2, blown[blown.length - 1])).toMatch(/flies off/);
    const ok = run([2.6], grad, { lr: 0.3, tol: 1e-3, limit: 8 });
    expect(insight1D(FN1.bowl, 0.3, ok[ok.length - 1])).toMatch(/^Converged in \d+ steps\.$/);
  });
  it("tells which valley it settled in", () => {
    const grad = (p: number[]) => [FN1.valleys.df(p[0])];
    const s = run([2.4], grad, { lr: 0.05, tol: 1e-3, limit: 8 });
    expect(insight1D(FN1.valleys, 0.05, s[s.length - 1])).toMatch(/shallower/);
  });
});

describe("insight2D", () => {
  it("explains the narrow valley zig-zag for plain gradient descent", () => {
    expect(insight2D(FN2.valley, 0.45, 0, init(FN2.valley.start), 3000)).toMatch(/zig-zag/);
  });
  it("warns before divergence", () => {
    expect(insight2D(FN2.valley, 0.6, 0, init(FN2.valley.start), 3000)).toMatch(/diverge/);
  });
  it("describes momentum", () => {
    expect(insight2D(FN2.wells, 0.3, 0.9, init(FN2.wells.start), 3000)).toMatch(/90%/);
  });
});
