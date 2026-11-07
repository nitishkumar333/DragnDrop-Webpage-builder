"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ELEMENT_CATALOG, CatalogItem } from "@/lib/element-catalog";
import { createElement } from "@/lib/element-factory";
import { topLevelAncestor } from "@/lib/editor-tree";
import { useEditor } from "@/providers/editor/editor-provider";
import React from "react";
import { BLOCK_PREVIEWS } from "./block-previews";

type Props = {
  /** Called right before an element is added by clicking. */
  onAdd?: () => void;
};

const CONTAINER_TYPES = ["container", "2Col", "section", "__body"];

const ComponentsTab = ({ onAdd }: Props) => {
  const { state, dispatch } = useEditor();

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("componentType", id);
    e.dataTransfer.effectAllowed = "copy";
  };

  /** Click-to-add: put the element somewhere sensible relative to the selection. */
  const handleAdd = (item: CatalogItem) => {
    const element = createElement(item.id);
    if (!element) return;
    onAdd?.();
    const { elements, selectedElement: sel } = state.editor;

    if (item.group === "blocks") {
      // Blocks are full-width sections: place them after the selected section.
      const anchor = sel.id ? topLevelAncestor(elements, sel.id) : null;
      if (anchor && anchor.type !== "__body") {
        dispatch({
          type: "APPEND_ELEMENT",
          payload: { containerId: anchor.id, elementDetails: element },
        });
      } else {
        dispatch({
          type: "ADD_ELEMENT",
          payload: { containerId: "__body", elementDetails: element },
        });
      }
    } else if (sel.id && CONTAINER_TYPES.includes(sel.type ?? "")) {
      dispatch({
        type: "ADD_ELEMENT",
        payload: { containerId: sel.id, elementDetails: element },
      });
    } else if (sel.id) {
      dispatch({
        type: "APPEND_ELEMENT",
        payload: { containerId: sel.id, elementDetails: element },
      });
    } else {
      dispatch({
        type: "ADD_ELEMENT",
        payload: { containerId: "__body", elementDetails: element },
      });
    }

    setTimeout(() => {
      document
        .querySelector(`[data-element-id="${element.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const tiles = (group: CatalogItem["group"]) =>
    ELEMENT_CATALOG.filter((item) => item.group === group).map((item) => {
      const Icon = item.icon;
      return (
        <button
          key={item.id}
          type="button"
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onClick={() => handleAdd(item)}
          title={`Drag onto the canvas or click to add`}
          className="group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-transparent bg-muted/60 px-1 py-3 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          {Icon && <Icon size={22} className="transition group-hover:scale-110" />}
          {item.label}
        </button>
      );
    });

  return (
    <Accordion
      type="multiple"
      className="w-full"
      defaultValue={["Blocks", "Elements", "Layout"]}
    >
      <AccordionItem value="Blocks" className="border-t px-6">
        <AccordionTrigger className="!no-underline">Blocks</AccordionTrigger>
        <AccordionContent className="grid grid-cols-2 gap-2">
          {ELEMENT_CATALOG.filter((i) => i.group === "blocks").map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onClick={() => handleAdd(item)}
              title={item.description}
              className="group flex cursor-grab flex-col overflow-hidden rounded-lg border bg-muted/40 text-left transition hover:border-primary/60 hover:shadow-md active:cursor-grabbing"
            >
              <div className="h-14 w-full overflow-hidden border-b transition group-hover:brightness-105">
                {BLOCK_PREVIEWS[item.id as string]}
              </div>
              <div className="px-2 py-1.5">
                <div className="text-xs font-medium text-foreground">{item.label}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Elements" className="px-6">
        <AccordionTrigger className="!no-underline">Elements</AccordionTrigger>
        <AccordionContent className="grid grid-cols-3 gap-2">
          {tiles("elements")}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Layout" className="px-6">
        <AccordionTrigger className="!no-underline">Layout</AccordionTrigger>
        <AccordionContent className="grid grid-cols-3 gap-2">
          {tiles("layout")}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ComponentsTab;
