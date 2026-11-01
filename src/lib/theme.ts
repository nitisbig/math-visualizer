// Canvas-side copy of src/styles/tokens.css. Keep the two in sync.
export const C = {
  bg: "#000000",
  card: "#05070A",
  ink: "#F8FAFC",
  ink2: "#E3E7EE",
  muted: "#A9B2C3",
  s2: "#0D1016",
  grid: "#232A38",
  line: "#384154",
  axis: "#5C677C",
  cyan: "#00E1FF",
  amber: "#FFB300",
  magenta: "#FF2E93",
  lime: "#2BFF6E",
  blue: "#2F86FF",
  alert: "#FF2B2B",
  // Axis colors (4D page): x red, y orange, z yellow; w is `blue`.
  x: "#FF4136",
  y: "#FF8A00",
  z: "#FFE033",
} as const;

export type Token = keyof typeof C;

export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
export const FONT_BODY = '"DM Sans", system-ui, sans-serif';

/** "#RRGGBB" + alpha → "rgba(...)". */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
