// Runs before first paint so dark-mode users never see a white flash.
// A separate file (not an inline <script>) so the Content Security Policy can
// stay strict: script-src 'self' with no 'unsafe-inline'.
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {
    /* storage blocked: fall back to light */
  }
})();
