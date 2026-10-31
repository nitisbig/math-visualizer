import { useRef } from "react";
import { axes, dot, dotGrid, glow, line, pointerPos, scale, useCanvas } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { useUrlNumber } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import Readout from "../../components/ui/Readout";
import Slider from "../../components/ui/Slider";

const X: [number, number] = [-2.5, 2.5];
const Y: [number, number] = [-0.6, 7.4];
const PX: [number, number] = [-2, 1];
const MATCH = 0.01;

export default function OwnDerivative() {
  const [a, setA] = useUrlNumber("a", 2, 1.2, 4);
  const [x, setX] = useUrlNumber("px", 0.6, PX[0], PX[1]);
  const dragging = useRef(false);

  const h = Math.pow(a, x);
  const slope = Math.log(a) * h;
  const match = Math.abs(a - Math.E) < MATCH;

  const frame = (w: number, hh: number) => {
    const pad = 28;
    return { sx: scale(X[0], X[1], pad, w - pad), sy: scale(Y[0], Y[1], hh - pad, pad) };
  };

  const { ref } = useCanvas(
    (ctx, size) => {
      const { sx, sy } = frame(size.w, size.h);
      dotGrid(ctx, size);
      axes(ctx, sx, sy, size, { color: C.axis, label: C.muted, ticks: { x: [-2, -1, 1, 2], y: [2, 4, 6] }, font: `11px ${FONT_MONO}` });

      // Reference: e^x, faint, so you can see where you're heading.
      if (!match) {
        ctx.strokeStyle = alpha(C.lime, 0.35);
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const t = X[0] + ((X[1] - X[0]) * i) / 200;
          i ? ctx.lineTo(sx(t), sy(Math.exp(t))) : ctx.moveTo(sx(t), sy(Math.exp(t)));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // a^x
      const curve = match ? C.lime : C.cyan;
      ctx.strokeStyle = curve;
      ctx.lineWidth = 2;
      glow(ctx, curve, match ? 18 : 10, () => {
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) {
          const t = X[0] + ((X[1] - X[0]) * i) / 240;
          i ? ctx.lineTo(sx(t), sy(Math.pow(a, t))) : ctx.moveTo(sx(t), sy(Math.pow(a, t)));
        }
        ctx.stroke();
      });

      const px = sx(x);
      const py = sy(h);

      // Height: from the axis up to the curve.
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 3;
      line(ctx, px, sy(0), px, py);

      // Tangent, and its rise over a run of 1 — compare that rise with the height.
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 1.5;
      glow(ctx, C.magenta, 8, () => line(ctx, sx(x - 1.2), sy(h - 1.2 * slope), sx(x + 1.4), sy(h + 1.4 * slope)));
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      line(ctx, px, py, sx(x + 1), py);
      ctx.setLineDash([]);
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 3;
      line(ctx, sx(x + 1), py, sx(x + 1), sy(h + slope));

      ctx.fillStyle = C.amber;
      glow(ctx, C.amber, 14, () => dot(ctx, px, py, 6));

      ctx.font = `12px ${FONT_MONO}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillStyle = C.amber;
      ctx.fillText("height", px - 8, (sy(0) + py) / 2);
      ctx.textAlign = "left";
      ctx.fillStyle = C.magenta;
      ctx.fillText("slope", sx(x + 1) + 8, (py + sy(h + slope)) / 2);
      ctx.fillStyle = C.muted;
      ctx.textBaseline = "top";
      ctx.fillText("run = 1", (px + sx(x + 1)) / 2 - 22, py + 6);

      ctx.textAlign = "left";
      ctx.fillStyle = curve;
      ctx.fillText(match ? "eˣ — slope equals height everywhere" : `${a.toFixed(3)}ˣ`, 36, 12);
    },
    [a, x, match],
  );

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointerdown") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!dragging.current) return;
    const c = e.currentTarget;
    const { sx } = frame(c.clientWidth, c.clientHeight);
    const v = sx.invert(pointerPos(e, c).x);
    setX(Math.round(Math.max(PX[0], Math.min(PX[1], v)) * 100) / 100);
  };

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">The function that is its own slope</span>
        <Legend
          items={[
            { color: "cyan", label: "aˣ" },
            { color: "amber", label: "height" },
            { color: "magenta", label: "slope" },
            { color: "lime", label: "a = e" },
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
        aria-label={`Graph of ${a.toFixed(3)} to the x. At x = ${fmt(x, 2)} the height is ${fmt(h)} and the slope is ${fmt(slope)}.`}
      />
      <div className="viz-body">
        <p className="hint">Slide the base until the magenta rise matches the amber height. Drag on the graph to move the point.</p>
        <div className="controls">
          <Slider label="Base a" value={a} min={1.2} max={4} step={0.001} onChange={setA} format={(v) => v.toFixed(3)} color={match ? "lime" : "cyan"} />
          <div className="ctl buttons">
            <button type="button" className="btn" onClick={() => setA(Math.E)}>
              Snap to e
            </button>
          </div>
        </div>
        <Readout
          items={[
            { label: "height aˣ", value: fmt(h), color: "amber" },
            { label: "slope", value: fmt(slope), color: "magenta" },
            { label: "slope ÷ height", value: fmt(slope / h, 4), color: match ? "lime" : "ink" },
          ]}
        />
        <p className="status" style={{ color: match ? C.lime : C.muted }} aria-live="polite">
          {match ? "a = e: the slope is exactly the height, at every point" : `slope ÷ height = ln ${a.toFixed(3)} — the same at every x`}
        </p>
      </div>
    </div>
  );
}
