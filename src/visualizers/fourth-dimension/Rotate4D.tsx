import { useState, type ReactNode } from "react";
import { dotGrid, prefersReducedMotion, useCanvas, useRaf } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { bool, oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Toggle from "../../components/ui/Toggle";
import Workspace from "../../components/ui/Workspace";
import { rotateInsight } from "./insights";
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
  type Vec4,
} from "./math";
import { AXIS_COLORS, AXIS_TOKENS, colorText, depthDots, drawWire, useOrbit } from "./view";

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

function fixedSet(mode: Mode, theta: number) {
  if (Math.abs(Math.sin(theta / 2)) < 1e-9) return "everything (θ = 0)";
  if (mode === "double") return "only the centre";
  const rest = AXES.filter((a) => !mode.includes(a)).join("");
  return `the whole ${rest} plane`;
}

export default function Rotate4D({ explain }: { explain?: ReactNode }) {
  const [mode, setMode] = useUrlState<Mode>("plane", "zw", oneOf(MODES));
  const [proj, setProj] = useUrlState<Proj>("proj", "persp", oneOf(PROJ));
  const [d, setD] = useUrlNumber("d", 2.2, 1.5, 6);
  const [trail, setTrail] = useUrlState("trail", false, bool);
  const [theta, setTheta] = useState(START_ANGLE);
  const [playing, setPlaying] = useState(false);
  const { orbit, dragging, handlers } = useOrbit({ yaw: -0.6, pitch: 0.42 });


  const M = matrixFor(mode, theta);
  const shadow = (v: Vec4) => (proj === "persp" ? perspective(v, d) : orthographic(v));
  const moved = VERTS.map((v) => apply(M, v));
  const true4 = EDGES.map((e) => dist(moved[e.a], moved[e.b]));
  const shadow3 = moved.map(shadow);
  const lens3 = EDGES.map((e) => dist(shadow3[e.a], shadow3[e.b]));

  const { ref, visible } = useCanvas(
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

      drawWire(ctx, pts, EDGES, { width: 2.2, glowBlur: 8 });
      depthDots(ctx, pts, 3, C.ink);

      // Edge lengths: the shadow's edges stretch (bars), the real 4D edges stay at 1 (line).
      // Bottom-right, clear of the transport. Phones get only the readout.
      if (w < 520) return;
      const bw = Math.min(5, (w * 0.32) / EDGES.length);
      const bh = Math.min(44, h * 0.12);
      const x0 = w - EDGES.length * (bw + 1.5) - 110;
      const y0 = h - 34;
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
      ctx.font = `12px ${FONT_MONO}`;
      ctx.textBaseline = "middle";
      colorText(ctx, [["true length 1", C.ink]], x0 + span + 8, y0 - bh / max);
      ctx.textBaseline = "top";
      colorText(ctx, [["32 edges: shadow length", C.muted]], x0, y0 + 6);
    },
    [mode, proj, d, trail, theta, orbit],
  );

  useRaf((dt) => setTheta((t) => (t + dt * SPEED) % TAU), playing, visible);

  const on = new Set(mixed(mode));
  const [lo3, hi3] = [Math.min(...lens3), Math.max(...lens3)];
  const [lo4, hi4] = [Math.min(...true4), Math.max(...true4)];

  const turn = (m: Mode, extra?: () => void) => () => {
    setMode(m);
    extra?.();
    if (!prefersReducedMotion()) setPlaying(true);
  };
  const planeLabel = mode === "double" ? "xy + zw" : mode;

  return (
    <Workspace
      title="Rotate it in four dimensions"
      tab="Rotate"
      legend={[
        ...AXES.map((a, i) => ({ color: AXIS_TOKENS[i], label: `${a} edges` })),
        ...(trail ? [{ color: "ink" as const, label: "corner trails" }] : []),
      ]}
      stage={
        <canvas
          ref={ref}
          className={`stage ${dragging ? "grabbing" : "grab"}`}
          {...handlers}
          role="img"
          aria-label={`The shadow of a tesseract rotating in the ${mode === "double" ? "xy and zw planes at once" : `${mode} plane`}, angle ${Math.round((theta * 180) / Math.PI)} degrees.`}
        />
      }
      status={{ text: `Rotating in ${planeLabel} · ${Math.round((theta * 180) / Math.PI)}°`, color: C.ink }}
      accent="blue"
      coach="Drag the picture for a 3D turn"
      transport={{
        playing,
        playLabel: prefersReducedMotion() ? "Turn 45°" : "Play",
        onPlay: () => (prefersReducedMotion() ? setTheta((t) => (t + Math.PI / 4) % TAU) : setPlaying(!playing)),
        onReset: () => {
          setPlaying(false);
          setTheta(START_ANGLE);
        },
      }}
      controls={
        <>
          <Segmented
            label="Rotation plane"
            value={mode}
            options={MODES.map((m) => ({ value: m, label: m === "double" ? "xy + zw" : m }))}
            onChange={setMode}
          />
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
        </>
      }
      more={
        <>
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
        </>
      }
      stats={[
        { label: "4D edges", value: hi4 - lo4 < 1e-9 ? `all ${fmt(lo4, 3)}` : `${fmt(lo4, 3)}–${fmt(hi4, 3)}` },
        { label: "shadow edges", value: `${fmt(lo3, 2)}–${fmt(hi3, 2)}` },
        { label: "det R", value: fmt(det(M), 3) },
      ]}
      detail={
        <figure className="mat-wrap">
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
          <figcaption className="mat-note">Rotation matrix R. Only the highlighted entries mix; {fixedSet(mode, theta)} stays fixed.</figcaption>
        </figure>
      }
      insight={rotateInsight(mode, proj, lo3, hi3)}
      tries={[
        { label: "Turn inside out: zw", apply: turn("zw", () => setProj("persp")) },
        { label: "xy, straight shadow", apply: turn("xy", () => setProj("ortho")) },
        { label: "Double rotation + trails", apply: turn("double", () => setTrail(true)) },
        {
          label: "Camera close: d = 1.6",
          apply: turn(mode, () => {
            setProj("persp");
            setD(1.6);
          }),
        },
      ]}
      explain={explain}
    />
  );
}
