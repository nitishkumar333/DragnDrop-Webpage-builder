"use client";
import AddOnModal from "@/app/main/_components/addonModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { findParent } from "@/lib/editor-tree";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import {
  ArrowDown,
  ArrowUp,
  CornerLeftUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";

type Props = { element: EditorElement };

const ToolbarButton = ({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="grid h-[22px] w-[22px] place-items-center rounded hover:bg-white/20"
  >
    {children}
  </button>
);

/**
 * Floating toolbar shown above the selected element: drag handle, name and
 * quick actions. Rendered inside the element (which is `position: relative`).
 */
const ElementToolbar = ({ element }: Props) => {
  const { state, dispatch } = useEditor();
  const isBody = element.type === "__body";

  if (isBody) {
    return (
      <div className="pointer-events-none absolute left-0 top-0 z-[30] rounded-br-md bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-black">
        Body
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("elementId", element.id);
    e.dataTransfer.effectAllowed = "move";
    const node = (e.currentTarget as HTMLElement).closest("[data-element-id]");
    if (node) e.dataTransfer.setDragImage(node, 12, 12);
  };

  const selectParent = () => {
    const parent = findParent(state.editor.elements, element.id);
    if (parent) {
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: { elementDetails: parent },
      });
    }
  };

  return (
    <div
      className="absolute -top-[27px] left-[-2px] z-[30] flex h-[26px] items-center gap-0.5 whitespace-nowrap rounded-t-md bg-blue-500 px-1 text-[11px] font-medium text-white shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() =>
          dispatch({ type: "SET_DROP_TARGET", payload: { id: null } })
        }
        title="Drag to move"
        className="grid h-[22px] w-[18px] cursor-grab place-items-center active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </span>
      <span className="max-w-[140px] truncate pr-1">{element.name}</span>
      <span className="mx-0.5 h-3.5 w-px bg-white/40" />
      <ToolbarButton title="Select parent" onClick={selectParent}>
        <CornerLeftUp size={13} />
      </ToolbarButton>
      <ToolbarButton
        title="Move up"
        onClick={() =>
          dispatch({
            type: "SHIFT_ELEMENT",
            payload: { elementId: element.id, direction: -1 },
          })
        }
      >
        <ArrowUp size={13} />
      </ToolbarButton>
      <ToolbarButton
        title="Move down"
        onClick={() =>
          dispatch({
            type: "SHIFT_ELEMENT",
            payload: { elementId: element.id, direction: 1 },
          })
        }
      >
        <ArrowDown size={13} />
      </ToolbarButton>
      <ToolbarButton
        title="Duplicate (Ctrl+D)"
        onClick={() =>
          dispatch({
            type: "DUPLICATE_ELEMENT",
            payload: { elementId: element.id },
          })
        }
      >
        <Copy size={13} />
      </ToolbarButton>
      <ToolbarButton
        title="Delete (Del)"
        onClick={() =>
          dispatch({
            type: "DELETE_ELEMENT",
            payload: { elementDetails: element },
          })
        }
      >
        <Trash2 size={13} />
      </ToolbarButton>
    </div>
  );
};

/** Round "+" button under the selected element to insert something after it. */
export const QuickAddButton = ({ element }: Props) => {
  const [open, setOpen] = useState(false);
  if (element.type === "__body") return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className="absolute -bottom-[14px] left-1/2 z-[30] -translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Add element after"
            className="grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-white shadow-md ring-2 ring-white transition hover:scale-110"
          >
            <Plus size={16} />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <AddOnModal targetId={element.id} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};

export default ElementToolbar;
