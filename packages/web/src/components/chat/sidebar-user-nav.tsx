"use client";

import { Check, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/auth";
import { createClient } from "@/lib/client";
import { applyThemePreset, getStoredThemePreset, THEME_PRESETS } from "@/lib/theme-presets";

function emailToHue(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SidebarUserNav({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [preset, setPreset] = useState("default");

  useEffect(() => {
    setPreset(getStoredThemePreset());
  }, []);

  const handleSelectPreset = (value: string) => {
    applyThemePreset(value);
    setPreset(value);
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-8 px-2 rounded-lg bg-transparent text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="user-nav-button"
            >
              <div
                className="size-5 shrink-0 rounded-full ring-1 ring-sidebar-border/50"
                style={{
                  background: `linear-gradient(135deg, oklch(0.35 0.08 ${emailToHue(user.email ?? "")}), oklch(0.25 0.05 ${emailToHue(user.email ?? "") + 40}))`,
                }}
              />
              <span className="truncate text-[13px]" data-testid="user-email">
                {user?.email}
              </span>
              <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width) rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-[var(--shadow-float)]"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              data-testid="user-nav-item-theme"
              onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-[13px]" data-testid="user-nav-item-preset">
                Color theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl">
                {THEME_PRESETS.map((p) => (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-[13px]"
                    key={p.value}
                    onSelect={() => handleSelectPreset(p.value)}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-border/60"
                      style={{ background: p.swatch }}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {preset === p.value && <Check className="size-3.5 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              data-testid="user-nav-item-auth"
              onSelect={handleSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
