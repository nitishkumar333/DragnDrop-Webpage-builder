import EditorProvider from "@/providers/editor/editor-provider";
import FunnelEditor from "@/app/main/[funnelPageId]/_components/funnel-editor";
import { apiUrl } from "@/lib/api";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React, { cache } from "react";

type Props = { params: { funnelPageId: string } };

export const dynamic = "force-dynamic";

type SavedPage = { id: string; name: string; content: string | null };

/** Load the saved page from the backend (deduped per request). */
const getPage = cache(async (id: string): Promise<SavedPage | null> => {
  const res = await fetch(apiUrl(`/getFunnel/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load page ${id} (${res.status})`);
  const page = await res.json();
  return page ? { id: page.id, name: page.name, content: page.content } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage(params.funnelPageId);
  return { title: page?.name || "Untitled page" };
}

/** Public, read-only rendering of a saved page. */
const SitePage = async ({ params }: Props) => {
  const page = await getPage(params.funnelPageId);
  if (!page) notFound();

  return (
    <div className="h-full bg-white">
      <EditorProvider funnelId="" pageDetails={page}>
        <FunnelEditor funnelPageId={page.id} liveMode />
      </EditorProvider>
    </div>
  );
};

export default SitePage;
