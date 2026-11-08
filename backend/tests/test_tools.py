from app.ai.operations import apply_operation, find_element, find_parent, walk
from app.ai.page_session import PageSession
from app.ai.tools import execute_tool

from .conftest import body_with


def heading(id_, text="Hi"):
    return {"id": id_, "name": "Heading", "type": "heading", "styles": {"marginTop": "0px", "fontSize": "40px"}, "content": {"innerText": text, "level": "h2"}}


def section(id_, *children):
    return {"id": id_, "name": "Section", "type": "container", "styles": {}, "content": list(children)}


def test_short_ids_are_stable_and_unique():
    tree = body_with(heading("abcdef12-0000"), heading("abcdef34-0000"), heading("ABCDEF12-1111"))
    s = PageSession(tree)
    assert s.short_id("__body") == "body"
    shorts = {s.short_id(e["id"]) for e in tree[0]["content"]}
    assert len(shorts) == 3
    assert s.short_id("abcdef12-0000") == "abcdef"
    assert PageSession(body_with(heading("abcdef12-0000"))).short_id("abcdef12-0000") == "abcdef"
    assert s.real_id("[ABCDEF]") == "abcdef12-0000"


def test_outline_skips_noise():
    s = PageSession(body_with(heading("h1")))
    line = s.serialize().splitlines()[1]
    assert line == '  [h1] heading h2 "Heading" text="Hi" {fontSize:40px}'


def test_update_styles_sanitizes_and_normalizes():
    s = PageSession(body_with(heading("h1"), heading("h2")))
    out = execute_tool(s, "update_styles", {"ids": ["h1", "h2"], "styles": [
        {"property": "fontSize", "value": "48"},
        {"property": "fontFamily", "value": "playfair display"},
        {"property": "lineHeight", "value": "1.2"},
        {"property": "marginTop", "value": ""},
    ]})
    assert not out.is_error and out.status == "Restyled 2 elements"
    styles = find_element(s.elements, "h1")["styles"]
    assert styles["fontSize"] == "48px"
    assert styles["fontFamily"] == "'Playfair Display', serif"
    assert styles["lineHeight"] == "1.2"
    assert "marginTop" not in styles


def test_unsafe_values_are_rejected_without_changes():
    s = PageSession(body_with(heading("h1")))
    for value in ("url(javascript:alert(1))", "expression(alert(1))", "<script>", "url(http://x.com/a.png)"):
        out = execute_tool(s, "update_styles", {"ids": ["h1"], "styles": [{"property": "backgroundImage", "value": value}]})
        assert out.is_error, value
    assert s.operations == []
    s.user_urls = {"https://x.com/a.png"}  # the user gave this one
    assert not execute_tool(s, "update_styles", {"ids": ["h1"], "styles": [{"property": "backgroundImage", "value": "url(https://x.com/a.png)"}]}).is_error


def test_update_content_fields():
    button = {"id": "b1", "name": "Button", "type": "button", "styles": {}, "content": {"innerText": "Go", "href": "#"}}
    video = {"id": "v1", "name": "Video", "type": "video", "styles": {}, "content": {"src": ""}}
    s = PageSession(body_with(heading("h1"), button, video))
    assert execute_tool(s, "update_content", {"id": "b1", "fields": [{"field": "href", "value": "javascript:alert(1)"}]}).is_error
    assert execute_tool(s, "update_content", {"id": "h1", "fields": [{"field": "href", "value": "/x"}]}).is_error
    assert not execute_tool(s, "update_content", {"id": "b1", "fields": [{"field": "text", "value": "Buy"}, {"field": "open_in_new_tab", "value": "true"}]}).is_error
    assert find_element(s.elements, "b1")["content"] == {"innerText": "Buy", "href": "#", "target": "_blank"}
    execute_tool(s, "update_content", {"id": "v1", "fields": [{"field": "src", "value": "https://youtu.be/dQw4w9WgXcQ"}]})
    assert find_element(s.elements, "v1")["content"]["src"] == "https://www.youtube.com/embed/dQw4w9WgXcQ"
    execute_tool(s, "update_content", {"id": "h1", "fields": [{"field": "heading_level", "value": "H1"}]})
    h = find_element(s.elements, "h1")
    assert h["content"]["level"] == "h1" and h["styles"]["fontSize"] == "56px"


def test_unknown_ids_and_bad_input_are_errors():
    s = PageSession(body_with(heading("h1")))
    out = execute_tool(s, "update_styles", {"ids": ["zzzzzz"], "styles": [{"property": "color", "value": "red"}]})
    assert out.is_error and out.result == 'Element "zzzzzz" does not exist on the page.'
    assert execute_tool(s, "update_styles", {"ids": ["h1"], "styles": [{"property": "position", "value": "fixed"}]}).is_error
    assert execute_tool(s, "nope", {}).is_error
    assert execute_tool(s, "delete_elements", {"ids": ["body"]}).is_error
    assert execute_tool(s, "add_element", {"type": "text", "parent_id": "h1", "styles": []}).is_error


def test_add_move_duplicate_delete():
    s = PageSession(body_with(section("s1", heading("h1")), section("s2")))
    out = execute_tool(s, "add_element", {"type": "button", "parent_id": "s1", "after_id": "top", "text": "Hey", "styles": [{"property": "borderRadius", "value": "999px"}]})
    new = s.elements[0]["content"][0]["content"][0]
    assert not out.is_error and new["content"]["innerText"] == "Hey" and new["styles"]["borderRadius"] == "999px"

    assert not execute_tool(s, "move_element", {"id": "h1", "parent_id": "s2"}).is_error
    assert find_parent(s.elements, "h1")["id"] == "s2"
    assert execute_tool(s, "move_element", {"id": "s2", "parent_id": "h1"}).is_error  # not a container
    assert execute_tool(s, "move_element", {"id": "s1", "parent_id": "s1"}).is_error  # inside itself

    assert not execute_tool(s, "duplicate_element", {"id": "s2"}).is_error
    body = s.elements[0]["content"]
    assert len(body) == 3 and body[2]["content"][0]["id"] != "h1"

    assert not execute_tool(s, "delete_elements", {"ids": ["s1", "s2"]}).is_error
    assert len(s.elements[0]["content"]) == 1


def test_inserted_element_in_operation_is_not_mutated_later():
    s = PageSession(body_with())
    execute_tool(s, "add_section", {"kind": "cta", "heading": "Original", "variant": "auto"})
    sent = s.operations[0]["element"]
    sent_heading = next(el for el in walk([sent]) if el["type"] == "heading")
    execute_tool(s, "update_content", {"id": s.short_id(sent_heading["id"]), "fields": [{"field": "text", "value": "Changed"}]})
    assert sent_heading["content"]["innerText"] == "Original"
    assert find_element(s.elements, sent_heading["id"])["content"]["innerText"] == "Changed"


def test_operations_skip_invalid_targets():
    tree = body_with(section("s1"))
    apply_operation(tree, {"op": "insert", "parentId": "missing", "element": heading("x")})
    apply_operation(tree, {"op": "update_content", "id": "s1", "content": {"innerText": "x"}})
    apply_operation(tree, {"op": "delete", "id": "__body"})
    assert tree == body_with(section("s1"))
