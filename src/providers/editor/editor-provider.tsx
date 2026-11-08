"use client";
import { EditorBtns } from "@/lib/constants";
import { cloneWithNewIds } from "@/lib/element-factory";
import {
  findElement,
  findParent,
  insertAfter,
  insertElement,
  mapElement,
  mergeStyles,
  moveElement,
  removeElement,
} from "@/lib/editor-tree";
import { applyOperations } from "@/lib/ai/operations";
import { EditorAction } from "./editor-actions";
import { Dispatch, createContext, useContext, useReducer } from "react";

export type DeviceTypes = "Desktop" | "Mobile" | "Tablet";

export type ElementContent = {
  href?: string;
  innerText?: string;
  src?: string;
  alt?: string;
  /** Semantic tag for headings. */
  level?: "h1" | "h2" | "h3" | "h4";
  /** Link / button target. */
  target?: "_self" | "_blank";
};

export type EditorElement = {
  id: string;
  styles: React.CSSProperties;
  name: string;
  type: EditorBtns;
  content: EditorElement[] | ElementContent;
};

export type Editor = {
  liveMode: boolean;
  elements: EditorElement[];
  selectedElement: EditorElement;
  device: DeviceTypes;
  previewMode: boolean;
  funnelPageId: string;
  /** Container currently highlighted as the drop target while dragging. */
  dropTargetId: string | null;
  /** The AI is building on the canvas, which is locked while it plays. */
  building: boolean;
};

export type HistoryState = {
  /** Snapshots of the element tree. */
  history: EditorElement[][];
  currentIndex: number;
  /** Key of the last coalescable update, used to merge slider drags etc. */
  lastKey: string | null;
};

export type EditorState = {
  editor: Editor;
  history: HistoryState;
  /** The element tree as last loaded / saved, used for the unsaved indicator. */
  savedElements: EditorElement[];
};

const MAX_HISTORY = 100;

export const emptySelection: EditorElement = {
  id: "",
  content: [],
  name: "",
  styles: {},
  type: null,
};

const initialElements: EditorElement[] = [
  {
    content: [],
    id: "__body",
    name: "Body",
    styles: {},
    type: "__body",
  },
];

const initialEditorState: Editor = {
  elements: initialElements,
  selectedElement: emptySelection,
  device: "Desktop",
  previewMode: false,
  liveMode: false,
  funnelPageId: "",
  dropTargetId: null,
  building: false,
};

const initialState: EditorState = {
  editor: initialEditorState,
  history: { history: [initialElements], currentIndex: 0, lastKey: null },
  savedElements: initialElements,
};

/** Re-resolve the selected element against a (possibly new) tree. */
const resolveSelection = (elements: EditorElement[], id: string) =>
  (id && findElement(elements, id)) || emptySelection;

/**
 * Apply a new element tree and record it in the undo history.
 * `select` - id to select afterwards (defaults to keeping the current one).
 * `key` - when equal to the previous key, replaces the latest history entry.
 */
const commit = (
  state: EditorState,
  elements: EditorElement[],
  opts: { select?: string; key?: string | null } = {}
): EditorState => {
  if (elements === state.editor.elements) return state;
  const key = opts.key ?? null;
  const { history, currentIndex, lastKey } = state.history;
  const base =
    key && lastKey === key
      ? history.slice(0, currentIndex)
      : history.slice(0, currentIndex + 1);
  const nextHistory = [...base, elements].slice(-MAX_HISTORY);

  return {
    ...state,
    editor: {
      ...state.editor,
      elements,
      selectedElement: resolveSelection(
        elements,
        opts.select ?? state.editor.selectedElement.id
      ),
    },
    history: {
      history: nextHistory,
      currentIndex: nextHistory.length - 1,
      lastKey: key,
    },
  };
};

const editorReducer = (
  state: EditorState = initialState,
  action: EditorAction
): EditorState => {
  const { elements } = state.editor;

  switch (action.type) {
    case "ADD_ELEMENT": {
      const { containerId, elementDetails, index } = action.payload;
      return commit(
        state,
        insertElement(elements, containerId, elementDetails, index),
        { select: elementDetails.id }
      );
    }

    case "APPEND_ELEMENT": {
      const { containerId, elementDetails } = action.payload;
      return commit(state, insertAfter(elements, containerId, elementDetails), {
        select: elementDetails.id,
      });
    }

    case "UPDATE_ELEMENT": {
      const { elementDetails } = action.payload;
      return commit(
        state,
        mapElement(elements, elementDetails.id, (el) => ({
          ...el,
          ...elementDetails,
        }))
      );
    }

    case "UPDATE_ELEMENT_STYLES": {
      const { elementId, styles, coalesce } = action.payload;
      const key = coalesce
        ? `styles:${elementId}:${Object.keys(styles).sort().join(",")}`
        : null;
      return commit(
        state,
        mapElement(elements, elementId, (el) => ({
          ...el,
          styles: mergeStyles(el.styles, styles),
        })),
        { key }
      );
    }

    case "UPDATE_ELEMENT_CONTENT": {
      const { elementId, content, coalesce } = action.payload;
      const key = coalesce
        ? `content:${elementId}:${Object.keys(content).sort().join(",")}`
        : null;
      return commit(
        state,
        mapElement(elements, elementId, (el) =>
          Array.isArray(el.content)
            ? el
            : { ...el, content: { ...el.content, ...content } }
        ),
        { key }
      );
    }

    case "RENAME_ELEMENT": {
      const { elementId, name } = action.payload;
      return commit(
        state,
        mapElement(elements, elementId, (el) => ({ ...el, name })),
        { key: `name:${elementId}` }
      );
    }

    case "DELETE_ELEMENT": {
      const { id } = action.payload.elementDetails;
      if (id === "__body") return state;
      return commit(state, removeElement(elements, id));
    }

    case "MOVE_ELEMENT": {
      const { elementId, containerId, index } = action.payload;
      return commit(state, moveElement(elements, elementId, containerId, index), {
        select: elementId,
      });
    }

    case "APPLY_OPERATIONS": {
      const { operations, historyKey } = action.payload;
      return commit(state, applyOperations(elements, operations), {
        key: historyKey ?? null,
      });
    }

    case "DUPLICATE_ELEMENT": {
      const original = findElement(elements, action.payload.elementId);
      if (!original || original.id === "__body") return state;
      const copy = cloneWithNewIds(original);
      return commit(state, insertAfter(elements, original.id, copy), {
        select: copy.id,
      });
    }

    case "SHIFT_ELEMENT": {
      const { elementId, direction } = action.payload;
      const parent = findParent(elements, elementId);
      if (!parent || !Array.isArray(parent.content)) return state;
      const children = [...parent.content];
      const from = children.findIndex((c) => c.id === elementId);
      const to = from + direction;
      if (to < 0 || to >= children.length) return state;
      [children[from], children[to]] = [children[to], children[from]];
      return commit(
        state,
        mapElement(elements, parent.id, (el) => ({ ...el, content: children }))
      );
    }

    case "CHANGE_CLICKED_ELEMENT": {
      const id = action.payload.elementDetails?.id ?? "";
      return {
        ...state,
        editor: {
          ...state.editor,
          selectedElement: resolveSelection(elements, id),
        },
        // Selecting an element ends slider/typing coalescing, but an AI run
        // that is still streaming keeps adding to its single undo step.
        history: {
          ...state.history,
          lastKey: state.history.lastKey?.startsWith("ai:")
            ? state.history.lastKey
            : null,
        },
      };
    }

    case "SET_DROP_TARGET":
      if (state.editor.dropTargetId === action.payload.id) return state;
      return {
        ...state,
        editor: { ...state.editor, dropTargetId: action.payload.id },
      };

    case "SET_BUILDING":
      return {
        ...state,
        editor: { ...state.editor, building: action.payload.building },
      };

    case "CHANGE_DEVICE":
      return {
        ...state,
        editor: { ...state.editor, device: action.payload.device },
      };

    case "TOGGLE_PREVIEW_MODE":
      return {
        ...state,
        editor: { ...state.editor, previewMode: !state.editor.previewMode },
      };

    case "TOGGLE_LIVE_MODE":
      return {
        ...state,
        editor: {
          ...state.editor,
          liveMode: action.payload
            ? action.payload.value
            : !state.editor.liveMode,
        },
      };

    case "UNDO":
    case "REDO": {
      const { history, currentIndex } = state.history;
      const nextIndex = action.type === "UNDO" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= history.length) return state;
      const restored = history[nextIndex];
      return {
        ...state,
        editor: {
          ...state.editor,
          elements: restored,
          selectedElement: resolveSelection(
            restored,
            state.editor.selectedElement.id
          ),
        },
        history: { ...state.history, currentIndex: nextIndex, lastKey: null },
      };
    }

    case "LOAD_DATA": {
      const loaded =
        Array.isArray(action.payload.elements) && action.payload.elements.length
          ? action.payload.elements
          : initialElements;
      return {
        editor: {
          ...initialEditorState,
          elements: loaded,
          liveMode: !!action.payload.withLive,
          funnelPageId: state.editor.funnelPageId,
          device: state.editor.device,
        },
        history: { history: [loaded], currentIndex: 0, lastKey: null },
        savedElements: loaded,
      };
    }

    case "MARK_SAVED":
      return { ...state, savedElements: state.editor.elements };

    case "SET_FUNNELPAGE_ID":
      return {
        ...state,
        editor: { ...state.editor, funnelPageId: action.payload.funnelPageId },
      };

    default:
      return state;
  }
};

export const EditorContext = createContext<{
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  funnelId: string;
  pageDetails: any;
}>({
  state: initialState,
  dispatch: () => undefined,
  funnelId: "",
  pageDetails: null,
});

type EditorProps = {
  children: React.ReactNode;
  funnelId: string;
  pageDetails: any;
};

const EditorProvider = (props: EditorProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  return (
    <EditorContext.Provider
      value={{
        state,
        dispatch,
        funnelId: props.funnelId,
        pageDetails: props.pageDetails,
      }}
    >
      {props.children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor Hook must be used within the editor Provider");
  }
  return context;
};

export default EditorProvider;
