"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (
    typeof window !== "undefined" && window.localStorage.getItem("ach-theme") === "dark" ? "dark" : "light"
  ));
  const transitionTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function choose(nextTheme: Theme) {
    if (nextTheme === theme) return;
    window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.add("theme-changing");
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("ach-theme", nextTheme);
    transitionTimer.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-changing");
    }, 240);
  }

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  return (
    <div className="theme-toggle" aria-label="Choose color theme" suppressHydrationWarning>
      <button type="button" className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => choose("dark")} title="Dark mode">
        <Moon size={14} /> <span>Dark</span>
      </button>
      <button type="button" className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => choose("light")} title="White mode">
        <Sun size={14} /> <span>White</span>
      </button>
    </div>
  );
}
