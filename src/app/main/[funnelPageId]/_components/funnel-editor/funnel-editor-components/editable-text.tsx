"use client";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import React from "react";

type Props = {
  element: EditorElement;
  as?: string;
  className?: string;
  /** Enter commits instead of inserting a line break. */
  singleLine?: boolean;
};

/**
 * Inline-editable text. In live mode it renders plain text; in the editor it
 * is contentEditable and commits on blur. The node is keyed by its text so
 * React never has to reconcile DOM the browser mutated while typing.
 */
const EditableText = ({ element, as = "span", className, singleLine }: Props) => {
  const { state, dispatch } = useEditor();
  const text = Array.isArray(element.content)
    ? ""
    : element.content.innerText ?? "";
  const classes = clsx("whitespace-pre-wrap break-words", className);

  if (state.editor.liveMode) {
    return React.createElement(as, { className: classes }, text);
  }

  return React.createElement(
    as,
    {
      key: text,
      "data-editable-text": true,
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      className: clsx(classes, "cursor-text outline-none"),
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const value = e.currentTarget.innerText.replace(/\n$/, "");
        if (value !== text) {
          dispatch({
            type: "UPDATE_ELEMENT_CONTENT",
            payload: { elementId: element.id, content: { innerText: value } },
          });
        }
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape" || (singleLine && e.key === "Enter")) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      },
    },
    text
  );
};

export default EditableText;
