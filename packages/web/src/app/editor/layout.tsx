import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth";
import { EditorShell } from "@/components/editor/editor-shell";

export const metadata = {
  title: "Agent Editor — Foreman",
};

// Auth gate reads Clerk cookies; no point prerendering this route.
export const dynamic = "force-dynamic";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?redirect_url=/editor");
  }

  return (
    <>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border/50",
        }}
      />
      <EditorShell user={{ id: session.user.id, email: session.user.email }}>
        {children}
      </EditorShell>
    </>
  );
}
