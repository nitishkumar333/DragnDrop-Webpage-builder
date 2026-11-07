import type {
  EditorElement,
  ElementContent,
} from "@/providers/editor/editor-provider";
import {
  findElement,
  insertElement,
  mapElement,
  mergeStyles,
  moveElement,
  removeElement,
} from "@/lib/editor-tree";

/**
 * A single change to the element tree, expressed with real element ids.
 *
 * The AI route produces these and the editor reducer applies them with
 * `applyOperations`. The server runs the same function on its own copy of the
 * page while the model works, so both sides end up with the same tree.
 */
export type EditorOperation =
  | {
      op: "insert";
      parentId: string;
      /** Position among the parent's children; appends when omitted. */
      index?: number;
      element: EditorElement;
    }
  | {
      op: "update_styles";
      id: string;
      /** Empty-string values remove the property. */
      styles: Record<string, string>;
    }
  | { op: "update_content"; id: string; content: Partial<ElementContent> }
  | { op: "delete"; id: string }
  | { op: "move"; id: string; parentId: string; index?: number };

/**
 * Apply one operation. Operations that no longer make sense (for example,
 * the target was deleted in the meantime) are skipped and the tree returned
 * unchanged.
 */
export const applyOperation = (
  elements: EditorElement[],
  operation: EditorOperation
): EditorElement[] => {
  switch (operation.op) {
    case "insert": {
      const parent = findElement(elements, operation.parentId);
      if (!parent || !Array.isArray(parent.content)) return elements;
      if (findElement(elements, operation.element.id)) return elements;
      return insertElement(
        elements,
        operation.parentId,
        operation.element,
        operation.index
      );
    }
    case "update_styles":
      if (!findElement(elements, operation.id)) return elements;
      return mapElement(elements, operation.id, (el) => ({
        ...el,
        styles: mergeStyles(el.styles, operation.styles as React.CSSProperties),
      }));
    case "update_content": {
      const el = findElement(elements, operation.id);
      if (!el || Array.isArray(el.content)) return elements;
      return mapElement(elements, operation.id, (current) => ({
        ...current,
        content: { ...(current.content as ElementContent), ...operation.content },
      }));
    }
    case "delete":
      if (operation.id === "__body" || !findElement(elements, operation.id)) {
        return elements;
      }
      return removeElement(elements, operation.id);
    case "move":
      return moveElement(elements, operation.id, operation.parentId, operation.index);
    default:
      return elements;
  }
};

export const applyOperations = (
  elements: EditorElement[],
  operations: EditorOperation[]
) => operations.reduce(applyOperation, elements);
