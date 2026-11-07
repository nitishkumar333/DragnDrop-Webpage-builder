import type {
  EditorElement,
  ElementContent,
} from "@/providers/editor/editor-provider";
import { walkElements } from "@/lib/editor-tree";
import { EditorOperation, applyOperation } from "./operations";

/** Style values every element carries by default; omitted to save tokens. */
const DEFAULT_STYLE_VALUES: Record<string, string> = {
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  objectFit: "cover",
  opacity: "100%",
  textAlign: "left",
};

/** Zero margins/paddings are the same as unset; omitted to save tokens. */
const isZeroSpacing = (key: string, value: string) =>
  /^(margin|padding)(Top|Right|Bottom|Left)?$/.test(key) && /^0(px)?$/.test(value);

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

/**
 * The server's working copy of a page during one AI request.
 *
 * - Gives every element a short, stable id (`body`, `3f9a1c`, …) derived from
 *   its uuid, so the model works with compact ids that stay the same across
 *   chat turns.
 * - Applies operations to its copy of the tree and records them, so the
 *   editor can replay exactly the same changes.
 */
export class PageSession {
  elements: EditorElement[];
  readonly operations: EditorOperation[] = [];
  private toShort = new Map<string, string>();
  private toReal = new Map<string, string>();

  constructor(elements: EditorElement[]) {
    this.elements = elements;
    walkElements(elements, (el) => this.register(el.id));
  }

  /** Assign a short id to a real id (no-op when it already has one). */
  register(realId: string) {
    if (this.toShort.has(realId)) return this.toShort.get(realId)!;
    let short: string;
    if (realId === "__body") {
      short = "body";
    } else {
      const base = realId.replace(/[^a-z0-9]/gi, "").toLowerCase() || "el";
      let length = 6;
      short = base.slice(0, length);
      while (this.toReal.has(short) && length < base.length) {
        length += 1;
        short = base.slice(0, length);
      }
      let n = 2;
      const stem = short;
      while (this.toReal.has(short)) short = `${stem}${n++}`;
    }
    this.toShort.set(realId, short);
    this.toReal.set(short, realId);
    return short;
  }

  shortId(realId: string) {
    return this.toShort.get(realId) ?? this.register(realId);
  }

  /** Resolve a short id from the model to a real id. */
  realId(shortId: string) {
    return this.toReal.get(shortId.trim().toLowerCase().replace(/^\[|\]$/g, ""));
  }

  apply(operation: EditorOperation) {
    if (operation.op === "insert") {
      walkElements([operation.element], (el) => this.register(el.id));
    }
    this.elements = applyOperation(this.elements, operation);
    this.operations.push(operation);
  }

  /** One line per element, indented by depth. */
  serialize(elements: EditorElement[] = this.elements, depth = 0): string {
    const lines: string[] = [];
    for (const el of elements) {
      lines.push(this.describe(el, depth));
      if (Array.isArray(el.content)) {
        const children = this.serialize(el.content, depth + 1);
        if (children) lines.push(children);
      }
    }
    return lines.join("\n");
  }

  /** A short human label for status messages, e.g. `heading "Hero title"`. */
  label(el: EditorElement) {
    return el.name || el.type || "element";
  }

  private describe(el: EditorElement, depth: number) {
    const parts = [`${"  ".repeat(depth)}[${this.shortId(el.id)}] ${el.type}`];
    if (!Array.isArray(el.content)) {
      const c = el.content as ElementContent;
      if (c.level) parts.push(c.level);
    }
    parts.push(JSON.stringify(el.name || ""));

    if (!Array.isArray(el.content)) {
      const c = el.content as ElementContent;
      if (c.innerText !== undefined) {
        parts.push(`text=${JSON.stringify(truncate(c.innerText, 400))}`);
      }
      if (c.href) parts.push(`href=${JSON.stringify(truncate(c.href, 200))}`);
      if (c.target === "_blank") parts.push("new_tab");
      if (c.src) parts.push(`src=${JSON.stringify(truncate(c.src, 200))}`);
      if (c.alt) parts.push(`alt=${JSON.stringify(truncate(c.alt, 120))}`);
    }

    const styles = Object.entries(el.styles || {})
      .filter(
        ([key, value]) =>
          value !== undefined &&
          value !== "" &&
          DEFAULT_STYLE_VALUES[key] !== String(value) &&
          !isZeroSpacing(key, String(value))
      )
      .map(([key, value]) => `${key}:${truncate(String(value), 200)}`);
    if (styles.length) parts.push(`{${styles.join("; ")}}`);

    return parts.join(" ");
  }
}
