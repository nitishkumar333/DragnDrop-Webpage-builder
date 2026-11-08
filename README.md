# Drag-and-drop webpage builder

A visual page builder with an AI assistant. The project has two parts:

- **Frontend:** Next.js 14 (App Router, React, Tailwind) in `src/`. It contains the editor, the dashboard and the public `/site/[id]` pages.
- **Backend:** FastAPI (Python) in `backend/`. It handles page storage (MongoDB) and the AI assistant.

The browser only talks to Next.js. Next.js forwards every `/api/*` request to the backend (see `next.config.mjs`).

## Getting started

Requirements: Node 18+ and Python 3.10+.

```bash
npm install
npm run setup:backend   # creates backend/.venv and installs Python packages
npm run dev             # starts the backend (port 8000) and Next.js (port 3000)
```

Open [http://localhost:3000/main](http://localhost:3000/main).

Settings go in `.env` at the repository root. Both parts read this file.

```bash
MONGODB_URI=mongodb+srv://...      # required (or PAGES_STORE=memory to run without a database)
NEXT_PUBLIC_DOMAIN=http://localhost:3000
BACKEND_URL=http://localhost:8000  # optional; where Next.js finds the backend
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev:web` / `npm run dev:api` | Start only Next.js or only the backend |
| `npm run test:backend` | Backend tests (pytest) and a check that the element templates are up to date |
| `npm run export:templates` | Regenerate `backend/app/ai/element_templates.json` after changing `src/lib/element-factory.ts` or the fonts in `src/lib/design-tokens.ts` |
| `npm run build` / `npm run lint` | Next.js production build / lint |

## AI assistant

The editor sidebar has an **AI assistant** tab (sparkles icon). Users describe a change in plain language and the assistant edits the page directly, or describe a business and it builds a whole page. Pages can also be generated from the "new page" dialog on the dashboard. Changes appear on the canvas as they are made, and each request is a single undo step. A menu in the tab picks the AI provider.

Add a key for at least one provider to `.env` and restart `npm run dev`:

```bash
ANTHROPIC_API_KEY=...   # Claude      https://platform.claude.com
GEMINI_API_KEY=...      # Gemini      https://aistudio.google.com/apikey
DEEPSEEK_API_KEY=...    # DeepSeek    https://platform.deepseek.com
GROQ_API_KEY=...        # Groq        https://console.groq.com/keys

AI_PROVIDER=anthropic   # optional default; otherwise the first provider with a key

UNSPLASH_ACCESS_KEY=...  # optional, real stock photos  https://unsplash.com/developers
```

With an Unsplash access key, generated pages use real stock photos, and the assistant can swap images on request ("use a real photo here"). Without one, or if a search fails, images are labeled placeholders. Team sections always use placeholders, so a stranger's photo never appears above a named team member.

Images only ever come from Unsplash or a placeholder. No model is asked to generate an image, and the backend rejects any other image URL from a model. The one exception is a URL the user types in their request, or one already on the page.

The [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) shape how this works (`backend/app/ai/photos.py`):

- Pages hotlink the URLs Unsplash returns, as its guidelines require, so nothing is stored.
- Using a photo triggers its download event.
- A small "Photos by ... on Unsplash" line is added at the bottom of any page with stock photos, and the chat shows the same credit. Set `UNSPLASH_APP_NAME` to your app's name for the links' `utm_source`.
- The free tier allows 50 requests an hour. A photo costs up to two (a search and a download event), so that is roughly four image-heavy pages an hour. Apply for production access (1000 an hour) before launch.

Optional model overrides (defaults shown):

```bash
ANTHROPIC_MODEL=claude-opus-5-5        # e.g. claude-sonnet-5-5 is faster and cheaper
ANTHROPIC_EFFORT=medium                # low | medium | high
GEMINI_MODEL=gemini-flash-latest       # Google's alias for the current Flash model
DEEPSEEK_MODEL=deepseek-v4-flash
GROQ_MODEL=openai/gpt-oss-120b
```

How it works:

1. The chat (`src/app/main/[funnelPageId]/_components/funnel-editor-sidebar/tabs/ai/`) sends `POST /api/ai`. The request contains the current page, the selected element, recent chat turns and the chosen provider.
2. `backend/app/ai/agent.py` runs a tool loop. The model reads a compact outline of the page (`page_session.py`) and calls the tools in `tools.py`: `start_page`, `add_section`, `add_element`, `update_styles`, `update_content`, `delete_elements`, `move_element`, `duplicate_element`, `find_photos`. Every call is validated and sanitized. Errors go back to the model so it can correct itself.
   - To build a page, the model picks a design with `start_page` (`design.py` corrects the colors for contrast) and writes each section's content with `add_section`. `sections.py` turns that content into normal, editable elements, so the layout quality doesn't depend on the model. Sections added to an existing page read the design from that page.
3. Each change becomes an operation that streams back as newline-delimited JSON. The editor applies it with the same logic the backend used (`src/lib/ai/operations.ts` ↔ `backend/app/ai/operations.py`). `backend/tests/test_ts_parity.py` checks that both produce identical pages.
4. Provider adapters are in `backend/app/ai/providers/`:
   - Claude uses the Anthropic SDK.
   - Gemini uses the google-genai SDK.
   - DeepSeek and Groq use their OpenAI-compatible APIs.

   To add a provider, implement `Provider` and `Conversation` from `providers/base.py` and register the class in `providers/__init__.py`.

The API has no authentication, only a basic per-IP rate limit on `/api/ai` (20 requests per minute per process). Add auth before deploying publicly, because every AI request uses your API credit.

## API

The backend keeps the original routes, so existing pages keep working:

| Route | Purpose |
| --- | --- |
| `GET /api/getFunnel/getAll` | List pages (`id`, `name`, `updatedAt`), most recent first |
| `POST /api/getFunnel/create-new-webpage` | Create a page: `{ id, name }` |
| `GET /api/getFunnel/{id}` | Get a page (`null` if it doesn't exist) |
| `POST /api/getFunnel/{id}` | Save the page's element tree |
| `GET /api/ai/providers` | Providers, their models and whether a key is configured |
| `POST /api/ai` | Run the assistant (streams NDJSON events: `operations`, `done`, `error`) |

Interactive docs are at [http://localhost:8000/docs](http://localhost:8000/docs) while the backend runs.

## Deploying

Deploy the frontend (for example on Vercel) and set `BACKEND_URL` to the backend's public URL. Deploy the backend anywhere that runs Python, such as Render, Railway, Fly.io or a container:

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Give the backend the same `MONGODB_URI` and AI keys. If browsers will call the backend directly instead of through Next.js, also set `CORS_ORIGINS`.
