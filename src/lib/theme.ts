export type LaneTheme = "light" | "dark";

export const THEME_KEY = "lane-theme";

export function readTheme(): LaneTheme {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" ? "light" : "dark";
}

export function applyTheme(theme: LaneTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0d0d0d" : "#f6f7f9");
}

export function persistTheme(theme: LaneTheme) {
  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
