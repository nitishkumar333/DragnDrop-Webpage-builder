import json

import pytest

from app.ai import providers as registry
from app.ai.operations import walk
from app.ai.providers.base import Conversation, Provider, ProviderError, Step, ToolCall

from .conftest import body_with


class ScriptedConversation(Conversation):
    def __init__(self, script, user_message, history):
        self.script = list(script)
        self.user_message = user_message
        self.history = history
        self.results = []

    async def next_step(self):
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step

    def add_tool_results(self, results):
        self.results.append(results)


class FakeProvider(Provider):
    id = "fake"
    label = "Fake"
    api_key_env = "FAKE_API_KEY"
    model_env = "FAKE_MODEL"
    default_model = "fake-1"

    def __init__(self, script):
        self.script = script
        self.conversation = None

    def configured(self):
        return True

    def start(self, *, system, tools, history, user_message):
        assert "add_section" in [t.name for t in tools] and "design assistant" in system
        self.conversation = ScriptedConversation(self.script, user_message, history)
        return self.conversation


@pytest.fixture
def fake(monkeypatch):
    def install(script):
        provider = FakeProvider(script)
        monkeypatch.setitem(registry.PROVIDERS, "fake", provider)
        return provider

    return install


def events(response):
    return [json.loads(line) for line in response.text.splitlines() if line]


PAGE = body_with({"id": "abc123-x", "name": "Heading", "type": "heading", "styles": {}, "content": {"innerText": "Hi"}})


def test_streams_operations_then_done(client, fake):
    provider = fake([
        Step(tool_calls=[
            ToolCall("1", "add_section", {"kind": "cta", "heading": "Ready?"}),
            ToolCall("2", "update_styles", {"ids": ["zzzzzz"], "styles": [{"property": "color", "value": "red"}]}),
        ]),
        Step(text="Added a call to action."),
    ])
    response = client.post("/api/ai", json={
        "prompt": "add a cta", "elements": PAGE, "provider": "fake", "selectedId": "abc123-x",
        "history": [{"role": "assistant", "content": "orphan"}, {"role": "user", "content": "earlier"}, {"role": "assistant", "content": "ok"}],
    })
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    got = events(response)
    assert [e["type"] for e in got] == ["operations", "done"]
    assert got[0]["operations"][0]["op"] == "insert" and got[0]["status"] == "Added Call to action section"
    assert got[1] == {"type": "done", "message": "Added a call to action.", "changeCount": 1, "provider": "fake", "model": "fake-1"}

    conv = provider.conversation
    assert "Selected element: [abc123] heading" in conv.user_message and conv.user_message.endswith("Request:\nadd a cta")
    assert [t.role for t in conv.history] == ["user", "assistant"]  # leading assistant turn dropped
    errors = [r for r in conv.results[0] if r.is_error]
    assert len(errors) == 1 and "does not exist" in errors[0].content


def test_builds_a_whole_page_section_by_section(client, fake):
    page = body_with({"id": "old1", "name": "Old", "type": "heading", "styles": {}, "content": {"innerText": "Old"}})
    fake([
        Step(tool_calls=[
            ToolCall("1", "start_page", {
                "accent": "#b45309", "background": "#fffbeb", "surface": "#ffffff", "text": "#292524", "muted": "#78716c",
                "heading_font": "Playfair Display", "body_font": "Inter", "corners": "soft", "replace_existing": True,
            }),
            ToolCall("2", "add_section", {"kind": "navbar", "heading": "Ember"}),
        ]),
        Step(tool_calls=[ToolCall("3", "add_section", {"kind": "hero", "heading": "Roasted slowly"})]),
        Step(text="Built your page."),
    ])
    got = events(client.post("/api/ai", json={"prompt": "coffee site", "elements": page, "provider": "fake"}))
    assert [e["type"] for e in got] == ["operations", "operations", "operations", "done"]
    assert [e.get("status") for e in got[:3]] == ["Set up the page design", "Added Navbar section", "Added Hero section"]
    assert [op["op"] for op in got[0]["operations"]] == ["delete", "update_styles"]
    # A later section uses the design chosen earlier in the run.
    hero_heading = next(el for el in walk([got[2]["operations"][0]["element"]]) if el["type"] == "heading")
    assert hero_heading["styles"]["fontFamily"] == "'Playfair Display', serif"


def test_refusal_and_provider_errors(client, fake):
    fake([Step(refused=True)])
    assert events(client.post("/api/ai", json={"prompt": "x", "elements": PAGE, "provider": "fake"})) == [
        {"type": "error", "message": "The AI declined this request. Try rephrasing it."}
    ]
    fake([ProviderError("Gemini is rate limited right now.")])
    assert events(client.post("/api/ai", json={"prompt": "x", "elements": PAGE, "provider": "fake"}))[0]["message"] == "Gemini is rate limited right now."


def test_invalid_tool_json_is_reported_back(client, fake):
    provider = fake([Step(tool_calls=[ToolCall("1", "add_block", None, parse_error="bad json")]), Step(text="ok")])
    got = events(client.post("/api/ai", json={"prompt": "x", "elements": PAGE, "provider": "fake"}))
    assert got[-1]["type"] == "done" and provider.conversation.results[0][0].content == "bad json"


def test_validation(client):
    assert client.post("/api/ai", content="{").status_code == 400
    assert client.post("/api/ai", json={"prompt": "x", "elements": [{"id": "nope"}]}).status_code == 400
    assert client.post("/api/ai", json={"prompt": "x", "elements": [{"id": "x", "name": "x", "content": []}]}).status_code == 400
    assert client.post("/api/ai", json={"prompt": "", "elements": PAGE}).status_code == 400


def test_not_configured(client):
    response = client.post("/api/ai", json={"prompt": "x", "elements": PAGE})
    assert response.status_code == 503 and "API key" in response.json()["error"]
    response = client.post("/api/ai", json={"prompt": "x", "elements": PAGE, "provider": "groq"})
    assert response.status_code == 503 and "GROQ_API_KEY" in response.json()["error"]


def test_providers_endpoint(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "k")
    data = client.get("/api/ai/providers").json()
    assert data["default"] == "deepseek"  # first configured, in registry order
    assert {p["id"]: p["configured"] for p in data["providers"]} == {"anthropic": False, "gemini": False, "deepseek": True, "groq": True}
    monkeypatch.setenv("AI_PROVIDER", "groq")
    assert client.get("/api/ai/providers").json()["default"] == "groq"
