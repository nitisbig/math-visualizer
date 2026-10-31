type Props = { label: string; checked: boolean; onChange: (v: boolean) => void };

export default function Toggle({ label, checked, onChange }: Props) {
  return (
    <label className="ctl toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
