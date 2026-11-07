import EditorProvider from "@/providers/editor/editor-provider";
import FunnelEditor from "@/app/main/[funnelPageId]/_components/funnel-editor";
import dbConnect from "@/lib/dbConnect";
import funnelPage from "@/lib/funnelPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React, { cache } from "react";

type Props = { params: { funnelPageId: string } };

export const dynamic = "force-dynamic";

/** Load the saved page straight from the database (deduped per request). */
const getPage = cache(async (id: string) => {
  await dbConnect();
  const page = await funnelPage
    .findOne({ id }, "id name content -_id")
    .lean<{ id: string; name: string; content: string | null }>();
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
