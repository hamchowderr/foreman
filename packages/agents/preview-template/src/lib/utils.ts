import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Canonical shadcn `cn` helper. The web app's lib/utils.ts is a superset that
// also pulls in chat/db/ai concerns the shadcn components never use — only `cn`
// is needed here, so the preview template keeps a minimal, self-contained copy.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
