import { redirect } from "next/navigation";
import { DocumentsBrowser } from "@/components/documents/documents-browser";
import { createClient } from "@/lib/server";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 font-semibold text-2xl tracking-tight">Documents</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Knowledge documents in your active workspace. Shared docs are visible to your whole team;
        private docs are only yours. Ask Foreman in a chat to create or edit them.
      </p>
      <DocumentsBrowser />
    </main>
  );
}
