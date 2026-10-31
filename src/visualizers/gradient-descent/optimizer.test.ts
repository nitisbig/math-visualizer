import { describe, expect, it } from "vitest";
import { FN1, FN2, FN2_IDS } from "./functions";
import { numGrad, run } from "./optimizer";

const grad2 = (id: keyof typeof FN2) => (p: number[]) => FN2[id].grad(p[0], p[1]);
const last = <T>(a: T[]) => a[a.length - 1];

describe("gradient descent", () => {
  it("converges on the bowl", () => {
    const end = last(run([-2.4, 2.1], grad2("bowl"), { lr: 0.15 }));
    expect(end.status).toBe("converged");
    expect(Math.hypot(end.p[0], end.p[1])).toBeLessThan(1e-3);
  });

  it("diverges when the learning rate is too large", () => {
    // Bowl curvature is 1, so any η > 2 overshoots by more each step.
    const end = last(run([2.6], (p) => [FN1.bowl.df(p[0])], { lr: 2.2 }));
    expect(end.status).toBe("diverged");
  });

  it("oscillates but still converges for 1 < η < 2", () => {
    const states = run([2.6], (p) => [FN1.bowl.df(p[0])], { lr: 1.6 });
    expect(Math.sign(states[1].p[0])).toBe(-1);
    expect(last(states).status).toBe("converged");
  });

  it("momentum reaches the valley floor in fewer steps", () => {
    const plain = run([-2.6, 1.4], grad2("valley"), { lr: 0.2 });
    const heavy = run([-2.6, 1.4], grad2("valley"), { lr: 0.2, beta: 0.8 });
    expect(last(heavy).status).toBe("converged");
    expect(heavy.length).toBeLessThan(plain.length);
  });

  it("each preset converges from its default start at its default η", () => {
    for (const id of FN2_IDS) {
      const fn = FN2[id];
      const end = last(run(fn.start, grad2(id), { lr: fn.lr }, 5000));
      expect(end.status, id).toBe("converged");
      const near = fn.minima.some(([mx, my]) => Math.hypot(end.p[0] - mx, end.p[1] - my) < 0.05);
      expect(near, `${id} ended at ${end.p}`).toBe(true);
    }
  });

  it("analytic gradients match numerical ones", () => {
    for (const id of FN2_IDS) {
      const fn = FN2[id];
      for (const p of [[0.3, -0.7], [1.1, 0.4], [-1.5, 1.9]]) {
        const num = numGrad((q) => fn.f(q[0], q[1]), p);
        const ana = fn.grad(p[0], p[1]);
        expect(ana[0]).toBeCloseTo(num[0], 4);
        expect(ana[1]).toBeCloseTo(num[1], 4);
      }
    }
    for (const fn of Object.values(FN1)) {
      expect(fn.df(0.7)).toBeCloseTo(numGrad((q) => fn.f(q[0]), [0.7])[0], 5);
    }
  });

  it("1D two-valley minima are where the slope is zero", () => {
    for (const m of FN1.valleys.minima) expect(Math.abs(FN1.valleys.df(m))).toBeLessThan(1e-3);
  });
});
