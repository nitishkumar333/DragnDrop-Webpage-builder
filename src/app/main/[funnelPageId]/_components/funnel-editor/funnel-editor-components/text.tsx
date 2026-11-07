"use client";
import { EditorElement } from "@/providers/editor/editor-provider";
import React from "react";
import EditableText from "./editable-text";
import ElementWrapper from "./element-wrapper";

type Props = {
  element: EditorElement;
};

/** Renders both `text` (paragraph) and `heading` (h1–h4) elements. */
const TextComponent = ({ element }: Props) => {
  const level =
    element.type === "heading" && !Array.isArray(element.content)
      ? element.content.level || "h2"
      : "p";

  return (
    <ElementWrapper element={element}>
      <EditableText element={element} as={level} />
    </ElementWrapper>
  );
};

export default TextComponent;
