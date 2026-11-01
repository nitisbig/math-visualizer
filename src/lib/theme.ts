// Canvas-side copy of src/styles/tokens.css. Keep the two in sync.
const DARK = {
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
  // Canvas-only: dot-grid texture and the bright rim on lit spheres.
  dot: "rgba(248,250,252,0.16)",
  rim: "#FFFFFF",
};

export type Token = keyof typeof DARK;

const LIGHT: Record<Token, string> = {
  bg: "#F4F5F8",
  card: "#FFFFFF",
  ink: "#0B1220",
  ink2: "#283142",
  muted: "#5D6677",
  s2: "#F6F7FA",
  grid: "#E3E7EE",
  line: "#D2D8E2",
  axis: "#98A2B3",
  cyan: "#0596BE",
  amber: "#E08600",
  magenta: "#E0157A",
  lime: "#0E9F55",
  blue: "#2563EB",
  alert: "#E0242B",
  x: "#E2362C",
  y: "#EE7400",
  z: "#C99A00",
  dot: "rgba(15,23,42,0.13)",
  rim: "#FFFFFF",
};

export type ThemeName = "dark" | "light";

/** The live palette. Draw code reads it at paint time, so it follows the theme. */
export const C: Record<Token, string> = { ...DARK };

let current: ThemeName = "dark";
export const themeName = () => current;

const listeners = new Set<() => void>();
/** Runs `fn` after the palette swaps; returns an unsubscribe. */
export function onThemeChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function sync() {
  const next: ThemeName = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  if (next === current) return;
  current = next;
  Object.assign(C, next === "light" ? LIGHT : DARK);
  listeners.forEach((fn) => fn());
}

if (typeof document !== "undefined") {
  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/** A token as a CSS custom property, for inline styles that should follow the theme. */
export const cssVar = (t: Token) => `var(--${t === "ink2" ? "ink-2" : t})`;

/**
 * A token name or a live palette color (e.g. `C.amber`) as a CSS custom property, so
 * server-rendered markup, which always sees the dark palette, matches the client's theme.
 */
export function toCss(color: Token | string): string {
  if (color in C) return cssVar(color as Token);
  const t = (Object.keys(C) as Token[]).find((k) => C[k] === color);
  return t ? cssVar(t) : color;
}

export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
export const FONT_BODY = '"DM Sans", system-ui, sans-serif';

/** "#RRGGBB" + alpha → "rgba(...)". */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
