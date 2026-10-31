import { C, type Token } from "../../lib/theme";

export default function Legend({ items }: { items: { color: Token; label: string }[] }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="swatch" style={{ background: C[it.color], boxShadow: `0 0 8px ${C[it.color]}` }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
