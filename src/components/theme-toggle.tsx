import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = localStorage.getItem("fb-theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  return (
    <button
      aria-label="Toggle dark mode"
      className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
      onClick={() => {
        const d = !dark;
        setDark(d);
        localStorage.setItem("fb-theme", d ? "dark" : "light");
        document.documentElement.classList.toggle("dark", d);
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
