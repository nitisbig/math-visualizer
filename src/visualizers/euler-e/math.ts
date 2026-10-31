// Math behind the Euler's-number widgets.

export const E_DIGITS = "2.718281828459045";

/** $1 at 100% yearly interest, compounded n times in the year. */
export const compound = (n: number) => Math.pow(1 + 1 / n, n);

/** How many leading characters of `v` (to 15 places) agree with e. */
export function matchingDigits(v: number): number {
  const s = v.toFixed(15);
  let i = 0;
  while (i < s.length && s[i] === E_DIGITS[i]) i++;
  return i;
}

export type Complex = [number, number];

export const cmul = ([a, b]: Complex, [c, d]: Complex): Complex => [a * c - b * d, a * d + b * c];

/** Vertices of (1 + iθ/n)^k for k = 0..n — compounding a rotation in n small steps. */
export function polygon(theta: number, n: number): Complex[] {
  const z: Complex = [1, theta / n];
  const pts: Complex[] = [[1, 0]];
  for (let k = 0; k < n; k++) pts.push(cmul(pts[k], z));
  return pts;
}

/** e^{iθ} = cos θ + i sin θ. */
export const expi = (theta: number): Complex => [Math.cos(theta), Math.sin(theta)];
