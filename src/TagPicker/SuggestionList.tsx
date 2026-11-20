import type { MutableRefObject } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import type { TagOption } from "../lib/tags";
import { Highlight, Kbd } from "./parts";

/** A row in the list shown while typing. */
export type Row =
  | { kind: "option"; option: TagOption; selected: boolean; fits: boolean; via: string | null }
  | { kind: "create"; label: string; fits: boolean; allowed: boolean };

export const rowKey = (row: Row) => (row.kind === "create" ? "__create__" : row.option.value);

export function SuggestionList({
  id,
  label,
  rows,
  activeIndex,
  query,
  room,
  sizeOf,
  noun,
  rowRefs,
  onHover,
  onChoose,
}: {
  id: string;
  label: string;
  rows: Row[];
  activeIndex: number;
  query: string;
  room: number;
  sizeOf: (tag: string) => number;
  noun: [string, string];
  rowRefs: MutableRefObject<Array<HTMLElement | null>>;
  onHover: (index: number) => void;
  onChoose: (row: Row) => void;
}) {
  const left = Math.max(0, room);
  return (
    <div className="dropdown absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_32px_-12px_rgb(20_24_40/0.28)]">
      <div
        id={id}
        role="listbox"
        aria-label={label}
        className="max-h-[min(19rem,42dvh)] overflow-y-auto overscroll-contain p-1.5"
      >
        {rows.map((row, i) => {
          const active = i === activeIndex;
          const picked = row.kind === "option" && row.selected;
          const disabled = (!row.fits || (row.kind === "create" && !row.allowed)) && !picked;
          return (
            <div
              key={rowKey(row)}
              id={`${id}-${i}`}
              ref={(el) => { rowRefs.current[i] = el; }}
              role="option"
              aria-selected={active}
              aria-disabled={disabled || undefined}
              // Keep focus in the input so the phone keyboard stays open.
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => { if (!active) onHover(i); }}
              onClick={() => onChoose(row)}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] pointer-coarse:min-h-12 sm:text-sm",
                active && "bg-surface-2",
                disabled ? "text-muted-2" : "text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  picked ? "bg-primary text-on-primary" : "border border-border text-muted-2",
                  row.kind === "create" && !disabled && "border-primary/50 text-primary",
                )}
                aria-hidden
              >
                {picked ? <Check className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={2.5} />}
              </span>
              {row.kind === "create" ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    Add <span className="font-semibold">“{row.label}”</span> as your own
                  </span>
                  <span className="shrink-0 text-xs text-muted-2">{!row.allowed ? "Not allowed" : disabled ? `${left} left` : `New ${noun[0]}`}</span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate"><Highlight text={row.option.label} query={query} /></span>
                  <span className="shrink-0 text-xs text-muted-2">
                    {picked
                      ? "Added"
                      : disabled
                        ? `Needs ${sizeOf(row.option.value)}, ${left} left`
                        : row.via
                          ? `matches “${row.via}”`
                          : row.option.group ?? ""}
                  </span>
                </>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted-2">No {noun[1]} match “{query}”. Try a shorter word.</p>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-2/50 px-4 py-2 text-xs text-muted-2 pointer-coarse:hidden" aria-hidden>
        <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
        <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> add</span>
        <span className="inline-flex items-center gap-1"><Kbd>,</Kbd> add as typed</span>
        <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
      </p>
    </div>
  );
}
