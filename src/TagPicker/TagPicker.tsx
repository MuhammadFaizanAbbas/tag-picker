import {
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ClipboardEvent, type KeyboardEvent, type ReactNode,
} from "react";
import { Check, Plus, Search, Undo2, X } from "lucide-react";
import { cn } from "../lib/cn";
import {
  canonicalTagFor, charLength, cleanTagText, CUSTOM_TAG_CHARS, isAllowedCustomTag, fitTagAdditions, joinNames, keywordHit, matchTagOptions,
  moveItem, recommendationSources, recommendTags, splitTagInput, tagCharCount, tagSlug, truncateChars,
  type TagOption, type TagRecommendations,
} from "../lib/tags";
import { BrowsePanel, type BrowseTab } from "./BrowsePanel";
import { BudgetRuler } from "./BudgetRuler";
import { Kbd } from "./parts";
import { SuggestionList, type Row } from "./SuggestionList";
import { useChipDrag } from "./useChipDrag";

type Option = string | TagOption;

const optionShape = (option: Option): TagOption =>
  typeof option === "string" ? { value: option, label: option } : option;

/** The line under the field: errors, undo, and summaries of what just happened. */
type Notice =
  | { kind: "error" | "info"; text: string }
  | { kind: "undo"; text: string; restore: string[] };

const SEPARATOR = /[,;\n\t]/;
const FOR_YOU = "__for_you__";
const ALL = "__all__";

export type TagPickerProps = {
  /** Tags always shown in the browse list. Give them a `group` to get tabs. */
  options: readonly Option[];
  /** Extra tags that only appear while typing (too many to show all the time). */
  searchOptions?: readonly Option[];
  /** Form field name. Submitted as one comma-separated string, in the user's order. */
  name?: string;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** Let people add tags that are not in the lists. */
  allowCustom?: boolean;
  /** Longest single tag, in characters. */
  maxTagLength?: number;
  /** Total characters across all selected tags. Omit for no limit. */
  maxChars?: number;
  /** Most tags allowed. A safety cap; defaults to 50. */
  maxTags?: number;
  /** How many of the first tags are shown somewhere prominent (e.g. a profile card). */
  featuredCount?: number;
  /** Where featured tags appear, for hints: "your profile card". */
  featuredWhere?: string;
  /** Data for the "For you" tab. Omit for no tab. */
  recommendations?: TagRecommendations;
  /** Accessible name of the field, e.g. "Skills". */
  label?: string;
  /** Words used in messages: ["skill", "skills"]. */
  noun?: [singular: string, plural: string];
  inputPlaceholder?: string;
  className?: string;
};

export function TagPicker({
  options,
  searchOptions = [],
  name,
  value,
  defaultValue = [],
  onChange,
  allowCustom = false,
  maxTagLength = 30,
  maxChars,
  maxTags = 50,
  featuredCount,
  featuredWhere = "the top",
  recommendations,
  label = "Tags",
  noun = ["tag", "tags"],
  inputPlaceholder,
  className,
}: TagPickerProps) {
  // ----- Options ------------------------------------------------------------
  const opts = useMemo(() => options.map(optionShape), [options]);
  const searchable = useMemo(() => {
    const seen = new Set(opts.map((o) => tagSlug(o.value)));
    const extra = searchOptions.map(optionShape).filter((o) => {
      const slug = tagSlug(o.value);
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
    return [...opts, ...extra];
  }, [opts, searchOptions]);
  const bySlug = useMemo(() => new Map(searchable.map((o) => [tagSlug(o.value), o])), [searchable]);
  const catalogValues = useMemo(() => new Set(opts.map((o) => o.value)), [opts]);
  const groups = useMemo(() => [...new Set(opts.map((o) => o.group).filter((g): g is string => !!g))], [opts]);

  // ----- State --------------------------------------------------------------
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", n: 0 });
  const [flash, setFlash] = useState<{ slug: string; kind: "added" | "exists" } | null>(null);
  const [tab, setTab] = useState(recommendations ? FOR_YOU : ALL);
  // Suggestions hold still while you tap through them (see `suggestions`).
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [freezeTick, setFreezeTick] = useState(0);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;
  const chipHelpId = `${baseId}-chip-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const chipListRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef<Array<HTMLElement | null>>([]);
  const pendingFocus = useRef<number | "input" | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ----- Derived ------------------------------------------------------------
  const labelFor = (tag: string) => bySlug.get(tagSlug(tag))?.label ?? tag;
  const sizeOf = (tag: string) => charLength(labelFor(tag));
  const isCustom = (tag: string) => !bySlug.has(tagSlug(tag));
  const has = (tag: string) => selected.some((item) => tagSlug(item) === tagSlug(tag));
  const isFeatured = (index: number) => featuredCount !== undefined && index < featuredCount;
  const charCount = tagCharCount(selected, sizeOf);
  const room = maxChars === undefined ? Infinity : maxChars - charCount;
  const fits = (tag: string) => has(tag) || (sizeOf(tag) <= room && selected.length < maxTags);
  const count = (n: number) => `${n} ${n === 1 ? noun[0] : noun[1]}`;

  // ----- Feedback -----------------------------------------------------------
  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }));
  const flashChip = (tag: string, kind: "added" | "exists") => setFlash({ slug: tagSlug(tag), kind });

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), notice.kind === "undo" ? 8000 : 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(t);
  }, [flash]);

  // ----- Changing the selection ---------------------------------------------
  const set = (next: string[]) => {
    selectedRef.current = next;
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  /** Add tags in order. Never drops a tag you already have to make room. */
  const add = (candidates: string[]) => {
    const current = selectedRef.current;
    const seen = new Set(current.map(tagSlug));
    const fresh: string[] = [];
    const dupes: string[] = [];
    for (const raw of candidates) {
      const tag = cleanTagText(raw);
      const slug = tagSlug(tag);
      if (!slug) continue;
      if (seen.has(slug)) { dupes.push(tag); continue; }
      seen.add(slug);
      fresh.push(tag);
    }
    const capped = fresh.slice(0, Math.max(0, maxTags - current.length));
    const tooMany = fresh.slice(capped.length);
    const next = maxChars === undefined
      ? [...current, ...capped]
      : fitTagAdditions([...current, ...capped], current, maxChars, sizeOf);
    const added = next.slice(current.length);
    const refused = capped.filter((tag) => !added.includes(tag));
    if (added.length) set(next);
    return { added, refused, dupes, tooMany };
  };

  /** Explain what happened, out loud and on screen, without nagging. */
  const report = ({ added, refused, dupes, tooMany = [], unknown = [], invalid = [] }: {
    added: string[]; refused: string[]; dupes: string[]; tooMany?: string[]; unknown?: string[]; invalid?: string[];
  }) => {
    const total = selectedRef.current.length;
    const left = maxChars === undefined ? Infinity : maxChars - tagCharCount(selectedRef.current, sizeOf);
    if (added.length === 1) flashChip(added[0], "added");
    else if (!added.length && dupes.length === 1) flashChip(dupes[0], "exists");

    // Common cases speak but stay quiet on screen: the chip itself animates.
    const problems = refused.length + unknown.length + tooMany.length + invalid.length;
    if (added.length === 1 && !dupes.length && !problems) {
      setNotice(null);
      announce(`Added ${labelFor(added[0])}. ${count(total)}.${Number.isFinite(left) ? ` ${left} characters left.` : ""}`);
      return;
    }
    if (!added.length && dupes.length === 1 && !problems) {
      setNotice(null);
      announce(`${labelFor(dupes[0])} is already added.`);
      return;
    }

    const parts: string[] = [];
    if (added.length) parts.push(`Added ${count(added.length)}.`);
    if (dupes.length) parts.push(`${dupes.length} already there.`);
    if (refused.length === 1 && !added.length && !dupes.length) {
      const tag = refused[0];
      parts.push(`“${labelFor(tag)}” needs ${sizeOf(tag)} characters and you have ${Math.max(0, left)} left. Remove a ${noun[0]} to make room.`);
    } else if (refused.length) {
      parts.push(`No room for ${joinNames(refused.map((t) => `“${labelFor(t)}”`))}.`);
    }
    if (tooMany.length) parts.push(`You can have up to ${count(maxTags)}.`);
    if (unknown.length) parts.push(`No ${noun[0]} called ${joinNames(unknown.map((u) => `“${u}”`))}.`);
    if (invalid.length) parts.push(`${joinNames(invalid.map((u) => `“${truncateChars(u, 24)}”`))} can't be added. Use only ${CUSTOM_TAG_CHARS}.`);
    if (!parts.length) { setNotice(null); return; }

    const text = parts.join(" ");
    setNotice({ kind: problems ? "error" : "info", text });
    announce(text);
  };

  /** Typed text to the stored tag: a known option's spelling, custom text, or null. */
  const resolve = (typed: string) => canonicalTagFor(typed, searchable) ?? (allowCustom ? typed : null);

  /** Commit text literally (a comma was typed, or a list was pasted). */
  const commitText = (raw: string) => {
    const resolved: string[] = [];
    const unknown: string[] = [];
    const invalid: string[] = [];
    for (const item of splitTagInput(raw, maxTagLength)) {
      const tag = resolve(item);
      if (!tag) unknown.push(item);
      else if (isCustom(tag) && !isAllowedCustomTag(tag)) invalid.push(tag);
      else resolved.push(tag);
    }
    if (!resolved.length && !unknown.length && !invalid.length) return;
    report({ ...add(resolved), unknown, invalid });
  };

  const remove = (tag: string, how: "pointer" | "key" = "pointer") => {
    const before = selectedRef.current;
    const index = before.findIndex((item) => tagSlug(item) === tagSlug(tag));
    if (index < 0) return;
    set(before.filter((_, i) => i !== index));
    setNotice({ kind: "undo", text: `Removed “${labelFor(tag)}”.`, restore: before });
    announce(`Removed ${labelFor(tag)}. ${count(before.length - 1)}. Undo is available.`);
    if (how === "key") pendingFocus.current = before.length > 1 ? Math.min(index, before.length - 2) : "input";
  };

  const clearAll = () => {
    const before = selectedRef.current;
    if (!before.length) return;
    set([]);
    setNotice({ kind: "undo", text: `Cleared ${count(before.length)}.`, restore: before });
    announce(`Cleared all ${noun[1]}. Undo is available.`);
  };

  const undo = () => {
    if (notice?.kind !== "undo") return;
    set(notice.restore);
    setNotice(null);
    announce(`Restored. ${count(notice.restore.length)}.`);
  };

  const toggle = (tag: string) => (has(tag) ? remove(tag) : report(add([tag])));

  const moveTo = (from: number, to: number, speak = true) => {
    const list = selectedRef.current;
    if (to < 0 || to >= list.length || from === to) return;
    set(moveItem(list, from, to));
    if (speak) announce(`${labelFor(list[from])}, position ${to + 1} of ${list.length}.`);
  };

  const { dragging, target: dropTarget, startDrag } = useChipDrag({
    listRef: fieldRef,
    items: selected,
    keyOf: tagSlug,
    onReorder: (tag, from, to) => {
      set(moveItem(selectedRef.current, from, to));
      announce(`Moved ${labelFor(tag)} to position ${to + 1} of ${selectedRef.current.length}.`);
    },
  });

  // Put focus where a keyboard user expects it after a chip disappears.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === "input") inputRef.current?.focus();
    else chipListRef.current?.querySelectorAll<HTMLElement>("[data-chip]")[target]?.focus();
  });

  // ----- Suggestions while typing -------------------------------------------
  const q = cleanTagText(draft);
  const customPicked: TagOption[] = selected.filter(isCustom).map((tag) => ({ value: tag, label: tag }));
  const pool = [...searchable, ...customPicked];
  const optionRows: Row[] = (q ? matchTagOptions(q, pool, { catalog: catalogValues }) : []).map((option) => ({
    kind: "option", option, selected: has(option.value), fits: fits(option.value), via: keywordHit(option, q),
  }));
  const unpicked = optionRows.filter((r) => r.kind === "option" && !r.selected);
  const picked = optionRows.filter((r) => r.kind === "option" && r.selected);
  const createLabel = truncateChars(q, maxTagLength);
  const createRow: Row | null = allowCustom && createLabel && !canonicalTagFor(q, pool)
    ? {
      kind: "create",
      label: createLabel,
      fits: charLength(createLabel) <= room && selected.length < maxTags,
      allowed: isAllowedCustomTag(createLabel),
    }
    : null;
  // Real matches first. "Add as your own" leads only when nothing else can be
  // added, so Enter never turns a half-typed word into a junk tag by accident.
  const rows: Row[] = createRow && !unpicked.length
    ? [createRow, ...picked]
    : [...unpicked, ...picked, ...(createRow ? [createRow] : [])];
  const open = focused && !!q && !dismissed;
  const activeIndex = Math.min(active, rows.length - 1);

  useEffect(() => {
    if (open) rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const choose = (row: Row) => {
    if (row.kind === "create") {
      if (!row.allowed) { report({ added: [], refused: [], dupes: [], invalid: [row.label] }); return; }
      report(add([row.label]));
    }
    else if (row.selected) { flashChip(row.option.value, "exists"); announce(`${row.option.label} is already added.`); }
    else report(add([row.option.value]));
    setDraft("");
    setActive(0);
  };

  // ----- For you ------------------------------------------------------------
  const live = recommendations
    ? recommendTags(selected, recommendations, 8).filter((tag) => sizeOf(tag) <= room)
    : [];
  // Adding a suggestion would reshuffle the row under your finger, so the next
  // tap hits a different tag. Hold the row still until you pause.
  const suggestions = frozen ?? live;
  useEffect(() => {
    if (!frozen) return;
    const t = window.setTimeout(() => setFrozen(null), 1800);
    return () => window.clearTimeout(t);
  }, [frozen, freezeTick]);
  const pickSuggestion = (tag: string) => {
    if (!frozen) setFrozen(live);
    setFreezeTick((n) => n + 1);
    toggle(tag);
  };
  const sourceOf = (tag: string) =>
    recommendations ? recommendationSources(tag, selected, recommendations.related)[0] : undefined;
  const reasons = [...new Set(suggestions.map(sourceOf).filter((s): s is string => !!s))].map(labelFor);
  const forYouCaption = !suggestions.length
    ? `Nothing more to suggest right now. Search, or browse a group.`
    : reasons.length
      ? `Often added with ${reasons.length > 2 ? `${reasons.slice(0, 2).join(", ")} and others` : joinNames(reasons)}.`
      : `Most profiles start with these.`;

  // ----- Keyboard -----------------------------------------------------------
  const chipEls = () => chipListRef.current?.querySelectorAll<HTMLElement>("[data-chip]");

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const caretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!q) return;
      event.preventDefault();
      setDismissed(false);
      if (rows.length) setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    } else if (event.key === "Enter") {
      if (!q) return; // empty: let the form submit as usual
      event.preventDefault();
      if (rows.length) choose(rows[activeIndex]);
      else report({ added: [], refused: [], dupes: [], unknown: [q] });
    } else if (event.key === "Escape") {
      if (open) { event.preventDefault(); setDismissed(true); }
      else if (draft) { event.preventDefault(); setDraft(""); }
    } else if ((event.key === "Backspace" || event.key === "ArrowLeft") && caretAtStart && selected.length) {
      // First press selects the last chip; a second Backspace removes it.
      event.preventDefault();
      chipEls()?.[selected.length - 1]?.focus();
    } else if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey) && !draft && notice?.kind === "undo") {
      event.preventDefault();
      undo();
    }
  };

  const onChipKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    const focusAt = (i: number) => (i >= selected.length ? inputRef.current?.focus() : chipEls()?.[Math.max(0, i)]?.focus());
    const reorder = event.shiftKey || event.altKey;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const to = index + (event.key === "ArrowLeft" ? -1 : 1);
      if (reorder) { moveTo(index, to); pendingFocus.current = Math.max(0, Math.min(to, selected.length - 1)); }
      else focusAt(to);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const to = event.key === "Home" ? 0 : selected.length - 1;
      if (reorder) { moveTo(index, to); pendingFocus.current = to; } else focusAt(to);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      remove(selected[index], "key");
      if (event.key === "Backspace" && index > 0) pendingFocus.current = index - 1;
    } else if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
      pendingFocus.current = "input";
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Start typing on a chip: carry on in the input.
      event.preventDefault();
      setDraft((d) => d + event.key);
      inputRef.current?.focus();
    }
  };

  const onDraftChange = (text: string) => {
    setDismissed(false);
    setActive(0);
    if (notice?.kind === "error") setNotice(null);
    // Watch the text, not the key: Android keyboards often report "," as key 229.
    if (SEPARATOR.test(text)) {
      const parts = text.split(SEPARATOR);
      const tail = parts.pop() ?? "";
      commitText(parts.join(","));
      setDraft(tail.trimStart());
    } else {
      setDraft(text);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!SEPARATOR.test(text)) return; // a single word pastes normally
    event.preventDefault();
    commitText(draft + text); // splitTagInput caps the size of what is read
    setDraft("");
  };

  const onFocus = () => {
    setFocused(true);
    // On phones the keyboard covers the bottom half of the screen. Lift the
    // field so its suggestions are not hidden underneath.
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    window.setTimeout(() => {
      const field = fieldRef.current;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      if (field && field.getBoundingClientRect().top > viewport * 0.3) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        field.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
    }, 300);
  };

  // ----- Pieces -------------------------------------------------------------
  const pill = (option: TagOption, onClick: () => void, title?: string) => {
    const on = has(option.value);
    const ok = fits(option.value);
    return (
      <button
        key={option.value}
        type="button"
        aria-pressed={on}
        aria-disabled={!ok || undefined}
        title={!ok ? (selected.length >= maxTags ? `Up to ${count(maxTags)}` : `Needs ${sizeOf(option.value)} characters, ${Math.max(0, room)} left`) : title}
        onClick={onClick}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border pl-2.5 pr-3.5 text-sm transition-colors pointer-coarse:h-10",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          on && "border-primary/30 bg-primary-soft font-medium text-primary",
          !on && ok && "border-border bg-surface text-foreground hover:border-foreground/35",
          !on && !ok && "cursor-not-allowed border-dashed border-border text-muted-2",
        )}
      >
        {on ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <Plus className="size-4 text-muted-2" aria-hidden />}
        <span>{option.label}</span>
        {!ok && <span className="sr-only"> (does not fit)</span>}
      </button>
    );
  };
  const pillRow = (list: TagOption[], onPick: (tag: string) => void, titleOf?: (tag: string) => string | undefined) => (
    <div className="flex flex-wrap gap-2">
      {list.map((o) => pill(o, () => onPick(o.value), titleOf?.(o.value)))}
    </div>
  );

  const tabs: BrowseTab[] = [
    ...(recommendations ? [{ id: FOR_YOU, label: "For you" }] : []),
    { id: ALL, label: "All" },
    ...groups.map((g) => ({ id: g, label: g, count: opts.filter((o) => o.group === g && has(o.value)).length })),
  ];

  const level: "ok" | "near" | "full" = maxChars === undefined
    ? "ok"
    : room <= 0 ? "full" : charCount / maxChars >= 0.85 ? "near" : "ok";
  const showCutoff = featuredCount !== undefined && selected.length > featuredCount;
  const cutoffChars = showCutoff ? tagCharCount(selected.slice(0, featuredCount), sizeOf) : null;

  const linkButton = "font-medium text-primary underline-offset-2 hover:underline pointer-coarse:py-2";
  const status: ReactNode = notice ? (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2.5", notice.kind === "error" && "text-danger")}>
      {notice.text}
      {notice.kind === "undo" && (
        <button type="button" onClick={undo} className={cn(linkButton, "inline-flex items-center gap-1")}>
          <Undo2 className="size-3.5" aria-hidden />Undo
        </button>
      )}
    </span>
  ) : !focused && q ? (
    <span className="inline-flex flex-wrap items-center gap-x-2.5">
      “{q}” is not added yet.
      <button type="button" className={linkButton} onClick={() => { commitText(q); setDraft(""); }}>Add it</button>
    </span>
  ) : focused && selected.length ? (
    <span className="inline-flex items-center gap-1.5 pointer-coarse:hidden"><Kbd>⌫</Kbd> to edit your {noun[1]}</span>
  ) : selected.length > 1 ? (
    <span>
      <span className="pointer-coarse:hidden">Drag to reorder.</span>
      <span className="hidden pointer-coarse:inline">Press and hold to reorder.</span>
      {featuredCount !== undefined && <> The first {featuredCount} show on {featuredWhere}.</>}
    </span>
  ) : null;

  // ----- Render -------------------------------------------------------------
  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={selected.join(",")} />}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement.text}{announcement.n % 2 ? "\u200B" : ""}
      </p>
      <p id={chipHelpId} className="sr-only">
        Left and right arrows move between {noun[1]}. Shift plus arrow moves this {noun[0]}. Backspace removes it.
      </p>

      <div className="relative">
        <div
          ref={fieldRef}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) { event.preventDefault(); inputRef.current?.focus(); }
          }}
          className={cn(
            "flex min-h-14 scroll-mt-4 flex-wrap items-center gap-1.5 rounded-2xl border bg-surface p-2 transition-[border-color,box-shadow]",
            "cursor-text focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
            level === "full" ? "border-danger/60" : "border-border-strong",
          )}
        >
          {selected.length > 0 && (
            <ul ref={chipListRef} aria-label={`Your ${noun[1]}, in order`} className="contents">
              {selected.map((tag, index) => {
                const slug = tagSlug(tag);
                const custom = isCustom(tag);
                const featured = isFeatured(index);
                return [
                  <li
                    key={slug}
                    data-chip={slug}
                    tabIndex={-1}
                    aria-label={`${labelFor(tag)}${custom ? ", your own" : ""}, ${index + 1} of ${selected.length}${featured ? `, shown on ${featuredWhere}` : ""}`}
                    aria-describedby={chipHelpId}
                    onKeyDown={(event) => onChipKeyDown(event, index)}
                    onPointerDown={(event) => startDrag(event, tag)}
                    onContextMenu={(event) => { if (dragging) event.preventDefault(); }}
                    title={custom ? `Your own ${noun[0]}` : undefined}
                    className={cn(
                      "chip relative inline-flex h-9 max-w-full select-none items-center gap-0.5 rounded-full border pl-3 pr-1 text-sm font-medium",
                      "touch-manipulation pointer-fine:cursor-grab pointer-coarse:h-10",
                      "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      featured && !custom && "border-primary bg-primary text-on-primary",
                      featured && custom && "border-dashed border-primary bg-surface text-primary",
                      !featured && !custom && "border-transparent bg-primary-soft text-primary",
                      !featured && custom && "border-dashed border-muted-2/70 bg-surface text-foreground",
                      dragging === tag && "lifted z-10 cursor-grabbing",
                      dropTarget?.key === slug && `drop-${dropTarget.side}`,
                      flash?.slug === slug && (flash.kind === "added" ? "chip-pop" : "chip-shake"),
                    )}
                  >
                    <span className="truncate">{labelFor(tag)}</span>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => remove(tag)}
                      aria-label={`Remove ${labelFor(tag)}`}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full pointer-coarse:size-8",
                        featured && !custom ? "text-on-primary/75 hover:bg-on-primary/15 hover:text-on-primary" : "opacity-60 hover:bg-foreground/10 hover:opacity-100",
                      )}
                    >
                      <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                  </li>,
                  showCutoff && index === featuredCount! - 1 && (
                    <li key="__cutoff__" aria-hidden className="mx-1 h-6 w-0.5 self-center rounded-full bg-foreground" title={`Above this line: shown on ${featuredWhere}`} />
                  ),
                ];
              })}
            </ul>
          )}
          <div className="flex min-w-[11ch] flex-1 items-center gap-2 px-1.5">
            <Search className="size-4 shrink-0 text-muted-2" aria-hidden />
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              onPaste={onPaste}
              onFocus={onFocus}
              // Leaving the field never adds a tag: half-typed words used to become tags.
              onBlur={() => setFocused(false)}
              placeholder={inputPlaceholder ?? (selected.length ? "Add more" : `Search ${noun[1]}, or type your own`)}
              aria-label={label}
              aria-describedby={statusId}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={open && rows.length ? `${listboxId}-${activeIndex}` : undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="enter"
              maxLength={200}
              className="h-9 w-full min-w-0 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-muted-2 sm:text-[15px]"
            />
          </div>
        </div>

        {open && (
          <SuggestionList
            id={listboxId}
            label={`${label} suggestions`}
            rows={rows}
            activeIndex={activeIndex}
            query={q}
            room={room}
            sizeOf={sizeOf}
            noun={noun}
            rowRefs={rowRefs}
            onHover={setActive}
            onChoose={choose}
          />
        )}
      </div>

      {maxChars !== undefined && (
        <div className="mt-3">
          <BudgetRuler
            max={maxChars}
            level={level}
            cutoff={cutoffChars}
            segments={selected.map((tag, i) => ({
              key: tagSlug(tag), size: sizeOf(tag), featured: isFeatured(i) || featuredCount === undefined,
              custom: isCustom(tag), lifted: dragging === tag,
            }))}
          />
        </div>
      )}

      <div id={statusId} className="mt-1 flex min-h-6 items-center justify-between gap-4 text-[13px] text-muted-2 pointer-coarse:min-h-9">
        <div className="min-w-0">{status}</div>
        {selected.length > 1 && (
          <button type="button" onClick={clearAll} className="shrink-0 font-medium text-muted hover:text-foreground pointer-coarse:py-2">
            Clear all
          </button>
        )}
      </div>

      <BrowsePanel
        tabs={tabs}
        active={tab}
        onTab={setTab}
        caption={tab === FOR_YOU ? forYouCaption : undefined}
      >
        {tab === FOR_YOU && suggestions.length > 0 && (
          <div onPointerLeave={(event) => { if (event.pointerType === "mouse") setFrozen(null); }}>
            {pillRow(
              suggestions.map((t) => bySlug.get(tagSlug(t)) ?? { value: t, label: t }),
              pickSuggestion,
              (t) => { const s = sourceOf(t); return s ? `Often added with ${labelFor(s)}` : "Popular"; },
            )}
          </div>
        )}
        {tab === ALL && (
          <div className="space-y-5">
            {(groups.length ? groups : [""]).map((g) => (
              <div key={g || "all"}>
                {g && <h2 className="mb-2 text-sm font-semibold text-foreground">{g}</h2>}
                {pillRow(g ? opts.filter((o) => o.group === g) : opts, toggle)}
              </div>
            ))}
          </div>
        )}
        {tab !== FOR_YOU && tab !== ALL && pillRow(opts.filter((o) => o.group === tab), toggle)}
      </BrowsePanel>
    </div>
  );
}
