import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export type DropTarget = { key: string; side: "before" | "after" };

/**
 * Drag selected tags into a new order, with a mouse, a pen or a finger.
 *
 * - Mouse / pen: press and move 5px to start.
 * - Touch: press and hold ~0.3s. Moving sooner is a normal page scroll, so a
 *   drag never steals a swipe.
 *
 * While dragging, the chip follows the pointer and a bar shows where it will
 * land; the list only changes on release. Reordering the DOM mid-drag made
 * phones drop the touch (lost pointer capture, then pointercancel).
 */
export function useChipDrag({
  listRef,
  items,
  keyOf,
  onReorder,
}: {
  /** The element holding the chips. Always mounted, so the touch listener is ready. */
  listRef: RefObject<HTMLElement | null>;
  items: readonly string[];
  /** The value each chip carries in its data-chip attribute. */
  keyOf: (item: string) => string;
  /** Called once on release, only when the position changed. */
  onReorder: (item: string, from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const latest = useRef({ items, keyOf, onReorder });
  useEffect(() => { latest.current = { items, keyOf, onReorder }; });
  const active = useRef(false);

  // Stop the page scrolling, but only during a touch drag. The listener must
  // exist before the touch starts and must not be passive.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const block = (event: TouchEvent) => { if (active.current) event.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [listRef]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>, item: string) => {
    if (event.button !== 0 || active.current) return;
    if ((event.target as HTMLElement).closest("button")) return; // the remove (x) button
    const chip = event.currentTarget;
    const { pointerId, pointerType, clientX: x0, clientY: y0 } = event;
    const key = latest.current.keyOf(item);
    let timer: number | undefined;
    let drop: DropTarget | null = null;

    const activate = () => {
      active.current = true;
      setDragging(item);
      navigator.vibrate?.(8);
    };
    if (pointerType === "touch") timer = window.setTimeout(activate, 300);

    /** Which chip, and which half of it, is under the pointer. */
    const hitTest = (x: number, y: number): DropTarget | null => {
      const chips = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-chip]") ?? [])]
        .filter((el) => el.dataset.chip !== key)
        .map((el) => ({ key: el.dataset.chip!, rect: el.getBoundingClientRect() }));
      for (const c of chips) {
        const r = c.rect;
        if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) {
          return { key: c.key, side: x < r.left + r.width / 2 ? "before" : "after" };
        }
      }
      // Past the end of the last row (over the input): move to the end.
      const last = chips.at(-1);
      if (last && x > last.rect.right && y >= last.rect.top - 4 && y <= last.rect.bottom + 4) {
        return { key: last.key, side: "after" };
      }
      return drop; // in a gap: keep the last target, so the bar does not flicker
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!active.current) {
        const dist = Math.hypot(e.clientX - x0, e.clientY - y0);
        if (pointerType === "touch") { if (dist > 8) finish(false); return; }
        if (dist < 5) return;
        activate();
      }
      e.preventDefault();
      // Set directly on the element: smooth, no re-render per frame. CSP allows
      // style changes made through the DOM.
      // On touch, lift the chip above the finger so it stays visible.
      chip.style.translate = `${e.clientX - x0}px ${e.clientY - y0 - (pointerType === "touch" ? 28 : 0)}px`;
      const next = hitTest(e.clientX, e.clientY);
      if (next?.key !== drop?.key || next?.side !== drop?.side) {
        drop = next;
        setTarget(next);
      }
    };

    const finish = (commit: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      chip.style.translate = "";
      if (!active.current) return;
      active.current = false;
      setDragging(null);
      setTarget(null);
      if (!commit || !drop) return;
      const { items: list, keyOf: k, onReorder: reorder } = latest.current;
      const from = list.indexOf(item);
      const rest = list.filter((t) => t !== item);
      const overIndex = rest.findIndex((t) => k(t) === drop!.key);
      if (from < 0 || overIndex < 0) return;
      const to = overIndex + (drop.side === "after" ? 1 : 0);
      if (to !== from) reorder(item, from, to);
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) finish(true); };
    const cancel = (e: PointerEvent) => { if (e.pointerId === pointerId) finish(false); };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return { dragging, target, startDrag };
}
