import { cssVar, type Token } from "../../lib/theme";

export type ReadoutItem = { label: string; value: string; color?: Token };

/** Tabular mono readouts; announced politely to screen readers. */
export default function Readout({ items }: { items: ReadoutItem[] }) {
  return (
    <dl className="readout" aria-live="polite">
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd className="mono" style={{ color: cssVar(it.color ?? "ink") }}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
