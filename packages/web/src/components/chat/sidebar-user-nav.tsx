"use client";

import { Check, ChevronUp, LogOut, Moon, Palette, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

  const hue = emailToHue(user.email ?? "");

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
                  background: `linear-gradient(135deg, oklch(0.35 0.08 ${hue}), oklch(0.25 0.05 ${hue + 40}))`,
                }}
              />
              <span className="truncate text-[13px]" data-testid="user-email">
                {user?.email}
              </span>
              <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-60 rounded-xl border border-border/60 bg-card/95 p-1.5 backdrop-blur-xl shadow-[var(--shadow-float)]"
            data-testid="user-nav-menu"
            side="top"
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-1.5 font-normal">
              <div
                className="size-7 shrink-0 rounded-full ring-1 ring-sidebar-border/50"
                style={{
                  background: `linear-gradient(135deg, oklch(0.35 0.08 ${hue}), oklch(0.25 0.05 ${hue + 40}))`,
                }}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {user?.email}
                </span>
                <span className="text-[11px] text-muted-foreground">Signed in</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[13px]"
              data-testid="user-nav-item-theme"
              onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "light" ? (
                <Moon className="size-4 text-muted-foreground" />
              ) : (
                <Sun className="size-4 text-muted-foreground" />
              )}
              {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className="gap-2 text-[13px]"
                data-testid="user-nav-item-preset"
              >
                <Palette className="size-4 text-muted-foreground" />
                Color theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl">
                {THEME_PRESETS.map((p) => (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-[13px]"
                    key={p.value}
                    onSelect={() => handleSelectPreset(p.value)}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25"
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
              className="cursor-pointer gap-2 text-[13px] text-destructive focus:text-destructive"
              data-testid="user-nav-item-auth"
              onSelect={handleSignOut}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
