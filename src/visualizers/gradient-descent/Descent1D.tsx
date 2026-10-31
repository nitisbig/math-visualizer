import { useEffect, useRef, useState } from "react";
import { arrow, axes, dot, dotGrid, glow, line, pointerPos, prefersReducedMotion, scale, useCanvas, useRaf } from "../../lib/canvas";
import { fmt, fmtSig } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import PlayControls from "../../components/ui/PlayControls";
import Readout from "../../components/ui/Readout";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import { FN1, FN1_IDS, type Fn1Id } from "./functions";
import { init, step, type OptState } from "./optimizer";

const X: [number, number] = [-3, 3];
const STEP_EVERY = 0.45; // seconds between steps while playing
const TWEEN = 0.3; // seconds to glide along each step
const MAX_STEPS = 200;

export default function Descent1D() {
  const [fnId, setFnId] = useUrlState<Fn1Id>("curve", "bowl", oneOf(FN1_IDS));
  const [lr, setLr] = useUrlNumber("lr1", 0.3, 0.01, 2.5);
  const [x0, setX0] = useUrlNumber("x1", 2.6, -2.9, 2.9);
  const fn = FN1[fnId];

  const [states, setStates] = useState<OptState[]>(() => [init([x0])]);
  const [playing, setPlaying] = useState(false);
  const [tween, setTween] = useState(1);
  const clock = useRef(0);
  const dragging = useRef(false);

  // Any change to the setup restarts the run from the start point.
  useEffect(() => {
    setStates([init([x0])]);
    setTween(1);
  }, [x0, lr, fnId]);

  const cur = states[states.length - 1];
  const done = cur.status !== "running" || cur.iter >= MAX_STEPS;

  const advance = () => {
    setStates((s) => [...s, step(s[s.length - 1], (p) => [fn.df(p[0])], { lr, tol: 1e-3, limit: 8 })]);
    setTween(prefersReducedMotion() ? 1 : 0);
  };

  useEffect(() => {
    if (done) setPlaying(false);
  }, [done]);

  useRaf((dt) => {
    if (tween < 1) setTween((t) => Math.min(1, t + dt / TWEEN));
    if (!playing) return;
    clock.current += dt;
    if (clock.current >= STEP_EVERY && tween >= 1) {
      clock.current = 0;
      advance();
    }
  }, playing || tween < 1);

  const { ref } = useCanvas(
    (ctx, size) => {
      const pad = 28;
      const sx = scale(X[0], X[1], pad, size.w - pad);
      const sy = scale(fn.y[0], fn.y[1], size.h - pad, pad);
      const diverged = cur.status === "diverged";

      dotGrid(ctx, size);
      axes(ctx, sx, sy, size, { color: C.axis, label: C.muted, ticks: { x: [-2, -1, 1, 2] }, font: `11px ${FONT_MONO}` });

      // Curve
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      glow(ctx, C.cyan, 12, () => {
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) {
          const x = X[0] + ((X[1] - X[0]) * i) / 240;
          const y = sy(fn.f(x));
          i === 0 ? ctx.moveTo(sx(x), y) : ctx.lineTo(sx(x), y);
        }
        ctx.stroke();
      });

      // Minima
      ctx.fillStyle = C.lime;
      for (const m of fn.minima) {
        glow(ctx, C.lime, 10, () => dot(ctx, sx(m), sy(fn.f(m)), 4));
      }

      // Path: completed steps fade with age; the newest one glides in.
      const pts = states.map((s) => s.p[0]);
      const pathColor = diverged ? C.alert : C.amber;
      for (let i = 1; i < pts.length; i++) {
        const age = pts.length - 1 - i;
        const t = i === pts.length - 1 ? tween : 1;
        const ax = sx(pts[i - 1]);
        const ay = sy(fn.f(pts[i - 1]));
        const bx = ax + (sx(pts[i]) - ax) * t;
        const by = ay + (sy(fn.f(pts[i])) - ay) * t;
        ctx.strokeStyle = ctx.fillStyle = alpha(pathColor, Math.max(0.18, 0.9 - age * 0.12));
        ctx.lineWidth = 1.5;
        arrow(ctx, ax, ay, bx, by, 7);
        dot(ctx, ax, ay, 2.5);
      }

      // Current point (interpolated) and its tangent
      const prev = pts[pts.length - 2] ?? pts[pts.length - 1];
      const x = prev + (pts[pts.length - 1] - prev) * (pts.length > 1 ? tween : 1);
      if (Math.abs(x) < 50) {
        const px = sx(x);
        const py = sy(fn.f(x));
        const slope = fn.df(x);
        // Tangent drawn in pixel space so it has a fixed on-screen length.
        const k = (sy(fn.f(x) + slope) - sy(fn.f(x))) / (sx(x + 1) - sx(x));
        const L = 70 / Math.hypot(1, k);
        ctx.strokeStyle = C.magenta;
        ctx.lineWidth = 1.5;
        glow(ctx, C.magenta, 8, () => line(ctx, px - L, py - k * L, px + L, py + k * L));

        ctx.fillStyle = diverged ? C.alert : C.amber;
        glow(ctx, ctx.fillStyle, 16, () => dot(ctx, px, py, 7));
        ctx.fillStyle = C.bg;
        dot(ctx, px, py, 2.5);

        ctx.font = `12px ${FONT_MONO}`;
        ctx.fillStyle = C.magenta;
        ctx.textAlign = px > size.w * 0.6 ? "right" : "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`slope ${fmt(slope, 2)}`, px + (px > size.w * 0.6 ? -14 : 14), py - 12);
      }

      ctx.font = `12px ${FONT_MONO}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("f(x)", pad, 10);
    },
    [states, tween, fn],
  );

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointerdown") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPlaying(false);
    }
    if (!dragging.current) return;
    const { x } = pointerPos(e, e.currentTarget);
    const w = e.currentTarget.clientWidth;
    const v = scale(28, w - 28, X[0], X[1])(x);
    setX0(Math.round(Math.max(-2.9, Math.min(2.9, v)) * 100) / 100);
  };

  const x = cur.p[0];
  const status =
    cur.status === "diverged"
      ? { text: "Diverged — η is too large", color: C.alert }
      : cur.status === "converged"
        ? { text: `Converged in ${cur.iter} steps`, color: C.lime }
        : cur.iter >= MAX_STEPS
          ? { text: `Still crawling after ${MAX_STEPS} steps`, color: C.muted }
          : { text: cur.iter === 0 ? "Ready" : "Descending…", color: C.muted };

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">Roll down a curve</span>
        <Legend
          items={[
            { color: "cyan", label: "loss f(x)" },
            { color: "amber", label: "position" },
            { color: "magenta", label: "slope" },
            { color: "lime", label: "minimum" },
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
        aria-label={`Curve ${fn.label}. Current position x = ${fmt(x)}, loss ${fmt(fn.f(x))}.`}
      />
      <div className="viz-body">
        <p className="hint">Drag anywhere on the curve to choose a starting point, then press Play.</p>
        <div className="controls">
          <Slider label="Learning rate η" value={lr} min={0.01} max={2.5} log onChange={setLr} format={fmtSig} color="amber" />
          <Segmented
            label="Curve"
            value={fnId}
            options={FN1_IDS.map((id) => ({ value: id, label: FN1[id].label }))}
            onChange={setFnId}
          />
          <PlayControls
            playing={playing}
            onPlay={() => {
              if (done) setStates([init([x0])]);
              setPlaying((p) => !p);
            }}
            onStep={done ? undefined : advance}
            onReset={() => {
              setPlaying(false);
              setStates([init([x0])]);
            }}
          />
        </div>
        <Readout
          items={[
            { label: "step", value: String(cur.iter) },
            { label: "x", value: fmt(x), color: "amber" },
            { label: "f(x)", value: fmt(fn.f(x)), color: "cyan" },
            { label: "f′(x)", value: fmt(fn.df(x)), color: "magenta" },
          ]}
        />
        <p className="status" style={{ color: status.color }} aria-live="polite">
          {status.text}
        </p>
      </div>
    </div>
  );
}
