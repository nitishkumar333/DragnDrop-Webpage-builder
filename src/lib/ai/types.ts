import type { EditorOperation } from "./operations";

/** One line of the newline-delimited JSON stream returned by /api/ai. */
export type AiStreamEvent =
  | {
      type: "operations";
      operations: EditorOperation[];
      /** Short description of what changed, for the chat UI. */
      status?: string;
    }
  | {
      type: "done";
      message: string;
      changeCount: number;
      /** Which provider and model produced the reply. */
      provider?: string;
      model?: string;
    }
  | { type: "error"; message: string };

export type AiChatTurn = { role: "user" | "assistant"; content: string };

/** One entry of GET /api/ai/providers. */
export type AiProviderInfo = {
  id: string;
  label: string;
  model: string;
  configured: boolean;
};
