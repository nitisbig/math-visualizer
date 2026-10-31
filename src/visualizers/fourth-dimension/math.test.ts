import { describe, expect, it } from "vitest";
import {
  LEADS,
  TESSERACT,
  apply,
  buildStage,
  centered,
  det,
  dist,
  faces,
  flatten,
  hypercube,
  identity,
  mul,
  orderFace,
  perspective,
  PLANES,
  rotation,
  section,
  shapeName,
  transpose,
  volume,
  type Lead,
  type Vec4,
} from "./math";

const close = (A: number[][], B: number[][]) => A.forEach((r, i) => r.forEach((v, j) => expect(v).toBeCloseTo(B[i][j], 12)));

function slice(lead: Lead, s: number) {
  const sec = section(LEADS[lead], s);
  const p = flatten(sec.points, LEADS[lead]);
  const ordered = sec.faces.map((f) => orderFace(f, p));
  return { sec, name: shapeName(sec, p), vol: volume(p, ordered) };
}

describe("n-cubes", () => {
  it("corners double, edges follow 2E + V", () => {
    for (let n = 0; n <= 4; n++) {
      const c = hypercube(n);
      expect(c.verts).toHaveLength(2 ** n);
      expect(c.edges).toHaveLength(n * 2 ** Math.max(0, n - 1));
      if (n > 0) {
        const prev = hypercube(n - 1);
        expect(c.edges.length).toBe(2 * prev.edges.length + prev.verts.length);
      }
    }
  });

  it("the tesseract has 16 corners, 32 edges, 24 squares and 8 cubes", () => {
    expect(faces(4, 0)).toHaveLength(16);
    expect(faces(4, 1)).toHaveLength(32);
    expect(faces(4, 2)).toHaveLength(24);
    expect(faces(4, 3)).toHaveLength(8);
    expect(faces(4, 4)).toHaveLength(1);
    // Euler characteristic of the tesseract's surface: V − E + F − C = 0.
    expect(16 - 32 + 24 - 8).toBe(0);
  });

  it("every edge has length 1 and the long diagonal is √n", () => {
    for (const e of TESSERACT.edges) expect(dist(TESSERACT.verts[e.a], TESSERACT.verts[e.b])).toBe(1);
    expect(dist([0, 0, 0, 0], [1, 1, 1, 1])).toBe(2);
    expect(dist([0, 0, 0, 0], [1, 1, 1, 0])).toBeCloseTo(Math.sqrt(3), 12);
  });

  it("the build stage drags a copy along the next axis", () => {
    expect(buildStage(0).verts).toHaveLength(1);
    expect(buildStage(4).edges).toHaveLength(32);
    const mid = buildStage(3.5);
    expect(mid.verts).toHaveLength(16);
    expect(mid.edges).toHaveLength(12 + 12 + 8);
    expect(mid.edges.filter((e) => e.axis === 3)).toHaveLength(8);
    const w = mid.verts.map((v) => v[3]);
    expect(Math.min(...w)).toBeCloseTo(-0.25, 12);
    expect(Math.max(...w)).toBeCloseTo(0.25, 12);
  });
});

describe("rotation in 4D", () => {
  it("every plane rotation is orthogonal with determinant 1, and keeps edge lengths", () => {
    for (const plane of PLANES) {
      const R = rotation(plane, 0.7);
      close(mul(transpose(R), R), identity());
      expect(det(R)).toBeCloseTo(1, 12);
      for (const e of TESSERACT.edges) {
        const a = apply(R, centered(TESSERACT.verts[e.a]));
        const b = apply(R, centered(TESSERACT.verts[e.b]));
        expect(dist(a, b)).toBeCloseTo(1, 12);
      }
    }
  });

  it("a zw rotation leaves the whole xy plane fixed", () => {
    const R = rotation("zw", 1.1);
    const p: Vec4 = [0.3, -0.8, 0, 0];
    expect(dist(apply(R, p), p)).toBeCloseTo(0, 12);
    expect(dist(apply(R, [0, 0, 1, 0]), [0, 0, 1, 0])).toBeGreaterThan(0.5);
  });

  it("a double rotation fixes only the centre", () => {
    const R = mul(rotation("xy", 0.9), rotation("zw", 0.9));
    for (const p of [[1, 0, 0, 0], [0, 0, 1, 0], [0.3, -0.2, 0.5, 0.1]] as Vec4[]) {
      expect(dist(apply(R, p), p)).toBeGreaterThan(0.1);
    }
    expect(det(R)).toBeCloseTo(1, 12);
  });

  it("perspective along w scales by d / (d − w)", () => {
    expect(perspective([1, 0, 0, 0.5], 3)[0]).toBeCloseTo(1.2, 12);
    expect(perspective([1, 0, 0, -0.5], 3)[0]).toBeCloseTo(6 / 7, 12);
  });
});

describe("slices of the tesseract", () => {
  it("cube first: always a unit cube", () => {
    for (const s of [0.1, 0.5, 0.9]) {
      const { name, vol } = slice("cube", s);
      expect(name).toBe("cube");
      expect(vol).toBeCloseTo(1, 9);
    }
  });

  it("corner first: tetrahedron, truncated tetrahedron, octahedron, and back", () => {
    const tet = slice("corner", 0.5);
    expect(tet.name).toBe("tetrahedron");
    expect(tet.vol).toBeCloseTo(0.5 ** 3 / 3, 9); // regular simplex with edge s√2
    expect(slice("corner", 1.5).name).toBe("truncated tetrahedron");
    const oct = slice("corner", 2);
    expect(oct.name).toBe("octahedron");
    expect(oct.sec.points).toHaveLength(6);
    expect(oct.vol).toBeCloseTo(4 / 3, 9); // regular octahedron with edge √2
    expect(slice("corner", 2.5).name).toBe("truncated tetrahedron");
    expect(slice("corner", 3.5).name).toBe("tetrahedron");
  });

  it("corner first exactly at a layer of corners gives the tetrahedron through them", () => {
    const { sec, name } = slice("corner", 1);
    expect(name).toBe("tetrahedron");
    expect(sec.points).toHaveLength(4);
    expect(sec.edges).toHaveLength(6);
  });

  it("edge first: triangular prism, then hexagonal prism", () => {
    expect(slice("edge", 0.5).name).toBe("triangular prism");
    const hex = slice("edge", 1.5);
    expect(hex.name).toBe("hexagonal prism");
    expect(hex.sec.edges).toHaveLength(18);
  });

  it("square first: a box that stretches, including when whole squares lie in the cut", () => {
    const a = slice("square", 0.5);
    expect(a.name).toBe("box");
    expect(a.vol).toBeCloseTo(0.5 * Math.SQRT2, 9);
    const b = slice("square", 1);
    expect(b.sec.faces).toHaveLength(6);
    expect(b.sec.edges).toHaveLength(12);
    expect(b.vol).toBeCloseTo(Math.SQRT2, 9);
  });

  it("slice corners always lie on the cut and inside the tesseract", () => {
    for (const n of Object.values(LEADS)) {
      for (const s of [0.3, 0.77, 1.4]) {
        if (s >= n.reduce((a, b) => a + b, 0)) continue;
        for (const p of section(n, s).points) {
          expect(p.reduce((acc, v, i) => acc + v * n[i], 0)).toBeCloseTo(s, 9);
          for (const c of p) expect(c).toBeGreaterThanOrEqual(-1e-12);
        }
      }
    }
  });
});
