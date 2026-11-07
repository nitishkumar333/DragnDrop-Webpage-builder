"""FastAPI app: page storage and the AI assistant.

Run locally with `npm run dev` from the repository root, or:
    uvicorn app.main:app --reload --port 8000   (from the backend/ directory)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db, pages
from .ai import router as ai_router
from .config import cors_origins

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.page_store = pages.create_store()
    yield
    await db.close()


app = FastAPI(title="Webpage builder API", lifespan=lifespan)

# The Next.js app proxies /api/* to this server, so CORS only matters when the
# browser calls the backend directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(pages.router)
app.include_router(ai_router.router)


@app.get("/api/health")
async def health():
    return {"ok": True}
