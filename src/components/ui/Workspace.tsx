import { useEffect, useRef, useState, type ReactNode } from "react";
import { cssVar, toCss, type Token } from "../../lib/theme";
import Legend, { type LegendItem } from "./Legend";
import PlayControls, { type PlayProps } from "./PlayControls";
import Readout, { type ReadoutItem } from "./Readout";
import Sheet from "./Sheet";

export type Try = { label: string; apply: () => void };

type Props = {
  title: string;
  /** Short name for the page nav and mobile tab bar; also the section id. */
  tab: string;
  legend: LegendItem[];
  /** The canvas. */
  stage: ReactNode;
  status?: { text: string; color?: Token | string };
  transport?: PlayProps;
  controls: ReactNode;
  /** Secondary controls, folded under "More". */
  more?: ReactNode;
  stats?: ReadoutItem[];
  /** Extra read-only content under the stats (e.g. a live matrix). */
  detail?: ReactNode;
  /** One live sentence about the current setup, shown first in Explain. */
  insight?: string;
  /** Presets offered in Explain. */
  tries?: Try[];
  /** One-time gesture hint over the canvas. */
  coach?: string;
  /** Color of the glow under the pointer while pressing the canvas. */
  accent?: Token;
  /** Authored explanation (Astro slot from the MDX page). */
  explain?: ReactNode;
};

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function useCoach(id: string, enabled: boolean) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    try {
      setShow(!localStorage.getItem(`coach:${id}`));
    } catch {
      setShow(true);
    }
  }, [id, enabled]);
  const dismiss = () => {
    if (!show) return;
    setShow(false);
    try {
      localStorage.setItem(`coach:${id}`, "1");
    } catch {}
  };
  return [show, dismiss] as const;
}

/** A glow that follows a press on the canvas, plus a ring that bursts out where it lands. */
function useTouchGlow() {
  const glowRef = useRef<HTMLSpanElement>(null);
  // Rings live in their own empty span so they never sit among Preact-managed children.
  const ringsRef = useRef<HTMLSpanElement>(null);
  const pressed = useRef<number | null>(null);

  const place = (e: React.PointerEvent<HTMLElement>) => {
    const g = glowRef.current;
    if (!g) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    g.style.translate = `${x}px ${y}px`;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    const at = place(e);
    if (!at) return;
    pressed.current = e.pointerId;
    glowRef.current!.classList.add("on");
    const ring = document.createElement("span");
    ring.className = "touch-ring";
    ring.style.translate = `${at.x}px ${at.y}px`;
    ring.addEventListener("animationend", () => ring.remove());
    ringsRef.current?.append(ring);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (pressed.current === e.pointerId) place(e);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (pressed.current !== e.pointerId) return;
    pressed.current = null;
    glowRef.current?.classList.remove("on");
  };

  return { glowRef, ringsRef, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

const EXPLAIN = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3v.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="8" cy="11.6" r=".9" fill="currentColor" />
  </svg>
);

export default function Workspace(p: Props) {
  const id = slug(p.tab);
  const [view, setView] = useState<"controls" | "explain">("controls");
  const [open, setOpen] = useState(false);
  const [coach, dismissCoach] = useCoach(id, !!p.coach);
  const statusColor = toCss(p.status?.color ?? "muted");
  const touch = useTouchGlow();

  const toggleExplain = () => {
    const next = view === "explain" ? "controls" : "explain";
    setView(next);
    if (next === "explain") setOpen(true);
  };

  return (
    <section className="ws" id={id} data-workspace data-tab={p.tab} data-title={p.title} aria-labelledby={`${id}-t`}>
      <div
        className="ws-stage"
        style={{ "--accent": cssVar(p.accent ?? "cyan") } as React.CSSProperties}
        onPointerDownCapture={dismissCoach}
        {...touch.handlers}
      >
        {p.stage}
        <span ref={touch.glowRef} className="touch-glow" aria-hidden="true" />
        <span ref={touch.ringsRef} aria-hidden="true" />
        {p.status && (
          <p className="ws-status" style={{ color: statusColor }} aria-live="polite">
            <span className="pulse" style={{ background: statusColor }} aria-hidden="true" />
            {p.status.text}
          </p>
        )}
        {p.transport && (
          <div className="ws-transport">
            <PlayControls {...p.transport} />
          </div>
        )}
        {p.coach && (
          <p className={`ws-coach ${coach ? "" : "gone"}`} aria-hidden={!coach}>
            <span className="finger" aria-hidden="true" />
            {p.coach}
          </p>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen} label={`${p.title} panel`} className={view === "explain" ? "explaining" : ""}>
        <header className="ws-head">
          <div className="ws-heading">
            <h2 id={`${id}-t`} className="ws-title">
              <span className="ws-num" aria-hidden="true" />
              {p.title}
            </h2>
            <Legend items={p.legend} />
          </div>
          <button
            type="button"
            className={`explain-btn ${view === "explain" ? "on" : ""}`}
            aria-pressed={view === "explain"}
            aria-controls={`${id}-x`}
            onClick={toggleExplain}
          >
            {view === "explain" ? (
              <>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Controls
              </>
            ) : (
              <>
                {EXPLAIN}
                Explain this
              </>
            )}
          </button>
        </header>

        <div className="ws-body" hidden={view !== "controls"}>
          <div className="controls">{p.controls}</div>
          {p.more && (
            <details className="more">
              <summary>More settings</summary>
              <div className="controls">{p.more}</div>
            </details>
          )}
          {p.stats && <Readout items={p.stats} />}
          {p.detail}
        </div>

        <div className="ws-explain" id={`${id}-x`} hidden={view !== "explain"}>
          {p.insight && (
            <p className="insight" aria-live="polite">
              <span className="eyebrow">Right now</span>
              {p.insight}
            </p>
          )}
          {p.tries && p.tries.length > 0 && (
            <div className="tries">
              <span className="eyebrow">Try</span>
              <div className="try-list">
                {p.tries.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className="try"
                    onClick={() => {
                      t.apply();
                      // On phones, drop the sheet so the canvas is in view.
                      if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {p.explain && <div className="explain-prose">{p.explain}</div>}
        </div>
      </Sheet>
    </section>
  );
}
