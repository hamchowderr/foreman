import "./docs.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Banner } from "fumadocs-ui/components/banner";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <Banner variant="rainbow" id="alpha-banner">
        Foreman is in alpha — self-hostable today, cloud in beta.
      </Banner>
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
