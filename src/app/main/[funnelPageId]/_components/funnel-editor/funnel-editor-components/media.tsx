"use client";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import React from "react";
import ElementWrapper from "./element-wrapper";
import { toYoutubeEmbed } from "@/lib/media-utils";

type Props = { element: EditorElement };

const contentOf = (element: EditorElement) =>
  Array.isArray(element.content) ? {} : element.content;

const hasFixedHeight = (element: EditorElement) =>
  !!element.styles.height && element.styles.height !== "auto";

export const ImageComponent = ({ element }: Props) => {
  const { src, alt } = contentOf(element);
  return (
    <ElementWrapper element={element}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || "https://placehold.co/800x450?text=Image"}
        alt={alt || ""}
        draggable={false}
        className={clsx("block w-full", hasFixedHeight(element) && "h-full")}
        style={{
          objectFit: element.styles.objectFit || "cover",
          // Crops the photo to the frame instead of growing it to the photo's shape.
          aspectRatio: element.styles.aspectRatio,
          borderRadius: "inherit",
        }}
      />
    </ElementWrapper>
  );
};

export const VideoComponent = ({ element }: Props) => {
  const { state } = useEditor();
  const { src } = contentOf(element);
  return (
    <ElementWrapper element={element}>
      <iframe
        src={toYoutubeEmbed(src || "")}
        title="Embedded video"
        className={clsx("block w-full", hasFixedHeight(element) ? "h-full" : "aspect-video")}
        style={{ borderRadius: "inherit" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {/* The iframe swallows clicks, so cover it while editing. */}
      {!state.editor.liveMode && <div className="absolute inset-0" />}
    </ElementWrapper>
  );
};

export const DividerComponent = ({ element }: Props) => (
  <ElementWrapper
    element={element}
    // Enlarge the click target of a 1px line without affecting layout.
    className="before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']"
  />
);

export const SpacerComponent = ({ element }: Props) => {
  const { state } = useEditor();
  return (
    <ElementWrapper
      element={element}
      className={clsx(
        !state.editor.liveMode &&
          "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(148,163,184,0.15)_6px,rgba(148,163,184,0.15)_12px)]"
      )}
    />
  );
};
