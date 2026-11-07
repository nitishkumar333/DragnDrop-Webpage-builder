"use client";
import { useEditor } from "@/providers/editor/editor-provider";
import { ELEMENT_CATALOG } from "@/lib/element-catalog";
import { createElement } from "@/lib/element-factory";
import React from "react";

type Props = {
  /** The new element is inserted directly after this element. */
  targetId: string;
  onDone?: () => void;
};

/** Compact grid of elements shown from the "+" button under a selection. */
const AddOnModal = ({ targetId, onDone }: Props) => {
  const { dispatch } = useEditor();

  const add = (kind: string) => {
    const element = createElement(kind);
    if (!element) return;
    dispatch({
      type: "APPEND_ELEMENT",
      payload: { containerId: targetId, elementDetails: element },
    });
    onDone?.();
  };

  return (
    <div className="grid w-[264px] grid-cols-4 gap-1">
      {ELEMENT_CATALOG.filter((item) => item.group !== "blocks").map(
        ({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => add(id)}
            className="flex flex-col items-center gap-1 rounded-md p-2 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {Icon && <Icon size={20} />}
            {label}
          </button>
        )
      )}
    </div>
  );
};

export default AddOnModal;
