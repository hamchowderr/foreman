"use client";

import Link from "next/link";

export function WorkflowsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col" style={{ backgroundColor: "#FFFDF9" }}>
      <div
        className="flex items-center gap-4 px-8 py-4"
        style={{ borderBottom: "1px solid #FFF3E6" }}
      >
        <Link href="/chat" className="flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white text-sm font-bold"
            style={{ backgroundColor: "#FF4F00" }}
          >
            F
          </span>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "#201515" }}>
            Foreman
          </span>
        </Link>
        <span className="text-sm" style={{ color: "#FFBF6E" }}>
          /
        </span>
        <Link
          href="/workflows"
          className="text-sm font-medium hover:underline"
          style={{ color: "#201515" }}
        >
          Workflows
        </Link>
      </div>
      <main className="flex-1 px-10 py-8 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
