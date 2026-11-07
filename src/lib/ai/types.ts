import type { EditorOperation } from "./operations";

/** One line of the newline-delimited JSON stream returned by /api/ai. */
export type AiStreamEvent =
  | {
      type: "operations";
      operations: EditorOperation[];
      /** Short description of what changed, for the chat UI. */
      status?: string;
    }
  | { type: "done"; message: string; changeCount: number }
  | { type: "error"; message: string };

export type AiChatTurn = { role: "user" | "assistant"; content: string };
