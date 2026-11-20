import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Content Security Policy. The app loads nothing from other sites (the font is
 * bundled), so everything can be locked to 'self'. No 'unsafe-inline' for
 * scripts or styles: even if someone found a way to inject markup, the browser
 * would refuse to run it. React's style={{ width }} is set through the DOM and
 * is allowed by style-src 'self'.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

/** Headers that only work as real HTTP headers (not <meta>). */
const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

/**
 * Production builds get the CSP as a <meta> tag, so it travels with the HTML
 * to any static host. Dev mode skips it: Vite's hot reload injects an inline
 * script that a strict CSP would (correctly) block.
 */
function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspMeta()],
  server: { headers: HEADERS },
  // `npm run preview` serves the production build with the full policy,
  // including frame-ancestors (clickjacking), which only works as a header.
  preview: { headers: { ...HEADERS, "Content-Security-Policy": `${CSP}; frame-ancestors 'none'` } },
  build: { sourcemap: false },
});
