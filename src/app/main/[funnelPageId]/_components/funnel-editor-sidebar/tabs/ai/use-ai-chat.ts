"use client";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import type { AiChatTurn, AiStreamEvent } from "@/lib/ai/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 } from "uuid";
import { apiUrl } from "@/lib/api";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "working" | "done" | "error" | "stopped";
  /** Status lines for each change, shown while the assistant works. */
  steps?: string[];
  changeCount?: number;
  /** The page right after this run, compared by reference to offer Undo. */
  resultElements?: EditorElement[];
  awaitingCapture?: boolean;
  reverted?: boolean;
};

const STORAGE_PREFIX = "ai-chat:";
const MAX_STORED = 60;

const storageKey = (pageId: string) => `${STORAGE_PREFIX}${pageId}`;

const loadMessages = (pageId: string): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(storageKey(pageId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveMessages = (pageId: string, messages: ChatMessage[]) => {
  try {
    const slim = messages.slice(-MAX_STORED).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: m.status === "working" ? "stopped" : m.status,
      steps: m.steps,
      changeCount: m.changeCount,
      reverted: m.reverted,
    }));
    localStorage.setItem(storageKey(pageId), JSON.stringify(slim));
  } catch {
    // Storage can be full or blocked; the chat still works without it.
  }
};

/** Prior completed exchanges, sent so follow-ups like "make it bigger" work. */
const toHistory = (messages: ChatMessage[]): AiChatTurn[] => {
  const turns: AiChatTurn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i];
    const reply = messages[i + 1];
    if (user.role === "user" && reply.role === "assistant" && reply.status === "done") {
      turns.push({ role: "user", content: user.content });
      turns.push({
        role: "assistant",
        content: reply.reverted
          ? `${reply.content}

(The user then undid these changes.)`
          : reply.content,
      });
      i++;
    }
  }
  return turns.slice(-20);
};

export function useAiChat() {
  const { state, dispatch } = useEditor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const pageId = state.editor.funnelPageId;
  const loadedFor = useRef<string | null>(null);

  // Restore this page's conversation.
  useEffect(() => {
    if (!pageId) return;
    setMessages(loadMessages(pageId));
    loadedFor.current = pageId;
  }, [pageId]);

  useEffect(() => {
    if (pageId && loadedFor.current === pageId) saveMessages(pageId, messages);
  }, [messages, pageId]);

  // Remember the page as it was right after a run so "Undo" can tell whether
  // the run is still the latest change.
  useEffect(() => {
    if (!messages.some((m) => m.awaitingCapture)) return;
    setMessages((ms) =>
      ms.map((m) =>
        m.awaitingCapture
          ? { ...m, awaitingCapture: false, resultElements: state.editor.elements }
          : m
      )
    );
  }, [messages, state.editor.elements]);

  // Stop a running request when the editor unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateMessage = (id: string, fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(
    async (input: string) => {
      const prompt = input.trim();
      if (!prompt || abortRef.current) return;

      const { editor } = stateRef.current;
      const history = toHistory(messagesRef.current);
      const historyKey = `ai:${v4()}`;
      const replyId = v4();
      let applied = 0;
      let finished = false;

      setMessages((ms) => [
        ...ms,
        { id: v4(), role: "user", content: prompt },
        { id: replyId, role: "assistant", content: "", status: "working", steps: [] },
      ]);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const handle = (event: AiStreamEvent) => {
        if (event.type === "operations") {
          dispatch({
            type: "APPLY_OPERATIONS",
            payload: { operations: event.operations, historyKey },
          });
          applied += event.operations.length;
          if (event.status) {
            updateMessage(replyId, (m) => ({
              ...m,
              steps: [...(m.steps || []), event.status!],
            }));
          }
        } else if (event.type === "done") {
          finished = true;
          updateMessage(replyId, (m) => ({
            ...m,
            content: event.message,
            status: "done",
            changeCount: applied,
            awaitingCapture: applied > 0,
          }));
        } else if (event.type === "error") {
          finished = true;
          updateMessage(replyId, (m) => ({
            ...m,
            content: event.message,
            status: "error",
            changeCount: applied,
            awaitingCapture: applied > 0,
          }));
        }
      };

      try {
        const res = await fetch(apiUrl("/ai"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            history,
            elements: editor.elements,
            selectedId: editor.selectedElement.id || null,
            device: editor.device,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `The AI request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) handle(JSON.parse(line) as AiStreamEvent);
          }
        }
        if (!finished) throw new Error("The connection closed before the AI finished.");
      } catch (error) {
        if (finished) return;
        const aborted = controller.signal.aborted;
        updateMessage(replyId, (m) => ({
          ...m,
          content: aborted
            ? "Stopped."
            : error instanceof Error
              ? error.message
              : "Something went wrong.",
          status: aborted ? "stopped" : "error",
          changeCount: applied,
          awaitingCapture: applied > 0,
        }));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [dispatch]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Undo a run, only while it is still the most recent change to the page. */
  const undo = useCallback(
    (id: string) => {
      const message = messagesRef.current.find((m) => m.id === id);
      if (!message?.resultElements) return;
      if (message.resultElements !== stateRef.current.editor.elements) return;
      dispatch({ type: "UNDO" });
      updateMessage(id, (m) => ({ ...m, reverted: true, resultElements: undefined }));
    },
    [dispatch]
  );

  const clear = useCallback(() => {
    if (!abortRef.current) setMessages([]);
  }, []);

  return {
    messages,
    busy,
    send,
    stop,
    undo,
    clear,
    canUndo: (m: ChatMessage) =>
      !!m.resultElements && m.resultElements === state.editor.elements,
  };
}

export type AiChat = ReturnType<typeof useAiChat>;
