import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspacesManager } from "@/components/workspaces/workspaces-manager";
import { createClient } from "@/lib/server";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link className="text-muted-foreground text-sm hover:text-foreground" href="/">
        ← Back
      </Link>
      <h1 className="mt-3 mb-1 font-semibold text-2xl">Workspaces</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Manage your workspaces, members, invitations, and connection settings.
      </p>
      <WorkspacesManager />
    </main>
  );
}
