import { source } from "@/lib/source";
import { getLastModified } from "@/lib/git-last-modified";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { useMDXComponents } from "@/mdx-components";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const mdxComponents = useMDXComponents();

  const relPath = `packages/web/content/docs/${page.path}`;
  const lastUpdate = getLastModified(relPath);

  return (
    <DocsPage
      toc={page.data.toc}
      lastUpdate={lastUpdate}
      editOnGithub={{
        owner: "hamchowderr",
        repo: "foreman",
        sha: "main",
        path: relPath,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return {};
  const ogImage = `/docs-og/${[...(slug ?? []), "image.png"].join("/")}`;
  return {
    title: `${page.data.title} · Foreman docs`,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: [ogImage],
    },
  };
}
