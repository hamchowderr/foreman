/**
 * Fallback-avatar helpers (foreman-3f1v). When a user/member has no avatar
 * image, we render initials on a deterministic per-identity gradient so the
 * same person always gets the same tint. The gradient formula matches the
 * one the user-nav circle used before the Avatar primitive was wired in.
 */

/** Deterministic hue (0-359) from a seed string (email/name/id). */
export function seedToHue(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** CSS `background` for a fallback avatar, tinted by the seed. */
export function seedToGradient(seed: string): string {
  const hue = seedToHue(seed);
  return `linear-gradient(135deg, oklch(0.35 0.08 ${hue}), oklch(0.25 0.05 ${hue + 40}))`;
}

/** Up to two uppercase initials from an email or display name. */
export function initialsFrom(value: string): string {
  const base = value.includes("@") ? (value.split("@")[0] ?? "") : value;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return chars.toUpperCase() || "?";
}
