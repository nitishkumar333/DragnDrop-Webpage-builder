import json

import pytest

from app.ai.design import contrast, infer_design, make_design
from app.ai.operations import walk
from app.ai.page_session import PageSession
from app.ai.router import is_element_tree
from app.ai.sections import SECTION_KINDS
from app.ai.tools import TOOLS, execute_tool

from .conftest import body_with

SECTION_SPECS = [
    {"kind": "navbar", "heading": "Ember", "primary_label": "Order", "items": [{"title": "Menu", "href": "#menu"}]},
    {"kind": "hero", "heading": "Coffee", "subheading": "Sub", "primary_label": "Go", "secondary_label": "More", "image": "Latte art"},
    {"kind": "hero", "variant": "split", "eyebrow": "New", "heading": "Coffee", "image": "Latte art"},
    {"kind": "logos", "heading": "As seen in", "items": [{"title": "Times"}, {"title": "Post"}]},
    {"kind": "stats", "items": [{"value": "12k", "title": "Cups"}, {"value": "4.9", "title": "Rating"}]},
    {"kind": "features", "heading": "Why", "items": [{"icon": "☕", "title": "Fresh", "text": "Daily"}, {"title": "Local", "text": "Farms"}]},
    {"kind": "features", "variant": "columns", "items": [{"title": "Fresh", "text": "Daily"}]},
    {"kind": "split", "variant": "image_left", "heading": "Our story", "image": "Roastery", "items": [{"title": "Since 1998"}]},
    {"kind": "steps", "heading": "How", "items": [{"title": "Order", "text": "Online"}, {"title": "Sip"}]},
    {"kind": "testimonials", "items": [{"text": "Great", "title": "Ana Ruiz", "value": "Regular"}]},
    {"kind": "testimonials", "heading": "Love", "items": [{"text": "Great", "title": "Ana"}, {"text": "Good", "title": "Bo"}]},
    {"kind": "pricing", "primary_label": "Join", "items": [{"title": "Basic", "value": "$9", "points": ["One bag"]}, {"title": "Plus", "value": "$19", "points": ["Two"], "highlighted": True}]},
    {"kind": "faq", "heading": "FAQ", "items": [{"title": "Open?", "text": "Daily"}]},
    {"kind": "gallery", "items": [{"title": "Shop", "text": "The front counter"}]},
    {"kind": "team", "items": [{"title": "Ana", "value": "Roaster", "text": "Bio"}]},
    {"kind": "cta", "heading": "Visit", "primary_label": "Directions"},
    {"kind": "cta", "background": "dark", "heading": "Visit"},
    {"kind": "contact", "heading": "Say hi", "items": [{"title": "Email", "text": "hi@ember.test"}]},
    {"kind": "footer", "heading": "Ember", "subheading": "Slow coffee", "items": [{"title": "Shop", "points": ["Beans"]}]},
]

DESIGN_INPUT = {
    "accent": "#b45309", "background": "#fffbeb", "surface": "#ffffff", "text": "#292524", "muted": "#78716c",
    "heading_font": "Playfair Display", "body_font": "Inter", "corners": "round", "replace_existing": True,
}


def new_session(*children):
    return PageSession(body_with(*children))


def test_every_kind_is_covered_and_tool_schema_requires_every_field():
    assert {s["kind"] for s in SECTION_SPECS} == set(SECTION_KINDS)
    # All-required fields keep the schemas valid for strict tool modes on every provider.
    for name in ("start_page", "add_section"):
        schema = next(t.parameters for t in TOOLS if t.name == name)
        assert set(schema["required"]) == set(schema["properties"])
    json.dumps([t.parameters for t in TOOLS])


@pytest.mark.parametrize("spec", SECTION_SPECS, ids=lambda s: f"{s['kind']}-{s.get('variant', s.get('background', 'auto'))}")
@pytest.mark.parametrize("background", ["default", "alt", "dark", "accent"])
def test_sections_render_valid_unique_readable_trees(spec, background):
    s = new_session()
    assert not execute_tool(s, "start_page", DESIGN_INPUT).is_error
    out = execute_tool(s, "add_section", {"background": background, **spec})
    assert not out.is_error, out.result
    assert is_element_tree(s.elements)
    elements = list(walk(s.elements))
    assert len({e["id"] for e in elements}) == len(elements)
    assert "styles" not in out.result and "{" not in out.result  # outline for the model stays compact


def test_sections_drop_unsafe_links():
    s = new_session()
    execute_tool(s, "add_section", {"kind": "cta", "heading": "x", "primary_label": "Go", "primary_href": "javascript:alert(1)"})
    button = next(e for e in walk(s.elements) if e["type"] == "button")
    assert button["content"]["href"] == "#"


def test_section_needs_its_content():
    s = new_session()
    assert execute_tool(s, "add_section", {"kind": "hero"}).is_error
    assert execute_tool(s, "add_section", {"kind": "features", "heading": "x"}).is_error
    assert execute_tool(s, "add_section", {"kind": "pricing", "items": [{"title": "a"}]}).is_error
    assert execute_tool(s, "add_section", {"kind": "unknown"}).is_error
    assert s.operations == []


def test_section_positions():
    first = {"id": "s1", "name": "A", "type": "container", "styles": {}, "content": [
        {"id": "h1", "name": "H", "type": "heading", "styles": {}, "content": {"innerText": "x"}}]}
    second = {"id": "s2", "name": "B", "type": "container", "styles": {}, "content": []}
    s = new_session(first, second)
    execute_tool(s, "add_section", {"kind": "cta", "heading": "after", "position": "h1"})
    assert s.operations[-1]["index"] == 1
    execute_tool(s, "add_section", {"kind": "navbar", "heading": "b", "position": "top"})
    assert s.operations[-1]["index"] == 0
    execute_tool(s, "add_section", {"kind": "footer", "heading": "b", "position": "end"})
    assert "index" not in s.operations[-1]
    assert execute_tool(s, "add_section", {"kind": "cta", "heading": "x", "position": "zzzzzz"}).is_error


def test_start_page_replaces_only_when_asked_and_validates():
    old = {"id": "s1", "name": "A", "type": "container", "styles": {}, "content": []}
    s = new_session(old)
    assert execute_tool(s, "start_page", {**DESIGN_INPUT, "accent": "red"}).is_error
    assert execute_tool(s, "start_page", {**DESIGN_INPUT, "body_font": "Comic Sans"}).is_error
    assert s.operations == [] and s.design is None

    assert not execute_tool(s, "start_page", {**DESIGN_INPUT, "replace_existing": False}).is_error
    assert len(s.elements[0]["content"]) == 1
    assert s.elements[0]["styles"] == {"backgroundColor": "#fffbeb", "color": "#292524", "fontFamily": "'Inter', sans-serif"}

    assert not execute_tool(s, "start_page", DESIGN_INPUT).is_error
    assert s.elements[0]["content"] == []


def test_poor_colors_are_made_readable():
    design = make_design(accent="#ffee00", background="#ffffff", surface="#ffffff", text="#eeeeee", muted="#fafafa",
                         heading_font="x", body_font="y")
    assert contrast(design.text, design.background) >= 4.5
    for name in ("default", "alt", "dark", "accent"):
        tone = design.tone(name)
        assert contrast(tone.text, tone.background) >= 4.5, name
        assert contrast(tone.muted, tone.background) >= 4.5, name
        assert contrast(tone.accent_text, tone.background) >= 4.5, name
        assert contrast(tone.on_primary, tone.primary) >= 4.5, name


def test_new_section_matches_an_existing_page():
    button = {"id": "b1", "name": "Button", "type": "button", "content": {"innerText": "Go"},
              "styles": {"backgroundColor": "#be123c", "borderRadius": "999px"}}
    ghost = {"id": "b0", "name": "Button", "type": "button", "content": {"innerText": "No"},
             "styles": {"backgroundColor": "#ffffff"}}
    title = {"id": "h1", "name": "H", "type": "heading", "content": {"innerText": "x"},
             "styles": {"fontFamily": "'Lora', serif"}}
    tree = body_with(ghost, button, title)
    tree[0]["styles"] = {"backgroundColor": "#111827", "color": "#f9fafb", "fontFamily": "'Inter', sans-serif"}
    design = infer_design(tree)
    assert (design.accent, design.corners, design.heading_font, design.body_font) == ("#be123c", "pill", "'Lora', serif", "'Inter', sans-serif")
    assert design.is_dark

    s = PageSession(tree)
    execute_tool(s, "add_section", {"kind": "cta", "heading": "Ready", "background": "default", "primary_label": "Go"})
    heading = next(e for e in walk([s.elements[0]["content"][-1]]) if e["type"] == "heading")
    assert heading["styles"]["fontFamily"] == "'Lora', serif"


def test_inference_handles_empty_and_unusual_pages():
    design = infer_design(body_with())
    assert design.background == "#ffffff" and not design.is_dark
    tree = body_with()
    tree[0]["styles"] = {"backgroundColor": "rgb(0,0,0)", "color": "var(--x)"}
    assert infer_design(tree).background == "#ffffff"
