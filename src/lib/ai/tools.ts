import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  EditorElement,
  ElementContent,
} from "@/providers/editor/editor-provider";
import { cloneWithNewIds, createElement } from "@/lib/element-factory";
import { findElement, findParent, mergeStyles, topLevelAncestor } from "@/lib/editor-tree";
import { FONT_OPTIONS } from "@/lib/design-tokens";
import { toYoutubeEmbed } from "@/lib/media-utils";
import { PageSession } from "./page-session";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const BLOCK_KINDS = {
  navbar: "navbar",
  hero: "hero",
  features: "features",
  testimonial: "testimonial",
  pricing: "pricing",
  cta: "cta",
  footer: "footer",
  gallery: "grid",
} as const;

export const ELEMENT_KINDS = {
  heading: "heading",
  text: "text",
  button: "button",
  link: "link",
  image: "image",
  video: "video",
  divider: "divider",
  spacer: "spacer",
  container: "container",
  two_columns: "2Col",
  contact_form: "contactForm",
} as const;

/** CSS properties the assistant may set (camelCase, as stored on elements). */
export const STYLE_PROPERTIES = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "width",
  "height",
  "maxWidth",
  "minHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "display",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "gap",
  "gridTemplateColumns",
  "flex",
  "borderRadius",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "boxShadow",
  "opacity",
  "objectFit",
  "aspectRatio",
] as const;

const CONTENT_FIELDS = [
  "text",
  "href",
  "src",
  "alt",
  "heading_level",
  "open_in_new_tab",
] as const;

/** Which content fields make sense for which element types. */
const FIELD_TYPES: Record<(typeof CONTENT_FIELDS)[number], string[]> = {
  text: ["text", "heading", "button", "link"],
  href: ["button", "link"],
  open_in_new_tab: ["button", "link"],
  src: ["image", "video"],
  alt: ["image"],
  heading_level: ["heading"],
};

const HEADING_SIZES: Record<string, string> = {
  h1: "56px",
  h2: "40px",
  h3: "28px",
  h4: "22px",
};

// ---------------------------------------------------------------------------
// Tool definitions (sent to the model)
// ---------------------------------------------------------------------------

const idDescription =
  "Short element id from the page outline, e.g. \"3f9a1c\" or \"body\".";

const styleListSchema = {
  type: "array",
  description:
    "CSS declarations. Use camelCase property names and CSS values with units (\"48px\", \"#0f172a\", \"1.4\"). An empty string removes the property.",
  items: {
    type: "object",
    properties: {
      property: { type: "string", enum: [...STYLE_PROPERTIES] },
      value: { type: "string" },
    },
    required: ["property", "value"],
    additionalProperties: false,
  },
} as const;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "add_block",
    description:
      "Insert a pre-designed, fully editable section into the page body. Blocks: navbar (logo + links + button), hero (headline, subtext, two buttons, image), features (3 feature cards), testimonial (quote card on dark background), pricing (3 plans), cta (call-to-action banner), footer (columns of links + copyright), gallery (grid of images). The result lists the new block's elements with their ids so you can then customize its text and styles.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: Object.keys(BLOCK_KINDS) },
        after_id: {
          type: "string",
          description:
            "Insert after the top-level section that contains this element. Use \"top\" to insert at the very top of the page. Omit to append at the end.",
        },
      },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  {
    name: "add_element",
    description:
      "Insert a single element into a container (body, container, two-column column, or any element whose outline line has children). Returns the new element's id.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: Object.keys(ELEMENT_KINDS) },
        parent_id: { type: "string", description: idDescription + " Must be a container." },
        after_id: {
          type: "string",
          description:
            "A direct child of parent_id to insert after, or \"top\" to insert first. Omit to append as the last child.",
        },
        text: {
          type: "string",
          description: "Initial text for heading, text, button or link elements.",
        },
        styles: styleListSchema,
      },
      required: ["type", "parent_id", "styles"],
      additionalProperties: false,
    },
  },
  {
    name: "update_styles",
    description:
      "Set CSS styles on one or more elements. Use several ids at once to restyle matching elements together (e.g. all headings, all buttons). Styles merge into the existing ones.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Element ids to style." },
        styles: styleListSchema,
      },
      required: ["ids", "styles"],
      additionalProperties: false,
    },
  },
  {
    name: "update_content",
    description:
      "Change an element's content. Fields: text (heading, text, button, link), href (button, link), open_in_new_tab \"true\"/\"false\" (button, link), src (image URL or YouTube URL for video), alt (image), heading_level h1-h4 (heading; also resets its font size).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: idDescription },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string", enum: [...CONTENT_FIELDS] },
              value: { type: "string" },
            },
            required: ["field", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["id", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_elements",
    description: "Delete elements (and everything inside them). The body cannot be deleted.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" } },
      },
      required: ["ids"],
      additionalProperties: false,
    },
  },
  {
    name: "move_element",
    description: "Move an element (with its children) into a container at a position.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: idDescription },
        parent_id: { type: "string", description: "Destination container id." },
        after_id: {
          type: "string",
          description:
            "A direct child of parent_id to place it after, or \"top\" to place it first. Omit to place it last.",
        },
      },
      required: ["id", "parent_id"],
      additionalProperties: false,
    },
  },
  {
    name: "duplicate_element",
    description:
      "Copy an element (with its children) and insert the copy right after the original. Returns the copy's ids.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: idDescription } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const styleList = z
  .array(z.object({ property: z.enum(STYLE_PROPERTIES), value: z.string().max(500) }))
  .max(60);

const blockKinds = Object.keys(BLOCK_KINDS) as [keyof typeof BLOCK_KINDS, ...(keyof typeof BLOCK_KINDS)[]];
const elementKinds = Object.keys(ELEMENT_KINDS) as [keyof typeof ELEMENT_KINDS, ...(keyof typeof ELEMENT_KINDS)[]];

const INPUT_SCHEMAS = {
  add_block: z.object({ kind: z.enum(blockKinds), after_id: z.string().optional() }),
  add_element: z.object({
    type: z.enum(elementKinds),
    parent_id: z.string(),
    after_id: z.string().optional(),
    text: z.string().max(5000).optional(),
    styles: styleList,
  }),
  update_styles: z.object({
    ids: z.array(z.string()).min(1).max(100),
    styles: styleList.min(1),
  }),
  update_content: z.object({
    id: z.string(),
    fields: z
      .array(z.object({ field: z.enum(CONTENT_FIELDS), value: z.string().max(5000) }))
      .min(1)
      .max(10),
  }),
  delete_elements: z.object({ ids: z.array(z.string()).min(1).max(100) }),
  move_element: z.object({
    id: z.string(),
    parent_id: z.string(),
    after_id: z.string().optional(),
  }),
  duplicate_element: z.object({ id: z.string() }),
};

type ToolName = keyof typeof INPUT_SCHEMAS;

// ---------------------------------------------------------------------------
// Value sanitizing
// ---------------------------------------------------------------------------

class ToolError extends Error {}

const UNSAFE_CSS = /[<>{}]|javascript:|expression\s*\(|@import|behavior\s*:/i;

const sanitizeStyleValue = (property: string, raw: string) => {
  const value = raw.trim();
  if (UNSAFE_CSS.test(value)) {
    throw new ToolError(`Invalid value for ${property}: ${JSON.stringify(raw)}`);
  }
  const urls = value.match(/url\(([^)]*)\)/gi) || [];
  for (const u of urls) {
    const inner = u.slice(4, -1).trim().replace(/^['"]|['"]$/g, "");
    if (!/^https:\/\//i.test(inner)) {
      throw new ToolError(`Only https:// URLs are allowed in ${property}.`);
    }
  }
  if (property === "fontFamily") {
    const match = FONT_OPTIONS.find(
      (f) =>
        f.label.toLowerCase() === value.toLowerCase() ||
        f.value.toLowerCase() === value.toLowerCase()
    );
    if (match) return match.value;
  }
  // Bare numbers for length properties get px, like the style panel does.
  if (
    /^-?\d+(\.\d+)?$/.test(value) &&
    !["fontWeight", "lineHeight", "opacity", "flex", "aspectRatio"].includes(property)
  ) {
    return `${value}px`;
  }
  return value;
};

const toStyleRecord = (styles: z.infer<typeof styleList>) => {
  const record: Record<string, string> = {};
  for (const { property, value } of styles) {
    record[property] = value === "" ? "" : sanitizeStyleValue(property, value);
  }
  return record;
};

const isSafeHref = (href: string) =>
  /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(href.trim());

const isSafeSrc = (src: string) => /^https?:\/\//i.test(src.trim());

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export type ToolOutcome = {
  /** Text returned to the model. */
  result: string;
  isError: boolean;
  /** Short status line for the chat UI. */
  status?: string;
  /** How many operations this call produced. */
  operationCount: number;
};

const resolve = (session: PageSession, shortId: string, what = "Element") => {
  const realId = session.realId(shortId);
  const el = realId ? findElement(session.elements, realId) : null;
  if (!el) throw new ToolError(`${what} "${shortId}" does not exist on the page.`);
  return el;
};

const resolveContainer = (session: PageSession, shortId: string) => {
  const el = resolve(session, shortId, "Container");
  if (!Array.isArray(el.content)) {
    throw new ToolError(
      `"${shortId}" is a ${el.type}, not a container. Use its parent or a container instead.`
    );
  }
  return el;
};

/** Index to insert at inside `parent`, given an optional `after_id`. */
const indexAfter = (
  session: PageSession,
  parent: EditorElement,
  afterId?: string
): number | undefined => {
  if (afterId === undefined || afterId === "") return undefined;
  if (afterId === "top") return 0;
  const sibling = resolve(session, afterId);
  const children = parent.content as EditorElement[];
  const index = children.findIndex((c) => c.id === sibling.id);
  if (index === -1) {
    throw new ToolError(`"${afterId}" is not a direct child of the given parent.`);
  }
  return index + 1;
};

const setText = (el: EditorElement, text?: string) => {
  if (text === undefined || Array.isArray(el.content)) return el;
  if (!["text", "heading", "button", "link"].includes(el.type ?? "")) return el;
  return { ...el, content: { ...(el.content as ElementContent), innerText: text } };
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function executeTool(
  session: PageSession,
  name: string,
  rawInput: unknown
): ToolOutcome {
  const before = session.operations.length;
  const done = (result: string, status?: string): ToolOutcome => ({
    result,
    status,
    isError: false,
    operationCount: session.operations.length - before,
  });

  try {
    const schema = INPUT_SCHEMAS[name as ToolName];
    if (!schema) throw new ToolError(`Unknown tool "${name}".`);
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ToolError(
        `Invalid input: ${parsed.error.issues
          .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
          .join("; ")}`
      );
    }

    switch (name as ToolName) {
      case "add_block": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.add_block>;
        const block = createElement(BLOCK_KINDS[input.kind]);
        if (!block) throw new ToolError(`Unknown block "${input.kind}".`);
        const body = session.elements[0];
        let index: number | undefined;
        if (input.after_id === "top") index = 0;
        else if (input.after_id && input.after_id !== "body") {
          const anchor = resolve(session, input.after_id);
          const section = topLevelAncestor(session.elements, anchor.id);
          const sections = body.content as EditorElement[];
          const at = sections.findIndex((s) => s.id === section?.id);
          index = at === -1 ? undefined : at + 1;
        }
        session.apply({ op: "insert", parentId: body.id, index, element: block });
        return done(
          `Added the ${input.kind} block:\n${session.serialize([block])}`,
          `Added ${block.name || input.kind} section`
        );
      }

      case "add_element": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.add_element>;
        const parent = resolveContainer(session, input.parent_id);
        const index = indexAfter(session, parent, input.after_id);
        let element = createElement(ELEMENT_KINDS[input.type]);
        if (!element) throw new ToolError(`Unknown element type "${input.type}".`);
        element = setText(element, input.text);
        if (input.styles.length) {
          element = {
            ...element,
            styles: mergeStyles(element.styles, toStyleRecord(input.styles)),
          };
        }
        session.apply({ op: "insert", parentId: parent.id, index, element });
        return done(
          `Added:\n${session.serialize([element])}`,
          `Added ${element.name.toLowerCase()} to ${session.label(parent)}`
        );
      }

      case "update_styles": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.update_styles>;
        const targets = Array.from(new Set(input.ids)).map((id) => resolve(session, id));
        const styles = toStyleRecord(input.styles);
        for (const el of targets) {
          session.apply({ op: "update_styles", id: el.id, styles });
        }
        const what =
          targets.length === 1 ? session.label(targets[0]) : plural(targets.length, "element");
        return done(
          `Updated styles on ${plural(targets.length, "element")}.`,
          `Restyled ${what}`
        );
      }

      case "update_content": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.update_content>;
        const el = resolve(session, input.id);
        if (Array.isArray(el.content)) {
          throw new ToolError(`"${input.id}" is a container; it has no content fields. Edit its children instead.`);
        }
        const content: Partial<ElementContent> = {};
        let headingSize: string | undefined;
        for (const { field, value } of input.fields) {
          if (!FIELD_TYPES[field].includes(el.type ?? "")) {
            throw new ToolError(`Field "${field}" does not apply to a ${el.type} element.`);
          }
          switch (field) {
            case "text":
              content.innerText = value;
              break;
            case "href":
              if (value && !isSafeHref(value)) {
                throw new ToolError("href must start with https://, http://, mailto:, tel:, # or /.");
              }
              content.href = value.trim();
              break;
            case "open_in_new_tab":
              content.target = value.trim().toLowerCase() === "true" ? "_blank" : "_self";
              break;
            case "src": {
              if (!isSafeSrc(value)) throw new ToolError("src must be an http(s) URL.");
              content.src = el.type === "video" ? toYoutubeEmbed(value.trim()) : value.trim();
              break;
            }
            case "alt":
              content.alt = value;
              break;
            case "heading_level": {
              const level = value.trim().toLowerCase();
              if (!["h1", "h2", "h3", "h4"].includes(level)) {
                throw new ToolError("heading_level must be h1, h2, h3 or h4.");
              }
              content.level = level as ElementContent["level"];
              headingSize = HEADING_SIZES[level];
              break;
            }
          }
        }
        session.apply({ op: "update_content", id: el.id, content });
        if (headingSize) {
          session.apply({ op: "update_styles", id: el.id, styles: { fontSize: headingSize } });
        }
        return done(`Updated ${session.label(el)}.`, `Edited ${session.label(el)}`);
      }

      case "delete_elements": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.delete_elements>;
        const targets = Array.from(new Set(input.ids)).map((id) => resolve(session, id));
        if (targets.some((el) => el.id === "__body")) {
          throw new ToolError("The body cannot be deleted. Delete its sections instead.");
        }
        for (const el of targets) session.apply({ op: "delete", id: el.id });
        const what =
          targets.length === 1 ? session.label(targets[0]) : plural(targets.length, "element");
        return done(`Deleted ${plural(targets.length, "element")}.`, `Deleted ${what}`);
      }

      case "move_element": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.move_element>;
        const el = resolve(session, input.id);
        if (el.id === "__body") throw new ToolError("The body cannot be moved.");
        const parent = resolveContainer(session, input.parent_id);
        if (findElement([el], parent.id)) {
          throw new ToolError("An element cannot be moved inside itself.");
        }
        const index = indexAfter(session, parent, input.after_id);
        session.apply({ op: "move", id: el.id, parentId: parent.id, index });
        return done(`Moved ${session.label(el)}.`, `Moved ${session.label(el)}`);
      }

      case "duplicate_element": {
        const input = parsed.data as z.infer<typeof INPUT_SCHEMAS.duplicate_element>;
        const el = resolve(session, input.id);
        const parent = findParent(session.elements, el.id);
        if (!parent || !Array.isArray(parent.content)) {
          throw new ToolError("The body cannot be duplicated.");
        }
        const copy = cloneWithNewIds(el);
        const index = parent.content.findIndex((c) => c.id === el.id) + 1;
        session.apply({ op: "insert", parentId: parent.id, index, element: copy });
        return done(
          `Duplicated. The copy:\n${session.serialize([copy])}`,
          `Duplicated ${session.label(el)}`
        );
      }
    }
    throw new ToolError(`Unknown tool "${name}".`);
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    return {
      result: error.message,
      isError: true,
      operationCount: session.operations.length - before,
    };
  }
}
