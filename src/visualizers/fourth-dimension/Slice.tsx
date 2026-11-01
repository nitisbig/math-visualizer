import { useMemo, useRef, useState, type ReactNode } from "react";
import { dotGrid, line, prefersReducedMotion, useCanvas, useRaf } from "../../lib/canvas";
import { fmt } from "../../lib/format";
import { C, FONT_MONO, alpha } from "../../lib/theme";
import { oneOf, useUrlNumber, useUrlState } from "../../lib/urlState";
import Segmented from "../../components/ui/Segmented";
import Slider from "../../components/ui/Slider";
import Workspace from "../../components/ui/Workspace";
import { sliceInsight } from "./insights";
import {
  AXES,
  LEADS,
  LEAD_IDS,
  TESSERACT,
  camera,
  centered,
  flatten,
  orderFace,
  perspective,
  section,
  shapeName,
  volume,
  type Lead,
} from "./math";
import { depthDots, drawFaces, drawWire, glowDot, useOrbit } from "./view";

const EPS = 0.005; // keep the cut strictly inside, so the slice is never empty
const W_CAMERA = 2.4;
const SWEEP_SECONDS = 6; // one pass through the whole tesseract
const DEFAULT_S = 0.7;

const LEAD_LABELS: Record<Lead, string> = { cube: "Cube", square: "Square", edge: "Edge", corner: "Corner" };

/** The cut's left-hand side, e.g. "x + y + z + w". */
const formula = (lead: Lead) =>
  AXES.filter((_, i) => LEADS[lead][i]).join(" + ");

export default function Slice({ explain }: { explain?: ReactNode }) {
  const [lead, setLead] = useUrlState<Lead>("lead", "corner", oneOf(LEAD_IDS));
  const [rawS, setS] = useUrlNumber("s", DEFAULT_S, 0, 4);
  const [playing, setPlaying] = useState(false);
  const dir = useRef(1);
  const { orbit, dragging, handlers } = useOrbit({ yaw: -0.55, pitch: 0.38 });

  const normal = LEADS[lead];
  const k = normal.reduce((a, b) => a + b, 0);
  const free = Math.min(k - EPS, Math.max(EPS, rawS));
  // By hand, snap to the exact middle, where the corner-first slice is a perfect octahedron.
  const s = !playing && Math.abs(free - k / 2) < 0.015 ? k / 2 : free;

  const slice = useMemo(() => {
    const sec = section(normal, s);
    const p3 = flatten(sec.points, normal);
    const faces = sec.faces.map((f) => orderFace(f, p3));
    return { sec, p3, faces, name: shapeName(sec, p3), vol: volume(p3, faces) };
  }, [lead, s]);

  const { ref, visible } = useCanvas(
    (ctx, size) => {
      const { w, h } = size;
      const side = w / h >= 1.2; // side by side when wide, stacked on phones
      const pw = side ? w / 2 : w;
      const ph = side ? h : h / 2;
      const left = { cx: pw / 2, cy: ph * 0.5 };
      const right = side ? { cx: pw * 1.5, cy: ph * 0.5 } : { cx: pw / 2, cy: ph * 1.5 };
      const unit = Math.min(pw, ph);
      const blue = C.blue;

      dotGrid(ctx, size);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      if (side) line(ctx, pw, 16, pw, h - 16);
      else line(ctx, 16, ph, w - 16, ph);

      // Left: the tesseract's shadow, with the slice drawn inside it at its true 4D position.
      const camL = camera(orbit, left.cx, left.cy, unit * 0.3);
      const tp = TESSERACT.verts.map((v) => camL(perspective(centered(v), W_CAMERA)));
      drawWire(ctx, tp, TESSERACT.edges, { width: 1.5, color: C.muted, far: 0.15 });
      const sp = slice.sec.points.map((v) => camL(perspective(centered(v), W_CAMERA)));
      drawFaces(ctx, sp, slice.faces, blue, 0.14);
      drawWire(ctx, sp, slice.sec.edges.map(([a, b]) => ({ a, b, axis: 3 })), { width: 2, color: blue, glowBlur: 8, far: 0.6 });
      tp.forEach((p, i) => {
        const passed = slice.sec.side[i] <= 0;
        glowDot(ctx, p.x, p.y, passed ? 3 : 2.2, passed ? C.ink : alpha(C.muted, 0.6), passed ? 6 : 0);
      });

      // Right: the slice on its own, as a 3D being would meet it. Fixed scale, so growth is real.
      const camR = camera(orbit, right.cx, right.cy, unit * 0.34);
      const rp = slice.p3.map(camR);
      drawFaces(ctx, rp, slice.faces, blue, 0.22);
      drawWire(ctx, rp, slice.sec.edges.map(([a, b]) => ({ a, b, axis: 3 })), { width: 2.5, color: blue, glowBlur: 12, far: 0.4 });
      depthDots(ctx, rp, 3, C.ink);

      // View captions, centred in each half so they stay clear of the overlays.
      ctx.font = `12px ${FONT_MONO}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = C.muted;
      ctx.fillText("the tesseract’s shadow", left.cx, side ? 52 : ph - 24);
      ctx.fillStyle = blue;
      ctx.fillText(`the slice we would see: ${slice.name.toLowerCase()}`, right.cx, side ? 52 : ph + 12);
    },
    [slice, orbit],
  );

  useRaf((dt) => {
    let next = free + dir.current * dt * (k / SWEEP_SECONDS);
    if (next >= k - EPS) [next, dir.current] = [k - EPS, -1];
    if (next <= EPS) [next, dir.current] = [EPS, 1];
    setS(next);
  }, playing, visible);


  const { sec, name, vol } = slice;

  const sweep = (l: Lead, at?: number) => () => {
    setLead(l);
    dir.current = 1;
    if (at !== undefined) {
      setPlaying(false);
      setS(at);
    } else {
      setS(EPS);
      if (!prefersReducedMotion()) setPlaying(true);
    }
  };

  return (
    <Workspace
      title="Slice it with our 3D space"
      tab="Slice"
      legend={[
        { color: "blue", label: "the slice" },
        { color: "ink", label: "corners passed" },
        { color: "muted", label: "tesseract edges" },
      ]}
      stage={
        <canvas
          ref={ref}
          className={`stage ${dragging ? "grabbing" : "grab"}`}
          {...handlers}
          role="img"
          aria-label={`Slicing the tesseract ${lead} first at ${formula(lead)} = ${fmt(s, 2)}. The slice is a ${name}.`}
        />
      }
      status={{ text: `${formula(lead)} = ${fmt(s, 2)}`, color: C.blue }}
      accent="blue"
      coach="Drag to turn both views"
      transport={{
        playing,
        playLabel: prefersReducedMotion() ? "Step" : "Sweep",
        onPlay: () => (prefersReducedMotion() ? setS(Math.min(k - EPS, s + k / 8)) : setPlaying(!playing)),
        onReset: () => {
          setPlaying(false);
          dir.current = 1;
          setS(DEFAULT_S);
        },
      }}
      controls={
        <>
          <Segmented label="Goes in first" value={lead} options={LEAD_IDS.map((l) => ({ value: l, label: LEAD_LABELS[l] }))} onChange={setLead} />
          <Slider
            label={`Cut at ${formula(lead)} =`}
            value={s}
            min={0}
            max={k}
            step={0.01}
            onChange={(v) => {
              setPlaying(false);
              setS(v);
            }}
            format={(v) => fmt(v, 2)}
            color="blue"
          />
        </>
      }
      stats={[
        { label: "corners", value: String(sec.points.length) },
        { label: "faces", value: String(sec.faces.length) },
        { label: "volume", value: fmt(vol, 3) },
      ]}
      insight={sliceInsight(lead, s, k, name)}
      tries={[
        { label: "Cube first", apply: sweep("cube") },
        { label: "Corner first", apply: sweep("corner") },
        { label: "The octahedron", apply: sweep("corner", 2) },
        { label: "Edge first", apply: sweep("edge") },
        { label: "Square first", apply: sweep("square") },
      ]}
      explain={explain}
    />
  );
}
