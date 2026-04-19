import "./docs.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: (
            <span className="flex items-center gap-2 font-semibold">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[--accent,#ff4a00] text-white text-[10px] font-bold">
                F
              </span>
              Foreman docs
            </span>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
