import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { z } from "zod";
import type { EditorElement } from "@/providers/editor/editor-provider";
import { findElement } from "@/lib/editor-tree";
import { PageSession } from "@/lib/ai/page-session";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { TOOLS, executeTool } from "@/lib/ai/tools";
import type { AiStreamEvent } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generating several sections can take a while.
export const maxDuration = 300;

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.AI_EFFORT || "medium") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";
/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
  "claude-sonnet-5-5",
]);

const MAX_TURNS = 12;
const MAX_OPERATIONS = 400;
const MAX_PAGE_BYTES = 500_000;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(40)
    .default([]),
  elements: z.array(z.any()).min(1),
  selectedId: z.string().nullable().optional(),
  device: z.enum(["Desktop", "Tablet", "Mobile"]).optional(),
});

/** Light structural check of the element tree sent by the editor. */
const isElementTree = (value: unknown, depth = 0): value is EditorElement[] =>
  Array.isArray(value) &&
  depth < 40 &&
  value.every(
    (el) =>
      el &&
      typeof el === "object" &&
      typeof el.id === "string" &&
      typeof el.name === "string" &&
      (el.styles === undefined || typeof el.styles === "object") &&
      (Array.isArray(el.content)
        ? isElementTree(el.content, depth + 1)
        : el.content && typeof el.content === "object")
  );

// ---------------------------------------------------------------------------
// Basic per-IP rate limit (per server instance)
// ---------------------------------------------------------------------------

const RATE_LIMIT = { requests: 20, windowMs: 60_000 };
const hits = new Map<string, number[]>();

const rateLimited = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT.requests;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonError = (status: number, message: string) =>
  Response.json({ error: message }, { status });

const describeApiError = (error: unknown) => {
  if (error instanceof Anthropic.AuthenticationError) {
    return "The ANTHROPIC_API_KEY on the server is invalid.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return `This API key cannot use the model "${MODEL}".`;
  }
  if (error instanceof Anthropic.NotFoundError) {
    return `The model "${MODEL}" was not found. Check AI_MODEL.`;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The AI service is rate limited right now. Try again in a moment.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `The AI request was rejected: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach the AI service.";
  }
  if (error instanceof Anthropic.APIError) {
    return `The AI service returned an error (${error.status ?? "unknown"}).`;
  }
  return "Something went wrong while generating changes.";
};

const buildUserMessage = (
  session: PageSession,
  prompt: string,
  selectedId: string | null | undefined,
  device: string | undefined
) => {
  const selected = selectedId ? findElement(session.elements, selectedId) : null;
  const selection = selected
    ? `[${session.shortId(selected.id)}] ${selected.type} ${JSON.stringify(selected.name)}`
    : "nothing";
  return [
    "<page>",
    session.serialize(),
    "</page>",
    `Selected element: ${selection}`,
    `Device being previewed: ${device || "Desktop"}`,
    "",
    "Request:",
    prompt,
  ].join("\n");
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      503,
      "The AI assistant is not configured. Add ANTHROPIC_API_KEY to your .env file and restart the server."
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    return jsonError(429, "Too many AI requests. Wait a minute and try again.");
  }

  const raw = await req.text();
  if (raw.length > MAX_PAGE_BYTES) {
    return jsonError(413, "This page is too large for the AI assistant.");
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    const parsed = RequestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return jsonError(400, "Invalid request.");
    body = parsed.data;
  } catch {
    return jsonError(400, "Invalid JSON.");
  }
  if (!isElementTree(body.elements) || body.elements[0]?.id !== "__body") {
    return jsonError(400, "Invalid page data.");
  }

  const session = new PageSession(body.elements);

  // Earlier chat turns as plain text; the page outline is only sent with the
  // latest message so the model always sees the current state.
  const history = body.history.slice(-20);
  while (history.length && history[0].role !== "user") history.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: buildUserMessage(session, body.prompt, body.selectedId, body.device),
    },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AiStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        let reply = "";
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          if (req.signal.aborted) return;

          const response = await client.beta.messages.create(
            {
              model: MODEL,
              max_tokens: 16000,
              system: SYSTEM_PROMPT,
              tools: TOOLS,
              messages,
              cache_control: { type: "ephemeral" },
              output_config: { effort: EFFORT },
              ...(FALLBACK_MODELS.has(MODEL)
                ? {
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default" as const,
                  }
                : {}),
            },
            { signal: req.signal }
          );

          if (response.stop_reason === "refusal") {
            send({
              type: "error",
              message: "The AI declined this request. Try rephrasing it.",
            });
            return;
          }

          const text = response.content
            .flatMap((block) => (block.type === "text" ? [block.text] : []))
            .join("\n")
            .trim();
          const toolUses = response.content.filter(
            (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use"
          );

          if (toolUses.length === 0) {
            reply = text;
            if (response.stop_reason === "max_tokens") {
              reply += reply ? "\n\n(The reply was cut off.)" : "The reply was cut off.";
            }
            break;
          }

          messages.push({ role: "assistant", content: response.content });

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            if (session.operations.length >= MAX_OPERATIONS) {
              results.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                is_error: true,
                content: "Change limit reached for this request. Stop and summarize.",
              });
              continue;
            }
            const start = session.operations.length;
            const outcome = executeTool(session, toolUse.name, toolUse.input);
            results.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: outcome.result,
              ...(outcome.isError ? { is_error: true } : {}),
            });
            if (outcome.operationCount > 0) {
              send({
                type: "operations",
                operations: session.operations.slice(start),
                status: outcome.status,
              });
            }
          }
          messages.push({ role: "user", content: results });

          if (turn === MAX_TURNS - 1) {
            reply = "I stopped after making several rounds of changes. Ask me to continue if something is missing.";
          }
        }

        send({
          type: "done",
          message: reply || "Done.",
          changeCount: session.operations.length,
        });
      } catch (error) {
        if (req.signal.aborted) return;
        if (!(error instanceof Anthropic.APIError)) console.error("[api/ai]", error);
        send({ type: "error", message: describeApiError(error) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the client went away.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
