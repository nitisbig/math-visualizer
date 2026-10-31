import { useState } from "react";
import { dotGrid, prefersReducedMotion, useCanvas, useRaf } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { bool, oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Legend from "../../components/ui/Legend";
import PlayControls from "../../components/ui/PlayControls";
import Readout from "../../components/ui/Readout";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Toggle from "../../components/ui/Toggle";
import {
  AXES,
  PLANES,
  TESSERACT,
  apply,
  axisIndex,
  camera,
  centered,
  det,
  dist,
  mul,
  orthographic,
  perspective,
  rotation,
  type Mat4,
  type Plane,
  type Vec4,
} from "./math";
import { AXIS_COLORS, AXIS_TOKENS, colorText, drawWire, glowDot, useOrbit } from "./view";

const TAU = Math.PI * 2;
const SPEED = 0.6; // radians per second
const TRAIL_SAMPLES = 30;
const TRAIL_STEP = 0.04;
const START_ANGLE = 0.5;

const MODES = [...PLANES, "double"] as const;
type Mode = (typeof MODES)[number];
const PROJ = ["persp", "ortho"] as const;
type Proj = (typeof PROJ)[number];

const VERTS = TESSERACT.verts.map(centered);
const EDGES = TESSERACT.edges;

const matrixFor = (mode: Mode, theta: number): Mat4 =>
  mode === "double" ? mul(rotation("xy", theta), rotation("zw", theta)) : rotation(mode, theta);

/** The axes a mode mixes; the rest stay put. */
const mixed = (mode: Mode) => (mode === "double" ? [0, 1, 2, 3] : [axisIndex(mode[0]), axisIndex(mode[1])]);

const planeRuns = (p: Plane): [string, string][] => [
  [p[0], AXIS_COLORS[axisIndex(p[0])]],
  [p[1], AXIS_COLORS[axisIndex(p[1])]],
];

function fixedSet(mode: Mode, theta: number) {
  if (Math.abs(Math.sin(theta / 2)) < 1e-9) return "everything (θ = 0)";
  if (mode === "double") return "only the centre";
  const rest = AXES.filter((a) => !mode.includes(a)).join("");
  return `the whole ${rest} plane`;
}

export default function Rotate4D() {
  const [mode, setMode] = useUrlState<Mode>("plane", "zw", oneOf(MODES));
  const [proj, setProj] = useUrlState<Proj>("proj", "persp", oneOf(PROJ));
  const [d, setD] = useUrlNumber("d", 2.2, 1.5, 6);
  const [trail, setTrail] = useUrlState("trail", false, bool);
  const [theta, setTheta] = useState(START_ANGLE);
  const [playing, setPlaying] = useState(false);
  const { orbit, dragging, handlers } = useOrbit({ yaw: -0.6, pitch: 0.42 });

  useRaf((dt) => setTheta((t) => (t + dt * SPEED) % TAU), playing);

  const M = matrixFor(mode, theta);
  const shadow = (v: Vec4) => (proj === "persp" ? perspective(v, d) : orthographic(v));
  const moved = VERTS.map((v) => apply(M, v));
  const true4 = EDGES.map((e) => dist(moved[e.a], moved[e.b]));
  const shadow3 = moved.map(shadow);
  const lens3 = EDGES.map((e) => dist(shadow3[e.a], shadow3[e.b]));

  const { ref } = useCanvas(
    (ctx, size) => {
      const { w, h } = size;
      const unit = Math.min(w, h) * 0.3;
      const cam = camera(orbit, w / 2, h * 0.47, unit);
      const pts = shadow3.map(cam);

      dotGrid(ctx, size);

      // Trails: where each corner was a moment ago (exact, from the same matrix at earlier angles).
      if (trail) {
        const past = Array.from({ length: TRAIL_SAMPLES }, (_, s) => {
          const Mk = matrixFor(mode, theta - (s + 1) * TRAIL_STEP);
          return VERTS.map((v) => cam(shadow(apply(Mk, v))));
        });
        ctx.lineWidth = 1.5;
        VERTS.forEach((_, i) => {
          let prev = pts[i];
          past.forEach((frame, s) => {
            ctx.strokeStyle = alpha(C.ink, 0.35 * (1 - s / TRAIL_SAMPLES));
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(frame[i].x, frame[i].y);
            ctx.stroke();
            prev = frame[i];
          });
        });
      }

      drawWire(ctx, pts, EDGES, { width: 2, glowBlur: 8 });
      for (const p of pts) glowDot(ctx, p.x, p.y, 2.5, C.ink, 4);

      ctx.font = `13px ${FONT_MONO}`;
      ctx.textBaseline = "top";
      const x = colorText(ctx, [["rotating in ", C.muted]], 16, 14);
      if (mode === "double") colorText(ctx, [...planeRuns("xy"), [" + ", C.muted], ...planeRuns("zw")], x, 14);
      else colorText(ctx, planeRuns(mode), x, 14);
      colorText(ctx, [[proj === "persp" ? `perspective, d = ${fmt(d, 1)}` : "straight shadow: drop w", C.muted]], 16, 34);

      // Edge lengths: the shadow's edges stretch (bars), the real 4D edges stay at 1 (line).
      // Phones get only the readout; the strip would cover the shape.
      if (w < 520) return;
      const bw = Math.min(5, (w * 0.4) / EDGES.length);
      const bh = Math.min(44, h * 0.14);
      const x0 = 16;
      const y0 = h - 30;
      const max = 1.8;
      lens3.forEach((len, i) => {
        ctx.fillStyle = alpha(AXIS_COLORS[EDGES[i].axis], 0.45);
        const hh = (Math.min(len, max) / max) * bh;
        ctx.fillRect(x0 + i * (bw + 1.5), y0 - hh, bw, hh);
      });
      const span = EDGES.length * (bw + 1.5);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 - 4, y0 - bh / max);
      ctx.lineTo(x0 + span + 2, y0 - bh / max);
      ctx.stroke();
      ctx.font = `11px ${FONT_MONO}`;
      ctx.textBaseline = "middle";
      colorText(ctx, [["true length 1", C.ink]], x0 + span + 8, y0 - bh / max);
      ctx.textBaseline = "top";
      colorText(ctx, [["32 edges: shadow length", C.muted]], x0, y0 + 6);
    },
    [mode, proj, d, trail, theta, orbit],
  );

  const on = new Set(mixed(mode));
  const [lo3, hi3] = [Math.min(...lens3), Math.max(...lens3)];
  const [lo4, hi4] = [Math.min(...true4), Math.max(...true4)];

  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-title">Rotate it in four dimensions</span>
        <Legend
          items={[
            ...AXES.map((a, i) => ({ color: AXIS_TOKENS[i], label: `${a} edges` })),
            ...(trail ? [{ color: "ink" as const, label: "corner trails" }] : []),
          ]}
        />
      </div>
      <canvas
        ref={ref}
        className={`stage ar-wide ${dragging ? "grabbing" : "grab"}`}
        {...handlers}
        role="img"
        aria-label={`The shadow of a tesseract rotating in the ${mode === "double" ? "xy and zw planes at once" : `${mode} plane`}, angle ${Math.round((theta * 180) / Math.PI)} degrees.`}
      />
      <div className="viz-body">
        <p className="hint">Pick a plane and press play. Dragging the picture is an ordinary 3D turn of the shadow.</p>
        <div className="controls">
          <Segmented
            label="Rotation plane"
            value={mode}
            options={MODES.map((m) => ({ value: m, label: m === "double" ? "xy + zw" : m }))}
            onChange={setMode}
          />
          <PlayControls
            playing={playing}
            onPlay={() => (prefersReducedMotion() ? setTheta((t) => (t + Math.PI / 4) % TAU) : setPlaying(!playing))}
            onReset={() => {
              setPlaying(false);
              setTheta(START_ANGLE);
            }}
            playLabel={prefersReducedMotion() ? "Turn 45°" : "Play"}
          />
        </div>
        <div className="controls">
          <Slider
            label="Angle θ"
            value={theta}
            min={0}
            max={TAU}
            step={0.001}
            onChange={(v) => {
              setPlaying(false);
              setTheta(v);
            }}
            format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
          />
          <Segmented
            label="Shadow"
            value={proj}
            options={[
              { value: "persp", label: "Perspective" },
              { value: "ortho", label: "Straight" },
            ]}
            onChange={setProj}
          />
          {proj === "persp" && (
            <Slider label="Camera distance d" value={d} min={1.5} max={6} step={0.01} onChange={setD} format={(v) => fmt(v, 2)} color="blue" />
          )}
          <Toggle label="Corner trails" checked={trail} onChange={setTrail} />
        </div>
        <div className="mat-wrap">
          <table className="mat mono" aria-label="Rotation matrix acting on (x, y, z, w)">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">row</span></th>
                {AXES.map((a, i) => (
                  <th key={a} scope="col" className={`c-${AXIS_TOKENS[i]}`}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {M.map((row, i) => (
                <tr key={i}>
                  <th scope="row" className={`c-${AXIS_TOKENS[i]}`}>{AXES[i]}′</th>
                  {row.map((v, j) => (
                    <td key={j} className={on.has(i) && on.has(j) ? "on" : v === 0 ? "zero" : undefined}>
                      {fmt(v, 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mat-note">
            The matrix R. Only the highlighted rows and columns mix; every other axis passes through unchanged.
          </p>
        </div>
        <Readout
          items={[
            { label: "4D edge lengths", value: hi4 - lo4 < 1e-9 ? `${fmt(lo4, 3)} (all 32)` : `${fmt(lo4, 3)}–${fmt(hi4, 3)}` },
            { label: "shadow edge lengths", value: `${fmt(lo3, 2)}–${fmt(hi3, 2)}` },
            { label: "det R", value: fmt(det(M), 3) },
            { label: "stays fixed", value: fixedSet(mode, theta) },
          ]}
        />
      </div>
    </div>
  );
}
