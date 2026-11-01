import { useRef, type ReactNode } from "react";
import { axes, ball, dotGrid, glow, line, pointerPos, scale, useCanvas } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { useUrlNumber } from "../../lib/urlState";
import Slider from "../../components/ui/Slider";
import Workspace from "../../components/ui/Workspace";
import { MATCH, derivativeInsight } from "./insights";

const X: [number, number] = [-2.5, 2.5];
const Y: [number, number] = [-0.6, 7.4];
const PX: [number, number] = [-2, 1];

export default function OwnDerivative({ explain }: { explain?: ReactNode }) {
  const [a, setA] = useUrlNumber("a", 2, 1.2, 4);
  const [x, setX] = useUrlNumber("px", 0.6, PX[0], PX[1]);
  const dragging = useRef(false);

  const h = Math.pow(a, x);
  const slope = Math.log(a) * h;
  const match = Math.abs(a - Math.E) < MATCH;

  const frame = (w: number, hh: number) => ({ sx: scale(X[0], X[1], 28, w - 28), sy: scale(Y[0], Y[1], hh - 64, 52) });

  const { ref } = useCanvas(
    (ctx, size) => {
      const { sx, sy } = frame(size.w, size.h);
      dotGrid(ctx, size);
      axes(ctx, sx, sy, size, { color: C.axis, label: C.muted, ticks: { x: [-2, -1, 1, 2], y: [2, 4, 6] }, font: `12px ${FONT_MONO}` });

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

      // a^x, with a soft fill underneath
      const curveColor = match ? C.lime : C.cyan;
      const curve = new Path2D();
      for (let i = 0; i <= 240; i++) {
        const t = X[0] + ((X[1] - X[0]) * i) / 240;
        i ? curve.lineTo(sx(t), sy(Math.pow(a, t))) : curve.moveTo(sx(t), sy(Math.pow(a, t)));
      }
      const area = new Path2D(curve);
      area.lineTo(sx(X[1]), sy(0));
      area.lineTo(sx(X[0]), sy(0));
      area.closePath();
      const g = ctx.createLinearGradient(0, 52, 0, sy(0));
      g.addColorStop(0, alpha(curveColor, 0.16));
      g.addColorStop(1, alpha(curveColor, 0.01));
      ctx.fillStyle = g;
      ctx.fill(area);
      ctx.strokeStyle = curveColor;
      ctx.lineWidth = 2;
      glow(ctx, curveColor, match ? 18 : 10, () => ctx.stroke(curve));

      const px = sx(x);
      const py = sy(h);
      const qx = sx(x + 1);
      const qy = sy(h + slope);

      // Rise-over-run triangle: its rise is the slope; compare it with the height.
      ctx.fillStyle = alpha(C.magenta, 0.12);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(qx, py);
      ctx.lineTo(qx, qy);
      ctx.closePath();
      ctx.fill();

      // Height: from the axis up to the curve.
      const hg = ctx.createLinearGradient(0, sy(0), 0, py);
      hg.addColorStop(0, alpha(C.amber, 0.25));
      hg.addColorStop(1, C.amber);
      ctx.strokeStyle = hg;
      ctx.lineWidth = 3;
      line(ctx, px, sy(0), px, py);

      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 1.5;
      glow(ctx, C.magenta, 8, () => line(ctx, sx(x - 1.2), sy(h - 1.2 * slope), sx(x + 1.4), sy(h + 1.4 * slope)));
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      line(ctx, px, py, qx, py);
      ctx.setLineDash([]);
      ctx.strokeStyle = C.magenta;
      ctx.lineWidth = 3;
      line(ctx, qx, py, qx, qy);

      ball(ctx, px, py, 6, C.amber);

      ctx.font = `12px ${FONT_MONO}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillStyle = C.amber;
      ctx.fillText("height", px - 10, (sy(0) + py) / 2);
      ctx.textAlign = "left";
      ctx.fillStyle = C.magenta;
      ctx.fillText("slope", qx + 8, (py + qy) / 2);
      ctx.fillStyle = C.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("run = 1", (px + qx) / 2, py + 6);
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
    <Workspace
      title="The function that is its own slope"
      tab="Slope"
      legend={[
        { color: "cyan", label: "aˣ" },
        { color: "amber", label: "height" },
        { color: "magenta", label: "slope" },
        { color: "lime", label: "a = e" },
      ]}
      stage={
        <canvas
          ref={ref}
          className="stage grab"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          role="img"
          aria-label={`Graph of ${a.toFixed(3)} to the x. At x = ${fmt(x, 2)} the height is ${fmt(h)} and the slope is ${fmt(slope)}.`}
        />
      }
      status={match ? { text: "a = e · slope = height", color: C.lime } : { text: `${a.toFixed(3)}ˣ · slope ÷ height = ${fmt(slope / h, 3)}`, color: C.cyan }}
      accent="amber"
      coach="Drag the graph to move the point"
      controls={
        <>
          <Slider label="Base a" value={a} min={1.2} max={4} step={0.001} onChange={setA} format={(v) => v.toFixed(3)} color={match ? "lime" : "cyan"} />
          <div className="ctl buttons">
            <button type="button" className="btn" onClick={() => setA(Math.E)}>
              Snap to e
            </button>
          </div>
        </>
      }
      stats={[
        { label: "height aˣ", value: fmt(h), color: "amber" },
        { label: "slope", value: fmt(slope), color: "magenta" },
        { label: "slope ÷ height", value: fmt(slope / h, 4), color: match ? "lime" : "ink" },
      ]}
      insight={derivativeInsight(a)}
      tries={[
        { label: "a = 2", apply: () => setA(2) },
        { label: "a = 3", apply: () => setA(3) },
        { label: "Snap to e", apply: () => setA(Math.E) },
      ]}
      explain={explain}
    />
  );
}
