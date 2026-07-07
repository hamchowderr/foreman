/**
 * Opt-in color theme presets (ported from myrp-build's shadcn kit).
 * The default (no preset) is Foreman's orange brand. Selecting a preset sets
 * `data-theme-preset` on <html>; the CSS for each lives in globals.css.
 */

export const THEME_PRESET_STORAGE_KEY = "foreman:theme-preset";

export type ThemePreset = {
  name: string;
  /** value written to data-theme-preset; "default" means remove the attribute */
  value: string;
  /** swatch color for the picker */
  swatch: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Foreman (Default)", value: "default", swatch: "#ff4a00" },
  { name: "Underground", value: "underground", swatch: "oklch(0.53 0.15 156.19)" },
  { name: "Rose Garden", value: "rose-garden", swatch: "oklch(0.5827 0.2418 12.23)" },
  { name: "Lake View", value: "lake-view", swatch: "oklch(0.62 0.17 163.22)" },
  { name: "Sunset Glow", value: "sunset-glow", swatch: "oklch(0.5591 0.1882 25.33)" },
  { name: "Forest Whisper", value: "forest-whisper", swatch: "oklch(0.53 0.15 182.22)" },
  { name: "Ocean Breeze", value: "ocean-breeze", swatch: "oklch(0.5461 0.2152 262.88)" },
  { name: "Lavender Dream", value: "lavender-dream", swatch: "oklch(0.5709 0.1808 306.89)" },
];

/** Apply a preset to <html> and persist it. Pass "default" to clear. */
export function applyThemePreset(value: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (value === "default") {
    root.removeAttribute("data-theme-preset");
  } else {
    root.setAttribute("data-theme-preset", value);
  }
  try {
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, value);
  } catch {}
}

export function getStoredThemePreset(): string {
  if (typeof localStorage === "undefined") return "default";
  try {
    return localStorage.getItem(THEME_PRESET_STORAGE_KEY) ?? "default";
  } catch {
    return "default";
  }
}
