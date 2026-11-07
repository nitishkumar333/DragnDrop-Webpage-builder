"""Element and block templates exported from the editor's element factory.

Regenerate with `npm run export:templates` after changing
src/lib/element-factory.ts or the fonts in src/lib/design-tokens.ts.
"""

import json
import uuid
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

_FILE = Path(__file__).with_name("element_templates.json")


@lru_cache
def _data() -> dict[str, Any]:
    return json.loads(_FILE.read_text(encoding="utf-8"))


def fonts() -> list[dict[str, str]]:
    return _data()["fonts"]


def _with_new_ids(element: dict[str, Any]) -> dict[str, Any]:
    """Give the element and every descendant a fresh id (replacing any existing one)."""
    element = {"id": str(uuid.uuid4()), **{k: v for k, v in element.items() if k != "id"}}
    if isinstance(element.get("content"), list):
        element["content"] = [_with_new_ids(child) for child in element["content"]]
    return element


def create_element(kind: str) -> dict[str, Any] | None:
    """A fresh copy of a template with new ids (like createElement in the editor)."""
    template = _data()["templates"].get(kind)
    return _with_new_ids(deepcopy(template)) if template else None


def clone_with_new_ids(element: dict[str, Any]) -> dict[str, Any]:
    """Deep copy with fresh ids (like cloneWithNewIds in the editor)."""
    return _with_new_ids(deepcopy(element))
