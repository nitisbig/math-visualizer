import { useRef, useState } from "react";
import { arrow, dot, dotGrid, glow, line, pointerPos, prefersReducedMotion, scale, useCanvas, useRaf, type Size } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { bool, useUrlNumber, useUrlState } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import Readout from "../../components/ui/Readout";
import Slider from "../../components/ui/Slider";
import Toggle from "../../components/ui/Toggle";
import { expi, polygon } from "./math";

const TAU = Math.PI * 2;
const PLAY_SECONDS = 1.8;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** a + bi to 3 places; the sign follows the rounded value so −0.000i never shows. */
const fmtComplex = (a: number, b: number) => `${fmt(a, 3)} ${b < -5e-4 ? "−" : "+"} ${fmt(Math.abs(b), 3)}i`;

function frame({ w, h }: Size) {
  const k = Math.min(w, h) / 3.4; // pixels per unit
  const sx = scale(-w / 2 / k, w / 2 / k, 0, w);
  const sy = scale(-h / 2 / k, h / 2 / k, h, 0);
  return { sx, sy, k };
}

export default function EulerCircle() {
  const [theta, setTheta] = useUrlNumber("t", 1, 0, TAU);
  const [showPoly, setShowPoly] = useUrlState("poly", false, bool);
  const [n, setN] = useUrlNumber("steps", 6, 1, 64);
  const [tween, setTween] = useState<{ from: number; to: number; t: number } | null>(null);
  const dragging = useRef(false);

  const atPi = Math.abs(theta - Math.PI) < 0.004;

  useRaf((dt) => {
    if (!tween) return;
    const t = Math.min(1, tween.t + dt / PLAY_SECONDS);
    setTheta(tween.from + (tween.to - tween.from) * ease(t));
    setTween(t >= 1 ? null : { ...tween, t });
  }, tween !== null);

  const playToPi = () => {
    const from = atPi ? 0 : theta;
    if (prefersReducedMotion()) return setTheta(Math.PI);
    setTween({ from, to: Math.PI, t: 0 });
  };

  const { ref } = useCanvas(
    (ctx, size) => {
      const { sx, sy, k } = frame(size);
      const ox = sx(0);
      const oy = sy(0);
      const [re, im] = expi(theta);
      const px = sx(re);
      const py = sy(im);
      const pointColor = atPi ? C.lime : C.amber;

      dotGrid(ctx, size);
      ctx.strokeStyle = C.axis;
      ctx.lineWidth = 1;
      line(ctx, 0, oy, size.w, oy);
      line(ctx, ox, 0, ox, size.h);
      ctx.font = `11px ${FONT_MONO}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("Re", size.w - 24, oy - 4);
      ctx.fillText("Im", ox + 6, 14);
      ctx.textBaseline = "top";
      ctx.fillText("1", sx(1) + 4, oy + 4);
      ctx.fillText("−1", sx(-1) - 18, oy + 4);
      ctx.fillText("i", ox + 6, sy(1) - 16);

      // Unit circle and the swept angle
      ctx.strokeStyle = C.line;
      ctx.beginPath();
      ctx.arc(ox, oy, k, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2.5;
      glow(ctx, C.cyan, 12, () => {
        ctx.beginPath();
        ctx.arc(ox, oy, k, 0, -theta, true);
        ctx.stroke();
      });

      // Compounding polygon: (1 + iθ/n)^k
      if (showPoly) {
        const pts = polygon(theta, n);
        ctx.strokeStyle = alpha(C.blue, 0.9);
        ctx.fillStyle = C.blue;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
        ctx.stroke();
        for (const [x, y] of pts) dot(ctx, sx(x), sy(y), 2.5);
        const [ex, ey] = pts[pts.length - 1];
        glow(ctx, C.blue, 10, () => dot(ctx, sx(ex), sy(ey), 4.5));
      }

      // Projections onto the axes
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      line(ctx, px, py, px, oy);
      line(ctx, px, py, ox, py);
      ctx.setLineDash([]);
      // Labels only when their projection line is long enough to own them.
      ctx.fillStyle = C.muted;
      if (Math.abs(im) > 0.2 && Math.abs(re) > 0.12) {
        ctx.textAlign = "center";
        ctx.textBaseline = im >= 0 ? "top" : "bottom";
        ctx.fillText("cos θ", px, oy + (im >= 0 ? 18 : -18));
      }
      if (Math.abs(re) > 0.2 && Math.abs(im) > 0.12) {
        ctx.textAlign = re >= 0 ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText("sin θ", ox + (re >= 0 ? -8 : 8), py);
      }

      // Radius and velocity: d/dθ e^{iθ} = i·e^{iθ}, always a quarter-turn ahead.
      ctx.strokeStyle = alpha(pointColor, 0.6);
      ctx.lineWidth = 1.5;
      line(ctx, ox, oy, px, py);
      const vl = 0.5 * k;
      ctx.strokeStyle = ctx.fillStyle = C.magenta;
      ctx.lineWidth = 2;
      glow(ctx, C.magenta, 8, () => arrow(ctx, px, py, px - im * vl, py - re * vl, 8));

      ctx.fillStyle = pointColor;
      glow(ctx, pointColor, 16, () => dot(ctx, px, py, 6.5));

      ctx.font = `13px ${FONT_MONO}`;
      ctx.textAlign = re >= 0 ? "left" : "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = pointColor;
      const lx = px + (re >= 0 ? 12 : -12);
      ctx.fillText(atPi ? "e^iπ = −1" : "e^iθ", lx, py - 10);
    },
    [theta, showPoly, n, atPi],
  );

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointerdown") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setTween(null);
    }
    if (!dragging.current) return;
    const c = e.currentTarget;
    const { sx, sy } = frame({ w: c.clientWidth, h: c.clientHeight });
    const p = pointerPos(e, c);
    let a = Math.atan2(sy.invert(p.y), sx.invert(p.x));
    if (a < 0) a += TAU;
    // Snap to π so Euler's identity is easy to hit by hand.
    if (Math.abs(a - Math.PI) < 0.04) a = Math.PI;
    setTheta(a);
  };

  const [re, im] = expi(theta);
  const end = showPoly ? polygon(theta, n)[n] : null;

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">e to an imaginary power</span>
        <Legend
          items={[
            { color: "cyan", label: "angle θ travelled" },
            { color: "amber", label: "e^iθ" },
            { color: "magenta", label: "rate of change" },
            ...(showPoly ? [{ color: "blue" as const, label: "(1 + iθ/n)ⁿ" }] : []),
            { color: "lime", label: "θ = π" },
          ]}
        />
      </div>
      <canvas
        ref={ref}
        className="stage grab ar-wide"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        role="img"
        aria-label={`Unit circle. e to the i theta at theta = ${fmt(theta, 2)} is ${fmt(re)} plus ${fmt(im)} i.`}
      />
      <div className="viz-body">
        <p className="hint">Drag the point around the circle, or play to θ = π.</p>
        <div className="controls">
          <Slider
            label="Angle θ"
            value={theta}
            min={0}
            max={TAU}
            step={0.001}
            onChange={(v) => {
              setTween(null);
              setTheta(v);
            }}
            format={(v) => `${v.toFixed(3)} = ${(v / Math.PI).toFixed(3)}π`}
            color={atPi ? "lime" : "amber"}
          />
          <div className="ctl buttons">
            <button type="button" className="btn primary" onClick={playToPi}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
              Play to π
            </button>
          </div>
        </div>
        <div className="controls">
          <Toggle label="Show (1 + iθ/n)ⁿ" checked={showPoly} onChange={setShowPoly} />
          {showPoly && <Slider label="Steps n" value={n} min={1} max={64} step={1} onChange={setN} color="blue" />}
        </div>
        <Readout
          items={[
            { label: "cos θ", value: fmt(re, 4) },
            { label: "sin θ", value: fmt(im, 4) },
            { label: "e^iθ", value: fmtComplex(re, im), color: atPi ? "lime" : "amber" },
            ...(end
              ? [{ label: `n = ${n} lands at`, value: fmtComplex(end[0], end[1]), color: "blue" as const }]
              : []),
          ]}
        />
      </div>
    </div>
  );
}
