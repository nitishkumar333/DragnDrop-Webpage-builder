"use client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceTypes, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import {
  ArrowLeftCircle,
  ExternalLink,
  EyeIcon,
  Laptop,
  Loader2,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

type Props = {
  funnelId: string;
  funnelPageDetails: any;
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
};

const FunnelEditorNavigation = ({ funnelPageDetails }: Props) => {
  const { state, dispatch } = useEditor();
  const { theme, setTheme } = useTheme();
  const [isChecked, setChecked] = useState(theme !== "light");
  const [saving, setSaving] = useState(false);
  const isDirty = state.editor.elements !== state.savedElements;

  useEffect(() => {
    setTheme(isChecked ? "dark" : "light");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecked]);

  useEffect(() => {
    dispatch({
      type: "SET_FUNNELPAGE_ID",
      payload: { funnelPageId: funnelPageDetails?.id },
    });
  }, [funnelPageDetails, dispatch]);

  const handlePreviewClick = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
  };

  const handleOnSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/${funnelPageDetails.id}`,
        {
          method: "POST",
          body: JSON.stringify(state.editor.elements),
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      dispatch({ type: "MARK_SAVED" });
      toast("Saved", { description: "Your page is up to date." });
    } catch (error) {
      toast("Oops!", { description: "Something went wrong while saving." });
    } finally {
      setSaving(false);
    }
  }, [saving, funnelPageDetails?.id, state.editor.elements, dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "s") {
        e.preventDefault();
        handleOnSave();
        return;
      }
      if (isTypingTarget(e.target) || state.editor.previewMode) return;

      const selected = state.editor.selectedElement;
      const canEditSelection = !!selected.id && selected.type !== "__body";

      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if (mod && key === "d" && canEditSelection) {
        e.preventDefault();
        dispatch({ type: "DUPLICATE_ELEMENT", payload: { elementId: selected.id } });
      } else if ((key === "delete" || key === "backspace") && canEditSelection) {
        e.preventDefault();
        dispatch({ type: "DELETE_ELEMENT", payload: { elementDetails: selected } });
      } else if (e.altKey && (key === "arrowup" || key === "arrowdown") && canEditSelection) {
        e.preventDefault();
        dispatch({
          type: "SHIFT_ELEMENT",
          payload: { elementId: selected.id, direction: key === "arrowup" ? -1 : 1 },
        });
      } else if (key === "escape") {
        dispatch({ type: "CHANGE_CLICKED_ELEMENT", payload: {} });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.editor.selectedElement, state.editor.previewMode, dispatch, handleOnSave]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  return (
    <nav
      className={clsx(
        "flex items-center justify-between gap-2 border-b-[1px] border-gray-200 pb-2 pl-4 pr-4 pt-2 transition-all dark:border-gray-700 dark:bg-gray-900",
        { "!h-0 !overflow-hidden !p-0": state.editor.previewMode }
      )}
    >
      <aside className="flex w-[300px] max-w-[260px] items-center gap-4">
        <Link href={`/main`} title="Back to pages">
          <ArrowLeftCircle />
        </Link>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg leading-tight">{funnelPageDetails?.name}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                isDirty ? "bg-amber-400" : "bg-emerald-500"
              )}
            />
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
      </aside>
      <aside>
        <Tabs
          className="w-fit"
          value={state.editor.device}
          onValueChange={(value) => {
            dispatch({
              type: "CHANGE_DEVICE",
              payload: { device: value as DeviceTypes },
            });
          }}
        >
          <TabsList className="flex h-fit w-full bg-transparent">
            <TabsTrigger value="Desktop" title="Desktop" className="h-10 w-10 p-0 data-[state=active]:bg-muted">
              <Laptop />
            </TabsTrigger>
            <TabsTrigger value="Tablet" title="Tablet" className="h-10 w-10 p-0 data-[state=active]:bg-muted">
              <Tablet />
            </TabsTrigger>
            <TabsTrigger value="Mobile" title="Mobile" className="h-10 w-10 p-0 data-[state=active]:bg-muted">
              <Smartphone />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </aside>
      <aside className="flex items-center gap-2">
        <Button
          variant={"ghost"}
          size={"icon"}
          title="Preview"
          className="hover:bg-slate-800"
          onClick={handlePreviewClick}
        >
          <EyeIcon />
        </Button>
        <Button
          disabled={!(state.history.currentIndex > 0)}
          onClick={() => dispatch({ type: "UNDO" })}
          variant={"ghost"}
          size={"icon"}
          title="Undo (Ctrl+Z)"
          className="hover:bg-slate-800"
        >
          <Undo2 />
        </Button>
        <Button
          disabled={!(state.history.currentIndex < state.history.history.length - 1)}
          onClick={() => dispatch({ type: "REDO" })}
          variant={"ghost"}
          size={"icon"}
          title="Redo (Ctrl+Shift+Z)"
          className="mr-2 hover:bg-slate-800"
        >
          <Redo2 />
        </Button>
        <div className="mr-2 flex items-center gap-2 text-sm">
          Dark
          <Switch checked={isChecked} onCheckedChange={setChecked} />
        </div>
        <Button variant="outline" asChild title="Open the saved version of this page">
          <a href={`/site/${funnelPageDetails?.id}`} target="_blank" rel="noopener noreferrer">
            View site <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        <Button onClick={handleOnSave} disabled={saving} title="Save (Ctrl+S)">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </aside>
    </nav>
  );
};

export default FunnelEditorNavigation;
