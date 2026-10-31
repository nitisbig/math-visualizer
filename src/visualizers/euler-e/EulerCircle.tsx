import { useRef, useState, type ReactNode } from "react";
import { arrow, ball, dot, dotGrid, glow, line, pointerPos, prefersReducedMotion, scale, useCanvas, useRaf, type Size } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { bool, useUrlNumber, useUrlState } from "../../lib/urlState";
import Slider from "../../components/ui/Slider";
import Toggle from "../../components/ui/Toggle";
import Workspace from "../../components/ui/Workspace";
import { circleInsight } from "./insights";
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

export default function EulerCircle({ explain }: { explain?: ReactNode }) {
  const [theta, setTheta] = useUrlNumber("t", 1, 0, TAU);
  const [showPoly, setShowPoly] = useUrlState("poly", false, bool);
  const [n, setN] = useUrlNumber("steps", 6, 1, 64);
  const [tween, setTween] = useState<{ from: number; to: number; t: number } | null>(null);
  const dragging = useRef(false);

  const atPi = Math.abs(theta - Math.PI) < 0.004;

  const playToPi = () => {
    const from = atPi ? 0 : theta;
    if (prefersReducedMotion()) return setTheta(Math.PI);
    setTween({ from, to: Math.PI, t: 0 });
  };

  const { ref, visible } = useCanvas(
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
      // The travelled arc brightens toward the point (conic gradient, plain cyan where unsupported).
      if ("createConicGradient" in ctx && theta > 0.01) {
        const g = ctx.createConicGradient(0, ox, oy);
        const at = Math.max(0, 1 - theta / TAU);
        g.addColorStop(0, C.cyan);
        g.addColorStop(at, C.cyan);
        g.addColorStop(1, alpha(C.cyan, 0.15));
        ctx.strokeStyle = g;
      } else ctx.strokeStyle = C.cyan;
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

      // Projections onto the axes: cos θ along Re, sin θ along Im.
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = alpha(C.ink, 0.45);
      line(ctx, ox, oy, px, oy);
      line(ctx, ox, oy, ox, py);
      ctx.lineCap = "butt";
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

      ball(ctx, px, py, 6.5, pointColor);

      ctx.font = `13px ${FONT_MONO}`;
      ctx.textAlign = re >= 0 ? "left" : "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = pointColor;
      const lx = px + (re >= 0 ? 12 : -12);
      ctx.fillText(atPi ? "e^iπ = −1" : "e^iθ", lx, py - 10);
    },
    [theta, showPoly, n, atPi],
  );

  useRaf((dt) => {
    if (!tween) return;
    const t = Math.min(1, tween.t + dt / PLAY_SECONDS);
    setTheta(tween.from + (tween.to - tween.from) * ease(t));
    setTween(t >= 1 ? null : { ...tween, t });
  }, tween !== null, visible);


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
    <Workspace
      title="e to an imaginary power"
      tab="Rotation"
      legend={[
        { color: "cyan", label: "angle θ travelled" },
        { color: "amber", label: "e^iθ" },
        { color: "magenta", label: "rate of change" },
        ...(showPoly ? [{ color: "blue" as const, label: "(1 + iθ/n)ⁿ" }] : []),
        { color: "lime", label: "θ = π" },
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
          aria-label={`Unit circle. e to the i theta at theta = ${fmt(theta, 2)} is ${fmt(re)} plus ${fmt(im)} i.`}
        />
      }
      status={atPi ? { text: "e^iπ = −1", color: C.lime } : { text: `θ = ${(theta / Math.PI).toFixed(3)}π`, color: C.amber }}
      coach="Drag the point around the circle"
      transport={{
        playing: tween !== null,
        playLabel: "Play to π",
        onPlay: () => (tween ? setTween(null) : playToPi()),
        onReset: () => {
          setTween(null);
          setTheta(0);
        },
      }}
      controls={
        <>
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
            format={(v) => `${(v / Math.PI).toFixed(3)}π`}
            color={atPi ? "lime" : "amber"}
          />
          <Toggle label="Show (1 + iθ/n)ⁿ" checked={showPoly} onChange={setShowPoly} />
          {showPoly && <Slider label="Steps n" value={n} min={1} max={64} step={1} onChange={setN} color="blue" />}
        </>
      }
      stats={[
        { label: "cos θ", value: fmt(re, 3) },
        { label: "sin θ", value: fmt(im, 3) },
        end
          ? { label: `n = ${n} lands at`, value: fmtComplex(end[0], end[1]), color: "blue" as const }
          : { label: "e^iθ", value: fmtComplex(re, im), color: atPi ? "lime" : "amber" },
      ]}
      insight={circleInsight(theta, showPoly, n)}
      tries={[
        { label: "Play to π", apply: playToPi },
        {
          label: "Compound it: n = 6",
          apply: () => {
            setShowPoly(true);
            setN(6);
          },
        },
        {
          label: "n = 64",
          apply: () => {
            setShowPoly(true);
            setN(64);
          },
        },
      ]}
      explain={explain}
    />
  );
}
