import "./docs.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { DocsBanner } from "@/components/docs-banner";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        SearchDialog: DefaultSearchDialog,
      }}
    >
      <DocsBanner />
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
        githubUrl="https://github.com/hamchowderr/foreman"
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
