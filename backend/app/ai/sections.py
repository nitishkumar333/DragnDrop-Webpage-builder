"""Turns a section's content (from the add_section tool) into editor elements.

The model decides what a page says and how it's arranged; the layout, spacing
and typography come from here, so every provider produces a well-built page.
Everything returned is a normal element tree the user can edit by hand.
"""

import re
from datetime import date
from typing import Any, Callable, Literal
from urllib.parse import quote_plus

from pydantic import BaseModel, Field

from . import templates
from .design import Design, Tone, ensure_contrast, mix
from .operations import Element, merge_styles
from .photos import Photo

SECTION_KINDS = (
    "navbar", "hero", "logos", "stats", "features", "split", "steps", "testimonials",
    "pricing", "faq", "gallery", "team", "cta", "contact", "footer",
)
VARIANTS = ("auto", "centered", "split", "cards", "columns", "image_left", "image_right")
BACKGROUNDS = ("auto", "default", "alt", "dark", "accent")

# Background used when the model doesn't choose one.
DEFAULT_TONE = {"stats": "alt", "steps": "alt", "testimonials": "alt", "faq": "alt", "team": "alt",
                "contact": "alt", "footer": "dark"}

SAFE_HREF = re.compile(r"^(https?://|mailto:|tel:|#|/(?!/))", re.I)
SAFE_SRC = re.compile(r"^https?://", re.I)

MAX_WIDTH = "1120px"


class SectionItem(BaseModel):
    title: str = Field(default="", max_length=300)
    text: str = Field(default="", max_length=1500)
    value: str = Field(default="", max_length=120)
    icon: str = Field(default="", max_length=12)
    href: str = Field(default="", max_length=1000)
    points: list[str] = Field(default_factory=list, max_length=12)
    highlighted: bool = False


class AddSection(BaseModel):
    kind: Literal[SECTION_KINDS]  # type: ignore[valid-type]
    variant: Literal[VARIANTS] = "auto"  # type: ignore[valid-type]
    background: Literal[BACKGROUNDS] = "auto"  # type: ignore[valid-type]
    position: str = "end"
    eyebrow: str = Field(default="", max_length=120)
    heading: str = Field(default="", max_length=300)
    subheading: str = Field(default="", max_length=1500)
    primary_label: str = Field(default="", max_length=80)
    primary_href: str = Field(default="", max_length=1000)
    secondary_label: str = Field(default="", max_length=80)
    secondary_href: str = Field(default="", max_length=1000)
    image: str = Field(default="", max_length=1000)
    items: list[SectionItem] = Field(default_factory=list, max_length=24)


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

_NO_BOX = {
    "paddingTop": "0px", "paddingBottom": "0px", "paddingLeft": "0px", "paddingRight": "0px",
    "marginTop": "0px", "marginBottom": "0px", "marginLeft": "0px", "marginRight": "0px",
}


def _pad(vertical: str, horizontal: str | None = None) -> dict[str, str]:
    horizontal = horizontal or vertical
    return {"paddingTop": vertical, "paddingBottom": vertical,
            "paddingLeft": horizontal, "paddingRight": horizontal}


def _border(color: str) -> dict[str, str]:
    return {"borderWidth": "1px", "borderStyle": "solid", "borderColor": color}


def _leaf(kind: str, name: str, content: dict[str, Any], styles: dict[str, Any]) -> Element:
    el = templates.create_element(kind)
    assert el is not None, kind
    el["name"] = name
    el["content"] = {**el["content"], **content}
    el["styles"] = merge_styles(el["styles"], styles)
    return el


def _box(name: str, children: list[Element], styles: dict[str, Any] | None = None) -> Element:
    el = templates.create_element("container")
    assert el is not None
    el["name"] = name
    el["styles"] = merge_styles(el["styles"], {**_NO_BOX, **(styles or {})})
    el["content"] = children
    return el


def _column(name: str, children: list[Element], gap: str = "12px", **styles: Any) -> Element:
    return _box(name, children, {"display": "flex", "flexDirection": "column", "gap": gap, **styles})


def _row(name: str, children: list[Element], gap: str = "24px", **styles: Any) -> Element:
    return _box(name, children, {"display": "flex", "flexDirection": "row", "flexWrap": "wrap", "gap": gap, **styles})


def _text(value: str, name: str = "Text", **styles: Any) -> Element:
    return _leaf("text", name, {"innerText": value}, {**_NO_BOX, **styles})


class Painter:
    """Draws elements with one section's design and tone."""

    def __init__(self, design: Design, tone: Tone, photos: dict[str, Photo] | None = None):
        self.design = design
        self.tone = tone
        self.photos = photos or {}

    def heading(self, value: str, level: str, size: str, name: str = "Heading", **styles: Any) -> Element:
        return _leaf(
            "heading", name, {"innerText": value, "level": level},
            {
                **_NO_BOX,
                "color": self.tone.text,
                "fontFamily": self.design.heading_font,
                "fontSize": size,
                "lineHeight": "1.15" if level in ("h1", "h2") else "1.3",
                "fontWeight": "700",
                "overflowWrap": "anywhere",  # a long word can't overflow a phone screen
                **styles,
            },
        )

    def body(self, value: str, name: str = "Text", size: str = "16px", **styles: Any) -> Element:
        return _text(value, name, color=self.tone.muted, fontSize=size, lineHeight="1.65", **styles)

    def link(self, label: str, href: str, **styles: Any) -> Element:
        return _leaf(
            "link", label or "Link", {"innerText": label, "href": _href(href)},
            {**_NO_BOX, "color": self.tone.muted, "fontSize": "15px", "width": "auto", **styles},
        )

    def button(self, label: str, href: str, *, primary: bool = True, **styles: Any) -> Element:
        look = (
            {"backgroundColor": self.tone.primary, "color": self.tone.on_primary, "boxShadow": ""}
            if primary
            else {"backgroundColor": "transparent", "color": self.tone.text, "boxShadow": "",
                  **_border(mix(self.tone.background, self.tone.text, 0.3))}
        )
        return _leaf(
            "button", label or "Button", {"innerText": label, "href": _href(href)},
            {"borderRadius": self.design.button_radius, **_pad("14px", "28px"), "fontSize": "15px", **look, **styles},
        )

    def actions(self, spec: AddSection, *, center: bool, **styles: Any) -> list[Element]:
        buttons = []
        if spec.primary_label:
            buttons.append(self.button(spec.primary_label, spec.primary_href))
        if spec.secondary_label:
            buttons.append(self.button(spec.secondary_label, spec.secondary_href, primary=False))
        if not buttons:
            return []
        return [_row("Actions", buttons, "12px", width="auto", alignItems="center",
                     justifyContent="center" if center else "flex-start", **styles)]

    def image(self, description: str, w: int, h: int, name: str = "Image", **styles: Any) -> Element:
        description = description.strip()
        is_url = bool(SAFE_SRC.match(description))
        photo = self.photos.get(description)
        if is_url:
            src = description
        else:
            src = photo.url if photo else self._placeholder(description, w, h)
        alt = "" if is_url else description
        return _leaf(
            "image", name, {"src": src, "alt": alt},
            {"borderRadius": self.design.card_radius, "aspectRatio": f"{w} / {h}", **styles},
        )

    def _placeholder(self, label: str, w: int, h: int) -> str:
        background = mix(self.tone.background, self.design.accent, 0.16)[1:]
        foreground = ensure_contrast(self.design.accent, mix(self.tone.background, self.design.accent, 0.16), 3)[1:]
        # Cut at a word, so a long description doesn't end mid-word on the image.
        short = label if len(label) <= 40 else label[:40].rsplit(" ", 1)[0]
        text = quote_plus(short.strip() or "Image")
        return f"https://placehold.co/{w}x{h}/{background}/{foreground}?text={text}"

    def header(self, spec: AddSection, *, center: bool = True) -> list[Element]:
        align = "center" if center else "left"
        children: list[Element] = []
        if spec.eyebrow:
            children.append(self.eyebrow(spec.eyebrow, textAlign=align))
        if spec.heading:
            children.append(self.heading(spec.heading, "h2", "40px", textAlign=align))
        if spec.subheading:
            extra = {"maxWidth": "640px", "marginLeft": "auto", "marginRight": "auto"} if center else {}
            children.append(self.body(spec.subheading, "Subheading", "18px", textAlign=align, **extra))
        if not children:
            return []
        return [_column("Header", children, "14px")]

    def eyebrow(self, value: str, **styles: Any) -> Element:
        return _text(value, "Eyebrow", color=self.tone.accent_text, fontSize="13px", fontWeight="700",
                     letterSpacing="0.12em", textTransform="uppercase", **styles)

    def card(self, name: str, children: list[Element], basis: str, gap: str = "12px", **styles: Any) -> Element:
        return _column(
            name, children, gap,
            flex=f"1 1 {basis}", width="auto", backgroundColor=self.tone.card,
            borderRadius=self.design.card_radius, **_pad("28px"), **_border(self.tone.border), **styles,
        )

    def icon(self, value: str) -> Element:
        return _text(
            value, "Icon", width="48px", height="48px", display="flex", alignItems="center",
            justifyContent="center", textAlign="center", fontSize="22px", color=self.tone.accent_text,
            borderRadius=self.design.card_radius,
            backgroundColor=mix(self.tone.card, self.design.accent, 0.12),
        )


def _href(value: str) -> str:
    value = value.strip()
    return value if SAFE_HREF.match(value) else "#"


def _basis(count: int) -> str:
    """A flex basis that fits this many items per row and wraps on small screens."""
    return {1: "100%", 2: "400px", 4: "230px"}.get(count, "280px")


def _band(name: str, tone: Tone, children: list[Element], *, padding: str = "96px",
          inner: dict[str, Any] | None = None, **styles: Any) -> Element:
    """A full-width band with a centered inner column."""
    column = _box("Inner", children, {
        "display": "flex", "flexDirection": "column", "gap": "56px",
        "maxWidth": MAX_WIDTH, "marginLeft": "auto", "marginRight": "auto", **(inner or {}),
    })
    return _box(name, [column], {"backgroundColor": tone.background, **_pad(padding, "24px"), **styles})


def _initials(name: str) -> str:
    words = re.findall(r"[^\W\d_]+", name)
    return "".join(w[0] for w in words[:2]).upper() or "•"


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


def _navbar(spec: AddSection, p: Painter) -> Element:
    menu = [p.link(i.title, i.href or "#", fontWeight="500") for i in spec.items if i.title]
    if spec.primary_label:
        menu.append(p.button(spec.primary_label, spec.primary_href, **_pad("10px", "20px"), fontSize="14px"))
    bar = _row(
        "Bar",
        [
            p.heading(spec.heading, "h4", "22px", "Brand", width="auto", letterSpacing="-0.01em"),
            _row("Menu", menu, "28px", width="auto", alignItems="center"),
        ],
        "16px", justifyContent="space-between", alignItems="center", maxWidth=MAX_WIDTH,
        marginLeft="auto", marginRight="auto",
    )
    return _box("Navbar", [bar], {
        "backgroundColor": p.tone.background, **_pad("18px", "24px"),
        "borderBottomWidth": "1px", "borderBottomStyle": "solid", "borderBottomColor": p.tone.border,
    })


def _hero(spec: AddSection, p: Painter, tone_name: str) -> Element:
    wash = mix(p.tone.background, p.design.accent, 0.1 if tone_name in ("default", "alt") else 0)
    gradient = {"backgroundImage": f"linear-gradient(180deg, {wash} 0%, {p.tone.background} 100%)"}
    title_size = "60px"

    if spec.variant == "split":
        copy: list[Element] = []
        if spec.eyebrow:
            copy.append(p.eyebrow(spec.eyebrow))
        copy.append(p.heading(spec.heading, "h1", title_size, "Headline", letterSpacing="-0.02em"))
        if spec.subheading:
            copy.append(p.body(spec.subheading, "Subheading", "19px"))
        copy += p.actions(spec, center=False, marginTop="12px")
        return _band(
            "Hero", p.tone,
            [_row(
                "Layout",
                [
                    _column("Copy", copy, "18px", flex="1 1 420px", width="auto"),
                    p.image(spec.image or spec.heading, 1000, 800, "Hero image", flex="1 1 420px", width="auto", minHeight="0"),
                ],
                "56px", alignItems="center",
            )],
            padding="88px", **gradient,
        )

    copy = []
    if spec.eyebrow:
        copy.append(p.eyebrow(spec.eyebrow, textAlign="center"))
    copy.append(p.heading(spec.heading, "h1", title_size, "Headline", textAlign="center", letterSpacing="-0.02em"))
    if spec.subheading:
        copy.append(p.body(spec.subheading, "Subheading", "20px", textAlign="center", maxWidth="680px",
                           marginLeft="auto", marginRight="auto"))
    copy += p.actions(spec, center=True, marginTop="12px", marginLeft="auto", marginRight="auto")
    children: list[Element] = [_column("Copy", copy, "20px", maxWidth="860px", marginLeft="auto", marginRight="auto")]
    if spec.image:
        children.append(p.image(spec.image, 1200, 640, "Hero image"))
    return _band("Hero", p.tone, children, padding="104px", **gradient)


def _logos(spec: AddSection, p: Painter) -> Element:
    names = [
        _text(i.title, i.title, width="auto", color=p.tone.muted, fontSize="20px", fontWeight="700",
              fontFamily=p.design.heading_font)
        for i in spec.items
    ]
    children: list[Element] = []
    if spec.heading:
        children.append(p.body(spec.heading, "Caption", "14px", textAlign="center"))
    children.append(_row("Logos", names, "48px", justifyContent="center", alignItems="center"))
    return _band("Logos", p.tone, children, padding="48px", inner={"gap": "24px"})


def _stats(spec: AddSection, p: Painter) -> Element:
    stats = [
        _column(
            i.title or "Stat",
            [
                p.heading(i.value or i.title, "h3", "44px", "Value", textAlign="center",
                          color=p.tone.accent_text, letterSpacing="-0.02em"),
                p.body(i.title if i.value else i.text, "Label", "15px", textAlign="center"),
            ],
            "6px", flex="1 1 180px", width="auto",
        )
        for i in spec.items
    ]
    return _band("Stats", p.tone, [*p.header(spec), _row("Stats", stats, "32px")], padding="72px")


def _features(spec: AddSection, p: Painter) -> Element:
    basis = _basis(len(spec.items))
    cards = []
    for item in spec.items:
        content: list[Element] = []
        if item.icon:
            content.append(p.icon(item.icon))
        content.append(p.heading(item.title, "h3", "20px", marginTop="8px" if item.icon else "0px"))
        if item.text:
            content.append(p.body(item.text, "Description", "15px"))
        if spec.variant == "columns":
            cards.append(_column(item.title or "Feature", content, "10px", flex=f"1 1 {basis}", width="auto",
                                 paddingTop="20px", borderTopWidth="2px", borderTopStyle="solid",
                                 borderTopColor=p.tone.border))
        else:
            cards.append(p.card(item.title or "Feature", content, basis))
    return _band("Features", p.tone, [*p.header(spec), _row("Grid", cards)])


def _split(spec: AddSection, p: Painter) -> Element:
    copy = p.header(spec, center=False)
    points = [
        _row(
            i.title or "Point",
            [
                _text("✓", "Check", width="auto", color=p.tone.accent_text, fontWeight="700", fontSize="16px"),
                _column("Copy", [
                    *([_text(i.title, "Title", color=p.tone.text, fontWeight="600", fontSize="16px")] if i.title else []),
                    *([p.body(i.text, "Description", "15px")] if i.text else []),
                ], "2px", flex="1 1 200px", width="auto"),
            ],
            "12px", flexWrap="nowrap", alignItems="flex-start",
        )
        for i in spec.items
    ]
    if points:
        copy.append(_column("Points", points, "14px"))
    copy += p.actions(spec, center=False)
    text = _column("Copy", copy, "24px", flex="1 1 420px", width="auto")
    picture = p.image(spec.image or spec.heading, 1000, 760, flex="1 1 420px", width="auto")
    parts = [picture, text] if spec.variant == "image_left" else [text, picture]
    return _band("Split", p.tone, [_row("Layout", parts, "56px", alignItems="center")])


def _steps(spec: AddSection, p: Painter) -> Element:
    basis = _basis(len(spec.items))
    steps = [
        _column(
            i.title or f"Step {n}",
            [
                _text(str(n), "Number", width="44px", height="44px", display="flex", alignItems="center",
                      justifyContent="center", textAlign="center", fontWeight="700", fontSize="17px",
                      color=p.tone.on_primary, backgroundColor=p.tone.primary, borderRadius="999px"),
                p.heading(i.title, "h3", "20px", marginTop="8px"),
                *([p.body(i.text, "Description", "15px")] if i.text else []),
            ],
            "10px", flex=f"1 1 {basis}", width="auto",
        )
        for n, i in enumerate(spec.items, 1)
    ]
    return _band("Steps", p.tone, [*p.header(spec), _row("Steps", steps, "32px")])


def _testimonials(spec: AddSection, p: Painter) -> Element:
    def author(item) -> Element:
        return _row(
            "Author",
            [
                _text(_initials(item.title), "Avatar", width="44px", height="44px", display="flex", alignItems="center",
                      justifyContent="center", textAlign="center", fontWeight="700", fontSize="14px",
                      color=p.tone.on_primary, backgroundColor=p.tone.primary, borderRadius="999px"),
                _column("Name", [
                    _text(item.title, "Name", color=p.tone.text, fontWeight="600", fontSize="15px"),
                    *([p.body(item.value, "Role", "14px")] if item.value else []),
                ], "0px", flex="1 1 140px", width="auto"),
            ],
            "12px", alignItems="center", flexWrap="nowrap",
        )

    if len(spec.items) == 1:
        item = spec.items[0]
        return _band(
            "Testimonial", p.tone,
            [
                *p.header(spec),
                _text(f"“{item.text}”", "Quote", color=p.tone.text, fontSize="28px", lineHeight="1.45",
                      fontWeight="500", textAlign="center", fontFamily=p.design.heading_font),
                _box("Author wrap", [author(item)], {"width": "fit-content", "marginLeft": "auto", "marginRight": "auto"}),
            ],
            inner={"maxWidth": "820px", "gap": "32px"},
        )

    cards = [
        p.card(
            i.title or "Testimonial",
            [_text(f"“{i.text}”", "Quote", color=p.tone.text, fontSize="16px", lineHeight="1.65", flex="1 1 auto"), author(i)],
            _basis(len(spec.items)), "20px",
        )
        for i in spec.items
    ]
    return _band("Testimonials", p.tone, [*p.header(spec), _row("Grid", cards, alignItems="stretch")])


def _pricing(spec: AddSection, p: Painter) -> Element:
    plans = []
    for item in spec.items:
        tone = p.design.tone("accent") if item.highlighted else p.tone
        plan = Painter(p.design, tone)
        label = item.title
        features = [
            _text(f"✓  {point}", "Feature", color=tone.text, fontSize="15px") for point in item.points
        ]
        children = [
            _text(label, "Plan", color=tone.accent_text, fontSize="14px", fontWeight="700",
                  letterSpacing="0.08em", textTransform="uppercase"),
            plan.heading(item.value or "—", "h3", "44px", "Price", letterSpacing="-0.02em"),
            *([plan.body(item.text, "Description", "15px")] if item.text else []),
            _leaf("divider", "Divider", {}, {"backgroundColor": tone.border, "marginTop": "8px", "marginBottom": "8px"}),
            *features,
        ]
        if spec.primary_label:
            children.append(plan.button(spec.primary_label, item.href or spec.primary_href, display="block",
                                        width="100%", marginTop="auto"))
        plans.append(_column(
            f"{label} plan", children, "10px", flex=f"1 1 {_basis(len(spec.items))}", width="auto",
            backgroundColor=tone.background if item.highlighted else tone.card,
            borderRadius=p.design.card_radius, **_pad("32px"), **_border(tone.border),
        ))
    return _band("Pricing", p.tone, [*p.header(spec), _row("Plans", plans, alignItems="stretch")])


def _faq(spec: AddSection, p: Painter) -> Element:
    rows = [
        _column(
            i.title or "Question",
            [p.heading(i.title, "h3", "18px", "Question"), p.body(i.text, "Answer")],
            "8px", **_pad("20px", "0px"), borderBottomWidth="1px", borderBottomStyle="solid",
            borderBottomColor=p.tone.border,
        )
        for i in spec.items
    ]
    return _band("FAQ", p.tone, [*p.header(spec), _column("Questions", rows, "0px")],
                 inner={"maxWidth": "780px", "gap": "40px"})


def _gallery(spec: AddSection, p: Painter) -> Element:
    pictures = [
        p.image(i.text or i.title, 800, 600, i.title or "Image", flex=f"1 1 {_basis(len(spec.items))}", width="auto")
        for i in spec.items
    ]
    return _band("Gallery", p.tone, [*p.header(spec), _row("Grid", pictures, "16px")])


def _team(spec: AddSection, p: Painter) -> Element:
    people = [
        _column(
            i.title or "Person",
            [
                p.image(f"Photo of {i.title}", 600, 600, "Photo"),
                p.heading(i.title, "h3", "18px", "Name", marginTop="8px"),
                *([_text(i.value, "Role", color=p.tone.accent_text, fontSize="14px", fontWeight="600")] if i.value else []),
                *([p.body(i.text, "Bio", "15px")] if i.text else []),
            ],
            "4px", flex="1 1 230px", width="auto",
        )
        for i in spec.items
    ]
    return _band("Team", p.tone, [*p.header(spec), _row("Grid", people, "32px")])


def _cta(spec: AddSection, p: Painter, tone_name: str) -> Element:
    # A banner in the accent color, unless the section is already a colored band.
    colored = tone_name in ("accent", "dark")
    tone = p.tone if colored else p.design.tone("accent")
    banner = Painter(p.design, tone)
    copy = [
        *([banner.eyebrow(spec.eyebrow, textAlign="center")] if spec.eyebrow else []),
        banner.heading(spec.heading, "h2", "40px", textAlign="center"),
        *([banner.body(spec.subheading, "Subheading", "18px", textAlign="center", maxWidth="620px",
                       marginLeft="auto", marginRight="auto")] if spec.subheading else []),
        *banner.actions(spec, center=True, marginTop="12px", marginLeft="auto", marginRight="auto"),
    ]
    if colored:
        return _band("Call to action", tone, [_column("Copy", copy, "16px")], padding="88px")
    card = _column("Card", copy, "16px", backgroundColor=tone.background, borderRadius=p.design.card_radius,
                   **_pad("64px", "32px"))
    return _band("Call to action", p.tone, [card], padding="64px")


def _contact(spec: AddSection, p: Painter) -> Element:
    details = [
        _column(i.title or "Detail", [
            _text(i.title, "Label", color=p.tone.text, fontWeight="600", fontSize="15px"),
            p.body(i.text or i.value, "Value", "15px"),
        ], "2px")
        for i in spec.items
    ]
    copy = _column("Copy", [*p.header(spec, center=False), *details], "20px", flex="1 1 380px", width="auto")
    form = _box("Form", [_leaf("contactForm", "Contact form", {}, {})], {"flex": "1 1 420px", "width": "auto"})
    return _band("Contact", p.tone, [_row("Layout", [copy, form], "56px", alignItems="flex-start")])


def _footer(spec: AddSection, p: Painter) -> Element:
    columns = [
        _column(
            i.title or "Links",
            [
                _text(i.title, "Title", color=p.tone.text, fontWeight="600", fontSize="14px"),
                *[p.link(point, "#", fontSize="14px") for point in i.points],
            ],
            "10px", flex="0 1 160px", width="auto",
        )
        for i in spec.items
    ]
    about = _column(
        "About",
        [
            p.heading(spec.heading, "h4", "20px", "Brand"),
            *([p.body(spec.subheading, "Tagline", "14px")] if spec.subheading else []),
        ],
        "8px", flex="1 1 280px", width="auto",
    )
    notice = f"© {date.today().year} {spec.heading}. All rights reserved."
    return _band(
        "Footer", p.tone,
        [
            _row("Links", [about, *columns], "40px", justifyContent="space-between"),
            _leaf("divider", "Divider", {}, {"backgroundColor": p.tone.border, "marginTop": "0px", "marginBottom": "0px"}),
            p.body(notice, "Copyright", "13px", textAlign="center"),
        ],
        padding="56px", inner={"gap": "28px"},
    )


_RENDERERS: dict[str, Callable[[AddSection, Painter], Element]] = {
    "navbar": _navbar,
    "logos": _logos,
    "stats": _stats,
    "features": _features,
    "split": _split,
    "steps": _steps,
    "testimonials": _testimonials,
    "pricing": _pricing,
    "faq": _faq,
    "gallery": _gallery,
    "team": _team,
    "contact": _contact,
    "footer": _footer,
}

# What each kind can't be drawn without, as (field, explanation).
_NEEDS_HEADING = {"navbar": "the brand name", "hero": "the headline", "split": "the title",
                  "cta": "the headline", "footer": "the brand name"}
_NEEDS_ITEMS = {
    "logos": "each with title (company name)",
    "stats": "each with value (the number) and title (the label)",
    "features": "each with title and text",
    "steps": "each with title and text",
    "testimonials": "each with text (the quote), title (the person's name) and value (their role)",
    "pricing": "each with title (plan), value (price), text and points (features)",
    "faq": "each with title (question) and text (answer)",
    "gallery": "each with title and text (what the image shows)",
    "team": "each with title (name), value (role) and text",
}


def validate(spec: AddSection) -> str | None:
    """A message for the model if the section is missing required content."""
    if spec.kind in _NEEDS_HEADING and not spec.heading.strip():
        return f"A {spec.kind} section needs heading: {_NEEDS_HEADING[spec.kind]}."
    if spec.kind in _NEEDS_ITEMS and not spec.items:
        return f"A {spec.kind} section needs items, {_NEEDS_ITEMS[spec.kind]}."
    if spec.kind == "pricing" and not spec.primary_label.strip():
        return "A pricing section needs primary_label: the text of each plan's button."
    return None


def image_urls(spec: AddSection) -> list[str]:
    """Image fields that contain a URL rather than a description to search for."""
    fields = [spec.image, *(item.text for item in spec.items if spec.kind == "gallery")]
    return [text.strip() for text in fields if SAFE_SRC.match(text.strip())]


CREDITS_NAME = "Photo credits"


def credit_link(design: Design, name: str, url: str) -> Element:
    painter = Painter(design, design.tone("default"))
    return painter.link(name, url, fontSize="12px", textDecoration="underline")


def photo_credits_block(design: Design, credits: list[dict[str, str]], unsplash_url: str) -> Element:
    """A small "Photos by … on Unsplash" line for the bottom of the page.

    Unsplash asks for the photographer and Unsplash to be credited wherever a photo
    is displayed. New photographers are inserted before the last two children.
    """
    tone = design.tone("default")
    note = {"width": "auto", "color": tone.muted, "fontSize": "12px"}
    row = _row(
        "Credits",
        [
            _text("Photos by", "Intro", **note),
            *(credit_link(design, c["name"], c["url"]) for c in credits),
            _text("on", "On", **note),
            credit_link(design, "Unsplash", unsplash_url),
        ],
        "8px", justifyContent="center", alignItems="center",
    )
    return _box(CREDITS_NAME, [row], {"backgroundColor": tone.background, **_pad("16px", "24px")})


def photo_requests(spec: AddSection) -> list[str]:
    """Descriptions in this section to search stock photos for, without duplicates.

    Team sections are left out on purpose: a stock photo of a stranger above a
    named team member would misrepresent who works there, so those stay labeled
    placeholders for the user to replace.
    """
    if spec.kind == "gallery":
        wanted = [item.text or item.title for item in spec.items]
    elif spec.kind == "split" or (spec.kind == "hero" and spec.variant == "split"):
        wanted = [spec.image or spec.heading]
    elif spec.kind == "hero":
        wanted = [spec.image]
    else:
        wanted = []
    cleaned = (text.strip() for text in wanted)
    return list(dict.fromkeys(text for text in cleaned if text and not SAFE_SRC.match(text)))


def render_section(spec: AddSection, design: Design, photos: dict[str, Photo] | None = None) -> Element:
    tone_name = spec.background if spec.background != "auto" else DEFAULT_TONE.get(spec.kind, "default")
    painter = Painter(design, design.tone(tone_name), photos)
    if spec.kind == "hero":
        return _hero(spec, painter, tone_name)
    if spec.kind == "cta":
        return _cta(spec, painter, tone_name)
    return _RENDERERS[spec.kind](spec, painter)
