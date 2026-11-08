import asyncio
import json
from pathlib import Path

import httpx
import pytest

from app.ai import photos
from app.ai import providers as registry
from app.ai.operations import find_element, walk
from app.ai.page_session import PageSession, urls_in_text
from app.ai.providers.base import Step, ToolCall
from app.ai.sections import CREDITS_NAME
from app.ai.tools import execute_tool, run_tool

from .conftest import body_with
from .test_ai_route import FakeProvider, events

API = "https://api.unsplash.com"


def result(n):
    return {
        "id": f"p{n}",
        "alt_description": f"photo {n}",
        "urls": {"raw": f"https://images.unsplash.com/photo-{n}?ixid=abc"},
        "links": {"download_location": f"{API}/photos/p{n}/download"},
        "user": {"name": f"Person {n}", "links": {"html": f"https://unsplash.com/@p{n}"}},
    }


def url_of(n):
    return f"https://images.unsplash.com/photo-{n}?ixid=abc" + photos.IMAGE_PARAMS


class FakeUnsplash:
    def __init__(self):
        self.next_id = 0
        self.searches = []
        self.downloads = []
        self.search_response = None
        self.download_status = 200

    def __call__(self, request):
        if request.url.path.endswith("/download"):
            self.downloads.append(request)
            return httpx.Response(self.download_status, json={"url": "x"})
        self.searches.append(request)
        if self.search_response is not None:
            return self.search_response
        # Each search gets its own photos, plus one that every search shares.
        self.next_id += 10
        return httpx.Response(200, json={"results": [result(1), result(self.next_id), result(self.next_id + 1)]})


@pytest.fixture
def unsplash(monkeypatch):
    fake = FakeUnsplash()
    real_client = httpx.AsyncClient
    monkeypatch.setattr(photos.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(fake), **kw))
    monkeypatch.setattr(photos, "_cache", {})
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "access-key")
    monkeypatch.delenv("UNSPLASH_BASE_URL", raising=False)
    monkeypatch.delenv("UNSPLASH_APP_NAME", raising=False)
    return fake


def image_srcs(session):
    return [e["content"]["src"] for e in walk(session.elements) if e["type"] == "image"]


def run(session, name, args):
    return asyncio.run(run_tool(session, name, args))


def credits_block(session):
    return next((s for s in session.elements[0]["content"] if s["name"] == CREDITS_NAME), None)


def test_search_request_and_parsing(unsplash):
    found = asyncio.run(photos.search("  latte   art ", "square"))
    request = unsplash.searches[0]
    assert request.headers["authorization"] == "Client-ID access-key"
    assert request.url.path == "/search/photos" and "access-key" not in str(request.url)
    params = dict(request.url.params)
    assert params["query"] == "latte art" and params["orientation"] == "squarish" and params["content_filter"] == "high"
    photo = found[0]
    assert photo.url == url_of(1) and "ixid=abc" in photo.url  # Unsplash requires ixid is kept
    assert photo.photographer == "Person 1"
    assert photo.photographer_url == "https://unsplash.com/@p1?utm_source=webpage_builder&utm_medium=referral"


def test_searches_are_cached_until_they_expire(unsplash, monkeypatch):
    asyncio.run(photos.search("coffee"))
    asyncio.run(photos.search("COFFEE"))
    assert len(unsplash.searches) == 1
    asyncio.run(photos.search("coffee", "portrait"))
    assert len(unsplash.searches) == 2
    start = photos.time.monotonic()
    monkeypatch.setattr(photos.time, "monotonic", lambda: start + photos.SEARCH_CACHE_SECONDS + 1)
    asyncio.run(photos.search("coffee"))
    assert len(unsplash.searches) == 3


def test_bad_results_are_ignored(unsplash):
    assert photos._parse("junk") is None
    assert photos._parse({"id": 1}) is None
    bad_host = result(1)
    bad_host["urls"]["raw"] = "https://evil.test/x.jpg"
    assert photos._parse(bad_host) is None
    # The access key is sent to this URL, so it can't point anywhere else.
    bad_location = result(1)
    bad_location["links"]["download_location"] = "https://evil.test/download"
    assert photos._parse(bad_location) is None


def test_sections_hotlink_unsplash_without_repeats(unsplash):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"})
    run(s, "add_section", {"kind": "split", "heading": "Story", "image": "roastery"})
    run(s, "add_section", {"kind": "gallery", "items": [{"title": "Shop", "text": "the counter"}, {"title": "Beans"}]})
    srcs = image_srcs(s)
    assert len(srcs) == 4 and len(set(srcs)) == 4
    assert all(src.startswith("https://images.unsplash.com/") for src in srcs)
    assert next(e for e in walk(s.elements) if e["type"] == "image")["content"]["alt"] == "latte art"


def test_each_used_photo_triggers_one_download_event(unsplash):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"})
    assert [r.url.path for r in unsplash.downloads] == ["/photos/p1/download"]
    assert unsplash.downloads[0].headers["authorization"] == "Client-ID access-key"
    run(s, "add_section", {"kind": "cta", "heading": "Visit"})  # no new photo
    assert len(unsplash.downloads) == 1


def test_failed_download_event_does_not_affect_the_page(unsplash):
    unsplash.download_status = 500
    s = PageSession(body_with())
    assert not run(s, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"}).is_error
    assert image_srcs(s) == [url_of(1)]


def test_page_gets_a_credit_line_that_stays_last_and_grows(unsplash):
    s = PageSession(body_with())
    out = run(s, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"})
    assert out.operation_count == 2  # the section and its credit line
    run(s, "add_section", {"kind": "split", "heading": "Story", "image": "roastery"})
    run(s, "add_section", {"kind": "cta", "heading": "Visit"})
    assert [c["name"] for c in s.elements[0]["content"]] == ["Hero", "Split", "Call to action", CREDITS_NAME]
    row = credits_block(s)["content"][0]
    texts = [c["content"]["innerText"] for c in row["content"]]
    assert texts == ["Photos by", "Person 1", "Person 20", "on", "Unsplash"]
    links = [c["content"]["href"] for c in row["content"] if c["type"] == "link"]
    assert all("utm_source=webpage_builder&utm_medium=referral" in href for href in links)


def test_no_credit_line_without_photos(unsplash):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "cta", "heading": "Visit"})
    assert credits_block(s) is None


def test_later_run_adds_to_the_existing_credit_line(unsplash):
    first = PageSession(body_with())
    run(first, "add_section", {"kind": "hero", "heading": "Coffee", "image": "latte art"})
    second = PageSession(first.elements)
    run(second, "add_section", {"kind": "gallery", "items": [{"title": "Shop", "text": "the counter"}]})
    names = [c["content"]["innerText"] for c in credits_block(second)["content"][0]["content"]]
    # This request's search also returned Person 1's photo first, which is already credited.
    assert names.count("Person 1") == 1 and names[-2:] == ["on", "Unsplash"]


def test_team_keeps_placeholders_and_makes_no_requests(unsplash):
    s = PageSession(body_with())
    run(s, "add_section", {"kind": "team", "items": [{"title": "Ana", "value": "Roaster"}]})
    assert unsplash.searches == []
    assert image_srcs(s)[0].startswith("https://placehold.co/")


def test_no_key_keeps_placeholders(monkeypatch):
    def fail(**kw):
        raise AssertionError("no request should be made")

    monkeypatch.setattr(photos.httpx, "AsyncClient", fail)
    s = PageSession(body_with())
    assert not run(s, "add_section", {"kind": "hero", "heading": "Hi", "image": "latte art"}).is_error
    assert image_srcs(s)[0].startswith("https://placehold.co/")
    out = run(s, "find_photos", {"query": "coffee", "orientation": "square"})
    assert out.is_error and "UNSPLASH_ACCESS_KEY" in out.result


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(403, text="Rate Limit Exceeded"),
        httpx.Response(401, json={"errors": ["bad key"]}),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json=["unexpected"]),
    ],
    ids=["rate-limited", "bad-key", "bad-json", "bad-shape"],
)
def test_search_failures_fall_back_to_placeholders_and_say_so(unsplash, response):
    unsplash.search_response = response
    s = PageSession(body_with())
    out = run(s, "add_section", {"kind": "hero", "heading": "Hi", "image": "latte art"})
    assert not out.is_error and "labeled placeholders: latte art" in out.result
    assert image_srcs(s)[0].startswith("https://placehold.co/")
    assert credits_block(s) is None and photos._cache == {}


# ---------------------------------------------------------------------------
# Images only come from Unsplash or a placeholder; a model can't make one up.
# ---------------------------------------------------------------------------

INVENTED = "https://cdn.ai-images.test/generated-coffee.png"


def page_with_image():
    return body_with(
        {"id": "i1", "name": "Image", "type": "image", "styles": {}, "content": {"src": "https://mine.test/logo.png"}},
        {"id": "b1", "name": "Box", "type": "container", "styles": {"backgroundImage": "url(https://mine.test/bg.png)"}, "content": []},
        {"id": "v1", "name": "Video", "type": "video", "styles": {}, "content": {"src": ""}},
    )


def set_src(session, value, id_="i1"):
    return execute_tool(session, "update_content", {"id": id_, "fields": [{"field": "src", "value": value}]})


def set_background(session, value):
    return execute_tool(session, "update_styles", {"ids": ["b1"], "styles": [{"property": "backgroundImage", "value": value}]})


def test_invented_image_urls_are_rejected_everywhere():
    s = PageSession(page_with_image())
    assert "Never invent" in set_src(s, INVENTED).result
    assert set_background(s, f"url({INVENTED})").is_error
    assert set_src(s, "https://images.unsplash.com/photo-made-up?w=1").is_error  # must be a real result
    assert execute_tool(s, "add_section", {"kind": "hero", "heading": "x", "image": INVENTED}).is_error
    assert execute_tool(s, "add_section", {"kind": "gallery", "items": [{"title": "a", "text": INVENTED}]}).is_error
    assert execute_tool(s, "add_element", {"type": "container", "parent_id": "body", "styles": [{"property": "backgroundImage", "value": f"url({INVENTED})"}]}).is_error
    assert s.operations == []


def test_allowed_image_sources():
    s = PageSession(page_with_image())
    assert not set_src(s, "https://placehold.co/600x400?text=Hi").is_error
    assert not set_background(s, "linear-gradient(135deg, #000 0%, #fff 100%)").is_error
    # Already on the page, so it isn't new: moving it elsewhere is fine.
    assert not set_src(s, "https://mine.test/bg.png").is_error
    assert not set_background(s, "url(https://mine.test/bg.png)").is_error
    # YouTube videos aren't images.
    assert not set_src(s, "https://youtu.be/dQw4w9WgXcQ", "v1").is_error


def test_url_the_user_typed_is_allowed():
    assert urls_in_text("use https://mine.test/a.png, please (or https://x.test/b.jpg).") == {"https://mine.test/a.png", "https://x.test/b.jpg"}
    s = PageSession(page_with_image())
    s.user_urls = urls_in_text("use https://mine.test/a.png please")
    assert not set_src(s, "https://mine.test/a.png").is_error
    assert not execute_tool(s, "add_section", {"kind": "hero", "heading": "x", "image": "https://mine.test/a.png"}).is_error
    assert set_src(s, INVENTED).is_error


def test_agent_passes_the_users_urls(client, monkeypatch):
    provider = FakeProvider([
        Step(tool_calls=[
            ToolCall("1", "update_content", {"id": "i1", "fields": [{"field": "src", "value": "https://user.test/own.png"}]}),
            ToolCall("2", "update_content", {"id": "i1", "fields": [{"field": "src", "value": INVENTED}]}),
        ]),
        Step(text="Done."),
    ])
    monkeypatch.setitem(registry.PROVIDERS, "fake", provider)
    got = events(client.post("/api/ai", json={"prompt": "use https://user.test/own.png", "elements": page_with_image(), "provider": "fake"}))
    assert [e["type"] for e in got] == ["operations", "done"]
    assert [r.is_error for r in provider.conversation.results[0]] == [False, True]


def test_no_provider_ever_requests_image_generation():
    source = "".join(p.read_text(encoding="utf-8") for p in (Path(__file__).parents[1] / "app").rglob("*.py")).lower()
    for marker in ("generate_images", "response_modalities", "images.generate", "imagen", "dall-e"):
        assert marker not in source, marker


def test_find_photos_then_swap_image_and_credit(client, monkeypatch, unsplash):
    page = page_with_image()
    url = url_of(1)
    provider = FakeProvider([
        Step(tool_calls=[ToolCall("1", "find_photos", {"query": "coffee", "orientation": "landscape"})]),
        Step(tool_calls=[ToolCall("2", "update_content", {"id": "i1", "fields": [{"field": "src", "value": url}]})]),
        Step(text="Swapped it."),
    ])
    monkeypatch.setitem(registry.PROVIDERS, "fake", provider)
    got = events(client.post("/api/ai", json={"prompt": "use a real photo", "elements": page, "provider": "fake"}))
    assert provider.conversation.results[0][0].content.splitlines()[1].startswith(url)
    assert got[0]["operations"][0]["content"]["src"] == url
    assert [op["op"] for op in got[0]["operations"]] == ["update_content", "insert"]  # plus the credit line
    # Only the photo that ended up on the page counts.
    assert len(unsplash.downloads) == 1
    assert got[-1]["photoCredits"] == [{"name": "Person 1", "url": "https://unsplash.com/@p1?utm_source=webpage_builder&utm_medium=referral"}]
    json.dumps(got)


def test_background_photos_are_credited(unsplash):
    s = PageSession(page_with_image())
    assert not run(s, "find_photos", {"query": "coffee", "orientation": "landscape"}).is_error
    run(s, "update_styles", {"ids": ["b1"], "styles": [{"property": "backgroundImage", "value": f"url({url_of(1)})"}]})
    assert [c["name"] for c in s.photo_credits()] == ["Person 1"]
    assert find_element(s.elements, "b1")["styles"]["backgroundImage"] == f"url({url_of(1)})"


def test_no_credits_without_photos(client, monkeypatch):
    monkeypatch.setitem(registry.PROVIDERS, "fake", FakeProvider([Step(text="Nothing to do.")]))
    got = events(client.post("/api/ai", json={"prompt": "hi", "elements": body_with(), "provider": "fake"}))
    assert "photoCredits" not in got[-1]
