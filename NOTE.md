# NOTE

```bash
npm install
npm run dev       # the app
npm test          # 47 unit tests: tag logic, security, source-file check
npm run build     # type check + production build (with the security policy)
npm run preview   # serve that build with full security headers
```

## How I approached it

I used the original picker on a laptop and a phone, tried to break it, and wrote down every surprise. Almost every problem broke trust in the same way: **the picker added tags I didn't mean, lost tags I did mean, or didn't explain why.** One input crashed the whole page.

So I worked to four rules:

1. **Never add a tag the person didn't clearly choose.**
2. **Never lose a tag without a way back.**
3. **Always explain what happened**, especially at the character limit.
4. **Treat everything typed or pasted as untrusted.**

Then I asked what the tags are *for*. They're skills on a profile, and a profile card can only show a few. That is why order matters, and it led to the main design idea below.

---

## 1. Bugs I found and fixed

| Before | After | Why |
|---|---|---|
| Typing the custom tag **`constructor`** or **`__proto__`** **blanked the whole page.** The recommendation lookup read `related[key]` from a plain object, found `Object.prototype` members, and crashed. | The lookup checks that the key really belongs to the map (`Object.hasOwn`). A regression test types every risky key. | One word shouldn't be able to take down the page. |
| Typing `reac` and pressing **Enter** added a junk tag **"reac"**, even while "React Native" was showing as a suggestion. | The suggestions are a real list. The first match is highlighted, ↑/↓ move, and Enter picks the highlighted row. Making your own tag is a separate **Add "…" as your own** row, listed last. | Enter should pick what you can see. |
| Clicking away after typing `fig` added **"fig"** as a tag. | Leaving the field never adds anything. A line says *"fig" is not added yet. Add it*. | A half-typed word isn't a decision. |
| Backspace in the empty box **deleted the last tag right away**. | The first Backspace selects the tag and the second removes it. Every removal (and **Clear all**) gets **Undo**, plus Ctrl/⌘+Z. | Accidental deletes had no way back. |
| Tags **re-sorted alphabetically** after every change, so a new tag jumped to a random spot. | Your order is kept. Drag to reorder with a mouse, press and hold on a phone, or use Shift+←/→ on a keyboard. | People lead with their strongest skill. |
| Typing a comma did nothing until Enter. | Each comma turns what you typed into a tag. I read it from the text, not the key, because Android keyboards often don't report a comma key. | Typing a list works the same on phones. |
| Blue chip text had **3.8:1** contrast (the minimum is 4.5:1). | All text passes. axe finds **0 issues** in light and dark mode, with the list open and with the limit full. | Readability. |

## 2. Security

A tag picker looks harmless, but it takes free text from users and sends it to a server that stores it, displays it to other people, and may export it. So I treated input as untrusted at every step.

**Input cleaning** (`cleanTagText` in `src/lib/tags.ts`, used for typing, pasting, the "Add as your own" row and the server check):
- **Invisible and direction-changing characters are removed.** For example, a zero-width space makes `Fig\u200Bma` look identical to "Figma". The right-to-left override `U+202E` makes stored text *display* reversed, a spoofing trick known as "Trojan Source". The joiners that Urdu, Persian, Hindi and emoji need are kept.
- **Unicode NFKC normalisation.** Full-width `Ｆｉｇｍａ` becomes `Figma`, so it's recognised as a duplicate instead of becoming a second "Figma".
- **Look-alike letters are folded when comparing.** `Figmа` written with a Cyrillic "а" counts as Figma, so a fake copy can't sit next to the real one.
- **Spreadsheet formula injection is blocked.** Leading `= + - @` characters are stripped. A tag like `=HYPERLINK(...)` would otherwise run as a formula when an admin exports profiles to CSV.
- **Custom tags use an allowlist, not a blocklist.** Allowed: letters and numbers in any language, emoji, spaces, and `. + # & / ' ( ) -`. That covers C++, C#, .NET, UI/UX and اردو. Anything else (`< > " : = ;` and backticks) is refused with a clear message, so a tag stays harmless even if another system later puts it into HTML or a URL without escaping it. React already escapes text, and there is no `dangerouslySetInnerHTML` anywhere.
- **Size caps:** 30 characters per tag (counted in real characters, so an emoji counts as 1 and is never cut in half), 50 tags at most, and at most 5,000 characters or 100 items read from one paste, so a huge paste can't freeze the tab.

**The server must check too.** The browser isn't a security boundary: a request can skip the page entirely. So the rules live in one pure function, **`sanitizeTagList(input, rules)`**, that a Node server can import as-is. It accepts the raw form field (or any unknown value) and returns `{ tags, rejected: [{ value, reason }] }`. The demo's Save button runs the submitted field through it, the way a server would.

**Content Security Policy and headers** (`vite.config.ts`):
- The production build gets a strict CSP: `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, with no `unsafe-inline`. To make that possible I moved the theme script out of the HTML into `public/theme-init.js` and bundled the font locally, so the page loads nothing from other sites.
- `npm run preview` and Vercel (`vercel.json`) also send `frame-ancestors 'none'` and `X-Frame-Options: DENY` (against clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, and a `Permissions-Policy` that turns off camera, microphone, location and payment.
- **Checked in a real browser:** normal use triggers **0** policy violations. When I injected a `<script>` and an `<img onerror>` into the live page, **both were blocked**.

**Other:**
- Saved theme values are read from an allowlist, so tampered storage can't inject anything.
- `npm audit`: 0 vulnerabilities. No source maps ship in the build.
- A test fails if any source file contains hidden or direction-changing characters (protecting the code itself from Trojan Source).

## 3. Look and feel: a full redesign

**The idea:** the limit is "100 characters", so I drew it as a **ruler**, like a typesetter's line measure. That is the one bold element. Everything around it stays quiet.

- **Budget ruler.** Each tag is a segment as long as its name, with tick marks every 10 characters. You can see what is using up your space. Custom tags are striped, matching their dashed chips. A black notch marks how much of the budget your profile card shows. The number of characters left is set in the font's narrow width, so it reads like a ruler marking.
- **Featured tags.** The first 4 tags (the ones on your profile card) are solid cobalt, followed by a short divider. The rest are soft. The **live profile card** beside the editor shows exactly what people will see, and "+2 more" makes the point of ordering obvious.
- **Search that explains itself.** Matched letters are marked in **highlighter yellow**. A keyword-only match says why (*SwiftUI: matches "ios"*). Tags you already have say **Added**. Tags that won't fit say *Needs 12, 2 left*. A footer shows the keys (↑ ↓, Enter, comma, Esc).
- **Drag that you can see.** The chip lifts and follows your pointer, a yellow bar shows where it will land, and the list only changes when you let go. On touch, the chip lifts above your finger so you can still see it.
- **Browse tabs.** *For you* comes first and explains itself (*Often added with React and Figma*). *All* and each group are one tap away, with a count of picked tags on each tab. This replaced a small box that scrolled inside the page.
- **Small but deliberate:** a new chip pops in, while a duplicate shakes the chip you already have. Suggestions hold still while you tap through them, so the row doesn't reshuffle under your finger. Custom tags are dashed. Save becomes a bar fixed to the bottom of a phone screen, and there's a **Discard** button.
- **Type and colour.** Instrument Sans with its narrow width for headings and numbers. Ink on cool paper, a deep cobalt, and yellow used only for highlights. The theme defaults to matching the device, with no white flash on load. Text contrast is checked to AA in both themes.

## 4. Phone

- Touch targets are bigger on touch screens (× buttons 32px, tags 40px), based on the pointer type, not the screen width.
- When you tap the field, it scrolls up so the suggestions aren't hidden under the keyboard.
- Press and hold (0.3s) to drag a tag. A normal swipe still scrolls the page.
- The input text is 16px, so iOS doesn't zoom in. The tabs are one swipeable row with a fade at the edge.
- I checked for sideways scrolling at 320, 375, 414, 768, 1024 and 1440px wide: none.

## 5. Accessibility

- The search is a combobox with a listbox (`aria-activedescendant`), so screen readers follow the highlighted row.
- A polite live region reads out adds, removes, moves, limits and errors.
- Chips can be reached and moved by keyboard (←/→, Home/End, Shift+arrow, Backspace/Delete).
- Focus rings are visible everywhere, and animations respect `prefers-reduced-motion`.

## Decisions I made on purpose

- **Comma and Enter do different things.** A comma means "add exactly what I typed" (fast for lists). Enter means "add the highlighted suggestion" (safe for half-typed words).
- **No alphabetical sorting.** It's one line to add back if a product needs it, and taking away the user's order costs more.
- **The list doesn't reorder while you drag.** It looks less "live", but moving elements mid-drag made phones cancel the touch. I found this in testing and changed the design.
- **Custom tags are an allowlist.** This could reject an unusual but valid skill name, and that is the right trade for text other people will see.

## Code

```
src/
  lib/tags.ts            pure logic + security (no React): cleaning, matching, budget,
                         recommendations, sanitizeTagList for the server
  lib/*.test.ts          47 tests, including hostile input and a hidden-character check
  TagPicker/             TagPicker (state), SuggestionList, BudgetRuler, BrowsePanel,
                         useChipDrag (mouse/pen/touch), parts
  components/            ProfileCard, ThemeSwitch
public/theme-init.js     theme before first paint, outside the HTML so the CSP stays strict
vite.config.ts           CSP + security headers
vercel.json              the same headers when deployed on Vercel
```

The `TagPicker` props still work the same way. I added `label`, `noun`, `maxTags`, `featuredCount` and `featuredWhere`. The form value is still one comma-separated string, now in the user's order.

**How I checked it:** I wrote scripted runs in headless Chrome:
- desktop keyboard and mouse flows;
- an emulated phone with real touch events (press-and-hold drag, swipe, fast taps);
- a hostile-input probe;
- CSP checks against the production build;
- axe scans in four states.

## What I would do with more time

1. **Test on real devices with real screen readers** (iOS Safari with VoiceOver, Android Chrome with TalkBack). I've only used emulation.
2. **Move my browser checks into Playwright tests in CI**, so every change re-runs the keyboard, touch, CSP and accessibility checks.
3. **Server side:** call `sanitizeTagList` in the real API, add rate limiting and moderation for custom tags (profanity, impersonation), and decide whether custom tags need review before they are shown publicly.
4. **Smarter matching:** handle typos (`figam` → Figma), synonyms (`JS` → JavaScript), and *"Did you mean Figma?"* before creating a custom tag.
5. **A full-screen bottom-sheet picker on small phones**, so the keyboard and the list never compete for space.
6. **Real data:** server search with loading and error states, popularity from real usage, and a virtualised list for thousands of tags.
7. **Measure** how often people hit the limit, create custom tags, undo or reorder, then tune the design to match.
