"""Settings, read from the repository's .env (shared with Next.js) and the environment."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

# Real environment variables win over both files; backend/.env is optional.
load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")


def env(name: str, default: str = "") -> str:
    value = os.environ.get(name, "").strip()
    return value or default


def cors_origins() -> list[str]:
    """Origins allowed to call the API directly (the Next.js app normally proxies)."""
    raw = env("CORS_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]
