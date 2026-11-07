"use client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import TabList from "./tabs";
import SettingsTab from "./tabs/settings-tab";
import ComponentsTab from "./tabs/components-tab";
import LayersTab from "./tabs/layers-tab";
import AiTab from "./tabs/ai/ai-tab";
import { useAiChat } from "./tabs/ai/use-ai-chat";

const FunnelEditorSidebar = () => {
  const { state } = useEditor();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("Components");
  // Elements added from the Components tab get selected; don't yank the user
  // away from the tab they're adding from.
  const suppressSwitch = useRef(false);
  // Lives here (not in the tab) so a running request and the conversation
  // survive switching tabs.
  const aiChat = useAiChat();

  useEffect(() => {
    if (suppressSwitch.current) {
      suppressSwitch.current = false;
      return;
    }
    if (state.editor.selectedElement.id && tab === "Components") {
      setTab("Settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.editor.selectedElement.id]);

  useEffect(() => {
    setSheetOpen(true);
  }, []);

  const header = (title: string, description: string) => (
    <SheetHeader className="p-6 pb-4 pt-0 text-left">
      <SheetTitle>{title}</SheetTitle>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet open={sheetOpen} modal={false}>
      <Tabs className="w-full" value={tab} onValueChange={setTab}>
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "z-[80] mt-[97px] w-16 overflow-hidden p-0 shadow-none transition-all focus:border-none",
            { hidden: state.editor.previewMode }
          )}
        >
          <TabList />
        </SheetContent>
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "z-[40] mr-16 mt-[97px] h-full w-80 overflow-hidden bg-background p-0 shadow-none transition-all",
            { hidden: state.editor.previewMode }
          )}
        >
          <TabsContent
            value="AI"
            className="mt-0 h-[calc(100vh-97px)] pt-6 focus-visible:ring-0"
          >
            <AiTab chat={aiChat} />
          </TabsContent>
          <div
            className={clsx("no-scrollbar h-full overflow-y-auto pb-36 pt-6", {
              hidden: tab === "AI",
            })}
          >
            <TabsContent value="Settings" className="mt-0">
              {header("Styles", "Fine-tune content, typography, colors and layout.")}
              <SettingsTab />
            </TabsContent>
            <TabsContent value="Components" className="mt-0 focus-visible:ring-0">
              {header("Components", "Drag onto the canvas, or click to add.")}
              <ComponentsTab onAdd={() => (suppressSwitch.current = true)} />
            </TabsContent>
            <TabsContent value="Layers" className="mt-0">
              {header("Layers", "The structure of your page. Click to select.")}
              <LayersTab />
            </TabsContent>
          </div>
        </SheetContent>
      </Tabs>
    </Sheet>
  );
};

export default FunnelEditorSidebar;
