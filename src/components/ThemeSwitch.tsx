import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

// Only these three values are ever read back from storage. Anything else
// (tampered or stale) falls back to "system".
function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** Follows the device by default. public/theme-init.js applies the same rule before first paint. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    };
    apply();
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch { /* storage blocked: still works, just not remembered */ }
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const choices = [
    { id: "system", label: "Match device", Icon: Monitor },
    { id: "light", label: "Light", Icon: Sun },
    { id: "dark", label: "Dark", Icon: Moon },
  ] as const;
  return (
    <div role="group" aria-label="Colour theme" className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {choices.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={theme === id}
          aria-label={label}
          title={label}
          onClick={() => setTheme(id)}
          className="grid size-9 place-items-center rounded-full text-muted-2 hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
