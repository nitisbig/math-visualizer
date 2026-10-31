// Marching squares: iso-lines of a sampled scalar field, as line segments.

/** Edge pairs per corner case. Corners: a=top-left(8) b=top-right(4) c=bottom-right(2) d=bottom-left(1).
 *  Edges: 0=top 1=right 2=bottom 3=left. */
const CASES: number[][][] = [
  [], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
  [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], [],
];

/**
 * `grid` is row-major, (nx+1) × (ny+1) samples spaced `cell` pixels apart.
 * Returns flat [x0, y0, x1, y1, ...] segments in pixels for each level.
 */
export function contours(grid: Float32Array, nx: number, ny: number, cell: number, levels: number[]): Float32Array[] {
  const W = nx + 1;
  return levels.map((L) => {
    const out: number[] = [];
    const lerp = (v0: number, v1: number) => (L - v0) / (v1 - v0 || 1e-12);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = grid[j * W + i];
        const b = grid[j * W + i + 1];
        const c = grid[(j + 1) * W + i + 1];
        const d = grid[(j + 1) * W + i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        const segs = CASES[idx];
        if (segs.length === 0) continue;
        const x = i * cell;
        const y = j * cell;
        const pt = (e: number): [number, number] =>
          e === 0
            ? [x + lerp(a, b) * cell, y]
            : e === 1
              ? [x + cell, y + lerp(b, c) * cell]
              : e === 2
                ? [x + lerp(d, c) * cell, y + cell]
                : [x, y + lerp(a, d) * cell];
        for (const [e0, e1] of segs) out.push(...pt(e0), ...pt(e1));
      }
    }
    return new Float32Array(out);
  });
}
