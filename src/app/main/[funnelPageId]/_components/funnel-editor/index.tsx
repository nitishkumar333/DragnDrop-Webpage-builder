"use client";
import { Button } from "@/components/ui/button";
import { FONT_OPTIONS, googleFamilyFor, googleFontsHref } from "@/lib/design-tokens";
import { walkElements } from "@/lib/editor-tree";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import { EyeOff } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import Recursive from "./funnel-editor-components/recursive";

type Props = { funnelPageId: string; liveMode?: boolean };

const parseContent = (content: unknown): EditorElement[] => {
  if (!content || typeof content !== "string") return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Injects Google Fonts used on the page. While editing, every curated font is
 * loaded so the font picker can preview them.
 */
const FontLoader = ({ elements, all }: { elements: EditorElement[]; all: boolean }) => {
  const href = useMemo(() => {
    const families = new Set<string>();
    if (all) {
      FONT_OPTIONS.forEach((f) => f.google && families.add(f.google));
    } else {
      walkElements(elements, (el) => {
        const family = googleFamilyFor(el.styles.fontFamily);
        if (family) families.add(family);
      });
    }
    return googleFontsHref(Array.from(families).sort());
  }, [elements, all]);

  // eslint-disable-next-line @next/next/no-page-custom-font
  return href ? <link rel="stylesheet" href={href} /> : null;
};

const FunnelEditor = ({ funnelPageId, liveMode }: Props) => {
  const { dispatch, state, pageDetails } = useEditor();
  const { editor } = state;

  useEffect(() => {
    const load = (content: unknown) =>
      dispatch({
        type: "LOAD_DATA",
        payload: { elements: parseContent(content), withLive: !!liveMode },
      });

    // The page route already fetched the details server-side – reuse them.
    if (pageDetails?.id === funnelPageId) {
      load(pageDetails.content);
      return;
    }

    const fetchData = async () => {
      const result = await fetch(
        `${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/${funnelPageId}`
      );
      const response = await result.json();
      if (response) load(response.content);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelPageId]);

  // Clear the drop highlight whenever a drag ends anywhere.
  useEffect(() => {
    const clear = () => dispatch({ type: "SET_DROP_TARGET", payload: { id: null } });
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [dispatch]);

  const handleClick = () => {
    if (editor.liveMode) return;
    dispatch({ type: "CHANGE_CLICKED_ELEMENT", payload: {} });
  };

  const handleUnpreview = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
  };

  const isPreviewing = editor.previewMode || editor.liveMode;

  return (
    <div
      className={clsx(
        "use-automation-zoom-in h-full bg-white text-left text-slate-900 transition-all [color-scheme:light]",
        {
          "mr-[385px] rounded-md shadow-2xl ring-1 ring-black/5": !isPreviewing,
          "!mr-0": isPreviewing,
          "!w-[850px]": editor.device === "Tablet" && !liveMode,
          "!w-[420px]": editor.device === "Mobile" && !liveMode,
          "w-full": editor.device === "Desktop" || liveMode,
        }
      )}
      onClick={handleClick}
    >
      <FontLoader elements={editor.elements} all={!liveMode} />
      {editor.previewMode && editor.liveMode && (
        <Button
          variant={"secondary"}
          size={"sm"}
          className="fixed left-3 top-3 z-[100] gap-2 shadow-lg"
          onClick={handleUnpreview}
        >
          <EyeOff size={16} /> Exit preview
        </Button>
      )}
      {editor.elements.map((childElement) => (
        <Recursive key={childElement.id} element={childElement} />
      ))}
    </div>
  );
};

export default FunnelEditor;
