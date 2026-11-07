"""/api/ai: run the assistant and stream its changes as newline-delimited JSON."""

import json
import logging
import time
from collections import defaultdict
from typing import Any, Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from .agent import run_agent
from .providers import PROVIDERS, ChatTurn, default_provider_id

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai")

MAX_BODY_BYTES = 500_000
RATE_LIMIT_REQUESTS = 20
RATE_LIMIT_WINDOW = 60.0


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class AiRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=40)
    elements: list[Any] = Field(min_length=1)
    selectedId: str | None = None
    device: Literal["Desktop", "Tablet", "Mobile"] | None = None
    provider: str | None = None


def is_element_tree(value: Any, depth: int = 0) -> bool:
    """Light structural check of the element tree sent by the editor."""
    if not isinstance(value, list) or depth >= 40:
        return False
    for el in value:
        if not isinstance(el, dict):
            return False
        if not isinstance(el.get("id"), str) or not isinstance(el.get("name"), str):
            return False
        if "styles" in el and el["styles"] is not None and not isinstance(el["styles"], dict):
            return False
        content = el.get("content")
        if isinstance(content, list):
            if not is_element_tree(content, depth + 1):
                return False
        elif not isinstance(content, dict):
            return False
    return True


# Basic per-IP rate limit (per server process).
_hits: dict[str, list[float]] = defaultdict(list)


def rate_limited(ip: str) -> bool:
    now = time.monotonic()
    recent = [t for t in _hits[ip] if now - t < RATE_LIMIT_WINDOW]
    recent.append(now)
    _hits[ip] = recent
    if len(_hits) > 5000:
        _hits.clear()
    return len(recent) > RATE_LIMIT_REQUESTS


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.get("/providers")
async def list_providers():
    """Providers the UI can offer, and which one is used by default."""
    return {
        "default": default_provider_id(),
        "providers": [
            {"id": p.id, "label": p.label, "model": p.model(), "configured": p.configured()}
            for p in PROVIDERS.values()
        ],
    }


@router.post("")
async def ai(request: Request):
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "local")
    if rate_limited(ip):
        return _error(429, "Too many AI requests. Wait a minute and try again.")

    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        return _error(413, "This page is too large for the AI assistant.")
    try:
        body = AiRequest.model_validate(json.loads(raw))
    except json.JSONDecodeError:
        return _error(400, "Invalid JSON.")
    except ValidationError:
        return _error(400, "Invalid request.")
    prompt = body.prompt.strip()
    if not prompt:
        return _error(400, "Invalid request.")
    if not is_element_tree(body.elements) or body.elements[0].get("id") != "__body":
        return _error(400, "Invalid page data.")

    provider_id = body.provider or default_provider_id()
    provider = PROVIDERS.get(provider_id or "")
    if provider is None or not provider.configured():
        if body.provider and body.provider in PROVIDERS:
            p = PROVIDERS[body.provider]
            return _error(503, f"{p.label} is not configured. Add {p.api_key_env} to your .env file and restart the backend.")
        return _error(
            503,
            "The AI assistant is not configured. Add an API key (ANTHROPIC_API_KEY, GEMINI_API_KEY, "
            "DEEPSEEK_API_KEY or GROQ_API_KEY) to your .env file and restart the backend.",
        )

    # Earlier chat turns as plain text; the page outline only goes with the latest
    # message so the model always sees the current state.
    history = [ChatTurn(t.role, t.content) for t in body.history[-20:]]
    while history and history[0].role != "user":
        history.pop(0)

    async def stream():
        try:
            async for event in run_agent(
                provider,
                elements=body.elements,
                prompt=prompt,
                history=history,
                selected_id=body.selectedId,
                device=body.device,
            ):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except Exception:  # unexpected bug: report it without leaking details
            log.exception("AI request failed")
            yield json.dumps({"type": "error", "message": "Something went wrong while generating changes."}) + "\n"

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
