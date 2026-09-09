import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, persistTheme, readTheme, type LaneTheme } from "@/lib/theme";
import { Button } from "@/components/ui";

export function ThemeToggle() {
  const [theme, setTheme] = useState<LaneTheme>("dark");
  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
  }, []);
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        persistTheme(next);
      }}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
    </Button>
  );
}
