# Tag Picker

A skills picker for a profile page. It helps you choose and order your skills within a 100-character limit, and it never adds or loses a tag without you meaning it to.

**Live demo:** [VERCEL_LINK](https://tag-picker-vu6h.vercel.app)  
**What I changed and why:** [NOTE.md](./NOTE.md)

## Run it

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev       # open http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app. Add `-- --host` to open it on your phone over the same Wi-Fi. |
| `npm test` | Runs 47 tests: tag logic, hostile input, and a hidden-character check on the source files. |
| `npm run build` | Type check and production build, with a strict Content Security Policy. |
| `npm run preview` | Serves that build with the full security headers. |

## What's inside

- **Search that picks what you see.** ↑/↓ and Enter choose the highlighted match. Making your own tag is a separate "Add as your own" row, so half-typed words never become junk tags.
- **Your order is kept.** Drag with a mouse, press and hold on a phone, or use Shift+←/→. The first 4 tags are marked as the ones shown on the profile card.
- **The limit as a ruler.** Each tag is a segment as long as its name, so you can see what is using the space.
- **Undo for every removal**, a paste-a-list shortcut, grouped browsing, and suggestions that explain themselves.
- **Secure by default.** Input is cleaned (invisible, reversed and look-alike characters, spreadsheet formulas), custom tags only allow safe characters, `sanitizeTagList` lets the server re-check everything, and the build has a strict CSP and security headers. It also fixes a crash where typing "constructor" as a tag blanked the page.
- **Works on phone and desktop**, with keyboard and screen-reader support and no axe accessibility issues in light or dark mode.

## Project layout

```
src/lib/tags.ts         logic and security, no React (unit tested)
src/TagPicker/          the component: TagPicker, SuggestionList, BudgetRuler, BrowsePanel, useChipDrag
src/components/         ProfileCard, ThemeSwitch (the demo page)
public/theme-init.js    sets the theme before first paint, outside the HTML so the CSP can stay strict
vite.config.ts          CSP for builds, security headers for dev and preview
vercel.json             the same headers on Vercel
```

Built with React 19, TypeScript, Vite and Tailwind CSS 4.

---

<details>
<summary>The original brief</summary>

Make this tag picker better.

- Change the look, the feel, or how it works. It is up to you.
- Add anything you think a great tag picker needs.
- Keep it working on a phone and on a computer.

Send back the code (without `node_modules`) and a `NOTE.md` covering what you changed, why, and what you would do with more time. It must still run with `npm install` and `npm run dev`.

</details>
