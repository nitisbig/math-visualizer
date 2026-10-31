/** Fixed decimals with a real minus sign; huge or invalid values collapse to ∞. */
export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v) || Math.abs(v) > 1e6) return v < 0 ? "−∞" : "∞";
  const s = v.toFixed(digits);
  return (s.startsWith("-") ? "−" + s.slice(1) : s).replace(/^−(0\.0+)$/, "$1");
}

/** Learning rates and other small positives: keep ~2 significant digits. */
export function fmtSig(v: number): string {
  return v >= 1 ? v.toFixed(2) : v.toPrecision(2);
}
