import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { createClient } from "@/lib/server";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

async function OnboardingContent({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; zapier_connected?: string; uses?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const params = await searchParams;
  const returningFromOAuth = params.zapier_connected === "true";

  if (!returningFromOAuth && !params.step) {
    try {
      const res = await fetch(`${AGENT_URL}/zapier/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const { connected } = await res.json();
        if (connected) redirect("/chat");
      }
    } catch {}
  }

  return (
    <OnboardingFlow
      initialStep={params.step ? parseInt(params.step, 10) : 0}
      initialUses={params.uses || ""}
      zapierJustConnected={returningFromOAuth}
    />
  );
}

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; zapier_connected?: string; uses?: string }>;
}) {
  return (
    <Suspense>
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}
