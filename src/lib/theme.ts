// Canvas-side copy of src/styles/tokens.css. Keep the two in sync.
export const C = {
  bg: "#000000",
  card: "#05070A",
  ink: "#F5F7FA",
  muted: "#7C8597",
  grid: "#1A1F2B",
  line: "#2A3140",
  axis: "#3A4252",
  cyan: "#22D3EE",
  amber: "#FFB020",
  magenta: "#FF3D9A",
  lime: "#C6FF4A",
  blue: "#5FB6FF",
  alert: "#FF4D4D",
  // Axis colors (4D page): x red, y orange, z yellow; w is `blue`.
  x: "#FF5A4E",
  y: "#FF9F3D",
  z: "#FFD17E",
} as const;

export type Token = keyof typeof C;

export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
export const FONT_BODY = '"DM Sans", system-ui, sans-serif';

/** "#RRGGBB" + alpha → "rgba(...)". */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
