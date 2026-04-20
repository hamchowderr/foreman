import "./docs.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <div className="bg-gradient-to-r from-accent/80 via-accent to-orange-500 text-white text-center text-xs sm:text-sm py-2 px-4 font-medium">
        Foreman is in alpha — self-hostable today, cloud in beta.
      </div>
      <DocsLayout
        tree={source.pageTree}
        githubUrl="https://github.com/hamchowderr/foreman"
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
