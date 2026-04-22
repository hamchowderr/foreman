import { source } from "@/lib/source";
import { generateOGImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // Last segment is `image.png` — strip it before looking up the page.
  const pageSlug = slug.slice(0, -1);
  const page = source.getPage(pageSlug);
  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: "Foreman docs",
    primaryColor: "#ff4a00",
  });
}

export function generateStaticParams() {
  return source.generateParams().map((p) => ({
    slug: [...(p.slug ?? []), "image.png"],
  }));
}
