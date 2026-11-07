"""Element-tree helpers and operations.

Mirrors src/lib/editor-tree.ts and src/lib/ai/operations.ts. The editor applies
the same operations to its own copy of the page, so the semantics (indexes,
skipping operations that no longer apply) must stay identical.
"""

from copy import deepcopy
from typing import Any, Iterator

Element = dict[str, Any]
Operation = dict[str, Any]


def is_container(el: Element) -> bool:
    return isinstance(el.get("content"), list)


def walk(elements: list[Element]) -> Iterator[Element]:
    for el in elements:
        yield el
        if is_container(el):
            yield from walk(el["content"])


def find_element(elements: list[Element], element_id: str) -> Element | None:
    return next((el for el in walk(elements) if el.get("id") == element_id), None)


def find_parent(
    elements: list[Element], element_id: str, parent: Element | None = None
) -> Element | None:
    for el in elements:
        if el.get("id") == element_id:
            return parent
        if is_container(el):
            found = find_parent(el["content"], element_id, el)
            if found is not None:
                return found
    return None


def top_level_ancestor(elements: list[Element], element_id: str) -> Element | None:
    """The ancestor of `element_id` that sits directly inside the body (or itself)."""
    current = find_element(elements, element_id)
    while current is not None:
        parent = find_parent(elements, current["id"])
        if parent is None or parent.get("type") == "__body":
            return current
        current = parent
    return None


def merge_styles(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Empty-string (or None) values remove the property."""
    merged = dict(current or {})
    for prop, value in patch.items():
        if value is None or value == "":
            merged.pop(prop, None)
        else:
            merged[prop] = value
    return merged


def _remove(elements: list[Element], element_id: str) -> None:
    elements[:] = [el for el in elements if el.get("id") != element_id]
    for el in elements:
        if is_container(el):
            _remove(el["content"], element_id)


def _insert(container: Element, element: Element, index: int | None) -> None:
    children = container["content"]
    at = len(children) if index is None or index < 0 or index > len(children) else index
    children.insert(at, element)


def _move(elements: list[Element], element_id: str, container_id: str, index: int | None) -> None:
    if element_id == "__body" or element_id == container_id:
        return
    moving = find_element(elements, element_id)
    target = find_element(elements, container_id)
    if moving is None or target is None or not is_container(target):
        return
    if find_element([moving], container_id) is not None:  # never inside itself
        return
    parent = find_parent(elements, element_id)
    if parent is not None and parent["id"] == container_id:
        old_index = next(i for i, c in enumerate(parent["content"]) if c["id"] == element_id)
        if index is None:
            index = len(parent["content"])
        if old_index < index:
            index -= 1
        if old_index == index:
            return
    _remove(elements, element_id)
    _insert(target, moving, index)


def apply_operation(elements: list[Element], op: Operation) -> None:
    """Apply one operation in place; operations that no longer make sense are skipped."""
    kind = op["op"]
    if kind == "insert":
        parent = find_element(elements, op["parentId"])
        if parent is None or not is_container(parent):
            return
        if find_element(elements, op["element"]["id"]) is not None:
            return
        # Copy, so later operations never change the element already sent to the editor.
        _insert(parent, deepcopy(op["element"]), op.get("index"))
    elif kind == "update_styles":
        el = find_element(elements, op["id"])
        if el is not None:
            el["styles"] = merge_styles(el.get("styles") or {}, op["styles"])
    elif kind == "update_content":
        el = find_element(elements, op["id"])
        if el is not None and not is_container(el):
            el["content"] = {**(el.get("content") or {}), **op["content"]}
    elif kind == "delete":
        if op["id"] != "__body" and find_element(elements, op["id"]) is not None:
            _remove(elements, op["id"])
    elif kind == "move":
        _move(elements, op["id"], op["parentId"], op.get("index"))


def operation(**fields: Any) -> Operation:
    """Build an operation; an unset index is omitted (it means 'append')."""
    return {k: v for k, v in fields.items() if not (k == "index" and v is None)}
