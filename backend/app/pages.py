"""Page storage and the /api/getFunnel routes.

The routes and response shapes match the original Next.js API routes, and
documents are written the way Mongoose wrote them (timestamps, __v, content as
a JSON string), so existing pages keep working.
"""

import json
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Protocol

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import JSONResponse

from . import db
from .config import env

router = APIRouter(prefix="/api/getFunnel")

NO_STORE = {"Cache-Control": "no-store"}


def _now() -> datetime:
    # BSON dates have millisecond precision.
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def _iso(value: datetime) -> str:
    """Same format as JavaScript's Date.prototype.toISOString()."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def to_json(document: dict[str, Any] | None) -> dict[str, Any] | None:
    """Serialize a MongoDB document like Mongoose's toJSON (ids and dates as strings)."""
    if document is None:
        return None
    out: dict[str, Any] = {}
    for key, value in document.items():
        if isinstance(value, ObjectId):
            out[key] = str(value)
        elif isinstance(value, datetime):
            out[key] = _iso(value)
        else:
            out[key] = value
    return out


def serialize_content(content: Any) -> str:
    """Matches JSON.stringify: compact, non-ASCII characters kept as-is."""
    return json.dumps(content, separators=(",", ":"), ensure_ascii=False)


class PageStore(Protocol):
    async def list_pages(self) -> list[dict[str, Any]]: ...
    async def get_page(self, page_id: str) -> dict[str, Any] | None: ...
    async def create_page(self, page_id: str, name: str) -> None: ...
    async def save_content(self, page_id: str, content: str) -> None: ...
    async def delete_page(self, page_id: str) -> bool: ...


class MongoPageStore:
    async def list_pages(self):
        collection = await db.get_collection()
        cursor = collection.find({}, {"_id": 0, "id": 1, "name": 1, "updatedAt": 1}).sort(
            "updatedAt", -1
        )
        return [to_json(doc) async for doc in cursor]

    async def get_page(self, page_id):
        collection = await db.get_collection()
        return to_json(await collection.find_one({"id": page_id}))

    async def create_page(self, page_id, name):
        collection = await db.get_collection()
        now = _now()
        await collection.insert_one(
            {
                "id": page_id,
                "name": name,
                "content": "",
                "previewImage": None,
                "createdAt": now,
                "updatedAt": now,
                "__v": 0,
            }
        )

    async def save_content(self, page_id, content):
        collection = await db.get_collection()
        # Like Mongoose's findOneAndUpdate: no upsert, and bump updatedAt.
        await collection.update_one(
            {"id": page_id}, {"$set": {"content": content, "updatedAt": _now()}}
        )

    async def delete_page(self, page_id):
        collection = await db.get_collection()
        result = await collection.delete_one({"id": page_id})
        return result.deleted_count > 0


class MemoryPageStore:
    """In-process store for tests and for running without a database (PAGES_STORE=memory)."""

    def __init__(self) -> None:
        self.pages: dict[str, dict[str, Any]] = {}

    async def list_pages(self):
        pages = sorted(self.pages.values(), key=lambda p: p["updatedAt"], reverse=True)
        return [to_json({k: p[k] for k in ("id", "name", "updatedAt") if k in p}) for p in pages]

    async def get_page(self, page_id):
        page = self.pages.get(page_id)
        return to_json(deepcopy(page)) if page else None

    async def create_page(self, page_id, name):
        now = _now()
        self.pages[page_id] = {
            "_id": ObjectId(),
            "id": page_id,
            "name": name,
            "content": "",
            "previewImage": None,
            "createdAt": now,
            "updatedAt": now,
            "__v": 0,
        }

    async def save_content(self, page_id, content):
        if page_id in self.pages:
            self.pages[page_id]["content"] = content
            self.pages[page_id]["updatedAt"] = _now()

    async def delete_page(self, page_id):
        return self.pages.pop(page_id, None) is not None


def create_store() -> PageStore:
    return MemoryPageStore() if env("PAGES_STORE") == "memory" else MongoPageStore()


def _store(request: Request) -> PageStore:
    return request.app.state.page_store


# Fixed paths first so they don't match /{funnel_page_id}.
@router.get("/getAll")
async def list_pages(request: Request):
    return JSONResponse(await _store(request).list_pages(), headers=NO_STORE)


@router.post("/create-new-webpage")
async def create_page(request: Request, body: Any = Body(default=None)):
    if not isinstance(body, dict) or not isinstance(body.get("id"), str) or not body["id"]:
        raise HTTPException(400, "A page id is required.")
    name = body.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(422, "A page name is required.")
    await _store(request).create_page(body["id"], name)
    return {"result": True}


@router.get("/{funnel_page_id}")
async def get_page(funnel_page_id: str, request: Request):
    return JSONResponse(await _store(request).get_page(funnel_page_id), headers=NO_STORE)


@router.post("/{funnel_page_id}")
async def save_page(funnel_page_id: str, request: Request, body: Any = Body(default=None)):
    if body is None:
        raise HTTPException(400, "Page content is required.")
    await _store(request).save_content(funnel_page_id, serialize_content(body))
    return {"result": True}


@router.delete("/{funnel_page_id}")
async def delete_page(funnel_page_id: str, request: Request):
    if not await _store(request).delete_page(funnel_page_id):
        raise HTTPException(404, "Page not found.")
    return {"result": True}
