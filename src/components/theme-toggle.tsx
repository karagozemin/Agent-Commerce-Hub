"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (
    typeof window !== "undefined" && window.localStorage.getItem("ach-theme") === "light" ? "light" : "dark"
  ));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function choose(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("ach-theme", nextTheme);
  }

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
