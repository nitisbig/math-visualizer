import { describe, expect, it } from "vitest";
import { hypercube } from "./math";
import { buildInsight, rotateInsight, sliceInsight } from "./insights";

const COUNTS = [0, 1, 2, 3, 4].map((n) => ({ V: hypercube(n).verts.length, E: hypercube(n).edges.length }));

describe("4D insights", () => {
  it("build states the edge rule", () => {
    expect(buildInsight(3, 0, COUNTS)).toMatch(/8 corners and 12 edges \(2 × 4 \+ 4\)/);
    expect(buildInsight(4, 0, COUNTS)).toMatch(/32 edges \(2 × 12 \+ 8\)/);
    expect(buildInsight(2, 0.5, COUNTS)).toMatch(/along z/);
  });
  it("rotate names the still axes", () => {
    expect(rotateInsight("zw", "persp", 0.6, 1.4)).toMatch(/x and y pass straight through/);
    expect(rotateInsight("xy", "ortho", 0, 1)).toMatch(/collapse/);
    expect(rotateInsight("double", "persp", 0.6, 1.4)).toMatch(/double rotation/);
  });
  it("slice spots the octahedron", () => {
    expect(sliceInsight("corner", 2, 4, "Octahedron")).toMatch(/octahedron/);
    expect(sliceInsight("edge", 0.5, 2, "Triangular prism")).toMatch(/entering .* triangular prism/);
  });
});
