import { useRef, useState, type ReactNode } from "react";
import { ball, dotGrid, glow, line, prefersReducedMotion, scale, useCanvas, useLayer, useRaf, type Size } from "../../lib/canvas";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { useUrlNumber } from "../../lib/urlState";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Workspace from "../../components/ui/Workspace";
import { compoundInsight } from "./insights";
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

function frame(size: Size) {
  return {
    sx: scale(0, 1, 56, size.w - 28),
    sy: scale(0.9, 2.9, size.h - 64, 52),
  };
}

export default function Compound({ explain }: { explain?: ReactNode }) {
  const [n, setN] = useUrlNumber("n", 1, 1, N_MAX);
  const [playing, setPlaying] = useState(false);
  const progress = useRef(0);
  const layer = useLayer();

  const value = compound(n);

  const { ref, visible } = useCanvas(
    (ctx, size) => {
      const { sx, sy } = frame(size);

      // Static: grid, axes, and the limit e^t ending at e.
      layer(ctx, "axes", size, (c) => {
        dotGrid(c, size);
        c.strokeStyle = C.axis;
        c.lineWidth = 1;
        line(c, sx(0), sy(0.9), sx(0), sy(2.9));
        line(c, sx(0), sy(1), sx(1), sy(1));
        c.font = `12px ${FONT_MONO}`;
        c.fillStyle = C.muted;
        c.textAlign = "right";
        c.textBaseline = "middle";
        for (const v of [1, 1.5, 2, 2.5]) c.fillText(`$${v.toFixed(2)}`, sx(0) - 8, sy(v));
        c.textAlign = "center";
        c.textBaseline = "top";
        c.fillText("start", sx(0), sy(1) + 8);
        c.fillText("1 year", sx(1), sy(1) + 8);

        c.strokeStyle = alpha(C.lime, 0.75);
        c.setLineDash([4, 5]);
        line(c, sx(0), sy(Math.E), sx(1), sy(Math.E));
        c.beginPath();
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          i ? c.lineTo(sx(t), sy(Math.exp(t))) : c.moveTo(sx(t), sy(1));
        }
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = C.lime;
        c.textAlign = "left";
        c.textBaseline = "bottom";
        c.fillText("e ≈ 2.71828", sx(0) + 10, sy(Math.E) - 6);
      });

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
      const g = ctx.createLinearGradient(0, sy(value), 0, sy(1));
      g.addColorStop(0, alpha(C.cyan, 0.22));
      g.addColorStop(1, alpha(C.cyan, 0.02));
      ctx.fillStyle = g;
      ctx.fill(area);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      glow(ctx, C.cyan, 10, () => ctx.stroke(balance));

      // Gap to e: what more compounding could still win.
      ctx.strokeStyle = alpha(C.amber, 0.5);
      ctx.lineWidth = 1;
      line(ctx, sx(1) + 14, sy(value), sx(1) + 14, sy(Math.E));

      ball(ctx, sx(1), sy(value), 6, C.amber);
      ctx.font = `12px ${FONT_MONO}`;
      ctx.fillStyle = C.amber;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(`$${value.toFixed(5)}`, sx(1) - 12, sy(value) + 10);
    },
    [n],
  );

  useRaf(
    (dt) => {
      progress.current = Math.min(1, progress.current + dt / PLAY_SECONDS);
      setN(Math.max(1, Math.round(Math.pow(N_MAX, progress.current))));
      if (progress.current >= 1) setPlaying(false);
    },
    playing,
    visible,
  );

  const choose = (v: number) => {
    setPlaying(false);
    setN(v);
  };

  return (
    <Workspace
      title="$1 at 100% interest for one year"
      tab="Compound"
      legend={[
        { color: "cyan", label: "balance" },
        { color: "amber", label: "final amount" },
        { color: "lime", label: "the limit, e" },
      ]}
      stage={<canvas ref={ref} className="stage" role="img" aria-label={`Compounding ${n} times gives $${value.toFixed(6)}.`} />}
      status={{ text: `${n.toLocaleString("en-US")} payment${n === 1 ? "" : "s"} a year`, color: n === 1 ? C.muted : C.cyan }}
      transport={{
        playing,
        playLabel: "Compound faster",
        onPlay: () => {
          if (prefersReducedMotion()) return setN(N_MAX);
          if (!playing && n >= N_MAX) progress.current = 0;
          else if (!playing) progress.current = Math.log(n) / Math.log(N_MAX);
          setPlaying((p) => !p);
        },
        onReset: () => {
          setPlaying(false);
          progress.current = 0;
          setN(1);
        },
      }}
      controls={
        <>
          <EDigits value={value} />
          <Slider
            label="Compounding periods n"
            value={n}
            min={1}
            max={N_MAX}
            log
            onChange={(v) => choose(Math.round(v))}
            format={(v) => Math.round(v).toLocaleString("en-US")}
            color="cyan"
          />
          <Segmented label="Compound" value={String(n)} options={PRESETS} onChange={(v) => choose(Number(v))} />
        </>
      }
      insight={compoundInsight(n)}
      tries={[
        { label: "Monthly", apply: () => choose(12) },
        { label: "Every minute", apply: () => choose(525600) },
        { label: "A million times", apply: () => choose(N_MAX) },
      ]}
      explain={explain}
    />
  );
}
