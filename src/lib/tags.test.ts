import { describe, expect, it } from "vitest";
import {
  canonicalTagFor, fitTagAdditions, joinNames, keywordHit, matchRanges, matchTagOptions, moveItem,
  recommendationSources, recommendTags, splitTagInput, type TagOption,
} from "./tags";

const opts: TagOption[] = [
  { value: "React", label: "React" },
  { value: "React Native", label: "React Native" },
  { value: "Figma setup", label: "Figma setup" },
  { value: "SwiftUI", label: "SwiftUI", keywords: ["ios", "apple"] },
];

describe("splitTagInput", () => {
  it("splits on the separators people paste", () => {
    expect(splitTagInput("Figma, React;Vue\nCSS\tHTML")).toEqual(["Figma", "React", "Vue", "CSS", "HTML"]);
  });
  it("strips bullets and numbering from pasted lists", () => {
    expect(splitTagInput("- Figma\n• React\n3. Vue\n4) CSS")).toEqual(["Figma", "React", "Vue", "CSS"]);
  });
  it("keeps hyphens that are part of a name", () => {
    expect(splitTagInput("Micro-interactions, Next.js")).toEqual(["Micro-interactions", "Next.js"]);
  });
  it("collapses spaces, drops empties and trims to max length", () => {
    expect(splitTagInput("  ui    design ,, ,abcdef", 4)).toEqual(["ui d", "abcd"]);
  });
});

describe("canonicalTagFor", () => {
  it("maps typed text to the stored spelling", () => {
    expect(canonicalTagFor("react", opts)).toBe("React");
    expect(canonicalTagFor("setup figma", opts)).toBe("Figma setup");
  });
  it("returns null for a partial word, so it is never silently accepted", () => {
    expect(canonicalTagFor("reac", opts)).toBeNull();
  });
});

describe("matchTagOptions + matchRanges + keywordHit", () => {
  it("ranks prefix matches first and finds hidden keywords", () => {
    expect(matchTagOptions("reac", opts).map((o) => o.value)).toEqual(["React", "React Native"]);
    expect(matchTagOptions("ios", opts).map((o) => o.value)).toEqual(["SwiftUI"]);
  });
  it("highlights each typed word, merged and in order", () => {
    expect(matchRanges("React Native", "nat re")).toEqual([[0, 2], [6, 9]]);
    expect(matchRanges("Figma", "x")).toEqual([]);
  });
  it("explains keyword-only matches", () => {
    expect(keywordHit(opts[3], "ios")).toBe("ios");
    expect(keywordHit(opts[3], "swift")).toBeNull();
  });
});

describe("budget", () => {
  it("refuses new tags that do not fit but keeps everything already held", () => {
    expect(fitTagAdditions(["Figma", "React", "TypeScript"], ["Figma", "React"], 12)).toEqual(["Figma", "React"]);
    // Over budget already (e.g. limit lowered): nothing held is dropped.
    expect(fitTagAdditions(["Figma", "React"], ["Figma", "React"], 3)).toEqual(["Figma", "React"]);
  });
});

describe("recommendations", () => {
  const data = {
    popular: ["CSS", "Figma"],
    related: {
      figma: [{ tag: "Prototyping", n: 40 }, { tag: "UI design", n: 38 }],
      react: [{ tag: "TypeScript", n: 50 }, { tag: "Prototyping", n: 5 }],
    },
  };
  it("prefers tags related to more of your picks", () => {
    expect(recommendTags(["Figma", "React"], data)[0]).toBe("Prototyping");
  });
  it("says which pick a suggestion came from, strongest first", () => {
    expect(recommendationSources("Prototyping", ["React", "Figma"], data.related)).toEqual(["Figma", "React"]);
    expect(recommendationSources("CSS", ["React"], data.related)).toEqual([]);
  });
});

describe("small helpers", () => {
  it("moveItem moves and clamps without mutating", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(list, 2, -5)).toEqual(["c", "a", "b"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
  it("joinNames reads like a sentence", () => {
    expect(joinNames(["Figma"])).toBe("Figma");
    expect(joinNames(["Figma", "React"])).toBe("Figma and React");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

// ---------------------------------------------------------------------------
// Security and hostile input
// ---------------------------------------------------------------------------
import { charLength, cleanTagText, isAllowedCustomTag, relatedTo, sanitizeTagList, tagSlug, truncateChars } from "./tags";

describe("cleanTagText", () => {
  it("removes invisible and direction-changing characters", () => {
    expect(cleanTagText("Fig\u200Bma")).toBe("Figma");
    expect(cleanTagText("\u202EamgiF")).toBe("amgiF"); // what is stored is what is shown
    expect(cleanTagText("\uFEFFReact\u2060")).toBe("React");
    expect(cleanTagText("Re\u0000act\u0007")).toBe("React");
  });
  it("keeps joiners that real languages and emoji need", () => {
    expect(cleanTagText("می\u200Cخواهم")).toBe("می\u200Cخواهم");
    expect(cleanTagText("👩\u200D💻")).toBe("👩\u200D💻");
  });
  it("normalises full-width and odd whitespace", () => {
    expect(cleanTagText("Ｆｉｇｍａ")).toBe("Figma");
    expect(cleanTagText("UI\u00A0\u00A0design\u2028")).toBe("UI design");
  });
  it("strips leading formula characters (CSV injection)", () => {
    expect(cleanTagText('=HYPERLINK("http://x")')).toBe('HYPERLINK("http://x")');
    expect(cleanTagText("+cmd|' /C calc'!A0")).toBe("cmd|' /C calc'!A0");
    expect(cleanTagText("@SUM(1)")).toBe("SUM(1)");
    expect(cleanTagText("C++")).toBe("C++");
  });
  it("leaves HTML as plain text (React escapes it when rendering)", () => {
    expect(cleanTagText("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("look-alike letters", () => {
  it("treats Cyrillic or Greek look-alikes as the real tag", () => {
    expect(tagSlug("Figmа")).toBe(tagSlug("Figma")); // Cyrillic а
    expect(tagSlug("Rеасt")).toBe("react");
    expect(canonicalTagFor("Rеасt", opts)).toBe("React");
    expect(matchTagOptions("Rеас", opts)[0].value).toBe("React");
  });
});

describe("prototype keys", () => {
  const related = { figma: [{ tag: "Prototyping", n: 4 }] };
  it("never reads Object.prototype (this used to blank the page)", () => {
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(relatedTo(related, key)).toEqual([]);
      expect(() => recommendTags([key], { related, popular: ["CSS"] })).not.toThrow();
      expect(recommendationSources("Prototyping", [key], related)).toEqual([]);
    }
  });
});

describe("length", () => {
  it("counts an emoji as one character and never splits it", () => {
    expect(charLength("🎨 Art")).toBe(5);
    expect(truncateChars("🎨🎨🎨", 2)).toBe("🎨🎨");
  });
  it("caps a huge paste", () => {
    expect(splitTagInput(Array(5000).fill("x").join(",")).length).toBe(100);
    expect(splitTagInput("a".repeat(100000), 30)).toEqual(["a".repeat(30)]);
  });
});

describe("sanitizeTagList (for the server)", () => {
  const base = { options: opts, maxChars: 20, maxTagLength: 12 };
  it("accepts the form field and returns canonical tags", () => {
    expect(sanitizeTagList("react,Ｒｅａｃｔ, setup figma", base)).toEqual({
      tags: ["React", "Figma setup"],
      rejected: [{ value: "React", reason: "duplicate" }],
    });
  });
  it("rejects unknown tags unless custom tags are allowed", () => {
    expect(sanitizeTagList(["Cobol"], base).rejected[0].reason).toBe("unknown");
    expect(sanitizeTagList(["Cobol"], { ...base, allowCustom: true }).tags).toEqual(["Cobol"]);
  });
  it("enforces length, budget, count and type", () => {
    const r = sanitizeTagList(["React", "React Native", "Figma setup", 42, { a: 1 }, "x".repeat(99)], { ...base, allowCustom: true });
    expect(r.tags).toEqual(["React", "React Native"]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["over-budget", "not-text", "not-text", "too-long"]);
    expect(sanitizeTagList(["a", "b", "c"], { options: [], allowCustom: true, maxTags: 2 }).tags).toEqual(["a", "b"]);
  });
  it("ignores input that is not a string or array", () => {
    expect(sanitizeTagList(null, base).tags).toEqual([]);
    expect(sanitizeTagList({ length: 5 }, base).tags).toEqual([]);
  });
});

describe("custom tag allowlist", () => {
  it("allows real skill names in any language", () => {
    for (const ok of ["C++", "C#", ".NET", "UI/UX", "Node.js", "R&D", "O'Reilly", "Go (lang)", "اردو", "日本語", "Café", "🎨 Art", "Next-gen"]) {
      expect(isAllowedCustomTag(ok)).toBe(true);
    }
  });
  it("refuses characters that are only useful for injection", () => {
    for (const bad of ["<img src=x>", 'a"b', "javascript:alert(1)", "a;b", "`x`", "a=b", "{{7*7}}", "${x}"]) {
      expect(isAllowedCustomTag(bad)).toBe(false);
    }
  });
  it("is enforced by the server-side validator too", () => {
    const r = sanitizeTagList(["<b>hi</b>", "C++"], { options: [], allowCustom: true });
    expect(r.tags).toEqual(["C++"]);
    expect(r.rejected).toEqual([{ value: "<b>hi</b>", reason: "bad-characters" }]);
  });
});
