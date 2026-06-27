import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/server";

/**
 * Shared app shell — the same shadcn sidebar (AppSidebar) the chat uses, wrapped
 * around any authed section (Automations, Inbox, Dashboards, Workspaces, Settings,
 * Editor) so the whole app keeps one persistent sidebar instead of bare pages /
 * one-off headers. Server component: reads the user + persisted collapse state,
 * like the chat layout's SidebarShell.
 *
 * `fullBleed` drops the scrolling content wrapper + top bar so a full-height tool
 * (the agent editor) can fill the inset itself.
 */
export async function AppShell({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  const sidebarUser = user
    ? {
        id: user.id,
        email: user.email ?? "",
        image: user.user_metadata?.avatar_url ?? null,
      }
    : undefined;

  return (
    <TooltipProvider delayDuration={0}>
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
          {fullBleed ? (
            children
          ) : (
            // The sidebar owns the only collapse control (app-sidebar.tsx); this
            // shell no longer renders a redundant top header just to hold a second
            // SidebarTrigger. Pages render their own <main> + title.
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
