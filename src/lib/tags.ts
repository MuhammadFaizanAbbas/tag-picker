// Pure helpers for the tag picker. No React in here.

export type TagOption = {
  value: string;
  label: string;
  /** Hidden search words: "ios" finds "SwiftUI". */
  keywords?: readonly string[];
  /** Section the option is browsed under, e.g. "Design". */
  group?: string;
};

// ---------------------------------------------------------------------------
// Cleaning untrusted text. Everything a person types or pastes goes through
// cleanTagText before it can become a tag. The browser is not a security
// boundary, so the server must validate too: see sanitizeTagList below.
// ---------------------------------------------------------------------------

/**
 * Invisible or display-changing characters: control codes, zero-width space,
 * word joiners, BOM, soft hyphen and bidirectional overrides ("Trojan Source":
 * U+202E makes the stored text "\u202EamgiF" *display* as "Figma").
 * ZWJ and ZWNJ (U+200C, U+200D) are kept on purpose: Urdu, Persian, Hindi and
 * emoji sequences need them.
 */
const INVISIBLE = /[\p{Cc}\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/gu;

/** A leading = + - @ makes spreadsheets run the cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\s]+/;

/**
 * Make typed text safe to store and fair to compare:
 * - Unicode NFKC, so full-width "Ｆｉｇｍａ" and ligatures become plain "Figma".
 * - Any whitespace (tabs, no-break spaces, line separators) becomes one space.
 * - Invisible and direction-changing characters are removed.
 * - Leading formula characters are removed.
 */
export function cleanTagText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\s\u2028\u2029]+/gu, " ")
    .replace(INVISIBLE, "")
    .replace(FORMULA_START, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * What a custom tag may contain: an allowlist, not a blocklist. Letters and
 * numbers in any language, emoji, spaces and . + # & / ' ( ) - which covers
 * C++, C#, .NET, UI/UX and Node.js. No < > " ` : = ; so a tag is harmless even
 * if some other system later puts it into HTML, a URL or a spreadsheet
 * without escaping it. Options from your own list are trusted and skip this.
 */
const CUSTOM_ALLOWED = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\u200C\u200D️ .+#&/'()-]+$/u;
export const CUSTOM_TAG_CHARS = "letters, numbers, spaces and . + # & / ' ( ) -";
export function isAllowedCustomTag(text: string): boolean {
  return CUSTOM_ALLOWED.test(text);
}

/** Length in characters people see (code points), not UTF-16 units: an emoji counts 1, not 2. */
export function charLength(text: string): number {
  return [...text].length;
}

/** Cut to a length without splitting an emoji (a surrogate pair) in half. */
export function truncateChars(text: string, max: number): string {
  if (!Number.isFinite(max)) return text;
  return [...text].slice(0, Math.max(0, max)).join("").trim();
}

/**
 * Cyrillic and Greek letters that look identical to Latin ones. Used only for
 * *comparing*: "Figmа" with a Cyrillic "а" counts as Figma, so a look-alike can
 * never sit next to the real tag.
 */
const LOOKALIKES: Record<string, string> = {
  "а": "a", "в": "b", "е": "e", "ѕ": "s", "і": "i", "ј": "j", "к": "k", "м": "m", "н": "h",
  "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ӏ": "l", "ԁ": "d", "ԛ": "q", "ԝ": "w",
  "α": "a", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKES).join("")}]`, "gu");

/** "The same tag" = same text after cleaning, lowercasing and folding look-alike letters. */
export function tagSlug(t: string): string {
  return cleanTagText(t).toLowerCase().replace(LOOKALIKE_RE, (ch) => LOOKALIKES[ch]);
}

/** How many characters one tag costs against the budget. */
export type TagSize = (tag: string) => number;
const ownLength: TagSize = charLength;

/** Characters a list of tags spends. Separators are not counted. */
export function tagCharCount(tags: readonly string[], sizeOf: TagSize = ownLength): number {
  return tags.reduce((total, tag) => total + sizeOf(tag), 0);
}

/**
 * Apply the character budget the way the editor should: refuse NEW tags that
 * do not fit, but never drop a tag that is already selected. Otherwise
 * removing one tag from an over-budget list could silently remove others.
 */
export function fitTagAdditions(
  next: readonly string[],
  held: readonly string[],
  budget: number,
  sizeOf: TagSize = ownLength,
): string[] {
  const heldSlugs = new Set(held.map(tagSlug));
  const isHeld = (tag: string) => heldSlugs.has(tagSlug(tag));
  let used = tagCharCount(next.filter(isHeld), sizeOf);
  return next.filter((tag) => {
    if (isHeld(tag)) return true;
    if (used + sizeOf(tag) > budget) return false;
    used += sizeOf(tag);
    return true;
  });
}

/** A tag's words, normalized and sorted: "setup figma" and "Figma setup" match. */
const tokenKey = (value: string) => tagSlug(value).split(" ").filter(Boolean).sort().join(" ");

/**
 * The spelling typed text should be stored as, or null if it matches no known
 * option (then it is kept as a free-text tag). Exact match first, then the
 * same words in a different order.
 */
export function canonicalTagFor(typed: string, options: readonly TagOption[]): string | null {
  const slug = tagSlug(typed);
  if (!slug) return null;
  const exact = options.find((o) => tagSlug(o.value) === slug || tagSlug(o.label) === slug);
  if (exact) return exact.value;
  const key = tokenKey(typed);
  const reordered = options.find((o) => tokenKey(o.value) === key || tokenKey(o.label) === key);
  return reordered ? reordered.value : null;
}

/** Related tags for one tag, strongest first. `n` = how many people use both. */
export type RelatedTag = { tag: string; n: number };

export type TagRecommendations = {
  /** tagSlug -> the tags most often used alongside it. */
  related: Record<string, RelatedTag[]>;
  /** Most-used tags overall: what an empty box is shown. */
  popular: string[];
};

/**
 * What to recommend, given what is already selected. A tag related to MORE of
 * your picks ranks above one related very strongly to a single pick. Topped up
 * with the most popular tags.
 */
export function recommendTags(
  selected: readonly string[],
  { related, popular }: TagRecommendations,
  limit = 12,
): string[] {
  const held = new Set(selected.map(tagSlug));
  const scored = new Map<string, { tag: string; score: number; breadth: number }>();

  for (const pick of selected) {
    for (const { tag, n } of relatedTo(related, pick)) {
      const slug = tagSlug(tag);
      if (held.has(slug)) continue;
      const prev = scored.get(slug);
      if (prev) {
        prev.score += n;
        prev.breadth += 1;
      } else {
        scored.set(slug, { tag, score: n, breadth: 1 });
      }
    }
  }

  const out = [...scored.values()]
    .sort((a, b) => b.breadth - a.breadth || b.score - a.score || a.tag.localeCompare(b.tag))
    .map((entry) => entry.tag);

  const taken = new Set(out.map(tagSlug));
  for (const tag of popular) {
    if (out.length >= limit) break;
    const slug = tagSlug(tag);
    if (held.has(slug) || taken.has(slug)) continue;
    taken.add(slug);
    out.push(tag);
  }
  return out.slice(0, limit);
}

/** Suggestions shown at once while typing. */
export const MAX_SUGGESTIONS = 24;

/**
 * Rank options against a typed query. Every word must appear, in any order.
 * `keywords` are hidden search aliases. Options in `catalog` (the always-visible
 * list) rank slightly higher.
 */
export function matchTagOptions(
  query: string,
  options: readonly TagOption[],
  { catalog, limit = MAX_SUGGESTIONS }: { catalog?: ReadonlySet<string>; limit?: number } = {},
): TagOption[] {
  const q = tagSlug(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  return options
    .map((option) => ({
      option,
      hay: tagSlug([option.label, ...(option.keywords ?? [])].join(" ")),
    }))
    .filter(({ hay }) => tokens.every((token) => hay.includes(token)))
    .map(({ option }) => {
      const label = tagSlug(option.label);
      let rank = 0;
      if (label.startsWith(q)) rank -= 4;
      else if (label.includes(q)) rank -= 2;
      if (catalog?.has(option.value)) rank -= 1;
      return { option, rank };
    })
    .sort((a, b) =>
      a.rank - b.rank ||
      a.option.label.length - b.option.label.length ||
      a.option.label.localeCompare(b.option.label, "en", { sensitivity: "base", numeric: true }),
    )
    .slice(0, limit)
    .map(({ option }) => option);
}

// ---------------------------------------------------------------------------
// Added for the reworked picker
// ---------------------------------------------------------------------------

/**
 * Split typed or pasted text into tag candidates. Accepts the separators
 * people actually paste from notes, CVs and spreadsheets: commas, semicolons,
 * new lines, tabs, and leading bullets ("- Figma", "• React").
 */
export function splitTagInput(raw: string, maxLength = Infinity): string[] {
  return raw
    .slice(0, MAX_INPUT_CHARS)
    .split(/[,;\n\r\t\u2028\u2029]+/)
    .slice(0, MAX_INPUT_ITEMS)
    .map((part) => part.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, ""))
    .map((part) => truncateChars(cleanTagText(part), maxLength))
    .filter(Boolean);
}

/** Most text one paste may contain, and most items taken from it. Stops a huge paste freezing the tab. */
export const MAX_INPUT_CHARS = 5000;
export const MAX_INPUT_ITEMS = 100;

/**
 * Safe lookup in the related map. A plain `related[key]` broke on custom tags
 * named "constructor" or "__proto__": they found Object.prototype members, the
 * "for...of" threw, and the whole page went blank. (This was in the original.)
 */
export function relatedTo(related: TagRecommendations["related"], tag: string): RelatedTag[] {
  const key = tagSlug(tag);
  if (!Object.hasOwn(related, key)) return [];
  const list = related[key];
  return Array.isArray(list) ? list : [];
}

export type RejectReason = "not-text" | "empty" | "too-long" | "unknown" | "bad-characters" | "duplicate" | "over-budget" | "too-many";

/**
 * The same rules the picker applies, as one pure function the SERVER can run
 * on the submitted field. Never trust the client: a request can skip the UI.
 * Accepts the raw form value (comma-separated string) or an array of unknown.
 */
export function sanitizeTagList(
  input: unknown,
  {
    options,
    allowCustom = false,
    maxTagLength = 30,
    maxChars,
    maxTags = 50,
  }: {
    options: readonly TagOption[];
    allowCustom?: boolean;
    maxTagLength?: number;
    maxChars?: number;
    maxTags?: number;
  },
): { tags: string[]; rejected: Array<{ value: string; reason: RejectReason }> } {
  const raw: unknown[] = typeof input === "string"
    ? input.slice(0, MAX_INPUT_CHARS).split(",")
    : Array.isArray(input) ? input.slice(0, MAX_INPUT_ITEMS) : [];
  const tags: string[] = [];
  const rejected: Array<{ value: string; reason: RejectReason }> = [];
  const seen = new Set<string>();
  let used = 0;

  for (const item of raw) {
    if (typeof item !== "string") { rejected.push({ value: String(item).slice(0, 40), reason: "not-text" }); continue; }
    const text = cleanTagText(item);
    if (!text) { if (item.trim()) rejected.push({ value: item.slice(0, 40), reason: "empty" }); continue; }
    if (charLength(text) > maxTagLength) { rejected.push({ value: truncateChars(text, 40), reason: "too-long" }); continue; }
    const known = canonicalTagFor(text, options);
    if (!known && !allowCustom) { rejected.push({ value: text, reason: "unknown" }); continue; }
    if (!known && !isAllowedCustomTag(text)) { rejected.push({ value: text, reason: "bad-characters" }); continue; }
    const tag = known ?? text;
    const slug = tagSlug(tag);
    if (seen.has(slug)) { rejected.push({ value: tag, reason: "duplicate" }); continue; }
    if (tags.length >= maxTags) { rejected.push({ value: tag, reason: "too-many" }); continue; }
    const size = charLength(options.find((o) => o.value === tag)?.label ?? tag);
    if (maxChars !== undefined && used + size > maxChars) { rejected.push({ value: tag, reason: "over-budget" }); continue; }
    seen.add(slug);
    used += size;
    tags.push(tag);
  }
  return { tags, rejected };
}

/**
 * Where the typed words appear in a label, as merged [start, end) ranges, so
 * the matching letters can be highlighted in the suggestion list.
 */
export function matchRanges(label: string, query: string): Array<[number, number]> {
  const hay = label.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const token of tagSlug(query).split(/\s+/).filter(Boolean)) {
    const at = hay.indexOf(token);
    if (at >= 0) ranges.push([at, at + token.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/**
 * When an option matched only because of a hidden keyword, return that
 * keyword so the list can say why ("matches ios"). Otherwise null: a result
 * that appears for no visible reason feels like a bug.
 */
export function keywordHit(option: TagOption, query: string): string | null {
  const label = option.label.toLowerCase();
  const missing = tagSlug(query).split(/\s+/).filter((t) => t && !label.includes(t));
  if (!missing.length) return null;
  return option.keywords?.find((k) => missing.some((t) => k.toLowerCase().includes(t))) ?? null;
}

/**
 * Which of your picks a recommendation comes from, strongest first. Lets the
 * UI explain itself: "Often paired with Figma".
 */
export function recommendationSources(
  tag: string,
  selected: readonly string[],
  related: TagRecommendations["related"],
): string[] {
  const slug = tagSlug(tag);
  return selected
    .map((pick) => ({ pick, n: relatedTo(related, pick).find((r) => tagSlug(r.tag) === slug)?.n ?? 0 }))
    .filter((entry) => entry.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((entry) => entry.pick);
}

/** Move one item to a new index. Returns a new array; out-of-range is clamped. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Join names for a sentence: "Figma", "Figma and React", "Figma, React and CSS". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
