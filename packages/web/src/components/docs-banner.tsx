"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "nd-banner-foreman-alpha";
const HEIGHT = "3rem";
const RAINBOW = [
  "rgba(0,149,255,0.56)",
  "rgba(231,77,255,0.77)",
  "rgba(255,0,0,0.73)",
  "rgba(131,255,166,0.66)",
];

export function DocsBanner() {
  // Start closed to prevent a flash before we've read localStorage; flip to
  // open after mount if the user hasn't dismissed yet. Trade-off: the banner
  // pops in slightly after hydration, but there's no dismiss-flash.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const bgImage = `repeating-linear-gradient(70deg, ${[...RAINBOW, RAINBOW[0]]
    .map((c, i) => `${c} ${(i * 50) / RAINBOW.length}%`)
    .join(", ")})`;

  return (
    <div
      className="sticky top-0 z-40 flex flex-row items-center justify-center px-4 text-center text-sm font-medium bg-fd-background"
      style={{ height: HEIGHT, ["--fd-banner-height" as string]: HEIGHT }}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          maskImage:
            "linear-gradient(to bottom,white,transparent), radial-gradient(circle at top center, white, transparent)",
          maskComposite: "intersect",
          animation: "fd-moving-banner 20s linear infinite",
          backgroundImage: bgImage,
          backgroundSize: "200% 100%",
          filter: "saturate(2)",
        }}
      />
      Foreman is in alpha — self-hostable today, cloud in beta.
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={() => {
          setOpen(false);
          localStorage.setItem(STORAGE_KEY, "true");
        }}
        className="absolute end-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-fd-muted-foreground/60 hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <style>{`@keyframes fd-moving-banner { from { background-position: 0% 0; } to { background-position: 100% 0; } }`}</style>
    </div>
  );
}
