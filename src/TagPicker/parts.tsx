import type { ReactNode } from "react";
import { matchRanges } from "../lib/tags";

/** A keyboard key, for hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-border bg-surface px-1 font-sans text-[11px] font-medium leading-none text-muted shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

/** Marks the letters that matched what you typed, like a highlighter pen. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(<span key={`t${i}`}>{text.slice(at, start)}</span>);
    parts.push(
      <mark key={`m${i}`} className="rounded-[3px] bg-highlight px-px text-on-highlight">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) parts.push(<span key="tail">{text.slice(at)}</span>);
  return <>{parts}</>;
}
