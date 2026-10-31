import { describe, expect, it } from "vitest";
import { compound, expi, matchingDigits, polygon } from "./math";

describe("Euler's number", () => {
  it("compounding once doubles, more often approaches e from below", () => {
    expect(compound(1)).toBe(2);
    expect(compound(12)).toBeCloseTo(2.613, 3);
    let prev = 0;
    for (const n of [1, 2, 10, 100, 1e4, 1e6]) {
      const v = compound(n);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThan(Math.E);
      prev = v;
    }
    expect(compound(1e6)).toBeCloseTo(Math.E, 5);
  });

  it("counts matching digits of e", () => {
    expect(matchingDigits(2)).toBe(2); // "2."
    expect(matchingDigits(2.7)).toBe(3); // "2.7"
    expect(matchingDigits(2.718)).toBe(5);
    expect(matchingDigits(Math.E)).toBe(17);
  });

  it("the compounding polygon lands on e^{iθ} as n grows", () => {
    for (const theta of [0.5, Math.PI / 2, Math.PI]) {
      const target = expi(theta);
      const err = (n: number) => {
        const end = polygon(theta, n)[n];
        return Math.hypot(end[0] - target[0], end[1] - target[1]);
      };
      expect(err(1000)).toBeLessThan(err(10));
      expect(err(1000)).toBeLessThan(0.01);
    }
  });

  it("e^{iπ} = −1", () => {
    const [re, im] = expi(Math.PI);
    expect(re).toBeCloseTo(-1, 12);
    expect(im).toBeCloseTo(0, 12);
  });
});
