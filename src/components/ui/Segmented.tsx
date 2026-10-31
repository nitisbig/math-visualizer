import { useId } from "react";

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
};

export default function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="ctl segmented">
      <legend>{label}</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={o.value} className={o.value === value ? "on" : undefined}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
