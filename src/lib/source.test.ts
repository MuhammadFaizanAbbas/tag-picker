import { describe, expect, it } from "vitest";

// Guard against "Trojan Source": invisible or direction-changing characters
// hidden in code can make it read differently from how it runs. Write them as
// escapes (\u200B) instead. Text with joiners for real languages is fine as
// an escape too.
const files = import.meta.glob("/src/**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const HIDDEN = /[\p{Cc}\p{Cf}\u2028\u2029\u00A0]/u;

describe("source files", () => {
  it("are found", () => expect(Object.keys(files).length).toBeGreaterThan(5));
  for (const [path, text] of Object.entries(files)) {
    it(`${path} has no hidden characters`, () => {
      const lines = text.split("\n");
      const bad = lines
        .map((line, i) => ({ line: i + 1, hit: HIDDEN.exec(line.replace(/\t/g, "")) }))
        .filter((x) => x.hit)
        .map((x) => `line ${x.line}: U+${x.hit![0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
      expect(bad).toEqual([]);
    });
  }
});
