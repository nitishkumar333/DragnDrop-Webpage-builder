import os

import pytest

# Never touch the real database or real AI providers from tests.
os.environ["PAGES_STORE"] = "memory"
PROVIDER_KEYS = ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "DEEPSEEK_API_KEY", "GROQ_API_KEY")


@pytest.fixture(autouse=True)
def no_provider_keys(monkeypatch):
    for key in PROVIDER_KEYS + ("AI_PROVIDER", "UNSPLASH_ACCESS_KEY"):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


def body_with(*children):
    return [{"id": "__body", "name": "Body", "type": "__body", "styles": {}, "content": list(children)}]
