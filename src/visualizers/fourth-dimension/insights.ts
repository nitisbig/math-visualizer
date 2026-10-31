// Live one-line explanations for the fourth-dimension widgets.
import { fmt } from "../../lib/format";
import { AXES, NAMES, type Lead } from "./math";

export type Counts = { V: number; E: number };

export function buildInsight(k: number, f: number, counts: Counts[]): string {
  if (f > 0) {
    return `Dragging the ${NAMES[k]} along ${AXES[k]}: every corner leaves a copy behind and a new edge joins the two, so the corners double.`;
  }
  const c = counts[k];
  if (k === 0) return "A single point: zero dimensions, nothing to measure. Drag it along x.";
  const p = counts[k - 1];
  const rule = `${c.V} corners and ${c.E} edges (2 × ${p.E} + ${p.V})`;
  if (k === 4) return `A tesseract: ${rule}. The w copy is drawn bigger because it sits closer to a 4D camera, so it looks like a cube inside a cube.`;
  return `A ${NAMES[k]}: ${rule}. Its long diagonal is √${k} = ${fmt(Math.sqrt(k), 3)}.`;
}

export function rotateInsight(mode: string, proj: "persp" | "ortho", lo3: number, hi3: number): string {
  if (mode === "double") {
    return "A double rotation, impossible in 3D: xy and zw turn at once, every corner travels a circle, and only the very centre stays still.";
  }
  const still = AXES.filter((a) => !mode.includes(a)).join(" and ");
  const shadow =
    proj === "ortho" && !mode.includes("w")
      ? " With a straight shadow the w edges collapse to nothing, so you only see a cube."
      : ` The shadow's edges range from ${fmt(lo3, 2)} to ${fmt(hi3, 2)}, but every real 4D edge stays exactly 1.`;
  return `Rotating in the ${mode} plane: ${still} pass straight through.` + shadow;
}

export function sliceInsight(lead: Lead, s: number, k: number, name: string): string {
  if (lead === "cube") return "Cube first, every slice is the same unit cube: the boring way in.";
  const mid = Math.abs(s - k / 2) < 1e-9;
  if (lead === "corner" && mid) return "Exactly halfway: the slice is a perfect octahedron, two pyramids glued base to base.";
  const where = s < k / 2 ? "entering" : "leaving";
  return `The tesseract is ${where} our space ${lead} first, and right now we would see a ${name.toLowerCase()}. Same object, different slice, depending only on its angle.`;
}
