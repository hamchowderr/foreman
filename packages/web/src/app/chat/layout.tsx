import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { DevConsolePanel } from "@/components/chat/dev-console";
import { ChatShell } from "@/components/chat/shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { DevConsoleProvider } from "@/hooks/use-dev-console";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DevConsoleProvider>
        <DataStreamProvider>
          <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
            <SidebarShell>{children}</SidebarShell>
          </Suspense>
        </DataStreamProvider>
        <DevConsolePanel />
      </DevConsoleProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([currentUser(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  const sidebarUser = user
    ? {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        image: user.imageUrl,
      }
    : undefined;

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        <Suspense fallback={<div className="flex h-dvh" />}>
          <ActiveChatProvider>
            <ChatShell />
          </ActiveChatProvider>
        </Suspense>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
