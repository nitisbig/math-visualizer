import { useRef, useState } from "react";
import { dot, dotGrid, glow, line, prefersReducedMotion, scale, useCanvas, useRaf } from "../../lib/canvas";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { useUrlNumber } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import PlayControls from "../../components/ui/PlayControls";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import { E_DIGITS, compound, matchingDigits } from "./math";

const N_MAX = 1_000_000;
const PLAY_SECONDS = 7;
const PRESETS = [
  { value: "1", label: "Yearly" },
  { value: "12", label: "Monthly" },
  { value: "365", label: "Daily" },
  { value: "8760", label: "Hourly" },
  { value: "525600", label: "Every minute" },
] as const;

/** The value with its e-matching prefix lit up. */
export function EDigits({ value, places = 9 }: { value: number; places?: number }) {
  const s = value.toFixed(places);
  const m = Math.min(matchingDigits(value), s.length);
  return (
    <div className="edigits mono" aria-label={`${s}, ${Math.max(0, m - 2)} decimal places match e`}>
      <span className="hit">{s.slice(0, m)}</span>
      <span className="miss">{s.slice(m)}</span>
      <div className="ref">e = {E_DIGITS.slice(0, places + 2)}…</div>
    </div>
  );
}

export default function Compound() {
  const [n, setN] = useUrlNumber("n", 1, 1, N_MAX);
  const [playing, setPlaying] = useState(false);
  const progress = useRef(0);

  useRaf((dt) => {
    progress.current = Math.min(1, progress.current + dt / PLAY_SECONDS);
    setN(Math.max(1, Math.round(Math.pow(N_MAX, progress.current))));
    if (progress.current >= 1) setPlaying(false);
  }, playing);

  const value = compound(n);

  const { ref } = useCanvas(
    (ctx, size) => {
      const padL = 44;
      const pad = 24;
      const sx = scale(0, 1, padL, size.w - pad);
      const sy = scale(0.9, 2.9, size.h - pad, pad);
      dotGrid(ctx, size);

      // Axes and y ticks
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1;
      line(ctx, sx(0), sy(0.9), sx(0), sy(2.9));
      line(ctx, sx(0), sy(1), sx(1), sy(1));
      ctx.font = `11px ${FONT_MONO}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const v of [1, 1.5, 2, 2.5]) ctx.fillText(`$${v.toFixed(2)}`, sx(0) - 6, sy(v));
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("start", sx(0), sy(1) + 6);
      ctx.fillText("1 year", sx(1), sy(1) + 6);

      // The limit: continuous growth e^t, ending at e.
      ctx.strokeStyle = alpha(C.lime, 0.8);
      ctx.setLineDash([4, 5]);
      line(ctx, sx(0), sy(Math.E), sx(1), sy(Math.E));
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        i ? ctx.lineTo(sx(t), sy(Math.exp(t))) : ctx.moveTo(sx(t), sy(1));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.lime;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("e ≈ 2.71828", sx(0) + 8, sy(Math.E) - 4);

      // Balance over the year: jumps at each compounding moment.
      // Exact steps while they're wider than ~3px, else sampled per pixel.
      const r = 1 + 1 / n;
      const balance = new Path2D();
      balance.moveTo(sx(0), sy(1));
      if (n <= size.w / 3) {
        let b = 1;
        for (let k = 1; k <= n; k++) {
          balance.lineTo(sx(k / n), sy(b));
          b *= r;
          balance.lineTo(sx(k / n), sy(b));
        }
      } else {
        const cols = Math.ceil(sx(1) - sx(0));
        for (let i = 0; i <= cols; i++) {
          const t = i / cols;
          balance.lineTo(sx(t), sy(Math.pow(r, Math.floor(t * n))));
        }
        balance.lineTo(sx(1), sy(value));
      }
      const area = new Path2D(balance);
      area.lineTo(sx(1), sy(1));
      area.closePath();
      ctx.fillStyle = alpha(C.cyan, 0.08);
      ctx.fill(area);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      glow(ctx, C.cyan, 10, () => ctx.stroke(balance));

      ctx.fillStyle = C.amber;
      glow(ctx, C.amber, 14, () => dot(ctx, sx(1), sy(value), 6));
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`$${value.toFixed(5)}`, sx(1) - 10, sy(value) + 8);
    },
    [n],
  );

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">$1 at 100% interest for one year</span>
        <Legend
          items={[
            { color: "cyan", label: "balance" },
            { color: "amber", label: "final amount" },
            { color: "lime", label: "the limit, e" },
          ]}
        />
      </div>
      <canvas ref={ref} className="stage ar-wide" role="img" aria-label={`Compounding ${n} times gives $${value.toFixed(6)}.`} />
      <div className="viz-body">
        <EDigits value={value} />
        <div className="controls">
          <Slider
            label="Compounding periods n"
            value={n}
            min={1}
            max={N_MAX}
            log
            onChange={(v) => {
              setPlaying(false);
              setN(Math.round(v));
            }}
            format={(v) => Math.round(v).toLocaleString("en-US")}
            color="cyan"
          />
          <Segmented
            label="Compound"
            value={String(n)}
            options={PRESETS}
            onChange={(v) => {
              setPlaying(false);
              setN(Number(v));
            }}
          />
        </div>
        <PlayControls
          playing={playing}
          playLabel="Compound faster"
          onPlay={() => {
            if (prefersReducedMotion()) return setN(N_MAX);
            if (!playing && n >= N_MAX) progress.current = 0;
            else if (!playing) progress.current = Math.log(n) / Math.log(N_MAX);
            setPlaying((p) => !p);
          }}
          onReset={() => {
            setPlaying(false);
            progress.current = 0;
            setN(1);
          }}
        />
      </div>
    </div>
  );
}
