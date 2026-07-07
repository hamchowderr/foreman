import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SettingsShell } from "@/components/settings/settings-shell";
import { createClient } from "@/lib/server";

async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  return <SettingsShell>{children}</SettingsShell>;
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<SettingsShell>{children}</SettingsShell>}>
        <AuthedLayout>{children}</AuthedLayout>
      </Suspense>
    </AppShell>
  );
}
