import Link from "next/link";

/**
 * Shared app brand header: the Zapier mark + "Foreman" wordmark, with an
 * optional breadcrumb segment. Matches the chat sidebar's brand mark
 * (`/zapier.svg`) so branding stays consistent across the app.
 */
export function BrandHeader({ label }: { label?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-4 border-b border-border px-6 py-4 sm:px-8">
      <Link className="flex items-center gap-2.5" href="/chat">
        {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
        <img alt="Zapier" className="size-5" height={20} src="/zapier.svg" width={20} />
        <span className="text-sm font-semibold tracking-tight text-foreground">Foreman</span>
      </Link>
      {label != null && (
        <>
          <span className="text-sm text-muted-foreground">/</span>
          {label}
        </>
      )}
    </header>
  );
}
