import EditorProvider from "@/providers/editor/editor-provider";
import React from "react";
import FunnelEditorNavigation from "./_components/funnel-editor-navigation";
import FunnelEditorSidebar from "./_components/funnel-editor-sidebar";
import FunnelEditor from "./_components/funnel-editor";
import { redirect } from "next/navigation";

type Props = {
  params: {
    funnelId: string;
    funnelPageId: string;
  };
};

const Page = async ({ params }: Props) => {
  const result = await fetch(
    `https://${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/${params.funnelPageId}`,
    { cache: "no-store" }
  );
  const funnelPageDetails = await result.json();
  if (!funnelPageDetails) {
    return redirect("/main");
  }

  return (
    // fixed top-0 bottom-0 left-0 right-0
    <div className="h-full z-[20] bg-background overflow-hidden">
      <EditorProvider
        funnelId={params.funnelId}
        pageDetails={funnelPageDetails}
      >
        <FunnelEditorNavigation
          funnelId={params.funnelId}
          funnelPageDetails={funnelPageDetails}
        />
        <div className="h-full flex justify-center">
          <FunnelEditor funnelPageId={params.funnelPageId} />
        </div>

        <FunnelEditorSidebar />
      </EditorProvider>
    </div>
  );
};

export default Page;
