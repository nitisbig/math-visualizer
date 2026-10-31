import { useState } from "react";
import { dotGrid, prefersReducedMotion, useCanvas, useRaf } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { bool, useUrlNumber, useUrlState } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import Readout from "../../components/ui/Readout";
import Slider from "../../components/ui/Slider";
import Toggle from "../../components/ui/Toggle";
import { AXES, NAMES, buildStage, camera, faces, hypercube, perspective } from "./math";
import { AXIS_COLORS, AXIS_TOKENS, colorText, drawWire, glowDot, useOrbit } from "./view";

const DRAG_SECONDS = 1;
const W_CAMERA = 2.2; // camera distance along w
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);

// Counts for the finished n-cubes, computed from the geometry.
const COUNTS = [0, 1, 2, 3, 4].map((n) => ({
  V: hypercube(n).verts.length,
  E: hypercube(n).edges.length,
  F: faces(n, 2).length,
  C: faces(n, 3).length,
}));

type Tween = { from: number; to: number; t: number };

/** Top view while flat, easing to three-quarters as the third axis arrives. */
function baseOrbit(u: number) {
  const s = smooth(Math.min(1, Math.max(0, u - 2)));
  return { yaw: -0.6 * s, pitch: (Math.PI / 2) * (1 - s) + 0.42 * s };
}

export default function Build() {
  const [u, setU] = useUrlNumber("dim", 3, 0, 4);
  const [bits, setBits] = useUrlState("bits", false, bool);
  const [tween, setTween] = useState<Tween | null>(null);
  const { orbit: offset, dragging, handlers } = useOrbit({ yaw: 0, pitch: 0 }, Math.PI);

  const stage = buildStage(u);
  const { k, f } = stage;

  useRaf((dt) => {
    if (!tween) return;
    const span = tween.to - tween.from;
    const t = Math.min(1, tween.t + dt / (DRAG_SECONDS * span));
    // One eased drag per unit, so a full replay reads as four separate moves.
    const raw = tween.from + span * t;
    const next = span > 1 && raw < tween.to ? Math.floor(raw) + ease(raw % 1) : tween.from + span * ease(t);
    setU(next);
    setTween(t >= 1 ? null : { ...tween, t });
  }, tween !== null);

  const animate = (from: number, to: number) => {
    if (prefersReducedMotion() || to <= from) return setU(to);
    setTween({ from, to, t: 0 });
  };
  const nextDim = Math.min(4, Math.floor(u + 1e-9) + 1);

  const { ref } = useCanvas(
    (ctx, size) => {
      const { w, h } = size;
      const base = baseOrbit(u);
      const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, base.pitch + offset.pitch));
      const cam = camera({ yaw: base.yaw + offset.yaw, pitch }, w / 2, h * 0.52, Math.min(w, h) * 0.34);
      const pts = stage.verts.map((v) => cam(perspective(v, W_CAMERA)));

      dotGrid(ctx, size);

      // The area each old edge sweeps out flashes in the new axis color, then fades.
      if (f > 0) {
        ctx.fillStyle = alpha(AXIS_COLORS[k], 0.16 * Math.sin(Math.PI * f));
        for (const q of stage.sweeps) {
          ctx.beginPath();
          q.forEach((i, n) => (n ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)));
          ctx.closePath();
          ctx.fill();
        }
      }

      const moving = (i: number) => {
        const e = stage.edges[i];
        return f > 0 && (stage.copy[e.a] || stage.copy[e.b]) ? 1.4 : 1;
      };
      drawWire(ctx, pts, stage.edges, { width: 2, glowBlur: 10, emphasis: moving });

      pts.forEach((p, i) => {
        const lead = f > 0 && stage.copy[i];
        glowDot(ctx, p.x, p.y, k === 0 && f === 0 ? 5 : lead ? 3.5 : 2.5, lead ? AXIS_COLORS[k] : C.ink, lead || k === 0 ? 12 : 4);
      });

      // Corner coordinates: each digit in its axis color.
      if (bits && f === 0 && k > 0) {
        ctx.font = `11px ${FONT_MONO}`;
        ctx.textBaseline = "bottom";
        stage.verts.forEach((v, i) => {
          const runs = v.slice(0, k).map((c, a) => [String(c + 0.5), AXIS_COLORS[a]] as [string, string]);
          colorText(ctx, runs, pts[i].x + 6, pts[i].y - 5);
        });
      }

      ctx.font = `13px ${FONT_MONO}`;
      ctx.textBaseline = "top";
      if (f > 0) {
        colorText(ctx, [[`${NAMES[k]} → ${NAMES[k + 1]}`, C.ink]], 16, 14);
        colorText(ctx, [["dragging along ", C.muted], [AXES[k], AXIS_COLORS[k]]], 16, 34);
      } else {
        colorText(ctx, [[NAMES[k], C.ink]], 16, 14);
        if (k === 4) colorText(ctx, [["a hypercube", C.muted]], 16, 34);
      }
    },
    [u, bits, offset],
  );

  const n = k; // the finished shape
  const c = COUNTS[n];
  const prev = n > 0 ? COUNTS[n - 1] : null;

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">Build a tesseract, one drag at a time</span>
        <Legend items={AXES.map((a, i) => ({ color: AXIS_TOKENS[i], label: `${a} edges` }))} />
      </div>
      <canvas
        ref={ref}
        className={`stage ar-wide ${dragging ? "grabbing" : "grab"}`}
        {...handlers}
        role="img"
        aria-label={`A ${NAMES[k]}${f > 0 ? ` being dragged along ${AXES[k]} into a ${NAMES[k + 1]}` : ""}, shown in perspective.`}
      />
      <div className="viz-body">
        <p className="hint">Drag the shape along the next axis. Drag the picture to turn it.</p>
        <div className="controls">
          <Slider
            label="Dimensions built"
            value={u}
            min={0}
            max={4}
            step={0.001}
            onChange={(v) => {
              setTween(null);
              setU(v);
            }}
            format={(v) => fmt(v, 2)}
            color={AXIS_TOKENS[Math.min(3, k)]}
          />
          <div className="ctl buttons">
            <button
              type="button"
              className="btn primary"
              disabled={u >= 4 || tween !== null}
              onClick={() => animate(u, nextDim)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
              {u >= 4 ? "Done: 4D" : `Drag along ${AXES[nextDim - 1]}`}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setU(0);
                animate(0, 4);
              }}
            >
              Replay from a point
            </button>
          </div>
        </div>
        <div className="controls">
          <Toggle label="Corner coordinates" checked={bits} onChange={setBits} />
        </div>
        <Readout
          items={[
            { label: "corners 2ⁿ", value: String(c.V) },
            { label: "edges", value: String(c.E) },
            { label: "edge rule 2E + V", value: prev ? `2 × ${prev.E} + ${prev.V} = ${c.E}` : "—" },
            { label: "squares", value: String(c.F) },
            { label: "cubes", value: String(c.C) },
            { label: "long diagonal √n", value: n > 0 ? `√${n} = ${fmt(Math.sqrt(n), 3)}` : "—" },
          ]}
        />
      </div>
    </div>
  );
}
