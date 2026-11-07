/** Element types that can live in the editor tree. */
export type EditorBtns =
  | null
  | "text"
  | "heading"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "container"
  | "section"
  | "contactForm"
  | "paymentForm"
  | "link"
  | "2Col"
  | "video"
  | "__body"
  | "navbar"
  | "grid";

/** Pre-designed sections built from the primitive elements above. */
export type BlockType =
  | "navbar"
  | "hero"
  | "features"
  | "testimonial"
  | "pricing"
  | "cta"
  | "footer"
  | "grid";

/** Anything that can be dragged from the sidebar onto the canvas. */
export type DragPayload = Exclude<EditorBtns, null> | BlockType;

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
