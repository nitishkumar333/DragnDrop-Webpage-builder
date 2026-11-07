"use client";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import React from "react";
import ElementToolbar, { QuickAddButton } from "./element-toolbar";

type Props = {
  element: EditorElement;
  children?: React.ReactNode;
  className?: string;
  /** In live mode the wrapper renders as a link when provided. */
  href?: string;
  target?: string;
};

/** Shared editor chrome for leaf elements: selection outline, toolbar, quick-add. */
export const editorOutline = (liveMode: boolean, selected: boolean) =>
  clsx(
    !liveMode && "outline-dashed outline-1 outline-offset-[-1px] outline-slate-300",
    selected && "!outline !outline-2 !outline-blue-500 z-[5]"
  );

const ElementWrapper = ({ element, children, className, href, target }: Props) => {
  const { state, dispatch } = useEditor();
  const { liveMode } = state.editor;
  const isSelected = !liveMode && state.editor.selectedElement.id === element.id;

  if (liveMode && href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        style={element.styles}
        className={clsx("relative no-underline", className)}
        data-element-id={element.id}
      >
        {children}
      </a>
    );
  }

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
      style={element.styles}
      data-element-id={element.id}
      onClick={handleClick}
      className={clsx("relative", editorOutline(liveMode, isSelected), className)}
    >
      {isSelected && <ElementToolbar element={element} />}
      {children}
      {isSelected && <QuickAddButton element={element} />}
    </div>
  );
};

export default ElementWrapper;
