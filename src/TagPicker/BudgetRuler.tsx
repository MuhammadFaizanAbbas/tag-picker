import { cn } from "../lib/cn";

export type Segment = { key: string; size: number; featured: boolean; custom: boolean; lifted: boolean };

/**
 * The character limit drawn as a ruler. Each tag is a segment as long as its
 * name, so you can see what is using the space. A notch marks how much of the
 * budget your profile card shows.
 */
export function BudgetRuler({
  segments,
  max,
  cutoff,
  level,
}: {
  segments: Segment[];
  max: number;
  /** Characters used by the featured tags, or null when every tag is featured. */
  cutoff: number | null;
  level: "ok" | "near" | "full";
}) {
  const used = segments.reduce((sum, s) => sum + s.size, 0);
  const left = Math.max(0, max - used);
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 py-1.5" aria-hidden>
        <div className={cn("ruler relative h-2 overflow-hidden rounded-full bg-surface-2", level === "full" && "outline outline-1 outline-danger/60")}>
          <div className="flex h-full gap-[2px]">
            {segments.map((s) => (
              <div
                key={s.key}
                className={cn(
                  "h-full shrink-0 rounded-[2px] transition-[width,opacity] duration-300 ease-out",
                  // Custom tags are striped, like their dashed chips.
                  s.custom
                    ? "bg-[repeating-linear-gradient(135deg,var(--primary)_0_2px,transparent_2px_4px)]"
                    : s.featured ? "bg-primary" : "bg-primary/45",
                  s.lifted && "opacity-40",
                )}
                style={{ width: `calc(${(s.size / max) * 100}% - 2px)` }}
              />
            ))}
          </div>
        </div>
        {cutoff !== null && (
          <div
            className="absolute top-0 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground transition-[left] duration-300"
            style={{ left: `${Math.min(100, (cutoff / max) * 100)}%` }}
          />
        )}
      </div>
      <p className="shrink-0 text-right leading-none" title={`${used} of ${max} characters used`}>
        <span
          className={cn(
            "counter text-xl font-semibold tabular-nums",
            level === "near" && "text-warn",
            level === "full" && "text-danger",
          )}
        >
          {left}
        </span>
        <span className="ml-1 text-xs text-muted-2">left</span>
      </p>
    </div>
  );
}
