"use client";
import { EditorElement } from "@/providers/editor/editor-provider";
import React from "react";
import EditableText from "./editable-text";
import ElementWrapper from "./element-wrapper";

type Props = {
  element: EditorElement;
};

/** Text links and buttons share the same behaviour; only their styles differ. */
const LinkComponent = ({ element }: Props) => {
  const content = Array.isArray(element.content) ? {} : element.content;

  return (
    <ElementWrapper
      element={element}
      href={content.href || "#"}
      target={content.target}
      className={element.type === "button" ? "cursor-pointer select-none" : undefined}
    >
      <EditableText element={element} singleLine />
    </ElementWrapper>
  );
};

export default LinkComponent;
