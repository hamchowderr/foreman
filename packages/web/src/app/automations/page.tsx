import Link from "next/link";
import { redirect } from "next/navigation";
import { AutomationsManager } from "@/components/automations/automations-manager";
import { createClient } from "@/lib/server";

export default async function AutomationsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link className="text-muted-foreground text-sm hover:text-foreground" href="/">
        ← Back
      </Link>
      <h1 className="mt-3 mb-1 font-semibold text-2xl">Automations</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Durable automations shared across your workspace. Ask Foreman in chat to create one; manage,
        run, and inspect them here.
      </p>
      <AutomationsManager />
    </main>
  );
}
