"use client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeviceTypes, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import {
  ArrowLeftCircle,
  EyeIcon,
  Laptop,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

type Props = {
  funnelId: string;
  funnelPageDetails: any;
};

const FunnelEditorNavigation = ({ funnelId, funnelPageDetails }: Props) => {
  const { state, dispatch } = useEditor();
  const { theme, setTheme } = useTheme();
  const [isChecked, setChecked] = useState(theme === "light" ? false : true);
  useEffect(() => {
    setTheme(isChecked === false ? "light" : "dark");
  }, [isChecked]);
  useEffect(() => {
    dispatch({
      type: "SET_FUNNELPAGE_ID",
      payload: { funnelPageId: funnelPageDetails?.id },
    });
  }, [funnelPageDetails]);

  const handlePreviewClick = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
  };

  const handleUndo = () => {
    dispatch({ type: "UNDO" });
  };

  const handleRedo = () => {
    dispatch({ type: "REDO" });
  };

  const handleOnSave = async () => {
    try {
      await fetch(
        `https://${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/${funnelPageDetails.id}`,
        {
          method: "POST",
          body: JSON.stringify(state.editor.elements),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      toast("Success", {
        description: "Saved Editor",
      });
    } catch (error) {
      toast("Opps!", {
        description: "Something Went Wrong.",
      });
    }
  };

  return (
    <>
      <nav
        className={clsx(
          "border-b-[1px] flex items-center justify-between pt-2 pb-2 pl-4 pr-4 gap-2 transition-all border-gray-200 dark:bg-gray-900 dark:border-gray-700",
          { "!h-0 !p-0 !overflow-hidden": state.editor.previewMode }
        )}
      >
        <aside className="flex items-center gap-4 max-w-[260px] w-[300px]">
          <Link href={`/main`}>
            <ArrowLeftCircle />
          </Link>
          <div className="w-full">
            <span className="h-5 text-lg">{funnelPageDetails?.name}</span>
          </div>
        </aside>
        <aside>
          <Tabs
            defaultValue="Desktop"
            className="w-fit "
            value={state.editor.device}
            onValueChange={(value: any) => {
              dispatch({
                type: "CHANGE_DEVICE",
                payload: { device: value as DeviceTypes },
              });
            }}
          >
            <TabsList className="flex w-full bg-transparent h-fit">
              <TabsTrigger
                value="Desktop"
                className="data-[state=active]:bg-muted w-10 h-10 p-0"
              >
                <Laptop />
              </TabsTrigger>
              <TabsTrigger
                value="Tablet"
                className="w-10 h-10 p-0 data-[state=active]:bg-muted"
              >
                <Tablet />
              </TabsTrigger>
              <TabsTrigger
                value="Mobile"
                className="w-10 h-10 p-0 data-[state=active]:bg-muted"
              >
                <Smartphone />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </aside>
        <aside className="flex items-center gap-2">
          <Button
            variant={"ghost"}
            size={"icon"}
            className="hover:bg-slate-800"
            onClick={handlePreviewClick}
          >
            <EyeIcon />
          </Button>
          <Button
            disabled={!(state.history.currentIndex > 0)}
            onClick={handleUndo}
            variant={"ghost"}
            size={"icon"}
            className="hover:bg-slate-800"
          >
            <Undo2 />
          </Button>
          <Button
            disabled={
              !(state.history.currentIndex < state.history.history.length - 1)
            }
            onClick={handleRedo}
            variant={"ghost"}
            size={"icon"}
            className="hover:bg-slate-800 mr-4"
          >
            <Redo2 />
          </Button>
          <div className="flex flex-col item-center mr-4">
            <div className="flex flex-row items-center gap-4">
              Dark Mode
              <Switch checked={isChecked} onCheckedChange={setChecked} />
            </div>
          </div>
          <Button onClick={handleOnSave}>Save</Button>
        </aside>
      </nav>
    </>
  );
};

export default FunnelEditorNavigation;
