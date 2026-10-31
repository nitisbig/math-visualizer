// Live one-line explanations for the Euler's-number widgets.
import { fmt } from "../../lib/format";
import { compound, polygon } from "./math";

const money = (v: number) => `$${v.toFixed(5)}`;

export function compoundInsight(n: number): string {
  const v = compound(n);
  if (n === 1) return "Paid once, $1 becomes $2. Split the interest into more payments and each one earns interest too.";
  const gap = Math.E - v;
  const more = compound(2 * n) - v;
  const times = n.toLocaleString("en-US");
  return `${times} payments give ${money(v)}, ${money(gap)} short of e. Doubling to ${(2 * n).toLocaleString("en-US")} adds only ${money(more)}: the growth hits a ceiling.`;
}

export const MATCH = 0.01;

export function derivativeInsight(a: number): string {
  if (Math.abs(a - Math.E) < MATCH) return "a = e: the slope equals the height at every point, so eˣ is its own derivative.";
  const r = Math.log(a);
  const dir = a < Math.E ? "Raise" : "Lower";
  return `At every x the slope is ln ${a.toFixed(3)} = ${fmt(r, 3)} × the height. ${dir} a toward 2.718 to make that ratio exactly 1.`;
}

export function circleInsight(theta: number, poly: boolean, n: number): string {
  if (Math.abs(theta - Math.PI) < 0.004) return "θ = π: half a turn around the circle lands on −1, so e^iπ + 1 = 0.";
  const deg = Math.round((theta * 180) / Math.PI);
  if (poly) {
    const [x, y] = polygon(theta, n)[n];
    const r = Math.hypot(x, y);
    return `${n} compounding step${n === 1 ? "" : "s"} overshoot the circle: the end point sits at radius ${fmt(r, 3)}. More steps pull it onto the circle.`;
  }
  return `θ = ${deg}°. The velocity (magenta) is always a quarter-turn from the radius, so the point never moves outward; it travels around the circle.`;
}
