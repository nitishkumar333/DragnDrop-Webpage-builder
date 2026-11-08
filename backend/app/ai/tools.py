"""The tools the model uses to edit the page, their validation and execution.

The definitions are plain JSON Schema shared by every provider; each provider
adapts them to its own format.
"""

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from . import photos, sections, templates
from .design import CORNERS, font_value, infer_design, is_hex, make_design, normalize_hex
from .operations import find_element, find_parent, merge_styles, operation, top_level_ancestor
from .page_session import PageSession
from .sections import SAFE_HREF as _SAFE_HREF
from .sections import SAFE_SRC as _SAFE_SRC
from .sections import AddSection

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

ELEMENT_KINDS = {
    "heading": "heading",
    "text": "text",
    "button": "button",
    "link": "link",
    "image": "image",
    "video": "video",
    "divider": "divider",
    "spacer": "spacer",
    "container": "container",
    "two_columns": "2Col",
    "contact_form": "contactForm",
}

# CSS properties the assistant may set (camelCase, as stored on elements).
STYLE_PROPERTIES = (
    "color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing",
    "textAlign", "textTransform", "textDecoration",
    "width", "height", "maxWidth", "minHeight",
    "marginTop", "marginRight", "marginBottom", "marginLeft",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "display", "flexDirection", "flexWrap", "justifyContent", "alignItems", "gap",
    "gridTemplateColumns", "flex",
    "borderRadius", "borderWidth", "borderStyle", "borderColor", "boxShadow",
    "opacity", "objectFit", "aspectRatio",
)

CONTENT_FIELDS = ("text", "href", "src", "alt", "heading_level", "open_in_new_tab")

# Which content fields make sense for which element types.
FIELD_TYPES = {
    "text": ("text", "heading", "button", "link"),
    "href": ("button", "link"),
    "open_in_new_tab": ("button", "link"),
    "src": ("image", "video"),
    "alt": ("image",),
    "heading_level": ("heading",),
}

HEADING_SIZES = {"h1": "56px", "h2": "40px", "h3": "28px", "h4": "22px"}

UNITLESS = {"fontWeight", "lineHeight", "opacity", "flex", "aspectRatio"}

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

_ID = 'Short element id from the page outline, e.g. "3f9a1c" or "body".'

_STYLE_LIST = {
    "type": "array",
    "description": (
        'CSS declarations. Use camelCase property names and CSS values with units ("48px", '
        '"#0f172a", "1.4"). An empty string removes the property.'
    ),
    "items": {
        "type": "object",
        "properties": {
            "property": {"type": "string", "enum": list(STYLE_PROPERTIES)},
            "value": {"type": "string"},
        },
        "required": ["property", "value"],
        "additionalProperties": False,
    },
}


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]


def _object(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


_COLOR = 'A hex color such as "#1d4ed8".'

_SECTION_ITEM = _object(
    {
        "title": {"type": "string", "description": "Name, title, question, plan, link column or label."},
        "text": {"type": "string", "description": "Description, answer, quote or image description."},
        "value": {"type": "string", "description": 'A stat\'s number, a plan\'s price ("$29/mo") or a person\'s role.'},
        "icon": {"type": "string", "description": "One emoji for a features item, otherwise empty."},
        "href": {"type": "string", "description": "Link target for navbar links and pricing buttons, otherwise empty."},
        "points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "A pricing plan's features or a footer column's links, otherwise empty.",
        },
        "highlighted": {"type": "boolean", "description": "True for the one recommended pricing plan."},
    },
    ["title", "text", "value", "icon", "href", "points", "highlighted"],
)

TOOLS: list[ToolDefinition] = [
    ToolDefinition(
        "start_page",
        "Choose the design for a new or redesigned page: palette, fonts and corners. Sets the page "
        "background and font, and optionally removes the existing sections. Call it once, before "
        "the first add_section, when building a whole page. Not needed to add a section to a page.",
        _object(
            {
                "accent": {"type": "string", "description": _COLOR + " Buttons and highlights."},
                "background": {"type": "string", "description": _COLOR + " The page background."},
                "surface": {"type": "string", "description": _COLOR + " Card background."},
                "text": {"type": "string", "description": _COLOR + " Headings and main text."},
                "muted": {"type": "string", "description": _COLOR + " Secondary text."},
                "heading_font": {"type": "string", "enum": [f["label"] for f in templates.fonts()]},
                "body_font": {"type": "string", "enum": [f["label"] for f in templates.fonts()]},
                "corners": {"type": "string", "enum": list(CORNERS), "description": "How rounded cards and buttons are."},
                "replace_existing": {
                    "type": "boolean",
                    "description": "Delete every existing section first. Only when the user asked for a new page or redesign, or the page is empty.",
                },
            },
            ["accent", "background", "surface", "text", "muted", "heading_font", "body_font", "corners", "replace_existing"],
        ),
    ),
    ToolDefinition(
        "add_section",
        "Add a complete, professionally laid out section using the page's design. You write the "
        "content; layout, spacing and colors are handled for you. Use empty strings and empty "
        "lists for fields a section doesn't use.\n"
        "Kinds: navbar (heading=brand, items=links, primary button); hero (variant centered or "
        "split, eyebrow, heading, subheading, two buttons, image); logos (heading=caption, "
        "items=company names); stats (items with value and title); features (variant cards or "
        "columns; items with icon, title, text); split (image beside text; variant image_left or "
        "image_right; items=bullet points); steps (numbered items); testimonials (items with text "
        "as the quote, title as the name, value as the role); pricing (items with title, value, "
        "text, points, highlighted; primary_label is each plan's button); faq (items with title "
        "as the question, text as the answer); gallery (items with title, text describing the "
        "image); team (items with title, value, text); cta (heading, subheading, buttons); contact "
        "(a contact form, with items as contact details); footer (heading=brand, subheading=tagline, "
        "items=link columns with title and points).",
        _object(
            {
                "kind": {"type": "string", "enum": list(sections.SECTION_KINDS)},
                "variant": {"type": "string", "enum": list(sections.VARIANTS), "description": 'Layout option, or "auto".'},
                "background": {
                    "type": "string",
                    "enum": list(sections.BACKGROUNDS),
                    "description": 'default = page background, alt = subtle tint, dark and accent = bold bands. "auto" picks a sensible one.',
                },
                "position": {
                    "type": "string",
                    "description": '"end", "top", or the id of an element: the section goes after the top-level section containing it.',
                },
                "eyebrow": {"type": "string", "description": "A short label above the heading."},
                "heading": {"type": "string"},
                "subheading": {"type": "string"},
                "primary_label": {"type": "string"},
                "primary_href": {"type": "string"},
                "secondary_label": {"type": "string"},
                "secondary_href": {"type": "string"},
                "image": {
                    "type": "string",
                    "description": 'A short description of the photo, used as a stock photo search ("barista pouring latte art"), or an https URL the user gave you. Used by hero and split.',
                },
                "items": {"type": "array", "items": _SECTION_ITEM},
            },
            [
                "kind", "variant", "background", "position", "eyebrow", "heading", "subheading",
                "primary_label", "primary_href", "secondary_label", "secondary_href", "image", "items",
            ],
        ),
    ),
    ToolDefinition(
        "add_element",
        "Insert a single element into a container (body, container, two-column column, or any "
        "element whose outline line has children). Returns the new element's id.",
        _object(
            {
                "type": {"type": "string", "enum": list(ELEMENT_KINDS)},
                "parent_id": {"type": "string", "description": _ID + " Must be a container."},
                "after_id": {
                    "type": "string",
                    "description": 'A direct child of parent_id to insert after, or "top" to insert first. Omit to append as the last child.',
                },
                "text": {
                    "type": "string",
                    "description": "Initial text for heading, text, button or link elements.",
                },
                "styles": _STYLE_LIST,
            },
            ["type", "parent_id", "styles"],
        ),
    ),
    ToolDefinition(
        "update_styles",
        "Set CSS styles on one or more elements. Use several ids at once to restyle matching "
        "elements together (e.g. all headings, all buttons). Styles merge into the existing ones.",
        _object(
            {
                "ids": {"type": "array", "items": {"type": "string"}, "description": "Element ids to style."},
                "styles": _STYLE_LIST,
            },
            ["ids", "styles"],
        ),
    ),
    ToolDefinition(
        "update_content",
        'Change an element\'s content. Fields: text (heading, text, button, link), href (button, '
        'link), open_in_new_tab "true"/"false" (button, link), src (image URL or YouTube URL for '
        "video), alt (image), heading_level h1-h4 (heading; also resets its font size).",
        _object(
            {
                "id": {"type": "string", "description": _ID},
                "fields": {
                    "type": "array",
                    "items": _object(
                        {
                            "field": {"type": "string", "enum": list(CONTENT_FIELDS)},
                            "value": {"type": "string"},
                        },
                        ["field", "value"],
                    ),
                },
            },
            ["id", "fields"],
        ),
    ),
    ToolDefinition(
        "delete_elements",
        "Delete elements (and everything inside them). The body cannot be deleted.",
        _object({"ids": {"type": "array", "items": {"type": "string"}}}, ["ids"]),
    ),
    ToolDefinition(
        "move_element",
        "Move an element (with its children) into a container at a position.",
        _object(
            {
                "id": {"type": "string", "description": _ID},
                "parent_id": {"type": "string", "description": "Destination container id."},
                "after_id": {
                    "type": "string",
                    "description": 'A direct child of parent_id to place it after, or "top" to place it first. Omit to place it last.',
                },
            },
            ["id", "parent_id"],
        ),
    ),
    ToolDefinition(
        "duplicate_element",
        "Copy an element (with its children) and insert the copy right after the original. "
        "Returns the copy's ids.",
        _object({"id": {"type": "string", "description": _ID}}, ["id"]),
    ),
    ToolDefinition(
        "find_photos",
        "Search stock photos, to replace an existing image or add a new one. Returns photo URLs "
        "to use with update_content's src field. add_section finds photos by itself, so this "
        "isn't needed for new sections.",
        _object(
            {
                "query": {"type": "string", "description": 'What the photo shows, in a few plain words, e.g. "barista pouring latte art".'},
                "orientation": {"type": "string", "enum": ["landscape", "portrait", "square"]},
            },
            ["query", "orientation"],
        ),
    ),
]

# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

StyleProperty = Literal[STYLE_PROPERTIES]  # type: ignore[valid-type]


class StyleDecl(BaseModel):
    property: StyleProperty
    value: str = Field(max_length=500)


class StartPage(BaseModel):
    accent: str
    background: str
    surface: str
    text: str
    muted: str
    heading_font: str
    body_font: str
    corners: Literal[tuple(CORNERS)] = "soft"  # type: ignore[valid-type]
    replace_existing: bool = False


class AddElement(BaseModel):
    type: Literal[tuple(ELEMENT_KINDS)]  # type: ignore[valid-type]
    parent_id: str
    after_id: str | None = None
    text: str | None = Field(default=None, max_length=5000)
    styles: list[StyleDecl] = Field(default_factory=list, max_length=60)


class UpdateStyles(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)
    styles: list[StyleDecl] = Field(min_length=1, max_length=60)


class ContentField(BaseModel):
    field: Literal[CONTENT_FIELDS]  # type: ignore[valid-type]
    value: str = Field(max_length=5000)


class UpdateContent(BaseModel):
    id: str
    fields: list[ContentField] = Field(min_length=1, max_length=10)


class DeleteElements(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)


class MoveElement(BaseModel):
    id: str
    parent_id: str
    after_id: str | None = None


class DuplicateElement(BaseModel):
    id: str


INPUT_MODELS: dict[str, type[BaseModel]] = {
    "start_page": StartPage,
    "add_section": AddSection,
    "add_element": AddElement,
    "update_styles": UpdateStyles,
    "update_content": UpdateContent,
    "delete_elements": DeleteElements,
    "move_element": MoveElement,
    "duplicate_element": DuplicateElement,
}

# ---------------------------------------------------------------------------
# Value sanitizing
# ---------------------------------------------------------------------------


class ToolError(Exception):
    pass


_UNSAFE_CSS = re.compile(r"[<>{}]|javascript:|expression\s*\(|@import|behavior\s*:", re.I)
_URL = re.compile(r"url\(([^)]*)\)", re.I)
_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")
_YOUTUBE = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})")


def to_youtube_embed(url: str) -> str:
    match = _YOUTUBE.search(url)
    return f"https://www.youtube.com/embed/{match.group(1)}" if match else url


def sanitize_style_value(prop: str, raw: str) -> str:
    value = raw.strip()
    if _UNSAFE_CSS.search(value):
        raise ToolError(f"Invalid value for {prop}: {json.dumps(raw)}")
    for inner in _URL.findall(value):
        url = inner.strip().strip("'\"")
        if not url.lower().startswith("https://"):
            raise ToolError(f"Only https:// URLs are allowed in {prop}.")
    if prop == "fontFamily":
        for font in templates.fonts():
            if value.lower() in (font["label"].lower(), font["value"].lower()):
                return font["value"]
    # Bare numbers for length properties get px, like the style panel does.
    if _NUMBER.match(value) and prop not in UNITLESS:
        return f"{value}px"
    return value


def style_record(styles: list[StyleDecl]) -> dict[str, str]:
    return {
        s.property: "" if s.value == "" else sanitize_style_value(s.property, s.value)
        for s in styles
    }


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


@dataclass
class ToolOutcome:
    result: str  # text returned to the model
    is_error: bool
    operation_count: int
    status: str | None = None  # short status line for the chat UI


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _resolve(session: PageSession, short_id: str, what: str = "Element"):
    real = session.real_id(short_id)
    el = find_element(session.elements, real) if real else None
    if el is None:
        raise ToolError(f'{what} "{short_id}" does not exist on the page.')
    return el


def _resolve_container(session: PageSession, short_id: str):
    el = _resolve(session, short_id, "Container")
    if not isinstance(el.get("content"), list):
        raise ToolError(
            f'"{short_id}" is a {el.get("type")}, not a container. Use its parent or a container instead.'
        )
    return el


def _index_after(session: PageSession, parent, after_id: str | None) -> int | None:
    if not after_id:
        return None
    if after_id == "top":
        return 0
    sibling = _resolve(session, after_id)
    for i, child in enumerate(parent["content"]):
        if child["id"] == sibling["id"]:
            return i + 1
    raise ToolError(f'"{after_id}" is not a direct child of the given parent.')


def _section_index(session: PageSession, position: str) -> int | None:
    """Where a new top-level section goes; None appends."""
    position = position.strip()
    if position == "top":
        return 0
    if position in ("", "end", "body"):
        return None
    anchor = _resolve(session, position)
    section = top_level_ancestor(session.elements, anchor["id"])
    ids = [s["id"] for s in session.elements[0]["content"]]
    return ids.index(section["id"]) + 1 if section and section["id"] in ids else None


def _start_page(session: PageSession, data: StartPage) -> None:
    colors = {}
    for field in ("accent", "background", "surface", "text", "muted"):
        value = getattr(data, field)
        if not is_hex(value):
            raise ToolError(f'{field} must be a hex color like "#1d4ed8", not {json.dumps(value)}.')
        colors[field] = normalize_hex(value)
    fonts = {}
    for field in ("heading_font", "body_font"):
        fonts[field] = font_value(getattr(data, field))
        if fonts[field] is None:
            available = ", ".join(f["label"] for f in templates.fonts())
            raise ToolError(f'{field} "{getattr(data, field)}" is not available. Use one of: {available}.')

    design = make_design(**colors, **fonts, corners=data.corners)
    session.design = design
    body = session.elements[0]
    if data.replace_existing:
        for section in list(body["content"]):
            session.apply(operation(op="delete", id=section["id"]))
    session.apply(
        operation(
            op="update_styles",
            id=body["id"],
            styles={"backgroundColor": design.background, "color": design.text, "fontFamily": design.body_font},
        )
    )


def _format_validation_error(error: ValidationError) -> str:
    issues = []
    for issue in error.errors():
        location = ".".join(str(p) for p in issue["loc"]) or "input"
        issues.append(f"{location}: {issue['msg']}")
    return "Invalid input: " + "; ".join(issues)


def execute_tool(session: PageSession, name: str, raw_input: Any) -> ToolOutcome:
    before = len(session.operations)

    def done(result: str, status: str | None = None) -> ToolOutcome:
        return ToolOutcome(result, False, len(session.operations) - before, status)

    try:
        model = INPUT_MODELS.get(name)
        if model is None:
            raise ToolError(f'Unknown tool "{name}".')
        try:
            data = model.model_validate(raw_input if raw_input is not None else {})
        except ValidationError as error:
            raise ToolError(_format_validation_error(error)) from error

        if isinstance(data, StartPage):
            _start_page(session, data)
            return done(
                "Design set. Add the page's sections with add_section, in order from top to bottom.",
                "Set up the page design",
            )

        if isinstance(data, AddSection):
            problem = sections.validate(data)
            if problem:
                raise ToolError(problem)
            index = _section_index(session, data.position)
            design = session.design or infer_design(session.elements)
            section = sections.render_section(data, design, session.photos_by_description)
            session.apply(operation(op="insert", parentId="__body", index=index, element=section))
            return done(
                f"Added the {data.kind} section:\n{session.serialize([section], styles=False)}",
                f"Added {section['name']} section",
            )

        if isinstance(data, AddElement):
            parent = _resolve_container(session, data.parent_id)
            index = _index_after(session, parent, data.after_id)
            element = templates.create_element(ELEMENT_KINDS[data.type])
            if element is None:
                raise ToolError(f'Unknown element type "{data.type}".')
            if (
                data.text is not None
                and isinstance(element.get("content"), dict)
                and element.get("type") in ("text", "heading", "button", "link")
            ):
                element["content"] = {**element["content"], "innerText": data.text}
            if data.styles:
                element["styles"] = merge_styles(element.get("styles") or {}, style_record(data.styles))
            session.apply(operation(op="insert", parentId=parent["id"], index=index, element=element))
            return done(
                f"Added:\n{session.serialize([element])}",
                f"Added {element['name'].lower()} to {session.label(parent)}",
            )

        if isinstance(data, UpdateStyles):
            targets = [_resolve(session, i) for i in dict.fromkeys(data.ids)]
            styles = style_record(data.styles)
            for el in targets:
                session.apply(operation(op="update_styles", id=el["id"], styles=styles))
            what = session.label(targets[0]) if len(targets) == 1 else _plural(len(targets), "element")
            return done(f"Updated styles on {_plural(len(targets), 'element')}.", f"Restyled {what}")

        if isinstance(data, UpdateContent):
            el = _resolve(session, data.id)
            if isinstance(el.get("content"), list):
                raise ToolError(
                    f'"{data.id}" is a container; it has no content fields. Edit its children instead.'
                )
            content: dict[str, Any] = {}
            heading_size = None
            for item in data.fields:
                if el.get("type") not in FIELD_TYPES[item.field]:
                    raise ToolError(f'Field "{item.field}" does not apply to a {el.get("type")} element.')
                value = item.value
                if item.field == "text":
                    content["innerText"] = value
                elif item.field == "href":
                    if value and not _SAFE_HREF.match(value.strip()):
                        raise ToolError("href must start with https://, http://, mailto:, tel:, # or /.")
                    content["href"] = value.strip()
                elif item.field == "open_in_new_tab":
                    content["target"] = "_blank" if value.strip().lower() == "true" else "_self"
                elif item.field == "src":
                    if not _SAFE_SRC.match(value.strip()):
                        raise ToolError("src must be an http(s) URL.")
                    src = value.strip()
                    content["src"] = to_youtube_embed(src) if el.get("type") == "video" else src
                elif item.field == "alt":
                    content["alt"] = value
                elif item.field == "heading_level":
                    level = value.strip().lower()
                    if level not in HEADING_SIZES:
                        raise ToolError("heading_level must be h1, h2, h3 or h4.")
                    content["level"] = level
                    heading_size = HEADING_SIZES[level]
            session.apply(operation(op="update_content", id=el["id"], content=content))
            if heading_size:
                session.apply(operation(op="update_styles", id=el["id"], styles={"fontSize": heading_size}))
            return done(f"Updated {session.label(el)}.", f"Edited {session.label(el)}")

        if isinstance(data, DeleteElements):
            targets = [_resolve(session, i) for i in dict.fromkeys(data.ids)]
            if any(el["id"] == "__body" for el in targets):
                raise ToolError("The body cannot be deleted. Delete its sections instead.")
            for el in targets:
                session.apply(operation(op="delete", id=el["id"]))
            what = session.label(targets[0]) if len(targets) == 1 else _plural(len(targets), "element")
            return done(f"Deleted {_plural(len(targets), 'element')}.", f"Deleted {what}")

        if isinstance(data, MoveElement):
            el = _resolve(session, data.id)
            if el["id"] == "__body":
                raise ToolError("The body cannot be moved.")
            parent = _resolve_container(session, data.parent_id)
            if find_element([el], parent["id"]) is not None:
                raise ToolError("An element cannot be moved inside itself.")
            index = _index_after(session, parent, data.after_id)
            session.apply(operation(op="move", id=el["id"], parentId=parent["id"], index=index))
            return done(f"Moved {session.label(el)}.", f"Moved {session.label(el)}")

        if isinstance(data, DuplicateElement):
            el = _resolve(session, data.id)
            parent = find_parent(session.elements, el["id"])
            if parent is None:
                raise ToolError("The body cannot be duplicated.")
            copy = templates.clone_with_new_ids(el)
            index = next(i for i, c in enumerate(parent["content"]) if c["id"] == el["id"]) + 1
            session.apply(operation(op="insert", parentId=parent["id"], index=index, element=copy))
            return done(
                f"Duplicated. The copy:\n{session.serialize([copy])}",
                f"Duplicated {session.label(el)}",
            )

        raise ToolError(f'Unknown tool "{name}".')
    except ToolError as error:
        return ToolOutcome(str(error), True, len(session.operations) - before)


# ---------------------------------------------------------------------------
# Tools that use the network
# ---------------------------------------------------------------------------


class FindPhotos(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    orientation: Literal["landscape", "portrait", "square"] = "landscape"


async def _section_photo(session: PageSession, description: str) -> None:
    """Find a photo for a description, avoiding any already used on this page."""
    results = await photos.search(description)
    photo = next((p for p in results if p.url not in session.photos_by_url), None)
    if photo:
        session.photos_by_url[photo.url] = photo
        session.photos_by_description[description] = photo


async def _fetch_section_photos(session: PageSession, raw_input: Any) -> None:
    if not photos.configured():
        return
    try:
        spec = AddSection.model_validate(raw_input if raw_input is not None else {})
    except ValidationError:
        return  # execute_tool reports this to the model
    if sections.validate(spec):
        return
    missing = [d for d in sections.photo_requests(spec) if d not in session.photos_by_description]
    await asyncio.gather(*(_section_photo(session, d) for d in missing))


async def _find_photos(session: PageSession, raw_input: Any) -> ToolOutcome:
    try:
        data = FindPhotos.model_validate(raw_input if raw_input is not None else {})
    except ValidationError as error:
        return ToolOutcome(_format_validation_error(error), True, 0)
    if not photos.configured():
        return ToolOutcome(
            "Photo search isn't set up on this server. Tell the user it needs a free Pexels API key "
            "(PEXELS_API_KEY in .env), or ask them for an image URL.",
            True,
            0,
        )
    results = [p for p in await photos.search(data.query, data.orientation) if p.url not in session.photos_by_url][:5]
    if not results:
        return ToolOutcome(f'No photos available for "{data.query}". Try different words.', True, 0)
    lines = []
    for photo in results:
        # Recorded so the photographer is credited if the photo ends up on the page.
        session.photos_by_url[photo.url] = photo
        lines.append(f"{photo.url} ({photo.alt or 'no description'})")
    return ToolOutcome("Photos, best match first:\n" + "\n".join(lines), False, 0)


async def run_tool(session: PageSession, name: str, raw_input: Any) -> ToolOutcome:
    """Run a tool call, doing any network work first (execute_tool itself never waits)."""
    if name == "find_photos":
        return await _find_photos(session, raw_input)
    if name == "add_section":
        await _fetch_section_photos(session, raw_input)
    return execute_tool(session, name, raw_input)
