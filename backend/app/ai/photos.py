"""Stock photos from the Unsplash API (https://unsplash.com/documentation).

Images on generated pages only ever come from here or from labeled placeholders;
no model is ever asked to generate one.

Unsplash's API guidelines shape this module:
- Pages must hotlink the URLs the API returns, so nothing is downloaded or stored.
- Using a photo must trigger its download_location endpoint (`track_download`).
- Displaying a photo must credit the photographer and Unsplash, with links that
  carry utm parameters (`Photo.photographer_url`, `unsplash_url`).

Needs UNSPLASH_ACCESS_KEY. Without a key, or if a search fails (the free tier
allows 50 requests an hour), callers get no photo and pages keep their
placeholders. A failed search must never break page generation.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from ..config import env

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.unsplash.com"
IMAGE_HOST = "https://images.unsplash.com/"
RESULTS_PER_SEARCH = 15
TIMEOUT_SECONDS = 6.0
MAX_QUERY_LENGTH = 100
MAX_CACHED_SEARCHES = 500
SEARCH_CACHE_SECONDS = 24 * 60 * 60  # saves the hourly request quota
ORIENTATIONS = {"landscape": "landscape", "portrait": "portrait", "square": "squarish"}
# Sizing goes on the raw URL, which keeps the ixid parameter Unsplash requires.
IMAGE_PARAMS = "&w=1600&q=80&auto=format&fit=max"


@dataclass(frozen=True)
class Photo:
    id: str
    url: str
    alt: str
    photographer: str
    photographer_url: str
    download_location: str


_cache: dict[tuple[str, str], tuple[float, list[Photo]]] = {}


def configured() -> bool:
    return bool(env("UNSPLASH_ACCESS_KEY"))


def _base_url() -> str:
    return env("UNSPLASH_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _headers() -> dict[str, str]:
    return {"Authorization": f"Client-ID {env('UNSPLASH_ACCESS_KEY')}", "Accept-Version": "v1"}


def _with_utm(url: str) -> str:
    query = urlencode({"utm_source": env("UNSPLASH_APP_NAME", "webpage_builder"), "utm_medium": "referral"})
    return f"{url}{'&' if '?' in url else '?'}{query}"


def unsplash_url() -> str:
    return _with_utm("https://unsplash.com/")


def _parse(item: Any) -> Photo | None:
    if not isinstance(item, dict):
        return None
    urls, links, user = item.get("urls"), item.get("links"), item.get("user")
    if not (isinstance(urls, dict) and isinstance(links, dict) and isinstance(user, dict)):
        return None
    raw = urls.get("raw")
    location = links.get("download_location")
    profile = (user.get("links") or {}).get("html")
    if not (isinstance(raw, str) and raw.startswith(IMAGE_HOST) and isinstance(location, str) and isinstance(profile, str)):
        return None
    # The access key is sent to this URL, so it must be Unsplash's own API.
    if not location.startswith(f"{_base_url()}/"):
        return None
    return Photo(
        id=str(item.get("id") or raw),
        url=raw + IMAGE_PARAMS,
        alt=str(item.get("alt_description") or ""),
        photographer=str(user.get("name") or user.get("username") or "Unknown"),
        photographer_url=_with_utm(profile),
        download_location=location,
    )


async def search(query: str, orientation: str = "landscape") -> list[Photo]:
    """Photos for a query, best match first. Empty if unavailable."""
    query = " ".join(query.split())[:MAX_QUERY_LENGTH]
    if not query or not configured():
        return []
    key = (query.lower(), orientation)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < SEARCH_CACHE_SECONDS:
        return cached[1]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{_base_url()}/search/photos",
                params={
                    "query": query,
                    "orientation": ORIENTATIONS.get(orientation, "landscape"),
                    "content_filter": "high",
                    "per_page": RESULTS_PER_SEARCH,
                },
                headers=_headers(),
            )
        response.raise_for_status()
        results = response.json().get("results") or []
    except (httpx.HTTPError, ValueError, AttributeError) as error:
        log.warning("Photo search failed: %s", type(error).__name__)
        return []
    photos = [photo for photo in map(_parse, results) if photo]
    if len(_cache) >= MAX_CACHED_SEARCHES:
        _cache.clear()
    _cache[key] = (time.monotonic(), photos)
    return photos


async def track_download(photo: Photo) -> None:
    """Tell Unsplash this photo was used. Best effort: a failure doesn't affect the page."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(photo.download_location, headers=_headers())
        response.raise_for_status()
    except httpx.HTTPError as error:
        log.warning("Photo download event failed: %s", type(error).__name__)
