import type { EditorOperation } from "@/lib/ai/operations";
import {
  DeviceTypes,
  EditorElement,
  ElementContent,
} from "./editor-provider";

type EmptySelection = {
  id: "";
  content: [];
  name: "";
  styles: {};
  type: null;
};

export type EditorAction =
  | {
      type: "ADD_ELEMENT";
      payload: {
        containerId: string;
        elementDetails: EditorElement;
        /** Position among the container's children; appends when omitted. */
        index?: number;
      };
    }
  | {
      /** Insert the element directly after the element with `containerId`. */
      type: "APPEND_ELEMENT";
      payload: {
        containerId: string;
        elementDetails: EditorElement;
      };
    }
  | {
      type: "UPDATE_ELEMENT";
      payload: {
        elementDetails: EditorElement;
      };
    }
  | {
      /**
       * Merge styles into an element. `undefined` / empty-string values remove
       * the property. With `coalesce`, consecutive updates to the same
       * properties collapse into a single undo step (sliders, typing).
       */
      type: "UPDATE_ELEMENT_STYLES";
      payload: {
        elementId: string;
        styles: React.CSSProperties;
        coalesce?: boolean;
      };
    }
  | {
      type: "UPDATE_ELEMENT_CONTENT";
      payload: {
        elementId: string;
        content: Partial<ElementContent>;
        coalesce?: boolean;
      };
    }
  | {
      type: "RENAME_ELEMENT";
      payload: { elementId: string; name: string };
    }
  | {
      type: "DELETE_ELEMENT";
      payload: {
        elementDetails: EditorElement;
      };
    }
  | {
      type: "MOVE_ELEMENT";
      payload: { elementId: string; containerId: string; index?: number };
    }
  | {
      /**
       * Apply a batch of operations (from the AI assistant). Batches sent with
       * the same `historyKey` in a row share one undo step.
       */
      type: "APPLY_OPERATIONS";
      payload: { operations: EditorOperation[]; historyKey?: string };
    }
  | {
      type: "DUPLICATE_ELEMENT";
      payload: { elementId: string };
    }
  | {
      /** Move an element one step up (-1) or down (1) among its siblings. */
      type: "SHIFT_ELEMENT";
      payload: { elementId: string; direction: -1 | 1 };
    }
  | {
      type: "CHANGE_CLICKED_ELEMENT";
      payload: {
        elementDetails?: EditorElement | EmptySelection;
      };
    }
  | {
      type: "SET_DROP_TARGET";
      payload: { id: string | null };
    }
  | {
      type: "SET_BUILDING";
      payload: { building: boolean };
    }
  | {
      type: "CHANGE_DEVICE";
      payload: {
        device: DeviceTypes;
      };
    }
  | {
      type: "TOGGLE_PREVIEW_MODE";
    }
  | {
      type: "TOGGLE_LIVE_MODE";
      payload?: {
        value: boolean;
      };
    }
  | { type: "REDO" }
  | { type: "UNDO" }
  | {
      type: "LOAD_DATA";
      payload: {
        elements: EditorElement[];
        withLive: boolean;
      };
    }
  | {
      type: "MARK_SAVED";
    }
  | {
      type: "SET_FUNNELPAGE_ID";
      payload: {
        funnelPageId: string;
      };
    };
