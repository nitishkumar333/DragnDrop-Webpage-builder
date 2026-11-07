"""The server's working copy of a page during one AI request.

- Gives every element a short, stable id ("body", "3f9a1c", ...) derived from
  its uuid, so the model works with compact ids that stay the same across chat
  turns.
- Applies operations to its copy of the tree and records them, so the editor
  can replay exactly the same changes.
"""

import json
import re
from typing import Any

from .operations import Element, Operation, apply_operation, is_container, walk

# Style values every element carries by default; omitted to save tokens.
DEFAULT_STYLE_VALUES = {
    "backgroundPosition": "center",
    "backgroundRepeat": "no-repeat",
    "objectFit": "cover",
    "opacity": "100%",
    "textAlign": "left",
}
_SPACING_KEY = re.compile(r"^(margin|padding)(Top|Right|Bottom|Left)?$")
_ZERO = re.compile(r"^0(px)?$")


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[:limit] + "…"


def _quote(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _css_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


class PageSession:
    def __init__(self, elements: list[Element]):
        self.elements = elements
        self.operations: list[Operation] = []
        self._to_short: dict[str, str] = {}
        self._to_real: dict[str, str] = {}
        for el in walk(elements):
            self.register(el["id"])

    def register(self, real_id: str) -> str:
        """Assign a short id to a real id (no-op when it already has one)."""
        if real_id in self._to_short:
            return self._to_short[real_id]
        if real_id == "__body":
            short = "body"
        else:
            base = re.sub(r"[^a-z0-9]", "", real_id.lower()) or "el"
            length = 6
            short = base[:length]
            while short in self._to_real and length < len(base):
                length += 1
                short = base[:length]
            stem, n = short, 2
            while short in self._to_real:
                short = f"{stem}{n}"
                n += 1
        self._to_short[real_id] = short
        self._to_real[short] = real_id
        return short

    def short_id(self, real_id: str) -> str:
        return self._to_short.get(real_id) or self.register(real_id)

    def real_id(self, short_id: str) -> str | None:
        """Resolve a short id from the model to a real id."""
        key = short_id.strip().lower()
        if key.startswith("["):
            key = key[1:]
        if key.endswith("]"):
            key = key[:-1]
        return self._to_real.get(key)

    def apply(self, op: Operation) -> None:
        if op["op"] == "insert":
            for el in walk([op["element"]]):
                self.register(el["id"])
        apply_operation(self.elements, op)
        self.operations.append(op)

    @staticmethod
    def label(el: Element) -> str:
        """A short human label for status messages."""
        return el.get("name") or el.get("type") or "element"

    def serialize(self, elements: list[Element] | None = None, depth: int = 0) -> str:
        """One line per element, indented by depth."""
        lines: list[str] = []
        for el in self.elements if elements is None else elements:
            lines.append(self._describe(el, depth))
            if is_container(el):
                children = self.serialize(el["content"], depth + 1)
                if children:
                    lines.append(children)
        return "\n".join(lines)

    def _describe(self, el: Element, depth: int) -> str:
        indent = "  " * depth
        parts = [f"{indent}[{self.short_id(el['id'])}] {el.get('type')}"]
        content = el.get("content")
        leaf = isinstance(content, dict)
        if leaf and content.get("level"):
            parts.append(content["level"])
        parts.append(_quote(el.get("name") or ""))
        if leaf:
            if content.get("innerText") is not None:
                parts.append("text=" + _quote(_truncate(str(content["innerText"]), 400)))
            if content.get("href"):
                parts.append("href=" + _quote(_truncate(str(content["href"]), 200)))
            if content.get("target") == "_blank":
                parts.append("new_tab")
            if content.get("src"):
                parts.append("src=" + _quote(_truncate(str(content["src"]), 200)))
            if content.get("alt"):
                parts.append("alt=" + _quote(_truncate(str(content["alt"]), 120)))
        styles = []
        for key, value in (el.get("styles") or {}).items():
            if value is None or value == "":
                continue
            text = _css_value(value)
            if DEFAULT_STYLE_VALUES.get(key) == text:
                continue
            if _SPACING_KEY.match(key) and _ZERO.match(text):
                continue
            styles.append(f"{key}:{_truncate(text, 200)}")
        if styles:
            parts.append("{" + "; ".join(styles) + "}")
        return " ".join(parts)
