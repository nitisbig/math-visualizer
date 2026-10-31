import { useEffect, useMemo, useRef, useState } from "react";
import { arrow, dot, glow, pointerPos, scale, useCanvas, useRaf, type Size } from "../../lib/canvas";
import { contours } from "../../lib/contours";
import { fmt, fmtSig } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import PlayControls from "../../components/ui/PlayControls";
import Readout from "../../components/ui/Readout";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import { FN2, FN2_IDS, type Fn2, type Fn2Id } from "./functions";
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

/** Heatmap + contour lines, rendered once per (surface, size) into an offscreen canvas. */
function renderSurface(fn: Fn2, size: Size): HTMLCanvasElement {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { sx, sy } = view(fn, size);
  const cell = 4;
  const nx = Math.ceil(size.w / cell);
  const ny = Math.ceil(size.h / cell);
  const W = nx + 1;
  const grid = new Float32Array(W * (ny + 1));
  const fmin = Math.min(...fn.minima.map(([x, y]) => fn.f(x, y)));
  const shade = (v: number) => (fn.logShade ? Math.log1p(v - fmin) : Math.sqrt(Math.max(0, v - fmin)));
  let gmax = 0;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const g = shade(fn.f(sx.invert(i * cell), sy.invert(j * cell)));
      grid[j * W + i] = g;
      if (g > gmax) gmax = g;
    }
  }

  const out = document.createElement("canvas");
  out.width = Math.round(size.w * dpr);
  out.height = Math.round(size.h * dpr);
  const ctx = out.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Low-res heat layer: higher loss = brighter cyan haze, the floor stays black.
  const heat = document.createElement("canvas");
  heat.width = W;
  heat.height = ny + 1;
  const img = heat.getContext("2d")!.createImageData(W, ny + 1);
  for (let p = 0; p < grid.length; p++) {
    const t = Math.min(1, grid[p] / gmax);
    img.data[p * 4] = 34;
    img.data[p * 4 + 1] = 211;
    img.data[p * 4 + 2] = 238;
    img.data[p * 4 + 3] = Math.round(70 * Math.pow(t, 1.4));
  }
  heat.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(heat, 0, 0, W * cell, (ny + 1) * cell);

  // Contours, denser near the floor.
  const N = 16;
  const levels = Array.from({ length: N }, (_, i) => gmax * Math.pow((i + 0.5) / N, 1.3));
  const segs = contours(grid, nx, ny, cell, levels);
  ctx.lineWidth = 1;
  segs.forEach((s, li) => {
    ctx.strokeStyle = alpha(C.cyan, 0.55 - (li / N) * 0.35);
    ctx.beginPath();
    for (let k = 0; k < s.length; k += 4) {
      ctx.moveTo(s[k], s[k + 1]);
      ctx.lineTo(s[k + 2], s[k + 3]);
    }
    ctx.stroke();
  });
  return out;
}

export default function Descent2D() {
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
  const surface = useRef<{ key: string; img: HTMLCanvasElement } | null>(null);

  const cfg = useMemo(() => ({ lr, beta: opt === "momentum" ? beta : 0, limit: 10 }), [lr, opt, beta]);
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

  useRaf((dt) => {
    clock.current += dt * STEPS_PER_SEC * Number(speed);
    const n = Math.floor(clock.current);
    if (n > 0) {
      clock.current -= n;
      advance(n);
    }
  }, playing);

  const { ref } = useCanvas(
    (ctx, size) => {
      const key = `${fnId}:${size.w}x${size.h}`;
      if (surface.current?.key !== key) surface.current = { key, img: renderSurface(fn, size) };
      ctx.drawImage(surface.current.img, 0, 0, size.w, size.h);

      const { sx, sy } = view(fn, size);
      const diverged = cur.status === "diverged";

      ctx.fillStyle = C.lime;
      for (const [mx, my] of fn.minima) glow(ctx, C.lime, 10, () => dot(ctx, sx(mx), sy(my), 4));

      // Trail
      const col = diverged ? C.alert : C.amber;
      ctx.strokeStyle = alpha(col, 0.85);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      states.forEach((s, i) => (i === 0 ? ctx.moveTo(sx(s.p[0]), sy(s.p[1])) : ctx.lineTo(sx(s.p[0]), sy(s.p[1]))));
      ctx.stroke();
      if (states.length < 150) {
        ctx.fillStyle = alpha(col, 0.7);
        for (const s of states) dot(ctx, sx(s.p[0]), sy(s.p[1]), 2);
      }

      // Start marker
      const s0 = states[0].p;
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(s0[0]), sy(s0[1]), 6, 0, Math.PI * 2);
      ctx.stroke();

      // Current point + downhill arrow (−∇f), length squashed so steep spots stay readable.
      const [px, py] = [sx(cur.p[0]), sy(cur.p[1])];
      if (Math.abs(px) < 1e4 && Math.abs(py) < 1e4) {
        const g = grad(cur.p);
        const gn = Math.hypot(g[0], g[1]);
        if (gn > 1e-6 && cur.status === "running") {
          const L = 14 + 36 * Math.tanh(gn);
          ctx.strokeStyle = ctx.fillStyle = C.magenta;
          ctx.lineWidth = 2;
          // Screen y is flipped, so −∂f/∂y points up on screen when positive.
          glow(ctx, C.magenta, 8, () => arrow(ctx, px, py, px - (g[0] / gn) * L, py + (g[1] / gn) * L, 8));
        }
        ctx.fillStyle = col;
        glow(ctx, col, 16, () => dot(ctx, px, py, 6));
        ctx.fillStyle = C.bg;
        dot(ctx, px, py, 2);
      }

      ctx.font = `11px ${FONT_MONO}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${fn.label} · loss contours`, 12, 10);
    },
    [states, fn],
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

  const g = grad(cur.p);
  const loss = fn.f(cur.p[0], cur.p[1]);
  const status =
    cur.status === "diverged"
      ? { text: "Diverged — η is too large for this surface", color: C.alert }
      : cur.status === "converged"
        ? { text: `Converged in ${cur.iter} steps`, color: C.lime }
        : cur.iter >= MAX_STEPS
          ? { text: `Still going after ${MAX_STEPS} steps — try momentum`, color: C.muted }
          : { text: cur.iter === 0 ? "Click the map to drop a ball" : "Descending…", color: C.muted };

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">Descend a loss landscape</span>
        <Legend
          items={[
            { color: "cyan", label: "loss surface" },
            { color: "amber", label: "path" },
            { color: "magenta", label: "−∇f (downhill)" },
            { color: "lime", label: "minimum" },
          ]}
        />
      </div>
      <canvas
        ref={ref}
        className="stage ar-map"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        role="img"
        aria-label={`Contour map of the ${fn.label} surface. Ball at (${fmt(cur.p[0], 2)}, ${fmt(cur.p[1], 2)}), loss ${fmt(loss)}.`}
      />
      <div className="viz-body">
        <div className="controls">
          <Segmented
            label="Surface"
            value={fnId}
            options={FN2_IDS.map((id) => ({ value: id, label: FN2[id].label }))}
            onChange={chooseSurface}
          />
          <Segmented
            label="Optimizer"
            value={opt}
            options={[
              { value: "gd", label: "Gradient descent" },
              { value: "momentum", label: "Momentum" },
            ]}
            onChange={setOpt}
          />
        </div>
        <div className="controls">
          <Slider label="Learning rate η" value={lr} min={0.0005} max={1.2} log onChange={setLr} format={fmtSig} color="amber" />
          {opt === "momentum" && (
            <Slider label="Momentum β" value={beta} min={0} max={0.99} step={0.01} onChange={setBeta} format={(v) => v.toFixed(2)} color="blue" />
          )}
          <Segmented label="Speed" value={speed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} onChange={setSpeed} />
        </div>
        <PlayControls
          playing={playing}
          onPlay={() => {
            if (done) restart();
            setPlaying((p) => !p);
          }}
          onStep={done ? undefined : () => advance()}
          onReset={() => {
            setPlaying(false);
            restart();
          }}
        />
        <Readout
          items={[
            { label: "step", value: String(cur.iter) },
            { label: "x", value: fmt(cur.p[0]), color: "amber" },
            { label: "y", value: fmt(cur.p[1]), color: "amber" },
            { label: "loss", value: fmt(loss), color: "cyan" },
            { label: "|∇f|", value: fmt(Math.hypot(g[0], g[1])), color: "magenta" },
          ]}
        />
        <p className="status" style={{ color: status.color }} aria-live="polite">
          {status.text}
        </p>
      </div>
    </div>
  );
}
