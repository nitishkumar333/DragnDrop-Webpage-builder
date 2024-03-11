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
import React, { useEffect, useState } from "react";
import TabList from "./tabs";
import SettingsTab from "./tabs/settings-tab";
import ComponentsTab from "./tabs/components-tab";

const FunnelEditorSidebar = () => {
  const { state, dispatch } = useEditor();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("Components");

  const onTabChange = (value: string) => {
    setTab(value);
  };
  useEffect(() => {
    setTab("Settings");
  }, [state.editor.selectedElement.id]);
  useEffect(() => {
    setSheetOpen(true);
  }, []);

  return (
    <Sheet open={sheetOpen} modal={false}>
      <Tabs className="w-full" value={tab} onValueChange={onTabChange}>
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "mt-[97px] w-16 z-[80] shadow-none  p-0 focus:border-none transition-all overflow-hidden",
            { hidden: state.editor.previewMode }
          )}
        >
          <TabList />
        </SheetContent>
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "mt-[97px] w-80 z-[40] shadow-none p-0 mr-16 bg-background h-full transition-all overflow-hidden ",
            { hidden: state.editor.previewMode }
          )}
        >
          <div className="h-full pb-36 overflow-scroll no-scrollbar">
            <TabsContent value="Settings">
              <SheetHeader className="text-left p-6 pt-0">
                <SheetTitle>Styles</SheetTitle>
                <SheetDescription>
                  Show your creativity! You can customize every component as you
                  like.
                </SheetDescription>
              </SheetHeader>
              <SettingsTab />
            </TabsContent>
            <TabsContent value="Components" className="focus-visible:ring-0">
              <SheetHeader className="text-left p-6 pt-0">
                <SheetTitle>Components</SheetTitle>
                <SheetDescription>
                  You can drag and drop components on the canvas
                </SheetDescription>
              </SheetHeader>
              <ComponentsTab />
            </TabsContent>
          </div>
        </SheetContent>
      </Tabs>
    </Sheet>
  );
};

export default FunnelEditorSidebar;
