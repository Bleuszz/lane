export type LaneTheme = "light" | "dark" | "system";

export const THEME_KEY = "lane-theme";

export function readTheme(): LaneTheme {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolvedTheme(theme: LaneTheme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: LaneTheme) {
  if (typeof document === "undefined") return;
  const resolved = resolvedTheme(theme);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#161411" : "#1A4A3C");
}

export function persistTheme(theme: LaneTheme) {
  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("lane-theme", { detail: theme }));
}
