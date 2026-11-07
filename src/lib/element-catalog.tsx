import type { DragPayload } from "./constants";
import {
  Columns2,
  Contact2Icon,
  Heading1,
  ImageIcon,
  Link2Icon,
  MousePointerSquareDashed,
  Minus,
  MoveVertical,
  Square,
  TypeIcon,
  Youtube,
  type LucideIcon,
} from "lucide-react";

/** Metadata for everything a user can add from the sidebar or "+" menu. */
export type CatalogItem = {
  id: DragPayload;
  label: string;
  icon?: LucideIcon;
  group: "elements" | "layout" | "blocks";
  description?: string;
};

export const ELEMENT_CATALOG: CatalogItem[] = [
  { id: "heading", label: "Heading", icon: Heading1, group: "elements" },
  { id: "text", label: "Text", icon: TypeIcon, group: "elements" },
  { id: "button", label: "Button", icon: MousePointerSquareDashed, group: "elements" },
  { id: "image", label: "Image", icon: ImageIcon, group: "elements" },
  { id: "link", label: "Link", icon: Link2Icon, group: "elements" },
  { id: "video", label: "Video", icon: Youtube, group: "elements" },
  { id: "divider", label: "Divider", icon: Minus, group: "elements" },
  { id: "spacer", label: "Spacer", icon: MoveVertical, group: "elements" },
  { id: "contactForm", label: "Contact", icon: Contact2Icon, group: "elements" },
  { id: "container", label: "Container", icon: Square, group: "layout" },
  { id: "2Col", label: "2 Columns", icon: Columns2, group: "layout" },
  { id: "navbar", label: "Navbar", group: "blocks", description: "Logo, links & CTA" },
  { id: "hero", label: "Hero", group: "blocks", description: "Headline, actions & image" },
  { id: "features", label: "Features", group: "blocks", description: "Three feature cards" },
  { id: "testimonial", label: "Testimonial", group: "blocks", description: "Customer quote" },
  { id: "pricing", label: "Pricing", group: "blocks", description: "Three pricing plans" },
  { id: "grid", label: "Gallery", group: "blocks", description: "Responsive image grid" },
  { id: "cta", label: "Call to action", group: "blocks", description: "Gradient banner" },
  { id: "footer", label: "Footer", group: "blocks", description: "Links & copyright" },
];
