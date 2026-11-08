import asyncio
import json

import httpx
import pytest

from app.ai import photos
from app.ai import providers as registry
from app.ai.operations import walk
from app.ai.page_session import PageSession
from app.ai.providers.base import Step, ToolCall
from app.ai.tools import run_tool

from .conftest import body_with
from .test_ai_route import FakeProvider, events


def pexels_item(n):
    return {
        "id": n,
        "alt": f"Photo {n}",
        "photographer": f"Person {n}",
        "photographer_url": f"https://www.pexels.com/@p{n}",
        "src": {"large2x": f"https://images.pexels.com/{n}.jpeg", "large": "https://images.pexels.com/small.jpeg"},
    }


@pytest.fixture
def pexels(monkeypatch):
    """A fake Pexels API. Returns the list of requests it received."""
    requests = []
    real_client = httpx.AsyncClient
    # Every search gets its own three photos, plus one all searches share.
    counter = {"n": 0}

    def handler(request):
        requests.append(request)
        counter["n"] += 1
        base = counter["n"] * 10
        return httpx.Response(200, json={"photos": [pexels_item(1), pexels_item(base), pexels_item(base + 1)]})

    monkeypatch.setattr(photos.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(photos, "_cache", {})
    monkeypatch.setenv("PEXELS_API_KEY", "test-key")
    return requests


def image_srcs(session):
    return [e["content"]["src"] for e in walk(session.elements) if e["type"] == "image"]


def run(session, name, args):
    return asyncio.run(run_tool(session, name, args))


def test_search_sends_the_key_and_parses_results(pexels):
    results = asyncio.run(photos.search("  latte   art ", "portrait"))
    assert results[0] == photos.Photo("https://images.pexels.com/1.jpeg", "Photo 1", "Person 1", "https://www.pexels.com/@p1")
    request = pexels[0]
    assert request.headers["authorization"] == "test-key"
    assert request.url.path == "/v1/search"
    assert dict(request.url.params) == {"query": "latte art", "orientation": "portrait", "per_page": "15"}


def test_repeat_searches_use_the_cache(pexels):
    asyncio.run(photos.search("coffee"))
    asyncio.run(photos.search("COFFEE"))
    assert len(pexels) == 1
    asyncio.run(photos.search("coffee", "square"))
    assert len(pexels) == 2


def test_sections_get_real_photos_without_repeats(pexels):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"})
    run(s, "add_section", {"kind": "split", "heading": "Story", "image": "roastery"})
    run(s, "add_section", {"kind": "gallery", "items": [{"title": "Shop", "text": "the counter"}, {"title": "Beans"}]})
    srcs = image_srcs(s)
    assert len(srcs) == 4 and len(set(srcs)) == 4
    assert all(src.startswith("https://images.pexels.com/") for src in srcs)
    alts = [e["content"]["alt"] for e in walk(s.elements) if e["type"] == "image"]
    assert alts[0] == "latte art"  # the description, which fits the page's context


def test_team_keeps_placeholders_and_makes_no_requests(pexels):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "team", "items": [{"title": "Ana", "value": "Roaster"}]})
    assert pexels == []
    assert image_srcs(s)[0].startswith("https://placehold.co/")


def test_given_urls_and_invalid_sections_make_no_requests(pexels):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "hero", "heading": "Hi", "image": "https://example.com/mine.jpg"})
    assert image_srcs(s) == ["https://example.com/mine.jpg"]
    assert run(s, "add_section", {"kind": "gallery"}).is_error
    assert run(s, "add_section", {"kind": "nope", "image": "x"}).is_error
    assert pexels == []


def test_no_key_keeps_placeholders(monkeypatch):
    def fail(**kw):
        raise AssertionError("no request should be made")

    monkeypatch.setattr(photos.httpx, "AsyncClient", fail)
    s = PageSession(body_with())
    assert not run(s, "add_section", {"kind": "hero", "heading": "Hi", "image": "latte art"}).is_error
    assert image_srcs(s)[0].startswith("https://placehold.co/")
    out = run(s, "find_photos", {"query": "coffee", "orientation": "square"})
    assert out.is_error and "PEXELS_API_KEY" in out.result


@pytest.mark.parametrize(
    "behavior",
    [
        lambda request: httpx.Response(429, json={"error": "limit"}),
        lambda request: httpx.Response(200, text="not json"),
        lambda request: httpx.Response(200, json=["unexpected"]),
        lambda request: (_ for _ in ()).throw(httpx.ConnectTimeout("slow")),
    ],
    ids=["rate-limited", "bad-json", "bad-shape", "timeout"],
)
def test_search_failures_fall_back_to_placeholders(monkeypatch, behavior):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(photos.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(behavior), **kw))
    monkeypatch.setattr(photos, "_cache", {})
    monkeypatch.setenv("PEXELS_API_KEY", "test-key")
    s = PageSession(body_with())
    assert not run(s, "add_section", {"kind": "hero", "heading": "Hi", "image": "latte art"}).is_error
    assert image_srcs(s)[0].startswith("https://placehold.co/")
    assert photos._cache == {}  # a failure isn't remembered


def test_unsafe_photo_urls_are_ignored():
    assert photos._parse({"src": {"large2x": "javascript:alert(1)"}}) is None
    assert photos._parse({"src": {"large2x": "http://insecure/x.jpg"}}) is None
    assert photos._parse({}) is None


def test_find_photos_then_swap_image_and_credit(client, monkeypatch, pexels):
    page = body_with({"id": "img123-x", "name": "Image", "type": "image", "styles": {}, "content": {"src": "https://placehold.co/1x1", "alt": ""}})
    url = "https://images.pexels.com/1.jpeg"
    provider = FakeProvider([
        Step(tool_calls=[ToolCall("1", "find_photos", {"query": "coffee", "orientation": "landscape"})]),
        Step(tool_calls=[ToolCall("2", "update_content", {"id": "img123", "fields": [{"field": "src", "value": url}]})]),
        Step(text="Swapped it."),
    ])
    monkeypatch.setitem(registry.PROVIDERS, "fake", provider)
    got = events(client.post("/api/ai", json={"prompt": "use a real photo", "elements": page, "provider": "fake"}))
    assert provider.conversation.results[0][0].content.splitlines()[1].startswith(url)
    assert got[0]["operations"][0]["content"]["src"] == url
    # Only photos that ended up on the page are credited.
    assert got[-1]["photoCredits"] == [{"name": "Person 1", "url": "https://www.pexels.com/@p1"}]
    json.dumps(got)


def test_no_credits_without_photos(client, monkeypatch):
    monkeypatch.setitem(registry.PROVIDERS, "fake", FakeProvider([Step(text="Nothing to do.")]))
    got = events(client.post("/api/ai", json={"prompt": "hi", "elements": body_with(), "provider": "fake"}))
    assert "photoCredits" not in got[-1]
