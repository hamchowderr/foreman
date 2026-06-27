import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageResponse } from "@/components/ai-elements/message";
import { BrandHeader } from "@/components/brand-header";
import { getPublicDocument } from "@/lib/documents-client";

// Public, logged-out share page for a knowledge document (foreman-jz14). No auth:
// the token in the URL is the capability (validated + expiry-checked by the
// agent's /documents/public/:token endpoint). Fetched no-store so a share always
// reflects the latest saved content of the document.
export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getPublicDocument(token);
  if (!doc) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandHeader label={<span className="text-muted-foreground text-sm">Shared document</span>} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        <article className="prose-sm max-w-none">
          <MessageResponse>{doc.content}</MessageResponse>
        </article>
      </main>

      <footer className="border-border border-t px-6 py-4 text-center text-muted-foreground text-xs sm:px-8">
        Built with{" "}
        <Link className="font-medium hover:underline" href="/">
          Foreman
        </Link>
      </footer>
    </div>
  );
}
