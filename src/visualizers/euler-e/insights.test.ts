import { describe, expect, it } from "vitest";
import { circleInsight, compoundInsight, derivativeInsight } from "./insights";

describe("Euler insights", () => {
  it("compounding reports the shrinking gain", () => {
    expect(compoundInsight(1)).toMatch(/becomes \$2/);
    expect(compoundInsight(12)).toMatch(/^12 payments give \$2\.61304/);
  });
  it("derivative tells which way to move a", () => {
    expect(derivativeInsight(2)).toMatch(/Raise a/);
    expect(derivativeInsight(3.5)).toMatch(/Lower a/);
    expect(derivativeInsight(Math.E)).toMatch(/its own derivative/);
  });
  it("circle names Euler's identity and the polygon overshoot", () => {
    expect(circleInsight(Math.PI, false, 6)).toMatch(/e\^iπ \+ 1 = 0/);
    expect(circleInsight(1, true, 1)).toMatch(/radius 1\.414/);
  });
});
