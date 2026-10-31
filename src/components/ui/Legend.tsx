import { C, type Token } from "../../lib/theme";

export type LegendItem = { color: Token; label: string };

export default function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="swatch" style={{ background: C[it.color] }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
