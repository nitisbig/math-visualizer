// Math behind the fourth-dimension widgets: the unit n-cube (n ≤ 4), rotations in
// coordinate planes, projection along w, and slices of the tesseract by a hyperplane.
// Every count, length and slice shape on the page comes from here.

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Mat4 = number[][];

export const AXES = ["x", "y", "z", "w"] as const;
export const NAMES = ["point", "segment", "square", "cube", "tesseract"] as const;

/** An edge joins corners that differ in one coordinate; that coordinate is its axis. */
export type Edge = { a: number; b: number; axis: number };
export type Cube = { n: number; verts: Vec4[]; edges: Edge[] };

/** Corner i of the n-cube has coordinate k = bit k of i (0 or 1), padded with zeros to 4D. */
export function hypercube(n: number): Cube {
  const verts: Vec4[] = [];
  const edges: Edge[] = [];
  for (let i = 0; i < 1 << n; i++) {
    verts.push([0, 1, 2, 3].map((k) => (k < n ? (i >> k) & 1 : 0)) as Vec4);
    for (let k = 0; k < n; k++) if (!((i >> k) & 1)) edges.push({ a: i, b: i | (1 << k), axis: k });
  }
  return { n, verts, edges };
}

const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/** The k-dimensional faces of the n-cube (k free axes, the rest fixed at 0 or 1), as corner indices. */
export function faces(n: number, k: number): number[][] {
  const out: number[][] = [];
  const all = (1 << n) - 1;
  for (let free = 0; free <= all; free++) {
    if (popcount(free) !== k) continue;
    const fixed = all & ~free;
    for (let sub = fixed; ; sub = (sub - 1) & fixed) {
      const corners: number[] = [];
      for (let i = 0; i <= all; i++) if ((i & fixed) === sub) corners.push(i);
      out.push(corners);
      if (sub === 0) break;
    }
  }
  return out;
}

export const TESSERACT = hypercube(4);

/** Shift {0, 1}⁴ to {−½, ½}⁴ so the tesseract turns about its centre. */
export const centered = (v: Vec4): Vec4 => [v[0] - 0.5, v[1] - 0.5, v[2] - 0.5, v[3] - 0.5];

// ---------------------------------------------------------------- building by dragging

export type Stage = {
  /** Dimension of the finished shape being dragged. */
  k: number;
  /** How far the copy has been dragged along axis k (0–1). */
  f: number;
  verts: Vec4[];
  edges: Edge[];
  /** Per vertex: true for the moving copy. */
  copy: boolean[];
  /** The quad each old edge sweeps out, as corner indices. */
  sweeps: number[][];
};

/** Build progress u ∈ [0, 4]: the k-cube (k = ⌊u⌋) and a copy dragged a distance u − k along the next axis. */
export function buildStage(u: number): Stage {
  const k = Math.min(4, Math.floor(u));
  const f = k === 4 ? 0 : u - k;
  const base = hypercube(k);
  const center = (v: Vec4, along: number): Vec4 =>
    v.map((c, i) => (i < k ? c - 0.5 : i === k ? along : 0)) as Vec4;
  if (f < 1e-6) {
    return { k, f: 0, verts: base.verts.map((v) => center(v, 0)), edges: base.edges, copy: base.verts.map(() => false), sweeps: [] };
  }
  const m = base.verts.length;
  return {
    k,
    f,
    verts: [...base.verts.map((v) => center(v, -f / 2)), ...base.verts.map((v) => center(v, f / 2))],
    edges: [
      ...base.edges,
      ...base.edges.map((e) => ({ a: e.a + m, b: e.b + m, axis: e.axis })),
      ...base.verts.map((_, i) => ({ a: i, b: i + m, axis: k })),
    ],
    copy: [...base.verts.map(() => false), ...base.verts.map(() => true)],
    sweeps: base.edges.map((e) => [e.a, e.b, e.b + m, e.a + m]),
  };
}

// ---------------------------------------------------------------- linear algebra

export const PLANES = ["xy", "xz", "xw", "yz", "yw", "zw"] as const;
export type Plane = (typeof PLANES)[number];

export const axisIndex = (a: string) => "xyzw".indexOf(a);

export const identity = (): Mat4 => [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));

/** Rotation in one coordinate plane: the 2×2 rotation matrix placed in rows/columns a and b. */
export function rotation(plane: Plane, angle: number): Mat4 {
  const a = axisIndex(plane[0]);
  const b = axisIndex(plane[1]);
  const R = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  R[a][a] = c;
  R[a][b] = -s;
  R[b][a] = s;
  R[b][b] = c;
  return R;
}

export const mul = (A: Mat4, B: Mat4): Mat4 =>
  A.map((row) => B[0].map((_, j) => row.reduce((acc, v, k) => acc + v * B[k][j], 0)));

export const transpose = (M: Mat4): Mat4 => M[0].map((_, j) => M.map((row) => row[j]));

export const apply = (M: Mat4, v: Vec4): Vec4 => M.map((row) => row.reduce((acc, m, k) => acc + m * v[k], 0)) as Vec4;

/** Determinant by Gaussian elimination with partial pivoting. */
export function det(M: Mat4): number {
  const A = M.map((r) => [...r]);
  const n = A.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return 0;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      d = -d;
    }
    d *= A[c][c];
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / A[c][c];
      for (let j = c; j < n; j++) A[r][j] -= k * A[c][j];
    }
  }
  return d;
}

export const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

// ---------------------------------------------------------------- projection

/** Perspective along w from a camera at w = d: x′ = d / (d − w) · x. Large w comes closer and grows. */
export function perspective(v: Vec4, d: number): Vec3 {
  const k = d / (d - v[3]);
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** A straight shadow: keep x, y, z and drop w (the 3 × 4 matrix [I | 0]). */
export const orthographic = (v: Vec4): Vec3 => [v[0], v[1], v[2]];

export type Orbit = { yaw: number; pitch: number };
export type ScreenPoint = { x: number; y: number; z: number };

/**
 * Pinhole camera for the 3D shadow: x right, y forward, z up. `yaw` turns about z,
 * `pitch` tilts the top toward the viewer. Returns screen x/y and depth z (larger = farther).
 */
export function camera({ yaw, pitch }: Orbit, cx: number, cy: number, unit: number, distance = 6) {
  const cw = Math.cos(yaw);
  const sw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return ([x, y, z]: Vec3): ScreenPoint => {
    const x1 = x * cw - y * sw;
    const y1 = x * sw + y * cw;
    const y2 = y1 * cp - z * sp;
    const z2 = y1 * sp + z * cp;
    const k = distance / (distance + y2);
    return { x: cx + unit * k * x1, y: cy - unit * k * z2, z: y2 };
  };
}

// ---------------------------------------------------------------- slicing

/** Which feature of the tesseract meets the cut first. The cut is n · p = s for p in [0, 1]⁴. */
export const LEAD_IDS = ["cube", "square", "edge", "corner"] as const;
export type Lead = (typeof LEAD_IDS)[number];
export const LEADS: Record<Lead, Vec4> = {
  cube: [0, 0, 0, 1],
  square: [0, 0, 1, 1],
  edge: [0, 1, 1, 1],
  corner: [1, 1, 1, 1],
};

const dot4 = (a: readonly number[], b: readonly number[]) => a.reduce((acc, v, i) => acc + v * b[i], 0);
const SQUARES = faces(4, 2);
const CELLS = faces(4, 3);
const edgesWithin = (corners: number[]) => {
  const set = new Set(corners);
  return TESSERACT.edges.flatMap((e, i) => (set.has(e.a) && set.has(e.b) ? [i] : []));
};
const SQUARE_EDGES = SQUARES.map(edgesWithin);
const CELL_EDGES = CELLS.map(edgesWithin);

export type Section = {
  /** Corners of the slice, in 4D (unit tesseract coordinates). */
  points: Vec4[];
  edges: [number, number][];
  /** Each face as unordered point indices (see `orderFace`). */
  faces: number[][];
  /** Per tesseract corner: sign of n · v − s (negative = the cut has passed it). */
  side: number[];
};

/**
 * The 3D cross-section of the unit tesseract by the hyperplane n · p = s.
 * Its corners are where the plane crosses the 32 edges, its edges are where it
 * crosses the 24 squares, and its faces are where it crosses the 8 cubes.
 */
export function section(normal: Vec4, s: number, eps = 1e-9): Section {
  const V = TESSERACT.verts;
  const f = V.map((v) => dot4(normal, v) - s);
  const points: Vec4[] = [];
  const index = new Map<string, number>();
  const add = (p: Vec4) => {
    const key = p.map((c) => Math.round(c * 1e7)).join(",");
    let i = index.get(key);
    if (i === undefined) {
      i = points.length;
      points.push(p);
      index.set(key, i);
    }
    return i;
  };
  const onEdge = TESSERACT.edges.map(({ a, b }) => {
    const out: number[] = [];
    const za = Math.abs(f[a]) < eps;
    const zb = Math.abs(f[b]) < eps;
    if (za) out.push(add(V[a]));
    if (zb) out.push(add(V[b]));
    if (!za && !zb && f[a] * f[b] < 0) {
      const t = f[a] / (f[a] - f[b]);
      out.push(add(V[a].map((c, k) => c + (V[b][k] - c) * t) as Vec4));
    }
    return out;
  });
  const pointsOn = (edgeIds: number[]) => [...new Set(edgeIds.flatMap((i) => onEdge[i]))];

  const edges: [number, number][] = [];
  const seen = new Set<string>();
  const addEdge = (i: number, j: number) => {
    const [a, b] = i < j ? [i, j] : [j, i];
    if (a !== b && !seen.has(`${a},${b}`)) {
      seen.add(`${a},${b}`);
      edges.push([a, b]);
    }
  };
  for (const ids of SQUARE_EDGES) {
    const pts = pointsOn(ids);
    if (pts.length === 2) addEdge(pts[0], pts[1]);
    // The whole square lies in the cut: its four edges are slice edges.
    else if (pts.length === 4) for (const e of ids) if (onEdge[e].length === 2) addEdge(onEdge[e][0], onEdge[e][1]);
  }

  // A plane meets a cube in at most a hexagon; 8 points means a whole cube lies in the cut,
  // and then the slice is that cube, whose faces are the squares in the cut.
  const cellPts = CELL_EDGES.map(pointsOn);
  const raw = cellPts.some((p) => p.length === 8)
    ? SQUARE_EDGES.map(pointsOn).filter((p) => p.length === 4)
    : cellPts.filter((p) => p.length >= 3);
  // Two cubes that share a square in the cut both report it.
  const faceKeys = new Set<string>();
  const faceList = raw.filter((p) => {
    const key = [...p].sort((a, b) => a - b).join(",");
    if (faceKeys.has(key)) return false;
    faceKeys.add(key);
    return true;
  });

  return { points, edges, faces: faceList, side: f.map((v) => (Math.abs(v) < eps ? 0 : Math.sign(v))) };
}

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mean3 = (ps: Vec3[]): Vec3 => {
  const c: Vec3 = [0, 0, 0];
  for (const p of ps) for (let k = 0; k < 3; k++) c[k] += p[k] / ps.length;
  return c;
};

/** Three orthonormal directions inside the hyperplane with normal n (Gram–Schmidt on x, y, z, w). */
export function hyperplaneBasis(normal: Vec4): Vec4[] {
  const len = Math.hypot(...normal);
  const basis: Vec4[] = [normal.map((c) => c / len) as Vec4];
  for (let k = 0; k < 4 && basis.length < 4; k++) {
    let v: Vec4 = [0, 0, 0, 0];
    v[k] = 1;
    for (const b of basis) {
      const d = dot4(v, b);
      v = v.map((c, i) => c - d * b[i]) as Vec4;
    }
    const l = Math.hypot(...v);
    if (l > 1e-6) basis.push(v.map((c) => c / l) as Vec4);
  }
  return basis.slice(1);
}

/** Slice corners as 3D coordinates inside the hyperplane, centred on their average. */
export function flatten(points: Vec4[], normal: Vec4): Vec3[] {
  if (!points.length) return [];
  const B = hyperplaneBasis(normal);
  const c = [0, 1, 2, 3].map((k) => points.reduce((acc, p) => acc + p[k], 0) / points.length);
  return points.map((p) => {
    const d = p.map((v, k) => v - c[k]);
    return [dot4(d, B[0]), dot4(d, B[1]), dot4(d, B[2])] as Vec3;
  });
}

/** Sorts a flat convex face's corners into a loop. */
export function orderFace(ids: number[], p: Vec3[]): number[] {
  const c = mean3(ids.map((i) => p[i]));
  const u = sub3(p[ids[0]], c);
  let n: Vec3 = [0, 0, 1];
  let best = 0;
  for (const i of ids) {
    const cr = cross(u, sub3(p[i], c));
    const l = Math.hypot(...cr);
    if (l > best) [best, n] = [l, cr];
  }
  const v = cross(n, u);
  const angle = (i: number) => {
    const d = sub3(p[i], c);
    return Math.atan2(dot3(d, v), dot3(d, u));
  };
  return [...ids].sort((a, b) => angle(a) - angle(b));
}

/** Volume of a convex solid from its ordered faces: fan of tetrahedra from the centre. */
export function volume(p: Vec3[], ordered: number[][]): number {
  if (!p.length) return 0;
  const c = mean3(p);
  let vol = 0;
  for (const f of ordered) {
    for (let i = 1; i + 1 < f.length; i++) {
      vol += Math.abs(dot3(sub3(p[f[0]], c), cross(sub3(p[f[i]], c), sub3(p[f[i + 1]], c)))) / 6;
    }
  }
  return vol;
}

/** Names the slice from its face shapes. */
export function shapeName(sec: Section, p: Vec3[]): string {
  const V = sec.points.length;
  const F = sec.faces.length;
  if (V === 0) return "nothing";
  if (F <= 1) return V === 1 ? "a single point" : V === 2 ? "a segment" : "a flat polygon";
  const count = (k: number) => sec.faces.filter((f) => f.length === k).length;
  const [t, q, h] = [count(3), count(4), count(6)];
  if (F === 4 && t === 4) return "tetrahedron";
  if (F === 8 && t === 8) return "octahedron";
  if (F === 8 && t === 4 && h === 4) return "truncated tetrahedron";
  if (F === 5 && t === 2 && q === 3) return "triangular prism";
  if (F === 8 && h === 2 && q === 6) return "hexagonal prism";
  if (F === 6 && q === 6) {
    const lengths = sec.edges.map(([a, b]) => dist(p[a], p[b]));
    return Math.max(...lengths) - Math.min(...lengths) < 1e-6 ? "cube" : "box";
  }
  return `${V}-corner solid`;
}
