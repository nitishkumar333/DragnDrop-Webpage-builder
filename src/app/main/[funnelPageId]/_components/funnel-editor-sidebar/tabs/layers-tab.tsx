"use client";
import { ELEMENT_CATALOG } from "@/lib/element-catalog";
import { cn } from "@/lib/utils";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import { ChevronRight, FileText, Square } from "lucide-react";
import React, { useState } from "react";

const iconFor = (el: EditorElement) => {
  if (el.type === "__body") return FileText;
  return ELEMENT_CATALOG.find((c) => c.id === el.type)?.icon ?? Square;
};

const LayerNode = ({ element, depth }: { element: EditorElement; depth: number }) => {
  const { state, dispatch } = useEditor();
  const [open, setOpen] = useState(depth < 2);
  const children = Array.isArray(element.content) ? element.content : [];
  const isSelected = state.editor.selectedElement.id === element.id;
  const Icon = iconFor(element);

  const select = () => {
    dispatch({ type: "CHANGE_CLICKED_ELEMENT", payload: { elementDetails: element } });
    document
      .querySelector(`[data-element-id="${element.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <li>
      <div
        className={cn(
          "group flex h-8 cursor-pointer items-center gap-1 rounded-md pr-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground",
          isSelected && "bg-primary/15 text-foreground"
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={select}
      >
        <button
          type="button"
          className={cn("grid h-5 w-5 place-items-center rounded", !children.length && "invisible")}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <ChevronRight size={13} className={cn("transition", open && "rotate-90")} />
        </button>
        <Icon size={14} className="shrink-0" />
        <span className="truncate">{element.name}</span>
        {!Array.isArray(element.content) && element.content.innerText && (
          <span className="ml-1 truncate text-[10px] text-muted-foreground/70">
            {element.content.innerText}
          </span>
        )}
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((child) => (
            <LayerNode key={child.id} element={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

/** Tree view of the page for precise selection of nested elements. */
const LayersTab = () => {
  const { state } = useEditor();
  return (
    <ul className="px-4 pb-4">
      {state.editor.elements.map((el) => (
        <LayerNode key={el.id} element={el} depth={0} />
      ))}
    </ul>
  );
};

export default LayersTab;
