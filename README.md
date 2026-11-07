This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## AI assistant

The editor sidebar has an **AI assistant** tab (sparkles icon). Users describe a change in plain language and it is applied to the page directly. Each request becomes a single undo step.

Setup: add these to `.env` and restart the dev server.

```bash
ANTHROPIC_API_KEY=sk-ant-...      # required; from https://platform.claude.com
AI_MODEL=claude-opus-5-5          # optional; e.g. claude-sonnet-5-5 is faster and cheaper
AI_EFFORT=medium                  # optional; low | medium | high
```

How it works:

- `src/app/main/[funnelPageId]/_components/funnel-editor-sidebar/tabs/ai/`: the chat UI and `useAiChat` hook. The hook sends the current page, the selected element and recent chat turns to `/api/ai`. It then applies the returned operations as they stream in.
- `src/app/api/ai/route.ts`: runs Claude with tools, streaming newline-delimited JSON events (`operations`, `done`, `error`).
- `src/lib/ai/tools.ts`: the tools Claude can call (`add_block`, `add_element`, `update_styles`, `update_content`, `delete_elements`, `move_element`, `duplicate_element`), plus validation and sanitizing.
- `src/lib/ai/page-session.ts`: gives elements short ids and writes the compact page outline the model reads.
- `src/lib/ai/operations.ts`: the operation format. `applyOperations` is shared by the server and the editor reducer (`APPLY_OPERATIONS`).
- `src/lib/ai/prompt.ts`: the system prompt and design guidance.

The route has a basic per-IP rate limit (20 requests per minute per server instance) and no authentication. Add auth before deploying publicly, because every request uses your API credit.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
