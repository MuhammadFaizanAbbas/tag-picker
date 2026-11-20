import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type BrowseTab = { id: string; label: string; count?: number };

/**
 * Tabs over the list of tags. "For you" first, so the page stays short on a
 * phone; every group is one tap away, and search covers everything.
 */
export function BrowsePanel({
  tabs,
  active,
  onTab,
  caption,
  children,
}: {
  tabs: BrowseTab[];
  active: string;
  onTab: (id: string) => void;
  /** One line under the tabs explaining the current view. */
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label="Browse" className="mt-6">
      <div
        role="group"
        aria-label="Show"
        // One swipeable row on phones; the fade at the edge says there is more.
        className="tabs-fade -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pr-8 [scrollbar-width:none] sm:pr-1 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={on}
              onClick={() => onTab(tab.id)}
              className={cn(
                "relative -mb-px inline-flex h-10 shrink-0 items-center whitespace-nowrap gap-1.5 border-b-2 px-2.5 text-sm transition-colors pointer-coarse:h-11",
                "focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                on ? "border-primary font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {!!tab.count && (
                <span className="rounded-full bg-primary-soft px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary">
                  {tab.count}<span className="sr-only"> picked</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {caption && <p className="mt-3 text-sm text-muted-2">{caption}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
