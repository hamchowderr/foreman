import Link from "next/link";
import { AuthTerminal } from "./auth-terminal";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#09090b] relative overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,74,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,74,0,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Bottom glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 110%, rgba(255,74,0,0.12) 0%, transparent 70%)",
          }}
        />
        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
            <img
              alt="Foreman"
              className="h-7 w-7 object-contain"
              height={28}
              src="/zapier.svg"
              width={28}
            />
            <span className="text-white text-[15px] font-semibold tracking-tight">Foreman</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white leading-tight">
              Your Zapier.
              <br />
              <span className="text-[#ff4a00]">On autopilot.</span>
            </h1>
            <p className="text-[#71717a] text-sm leading-relaxed max-w-xs">
              Tell Foreman what to do in plain English. It handles your Zapier workflows so you
              don&apos;t have to.
            </p>
          </div>

          <AuthTerminal />
        </div>

        {/* Status */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#52525b] text-xs font-mono">systems operational</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md space-y-8 px-4">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
            <img
              alt="Foreman"
              className="h-6 w-6 object-contain"
              height={24}
              src="/zapier.svg"
              width={24}
            />
            <span className="text-foreground text-sm font-semibold tracking-tight">Foreman</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
