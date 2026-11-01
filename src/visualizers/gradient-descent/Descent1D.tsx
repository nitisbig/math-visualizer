import { useEffect, useRef, useState, type ReactNode } from "react";
import { arrow, axes, ball, dot, dotGrid, fadeLine, glow, pointerPos, prefersReducedMotion, scale, useCanvas, useLayer, useRaf, type Size } from "../../lib/canvas";
import { fmt, fmtSig } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Workspace from "../../components/ui/Workspace";
import { FN1, FN1_IDS, type Fn1, type Fn1Id } from "./functions";
import { insight1D } from "./insights";
import { init, step, type OptState } from "./optimizer";

const X: [number, number] = [-3, 3];
const STEP_EVERY = 0.45; // seconds between steps while playing
const TWEEN = 0.3; // seconds to glide along each step
const MAX_STEPS = 200;
const PAD = { x: 28, top: 56, bottom: 64 };

function view(fn: Fn1, size: Size) {
  return {
    sx: scale(X[0], X[1], PAD.x, size.w - PAD.x),
    sy: scale(fn.y[0], fn.y[1], size.h - PAD.bottom, PAD.top),
  };
}

export default function Descent1D({ explain }: { explain?: ReactNode }) {
  const [fnId, setFnId] = useUrlState<Fn1Id>("curve", "bowl", oneOf(FN1_IDS));
  const [lr, setLr] = useUrlNumber("lr1", 0.3, 0.01, 2.5);
  const [x0, setX0] = useUrlNumber("x1", 2.6, -2.9, 2.9);
  const fn = FN1[fnId];

  const [states, setStates] = useState<OptState[]>(() => [init([x0])]);
  const [playing, setPlaying] = useState(false);
  const [tween, setTween] = useState(1);
  const clock = useRef(0);
  const dragging = useRef(false);
  const layer = useLayer();

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

  const { ref, visible } = useCanvas(
    (ctx, size) => {
      const { sx, sy } = view(fn, size);
      const diverged = cur.status === "diverged";

      // Static: grid, axes, the loss curve with its soft fill, minima.
      layer(ctx, fnId, size, (c) => {
        dotGrid(c, size);
        axes(c, sx, sy, size, { color: C.axis, label: C.muted, ticks: { x: [-2, -1, 1, 2] }, font: `12px ${FONT_MONO}` });
        const curve = new Path2D();
        for (let i = 0; i <= 240; i++) {
          const x = X[0] + ((X[1] - X[0]) * i) / 240;
          i === 0 ? curve.moveTo(sx(x), sy(fn.f(x))) : curve.lineTo(sx(x), sy(fn.f(x)));
        }
        const area = new Path2D(curve);
        area.lineTo(sx(X[1]), size.h);
        area.lineTo(sx(X[0]), size.h);
        area.closePath();
        const g = c.createLinearGradient(0, PAD.top, 0, size.h);
        g.addColorStop(0, alpha(C.cyan, 0.02));
        g.addColorStop(1, alpha(C.cyan, 0.14));
        c.fillStyle = g;
        c.fill(area);
        c.strokeStyle = C.cyan;
        c.lineWidth = 2;
        glow(c, C.cyan, 12, () => c.stroke(curve));
        for (const m of fn.minima) {
          c.strokeStyle = alpha(C.lime, 0.5);
          c.lineWidth = 1;
          c.setLineDash([2, 4]);
          c.beginPath();
          c.moveTo(sx(m), sy(fn.f(m)));
          c.lineTo(sx(m), size.h - PAD.bottom + 24);
          c.stroke();
          c.setLineDash([]);
          c.fillStyle = C.lime;
          glow(c, C.lime, 10, () => dot(c, sx(m), sy(fn.f(m)), 4));
        }
      });

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
        ctx.strokeStyle = ctx.fillStyle = alpha(pathColor, Math.max(0.12, 0.85 - age * 0.11));
        ctx.lineWidth = 1.25;
        arrow(ctx, ax, ay, bx, by, 6);
        dot(ctx, ax, ay, 2);
      }

      // Current point (interpolated)
      const prev = pts[pts.length - 2] ?? pts[pts.length - 1];
      const x = prev + (pts[pts.length - 1] - prev) * (pts.length > 1 ? tween : 1);
      if (Math.abs(x) < 50) {
        const px = sx(x);
        const py = sy(fn.f(x));
        const slope = fn.df(x);

        // Ghost of the next step, so you can see where η will send the ball.
        if (!done && tween >= 1) {
          const nx = x - lr * slope;
          const gx = sx(nx);
          const gy = sy(fn.f(nx));
          if (Math.abs(nx) < 6 && gy > -size.h) {
            ctx.strokeStyle = alpha(C.amber, 0.45);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.quadraticCurveTo((px + gx) / 2, Math.min(py, gy) - 36, gx, gy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(gx, gy, 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Tangent in pixel space so it has a fixed on-screen length, fading at the ends.
        const k = (sy(fn.f(x) + slope) - sy(fn.f(x))) / (sx(x + 1) - sx(x));
        const L = 84 / Math.hypot(1, k);
        ctx.lineWidth = 1.5;
        fadeLine(ctx, px - L, py - k * L, px + L, py + k * L, C.magenta);

        ball(ctx, px, py, 7, diverged ? C.alert : C.amber);

        ctx.font = `12px ${FONT_MONO}`;
        ctx.fillStyle = C.magenta;
        const right = px > size.w * 0.6;
        ctx.textAlign = right ? "right" : "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`slope ${fmt(slope, 2)}`, px + (right ? -16 : 16), py - 14);
      }
    },
    [states, tween, fn, lr, done],
  );

  useRaf(
    (dt) => {
      if (tween < 1) setTween((t) => Math.min(1, t + dt / TWEEN));
      if (!playing) return;
      clock.current += dt;
      if (clock.current >= STEP_EVERY && tween >= 1) {
        clock.current = 0;
        advance();
      }
    },
    playing || tween < 1,
    visible,
  );

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointerdown") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setPlaying(false);
    }
    if (!dragging.current) return;
    const c = e.currentTarget;
    const { x } = pointerPos(e, c);
    const v = view(fn, { w: c.clientWidth, h: c.clientHeight }).sx.invert(x);
    setX0(Math.round(Math.max(-2.9, Math.min(2.9, v)) * 100) / 100);
  };

  const preset = (id: Fn1Id, rate: number) => () => {
    setFnId(id);
    setLr(rate);
    setX0(FN1[id].start);
    setStates([init([FN1[id].start])]);
    setPlaying(true);
  };

  const x = cur.p[0];
  const status =
    cur.status === "diverged"
      ? { text: "Diverged", color: C.alert }
      : cur.status === "converged"
        ? { text: `Converged · ${cur.iter} steps`, color: C.lime }
        : cur.iter >= MAX_STEPS
          ? { text: `Still crawling · ${MAX_STEPS} steps`, color: C.muted }
          : { text: cur.iter === 0 ? "Ready" : `Step ${cur.iter}`, color: cur.iter === 0 ? C.muted : C.amber };

  return (
    <Workspace
      title="Roll down a curve"
      tab="Curve"
      legend={[
        { color: "cyan", label: "loss f(x)" },
        { color: "amber", label: "position" },
        { color: "magenta", label: "slope" },
        { color: "lime", label: "minimum" },
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
          aria-label={`Curve ${fn.label}. Current position x = ${fmt(x)}, loss ${fmt(fn.f(x))}.`}
        />
      }
      status={status}
      accent="amber"
      coach="Drag the curve to pick a start"
      transport={{
        playing,
        onPlay: () => {
          if (done) setStates([init([x0])]);
          setPlaying((p) => !p);
        },
        onStep: done ? undefined : advance,
        onReset: () => {
          setPlaying(false);
          setStates([init([x0])]);
        },
      }}
      controls={
        <>
          <Slider label="Learning rate η" value={lr} min={0.01} max={2.5} log onChange={setLr} format={fmtSig} color="amber" />
          <Segmented label="Curve" value={fnId} options={FN1_IDS.map((id) => ({ value: id, label: FN1[id].label }))} onChange={setFnId} />
        </>
      }
      stats={[
        { label: "x", value: fmt(x), color: "amber" },
        { label: "loss f(x)", value: fmt(fn.f(x)), color: "cyan" },
        { label: "slope f′(x)", value: fmt(fn.df(x)), color: "magenta" },
      ]}
      insight={insight1D(fn, lr, cur)}
      tries={[
        { label: "Crawl · η 0.1", apply: preset("bowl", 0.1) },
        { label: "One jump · η 1.0", apply: preset("bowl", 1) },
        { label: "Zig-zag · η 1.8", apply: preset("bowl", 1.8) },
        { label: "Blow up · η 2.2", apply: preset("bowl", 2.2) },
        { label: "Two valleys", apply: preset("valleys", 0.05) },
      ]}
      explain={explain}
    />
  );
}
