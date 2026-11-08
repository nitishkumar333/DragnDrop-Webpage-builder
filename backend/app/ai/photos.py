"""Stock photo search through the Pexels API (https://www.pexels.com/api/documentation/).

Needs PEXELS_API_KEY. Without a key, or if a search fails, callers get no photos
and generated pages keep their labeled placeholders. A failed search must never
break page generation.
"""

import logging
from dataclasses import dataclass

import httpx

from ..config import env

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.pexels.com/v1"
RESULTS_PER_SEARCH = 15
TIMEOUT_SECONDS = 6.0
MAX_CACHED_SEARCHES = 500
MAX_QUERY_LENGTH = 100


@dataclass(frozen=True)
class Photo:
    url: str
    alt: str
    photographer: str
    photographer_url: str


# The API allows a limited number of requests per hour, so repeat searches are
# answered from memory. Failures aren't cached.
_cache: dict[tuple[str, str], list[Photo]] = {}


def configured() -> bool:
    return bool(env("PEXELS_API_KEY"))


def _parse(item: dict) -> Photo | None:
    src = item.get("src") or {}
    url = src.get("large2x") or src.get("large") or src.get("original")
    if not isinstance(url, str) or not url.startswith("https://"):
        return None
    return Photo(
        url=url,
        alt=str(item.get("alt") or ""),
        photographer=str(item.get("photographer") or "Unknown"),
        photographer_url=str(item.get("photographer_url") or "https://www.pexels.com"),
    )


async def search(query: str, orientation: str = "landscape") -> list[Photo]:
    """Photos for a query, best match first. Empty if unavailable."""
    query = " ".join(query.split())[:MAX_QUERY_LENGTH]
    if not query or not configured():
        return []
    key = (query.lower(), orientation)
    if key in _cache:
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{env('PEXELS_BASE_URL', DEFAULT_BASE_URL)}/search",
                params={"query": query, "orientation": orientation, "per_page": RESULTS_PER_SEARCH},
                headers={"Authorization": env("PEXELS_API_KEY")},
            )
        response.raise_for_status()
        items = response.json().get("photos") or []
    except (httpx.HTTPError, ValueError, AttributeError) as error:
        # Only the type: an httpx message can include request details.
        log.warning("Photo search failed: %s", type(error).__name__)
        return []
    photos = [photo for photo in map(_parse, items) if photo]
    if len(_cache) >= MAX_CACHED_SEARCHES:
        _cache.clear()
    _cache[key] = photos
    return photos
