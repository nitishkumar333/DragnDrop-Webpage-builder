"use client";
import { createElement } from "@/lib/element-factory";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import { MousePointerClick } from "lucide-react";
import React from "react";
import ElementToolbar, { QuickAddButton } from "./element-toolbar";
import { editorOutline } from "./element-wrapper";
import Recursive from "./recursive";

type Props = { element: EditorElement };

/** Work out where among the container's children the drop should land. */
const getDropIndex = (e: React.DragEvent<HTMLElement>) => {
  const container = e.currentTarget;
  const children = Array.from(container.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.elementId
  );
  const computed = window.getComputedStyle(container);
  const horizontal =
    computed.display.includes("flex") && computed.flexDirection.startsWith("row");

  for (let i = 0; i < children.length; i++) {
    const r = children[i].getBoundingClientRect();
    if (horizontal) {
      if (e.clientY < r.top) return i;
      if (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2) return i;
    } else if (e.clientY < r.top + r.height / 2) {
      return i;
    }
  }
  return children.length;
};

const Container = ({ element }: Props) => {
  const { id, content, type, styles } = element;
  const { dispatch, state } = useEditor();
  const { liveMode, device, selectedElement, dropTargetId, building } = state.editor;
  const isBody = type === "__body";
  const isSelected = !liveMode && selectedElement.id === id;
  const children = Array.isArray(content) ? content : [];
  const isEmpty = children.length === 0;

  const handleDragOver = (e: React.DragEvent) => {
    if (liveMode) return;
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "SET_DROP_TARGET", payload: { id } });
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    if (liveMode) return;
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "SET_DROP_TARGET", payload: { id: null } });
    const index = getDropIndex(e);

    const movingId = e.dataTransfer.getData("elementId");
    if (movingId) {
      dispatch({
        type: "MOVE_ELEMENT",
        payload: { elementId: movingId, containerId: id, index },
      });
      return;
    }

    const newElement = createElement(e.dataTransfer.getData("componentType"));
    if (newElement) {
      dispatch({
        type: "ADD_ELEMENT",
        payload: { containerId: id, elementDetails: newElement, index },
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (liveMode) return;
    e.stopPropagation();
    if (!isSelected) {
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: { elementDetails: element },
      });
    }
  };

  return (
    <div
      style={styles}
      data-element-id={isBody ? undefined : id}
      data-canvas-body={isBody || undefined}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
      className={clsx(
        "relative",
        editorOutline(liveMode, isSelected && !isBody),
        {
          // Body
          "h-full overflow-y-auto no-scrollbar": isBody,
          "pb-24 pt-8": isBody && !liveMode,
          "!outline !outline-[3px] !outline-amber-400": isBody && isSelected,
          // Two columns stack on small screens
          flex: type === "2Col",
          "!flex-col": type === "2Col" && !liveMode && device === "Mobile",
          "!flex-row": type === "2Col" && !liveMode && device !== "Mobile",
          "flex-col md:!flex-row": type === "2Col" && liveMode,
          // Keep empty containers droppable while editing
          "min-h-[72px]": isEmpty && !liveMode && !isBody,
          // Drop highlight
          "after:pointer-events-none after:absolute after:inset-0 after:z-[4] after:bg-blue-500/10 after:outline after:outline-2 after:outline-offset-[-2px] after:outline-blue-500 after:content-['']":
            !liveMode && dropTargetId === id,
        }
      )}
    >
      {isSelected && <ElementToolbar element={element} />}

      {children.map((child) => (
        <Recursive key={child.id} element={child} />
      ))}

      {isEmpty && !liveMode && !building && (
        <div
          className={clsx(
            "pointer-events-none flex flex-col items-center justify-center gap-2 text-center text-sm text-slate-400",
            isBody ? "h-[60vh]" : "h-full min-h-[40px]"
          )}
        >
          {isBody && <MousePointerClick size={32} className="text-slate-300" />}
          <span>
            {isBody
              ? "Drag components or blocks here, or click one in the sidebar"
              : "Drop elements here"}
          </span>
        </div>
      )}

      {isSelected && <QuickAddButton element={element} />}
    </div>
  );
};

export default Container;
