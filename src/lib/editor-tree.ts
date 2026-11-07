import type { EditorElement } from "@/providers/editor/editor-provider";

/** Pure, immutable helpers for working with the editor element tree. */

export const isContainerElement = (el: EditorElement) => Array.isArray(el.content);

export const findElement = (
  elements: EditorElement[],
  id: string
): EditorElement | null => {
  for (const el of elements) {
    if (el.id === id) return el;
    if (Array.isArray(el.content)) {
      const found = findElement(el.content, id);
      if (found) return found;
    }
  }
  return null;
};

export const findParent = (
  elements: EditorElement[],
  id: string,
  parent: EditorElement | null = null
): EditorElement | null => {
  for (const el of elements) {
    if (el.id === id) return parent;
    if (Array.isArray(el.content)) {
      const found = findParent(el.content, id, el);
      if (found) return found;
    }
  }
  return null;
};

export const mapElement = (
  elements: EditorElement[],
  id: string,
  fn: (el: EditorElement) => EditorElement
): EditorElement[] =>
  elements.map((el) => {
    if (el.id === id) return fn(el);
    if (Array.isArray(el.content)) {
      return { ...el, content: mapElement(el.content, id, fn) };
    }
    return el;
  });

export const removeElement = (
  elements: EditorElement[],
  id: string
): EditorElement[] =>
  elements
    .filter((el) => el.id !== id)
    .map((el) =>
      Array.isArray(el.content)
        ? { ...el, content: removeElement(el.content, id) }
        : el
    );

export const insertElement = (
  elements: EditorElement[],
  containerId: string,
  element: EditorElement,
  index?: number
): EditorElement[] =>
  mapElement(elements, containerId, (container) => {
    const children = Array.isArray(container.content)
      ? [...container.content]
      : [];
    const at =
      index === undefined || index < 0 || index > children.length
        ? children.length
        : index;
    children.splice(at, 0, element);
    return { ...container, content: children };
  });

export const insertAfter = (
  elements: EditorElement[],
  siblingId: string,
  element: EditorElement
): EditorElement[] => {
  const parent = findParent(elements, siblingId);
  if (!parent || !Array.isArray(parent.content)) {
    // The sibling is a root (e.g. the body) – drop the element inside it.
    const root = findElement(elements, siblingId);
    if (root && Array.isArray(root.content)) {
      return insertElement(elements, siblingId, element);
    }
    return elements;
  }
  const index = parent.content.findIndex((c) => c.id === siblingId);
  return insertElement(elements, parent.id, element, index + 1);
};

/** The ancestor of `id` that sits directly inside the body (or itself). */
export const topLevelAncestor = (
  elements: EditorElement[],
  id: string
): EditorElement | null => {
  let current = findElement(elements, id);
  while (current) {
    const parent = findParent(elements, current.id);
    if (!parent || parent.type === "__body") return current;
    current = parent;
  }
  return null;
};

/** Walk every element in the tree (depth first). */
export const walkElements = (
  elements: EditorElement[],
  fn: (el: EditorElement) => void
) => {
  for (const el of elements) {
    fn(el);
    if (Array.isArray(el.content)) walkElements(el.content, fn);
  }
};

/**
 * Merge a style patch into existing styles. `undefined` / empty-string values
 * remove the property.
 */
export const mergeStyles = (
  current: React.CSSProperties,
  patch: React.CSSProperties
): React.CSSProperties => {
  const next: Record<string, unknown> = { ...current };
  Object.entries(patch).forEach(([prop, value]) => {
    if (value === undefined || value === "") delete next[prop];
    else next[prop] = value;
  });
  return next as React.CSSProperties;
};

/**
 * Move an element into `containerId` at `index` (appends when omitted).
 * Returns the original array when the move is invalid or a no-op: moving the
 * body, moving into a non-container, or moving an element inside itself.
 */
export const moveElement = (
  elements: EditorElement[],
  elementId: string,
  containerId: string,
  index?: number
): EditorElement[] => {
  if (elementId === "__body" || elementId === containerId) return elements;

  const moving = findElement(elements, elementId);
  const target = findElement(elements, containerId);
  if (!moving || !target || !Array.isArray(target.content)) return elements;
  // Never drop an element inside itself.
  if (findElement([moving], containerId)) return elements;

  const parent = findParent(elements, elementId);
  if (parent && parent.id === containerId && Array.isArray(parent.content)) {
    const oldIndex = parent.content.findIndex((c) => c.id === elementId);
    if (index === undefined) index = parent.content.length;
    if (oldIndex < index) index -= 1;
    if (oldIndex === index) return elements;
  }

  return insertElement(removeElement(elements, elementId), containerId, moving, index);
};
