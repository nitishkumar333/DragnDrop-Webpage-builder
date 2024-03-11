import { v4 } from "uuid";
import { EditorElement } from "@/providers/editor/editor-provider";

export type EditorBtns =
  | null
  | "text"
  | "container"
  | "section"
  | "contactForm"
  | "paymentForm"
  | "link"
  | "2Col"
  | "video"
  | "__body"
  | "image"
  | "navbar"
  | "grid";

export const defaultStyles: React.CSSProperties = {
  backgroundPosition: "center",
  objectFit: "cover",
  backgroundRepeat: "no-repeat",
  textAlign: "left",
  opacity: "100%",
};

export const defaultStylesForText: React.CSSProperties = {
  paddingTop: "2px",
  paddingBottom: "2px",
  paddingLeft: "2px",
  paddingRight: "2px",
  marginTop: "5px",
  marginBottom: "5px",
  marginLeft: "0px",
  marginRight: "0px",
  fontSize: "16px",
  width: "100%",
  height: "auto",
};

export const defaultStylesForContainer: React.CSSProperties = {
  paddingTop: "16px",
  paddingBottom: "16px",
  paddingLeft: "16px",
  paddingRight: "16px",
  marginTop: "16px",
  marginBottom: "16px",
  marginLeft: "0px",
  marginRight: "0px",
  width: "100%",
  height: "fit-content",
};
