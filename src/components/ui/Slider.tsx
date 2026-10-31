import { useId } from "react";
import { C, type Token } from "../../lib/theme";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  /** Log-scale track: equal slider distance = equal ratio. */
  log?: boolean;
  format?: (v: number) => string;
  color?: Token;
};

const LOG_STEPS = 1000;

export default function Slider({ label, value, min, max, onChange, step, log, format, color = "ink" }: Props) {
  const id = useId();
  const toTrack = (v: number) =>
    log ? (Math.log(v / min) / Math.log(max / min)) * LOG_STEPS : v;
  const fromTrack = (t: number) => (log ? min * Math.pow(max / min, t / LOG_STEPS) : t);
  const shown = format ? format(value) : String(value);

  return (
    <div className="ctl slider" style={{ ["--accent" as string]: C[color] }}>
      <label htmlFor={id}>
        <span>{label}</span>
        <output htmlFor={id} className="mono">{shown}</output>
      </label>
      <input
        id={id}
        type="range"
        min={log ? 0 : min}
        max={log ? LOG_STEPS : max}
        step={log ? 1 : (step ?? "any")}
        value={toTrack(value)}
        aria-valuetext={shown}
        onChange={(e) => onChange(fromTrack(Number(e.currentTarget.value)))}
      />
    </div>
  );
}
