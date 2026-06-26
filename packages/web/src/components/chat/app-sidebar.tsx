"use client";

import {
  InboxIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PanelLeftIcon,
  PenSquareIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarHistory } from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import type { SessionUser as User } from "@/lib/auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const NAV: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/automations", label: "Automations", Icon: ZapIcon },
  { href: "/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/dashboards", label: "Dashboards", Icon: LayoutDashboardIcon },
  { href: "/workspaces", label: "Workspaces", Icon: UsersIcon },
];

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0 pt-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row items-center justify-between">
            <div className="group/logo relative flex items-center justify-center">
              <SidebarMenuButton
                asChild
                className="size-8 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                tooltip="Foreman"
              >
                <Link href="/" onClick={() => setOpenMobile(false)}>
                  {/* biome-ignore lint/performance/noImgElement: small static brand asset, next/image is overkill */}
                  <img
                    alt="Zapier"
                    className="size-5 object-contain group-data-[collapsible=icon]:size-4"
                    height={20}
                    src="/zapier.svg"
                    width={20}
                  />
                </Link>
              </SidebarMenuButton>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                    onClick={() => toggleSidebar()}
                  >
                    <PanelLeftIcon className="size-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent className="hidden md:block" side="right">
                  Open sidebar
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-8 rounded-lg text-[13px] font-medium text-sidebar-foreground/80 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/chat");
                  }}
                  tooltip="New Chat"
                >
                  <PenSquareIcon className="size-4" />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user &&
                NAV.map(({ href, label, Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(href)}
                      className="h-8 rounded-lg text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                      tooltip={label}
                    >
                      <Link href={href} onClick={() => setOpenMobile(false)}>
                        <Icon className="size-4" />
                        <span className="text-[13px]">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-2 pb-5">
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
