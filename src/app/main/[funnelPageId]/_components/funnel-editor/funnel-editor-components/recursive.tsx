import { EditorElement } from "@/providers/editor/editor-provider";
import React from "react";
import TextComponent from "./text";
import Container from "./container";
import LinkComponent from "./link-component";
import ContactFormComponent from "./contact-form-component";
import {
  DividerComponent,
  ImageComponent,
  SpacerComponent,
  VideoComponent,
} from "./media";

type Props = {
  element: EditorElement;
};

const Recursive = ({ element }: Props) => {
  switch (element.type) {
    case "text":
    case "heading":
      return <TextComponent element={element} />;
    case "link":
    case "button":
      return <LinkComponent element={element} />;
    case "image":
      return <ImageComponent element={element} />;
    case "video":
      return <VideoComponent element={element} />;
    case "divider":
      return <DividerComponent element={element} />;
    case "spacer":
      return <SpacerComponent element={element} />;
    case "contactForm":
      return <ContactFormComponent element={element} />;
    case "container":
    case "section":
    case "2Col":
    case "__body":
      return <Container element={element} />;
    default:
      return null;
  }
};

export default Recursive;
