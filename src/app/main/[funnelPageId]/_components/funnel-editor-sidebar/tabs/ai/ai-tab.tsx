"use client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Loader2,
  MousePointerClick,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { AiChat, ChatMessage } from "./use-ai-chat";

const EMPTY_PAGE_SUGGESTIONS = [
  "Build a landing page for a specialty coffee roaster in Portland",
  "Create a portfolio site for a wedding photographer",
  "Make a homepage for a family-run Italian restaurant",
  "Design a landing page for a time-tracking app, with pricing",
];

const PAGE_SUGGESTIONS = [
  "Add a pricing section after the features",
  "Add a testimonials section with three customer quotes",
  "Switch every font to Playfair Display",
  "Give the page a dark theme with a violet accent",
];

const SELECTION_SUGGESTIONS = [
  "Make this bigger and bolder",
  "Rewrite this to sound more confident",
  "Give this a soft gradient background",
  "Center this",
];

type Props = { chat: AiChat };

const AssistantMessage = ({ message, chat }: { message: ChatMessage; chat: AiChat }) => {
  const working = message.status === "working";
  const steps = message.steps || [];
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
      {steps.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      )}
      {working && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {chat.animating ? "Building…" : steps.length ? "Working…" : "Thinking…"}
          {chat.animating && (
            <button
              type="button"
              className="ml-auto underline underline-offset-2 hover:text-foreground"
              onClick={chat.skipAnimation}
            >
              Skip animation
            </button>
          )}
        </div>
      )}
      {message.content && (
        <p
          className={clsx("whitespace-pre-wrap leading-relaxed", {
            "text-destructive": message.status === "error",
            "text-muted-foreground": message.status === "stopped",
          })}
        >
          {message.status === "error" && (
            <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          )}
          {message.content}
        </p>
      )}
      {!working && !message.reverted && !!message.photoCredits?.length && (
        <p className="text-[11px] text-muted-foreground">
          Photos by{" "}
          {message.photoCredits.map((credit, i) => (
            <React.Fragment key={credit.url}>
              {i > 0 && ", "}
              <a href={credit.url} target="_blank" rel="noreferrer" className="underline">
                {credit.name}
              </a>
            </React.Fragment>
          ))}{" "}
          on{" "}
          <a
            href="https://unsplash.com/?utm_source=webpage_builder&utm_medium=referral"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            Unsplash
          </a>
        </p>
      )}
      {!working && message.modelLabel && (message.changeCount ?? 0) === 0 && (
        <p className="text-[11px] text-muted-foreground">{message.modelLabel}</p>
      )}
      {!working && (message.changeCount ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
          <span>
            {message.reverted
              ? "Changes undone"
              : `${message.changeCount} change${message.changeCount === 1 ? "" : "s"} applied`}
            {message.modelLabel && <span className="block text-[11px]">{message.modelLabel}</span>}
          </span>
          {chat.canUndo(message) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => chat.undo(message.id)}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const AiTab = ({ chat }: Props) => {
  const { state, dispatch } = useEditor();
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selected = state.editor.selectedElement;
  const hasSelection = !!selected.id;

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (text = input) => {
    if (!text.trim() || chat.busy) return;
    chat.send(text);
    setInput("");
  };

  const pageIsEmpty =
    !hasSelection &&
    Array.isArray(state.editor.elements[0]?.content) &&
    state.editor.elements[0].content.length === 0;
  const suggestions = hasSelection
    ? SELECTION_SUGGESTIONS
    : pageIsEmpty
      ? EMPTY_PAGE_SUGGESTIONS
      : PAGE_SUGGESTIONS;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-6 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Describe a change and watch it happen.
          </p>
          {chat.providers.length > 0 && (
            <Select
              value={chat.provider ?? undefined}
              onValueChange={chat.setProvider}
              disabled={chat.busy}
            >
              <SelectTrigger className="mt-2 h-8 w-full text-xs" title="AI model">
                <SelectValue placeholder="No AI provider configured" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {chat.providers.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.configured} className="text-xs">
                    {p.label}
                    <span className="ml-1 text-muted-foreground">
                      {p.configured ? p.model : "(no API key)"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {chat.messages.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            title="Clear conversation"
            disabled={chat.busy}
            onClick={chat.clear}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto px-4">
        {chat.messages.length === 0 ? (
          <div className="flex flex-col gap-3 px-2 pt-4">
            <p className="text-sm text-muted-foreground">
              {hasSelection
                ? "Ask for a change to the selected element, or the whole page."
                : pageIsEmpty
                  ? "Describe your business or idea and the assistant will build the whole page."
                  : "Ask for a new section, a new look, or new copy. Select an element first to change just that."}
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {chat.messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="ml-8 self-end whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                >
                  {m.content}
                </div>
              ) : (
                <AssistantMessage key={m.id} message={m} chat={chat} />
              )
            )}
          </div>
        )}
      </div>

      <div className="border-t p-3">
        {hasSelection && (
          <div className="mb-2 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span className="truncate">
              Selected: <span className="font-medium">{selected.name || selected.type}</span>
            </span>
            <button
              type="button"
              title="Clear selection"
              className="ml-auto rounded p-0.5 hover:bg-background"
              onClick={() => dispatch({ type: "CHANGE_CLICKED_ELEMENT", payload: {} })}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            maxLength={4000}
            placeholder={
              hasSelection
                ? "e.g. make this a pill-shaped button"
                : pageIsEmpty
                  ? "e.g. a landing page for my yoga studio"
                  : "e.g. add a testimonial section"
            }
            className="resize-none pr-12 text-sm"
          />
          {chat.busy ? (
            <Button
              size="icon"
              variant="secondary"
              title="Stop"
              className="absolute bottom-2 right-2 h-8 w-8"
              onClick={chat.stop}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              title="Send (Enter)"
              className="absolute bottom-2 right-2 h-8 w-8"
              disabled={!input.trim()}
              onClick={() => submit()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Ctrl+Z undoes a whole AI change
        </p>
      </div>
    </div>
  );
};

export default AiTab;
