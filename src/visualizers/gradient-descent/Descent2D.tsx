import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arrow, ball, dot, glow, pointerPos, scale, useCanvas, useLayer, useRaf, type Size } from "../../lib/canvas";
import { contours } from "../../lib/contours";
import { fmt, fmtSig } from "../../lib/format";
import { C, alpha } from "../../lib/theme";
import { oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Workspace from "../../components/ui/Workspace";
import { FN2, FN2_IDS, type Fn2, type Fn2Id } from "./functions";
import { insight2D } from "./insights";
import { init, step, type OptState } from "./optimizer";

const STEPS_PER_SEC = 20;
const MAX_STEPS = 3000;
const SPEEDS = ["1", "5", "25"] as const;
const OPTS = ["gd", "momentum"] as const;
type Opt = (typeof OPTS)[number];

/** Uniform scale that fits the function's domain into the canvas (extra room extends the view). */
function view(fn: Fn2, { w, h }: Size) {
  const [x0, x1] = fn.domain.x;
  const [y0, y1] = fn.domain.y;
  const k = Math.min(w / (x1 - x0), h / (y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sx = scale(cx - w / 2 / k, cx + w / 2 / k, 0, w);
  const sy = scale(cy - h / 2 / k, cy + h / 2 / k, h, 0);
  return { sx, sy };
}

/** Shaded relief + contour lines for one surface. Rendered into a cached layer. */
function renderSurface(ctx: CanvasRenderingContext2D, fn: Fn2, size: Size) {
  const { sx, sy } = view(fn, size);
  const cell = 2;
  const nx = Math.ceil(size.w / cell);
  const ny = Math.ceil(size.h / cell);
  const W = nx + 1;
  const H = ny + 1;
  const grid = new Float32Array(W * H);
  const fmin = Math.min(...fn.minima.map(([x, y]) => fn.f(x, y)));
  const shade = (v: number) => (fn.logShade ? Math.log1p(v - fmin) : Math.sqrt(Math.max(0, v - fmin)));
  let gmax = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const g = shade(fn.f(sx.invert(i * cell), sy.invert(j * cell)));
      grid[j * W + i] = g;
      if (g > gmax) gmax = g;
    }
  }

  // Low-res relief: height → navy-to-cyan ramp, lit from the top-left (hillshade).
  const heat = document.createElement("canvas");
  heat.width = W;
  heat.height = H;
  const img = heat.getContext("2d")!.createImageData(W, H);
  const [lx, ly, lz] = [-0.45, -0.55, 0.7];
  const relief = 7;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const p = j * W + i;
      const t = Math.min(1, grid[p] / gmax);
      const dx = (grid[j * W + Math.min(nx, i + 1)] - grid[j * W + Math.max(0, i - 1)]) / gmax;
      const dy = (grid[Math.min(ny, j + 1) * W + i] - grid[Math.max(0, j - 1) * W + i]) / gmax;
      const n = Math.hypot(dx * relief, dy * relief, 1);
      const lam = Math.max(0, (-dx * relief * lx - dy * relief * ly + lz) / n);
      const tt = Math.pow(t, 0.85);
      const k = (0.06 + 0.3 * Math.pow(tt, 1.3)) * (0.5 + 0.7 * lam) * 1.15;
      img.data[p * 4] = (10 + 24 * tt) * k;
      img.data[p * 4 + 1] = (22 + 189 * tt) * k;
      img.data[p * 4 + 2] = (40 + 198 * tt) * k;
      img.data[p * 4 + 3] = 255;
    }
  }
  heat.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(heat, 0, 0, W * cell, H * cell);

  // Contours, denser near the floor; every fourth one a little brighter.
  const N = 16;
  const levels = Array.from({ length: N }, (_, i) => gmax * Math.pow((i + 0.5) / N, 1.3));
  const segs = contours(grid, nx, ny, cell, levels);
  segs.forEach((seg, li) => {
    const major = li % 4 === 3;
    ctx.lineWidth = major ? 1.4 : 1;
    ctx.strokeStyle = alpha(C.cyan, (major ? 0.95 : 0.65) - (li / N) * 0.3);
    ctx.beginPath();
    for (let k = 0; k < seg.length; k += 4) {
      ctx.moveTo(seg[k], seg[k + 1]);
      ctx.lineTo(seg[k + 2], seg[k + 3]);
    }
    ctx.stroke();
  });

  // Vignette keeps the eye in the middle.
  const v = ctx.createRadialGradient(size.w / 2, size.h / 2, Math.min(size.w, size.h) * 0.35, size.w / 2, size.h / 2, Math.hypot(size.w, size.h) * 0.6);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size.w, size.h);

  ctx.fillStyle = C.lime;
  for (const [mx, my] of fn.minima) glow(ctx, C.lime, 10, () => dot(ctx, sx(mx), sy(my), 4));
}

export default function Descent2D({ explain }: { explain?: ReactNode }) {
  const [fnId, setFnId] = useUrlState<Fn2Id>("surf", "bowl", oneOf(FN2_IDS));
  const fn = FN2[fnId];
  const [lr, setLr] = useUrlNumber("lr", FN2.bowl.lr, 0.0005, 1.2);
  const [opt, setOpt] = useUrlState<Opt>("opt", "gd", oneOf(OPTS));
  const [beta, setBeta] = useUrlNumber("beta", 0.9, 0, 0.99);
  const [startX, setStartX] = useUrlNumber("x", FN2.bowl.start[0], -10, 10);
  const [startY, setStartY] = useUrlNumber("y", FN2.bowl.start[1], -10, 10);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("1");

  const [states, setStates] = useState<OptState[]>(() => [init([startX, startY])]);
  const [playing, setPlaying] = useState(false);
  const clock = useRef(0);
  const dragging = useRef(false);
  const layer = useLayer();

  const b = opt === "momentum" ? beta : 0;
  const cfg = useMemo(() => ({ lr, beta: b, limit: 10 }), [lr, b]);
  const grad = (p: number[]) => fn.grad(p[0], p[1]);
  const restart = () => setStates([init([startX, startY])]);

  useEffect(restart, [startX, startY, lr, opt, beta, fnId]);

  const cur = states[states.length - 1];
  const done = cur.status !== "running" || cur.iter >= MAX_STEPS;
  useEffect(() => {
    if (done) setPlaying(false);
  }, [done]);

  const advance = (n = 1) =>
    setStates((s) => {
      const next = [...s];
      for (let i = 0; i < n && next[next.length - 1].status === "running" && next.length <= MAX_STEPS; i++) {
        next.push(step(next[next.length - 1], grad, cfg));
      }
      return next;
    });

  const { ref, visible } = useCanvas(
    (ctx, size) => {
      layer(ctx, fnId, size, (c) => renderSurface(c, fn, size));
      const { sx, sy } = view(fn, size);
      const diverged = cur.status === "diverged";
      const col = diverged ? C.alert : C.amber;

      // Path, brighter toward the present: drawn in a few age buckets, not per segment.
      const n = states.length;
      const buckets = Math.min(10, n - 1);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      for (let k = 0; k < buckets; k++) {
        const i0 = Math.floor((k * (n - 1)) / buckets);
        const i1 = Math.floor(((k + 1) * (n - 1)) / buckets);
        ctx.strokeStyle = alpha(col, 0.2 + 0.75 * ((k + 1) / buckets));
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const [x, y] = states[i].p;
          i === i0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y));
        }
        ctx.stroke();
      }
      if (n < 150) {
        ctx.fillStyle = alpha(col, 0.65);
        for (const s of states) dot(ctx, sx(s.p[0]), sy(s.p[1]), 1.8);
      }

      // Start marker
      const s0 = states[0].p;
      ctx.strokeStyle = alpha(C.ink, 0.5);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(sx(s0[0]), sy(s0[1]), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const [px, py] = [sx(cur.p[0]), sy(cur.p[1])];
      if (Math.abs(px) < 1e4 && Math.abs(py) < 1e4) {
        if (cur.status === "running") {
          // Downhill arrow (−∇f), length squashed so steep spots stay readable.
          const g = grad(cur.p);
          const gn = Math.hypot(g[0], g[1]);
          if (gn > 1e-6) {
            const L = 16 + 36 * Math.tanh(gn);
            ctx.strokeStyle = ctx.fillStyle = C.magenta;
            ctx.lineWidth = 2;
            // Screen y is flipped, so −∂f/∂y points up on screen when positive.
            glow(ctx, C.magenta, 8, () => arrow(ctx, px, py, px - (g[0] / gn) * L, py + (g[1] / gn) * L, 8));
          }
          // Momentum: where the velocity alone would carry the ball.
          const vn = Math.hypot(cur.v[0], cur.v[1]);
          if (b > 0 && vn > 1e-6) {
            const L = 12 + 40 * Math.tanh(vn * lr * 4);
            ctx.strokeStyle = ctx.fillStyle = alpha(C.ink, 0.75);
            ctx.lineWidth = 1.5;
            arrow(ctx, px, py, px - (cur.v[0] / vn) * L, py + (cur.v[1] / vn) * L, 6);
          }
        }
        if (cur.status === "converged") {
          ctx.strokeStyle = alpha(C.lime, 0.8);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
        ball(ctx, px, py, 6.5, col);
      }
    },
    [states, fn, b, lr],
  );

  useRaf(
    (dt) => {
      clock.current += dt * STEPS_PER_SEC * Number(speed);
      const n = Math.floor(clock.current);
      if (n > 0) {
        clock.current -= n;
        advance(n);
      }
    },
    playing,
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
    const { x, y } = pointerPos(e, c);
    const { sx, sy } = view(fn, { w: c.clientWidth, h: c.clientHeight });
    setStartX(Math.round(sx.invert(x) * 100) / 100);
    setStartY(Math.round(sy.invert(y) * 100) / 100);
  };
  const onRelease = () => {
    if (!dragging.current) return;
    dragging.current = false;
    restart();
    setPlaying(true);
  };

  const chooseSurface = (id: Fn2Id) => {
    setFnId(id);
    setLr(FN2[id].lr);
    setStartX(FN2[id].start[0]);
    setStartY(FN2[id].start[1]);
  };

  const preset = (id: Fn2Id, o: Opt, spd: (typeof SPEEDS)[number] = "1") => () => {
    chooseSurface(id);
    setOpt(o);
    if (o === "momentum") setBeta(0.9);
    setSpeed(spd);
    setStates([init(FN2[id].start)]);
    setPlaying(true);
  };

  const g = grad(cur.p);
  const loss = fn.f(cur.p[0], cur.p[1]);
  const status =
    cur.status === "diverged"
      ? { text: "Diverged", color: C.alert }
      : cur.status === "converged"
        ? { text: `Converged · ${cur.iter} steps`, color: C.lime }
        : cur.iter >= MAX_STEPS
          ? { text: `Still going · ${MAX_STEPS} steps`, color: C.muted }
          : { text: cur.iter === 0 ? "Ready" : `Step ${cur.iter}`, color: cur.iter === 0 ? C.muted : C.amber };

  return (
    <Workspace
      title="Descend a loss landscape"
      tab="Landscape"
      legend={[
        { color: "cyan", label: "loss surface" },
        { color: "amber", label: "path" },
        { color: "magenta", label: "−∇f downhill" },
        ...(b > 0 ? [{ color: "ink" as const, label: "velocity" }] : []),
        { color: "lime", label: "minimum" },
      ]}
      stage={
        <canvas
          ref={ref}
          className="stage"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          role="img"
          aria-label={`Contour map of the ${fn.label} surface. Ball at (${fmt(cur.p[0], 2)}, ${fmt(cur.p[1], 2)}), loss ${fmt(loss)}.`}
        />
      }
      status={status}
      accent="amber"
      coach="Tap the map to drop a ball"
      transport={{
        playing,
        onPlay: () => {
          if (done) restart();
          setPlaying((p) => !p);
        },
        onStep: done ? undefined : () => advance(),
        onReset: () => {
          setPlaying(false);
          restart();
        },
      }}
      controls={
        <>
          <Segmented label="Surface" value={fnId} options={FN2_IDS.map((id) => ({ value: id, label: FN2[id].label }))} onChange={chooseSurface} />
          <Segmented
            label="Optimizer"
            value={opt}
            options={[
              { value: "gd", label: "Gradient descent" },
              { value: "momentum", label: "Momentum" },
            ]}
            onChange={setOpt}
          />
          <Slider label="Learning rate η" value={lr} min={0.0005} max={1.2} log onChange={setLr} format={fmtSig} color="amber" />
          {opt === "momentum" && (
            <Slider label="Momentum β" value={beta} min={0} max={0.99} step={0.01} onChange={setBeta} format={(v) => v.toFixed(2)} color="ink" />
          )}
        </>
      }
      more={<Segmented label="Speed" value={speed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} onChange={setSpeed} />}
      stats={[
        { label: "position", value: `${fmt(cur.p[0], 2)}, ${fmt(cur.p[1], 2)}`, color: "amber" },
        { label: "loss", value: fmt(loss), color: "cyan" },
        { label: "|∇f|", value: fmt(Math.hypot(g[0], g[1])), color: "magenta" },
      ]}
      insight={insight2D(fn, lr, b, cur, MAX_STEPS)}
      tries={[
        { label: "Narrow valley", apply: preset("valley", "gd") },
        { label: "…with momentum", apply: preset("valley", "momentum") },
        { label: "Two minima", apply: preset("wells", "gd") },
        { label: "Escape with momentum", apply: preset("wells", "momentum") },
        { label: "Rosenbrock", apply: preset("rosenbrock", "gd", "25") },
        { label: "Rosenbrock + momentum", apply: preset("rosenbrock", "momentum", "5") },
      ]}
      explain={explain}
    />
  );
}
