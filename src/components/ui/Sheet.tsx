import { useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  label: string;
  children: ReactNode;
};

/**
 * The workspace panel. On phones it is a bottom sheet: drag or tap the handle
 * to move between peek and open. On larger screens CSS turns it into a plain
 * side or bottom panel and the handle is hidden.
 */
export default function Sheet({ open, onOpenChange, className = "", label, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const moved = useRef(false);

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current?.classList.add("dragging");
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dy = e.clientY - d.y0;
    if (Math.abs(d.dy) > 6) moved.current = true;
    ref.current?.style.setProperty("--dy", `${d.dy}px`);
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    ref.current?.classList.remove("dragging");
    ref.current?.style.removeProperty("--dy");
    if (!moved.current) return; // a tap: the click handler toggles
    const v = d.dy / Math.max(1, performance.now() - d.t0); // px per ms
    if (v < -0.3 || d.dy < -48) onOpenChange(true);
    else if (v > 0.3 || d.dy > 48) onOpenChange(false);
  };

  return (
    <aside ref={ref} className={`ws-panel ${open ? "open" : ""} ${className}`} aria-label={label}>
      <button
        type="button"
        className="sheet-handle"
        aria-label={open ? "Collapse controls" : "Expand controls"}
        aria-expanded={open}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => {
          if (!moved.current) onOpenChange(!open);
          moved.current = false;
        }}
      >
        <span aria-hidden="true" />
      </button>
      {children}
    </aside>
  );
}
