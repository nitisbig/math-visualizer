import { cssVar, type Token } from "../../lib/theme";

export type LegendItem = { color: Token; label: string };

export default function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="swatch" style={{ background: cssVar(it.color), color: cssVar(it.color) }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
