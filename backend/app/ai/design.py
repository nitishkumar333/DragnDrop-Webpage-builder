"""A page's design: palette, fonts and corners.

Colors the model picks are corrected for contrast here, so a poor choice can't
produce unreadable text. Each section is drawn on a `Tone`, the set of colors
that work on its background.
"""

import re
from dataclasses import dataclass
from typing import Any

from . import templates
from .operations import Element, walk

_HEX = re.compile(r"^#(?:[0-9a-f]{3}|[0-9a-f]{6})$", re.I)
INK = "#0f172a"
PAPER = "#f8fafc"
WHITE = "#ffffff"
BLACK = "#000000"
MIN_TEXT_CONTRAST = 4.5

# corners -> (card radius, button radius)
CORNERS = {
    "sharp": ("0px", "0px"),
    "soft": ("10px", "8px"),
    "round": ("20px", "12px"),
    "pill": ("24px", "999px"),
}

TONES = ("default", "alt", "dark", "accent")


def is_hex(value: Any) -> bool:
    return isinstance(value, str) and bool(_HEX.match(value.strip()))


def normalize_hex(value: str) -> str:
    value = value.strip().lower()
    if len(value) == 4:
        return "#" + "".join(c * 2 for c in value[1:])
    return value


def _rgb(color: str) -> tuple[int, int, int]:
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def mix(a: str, b: str, amount: float) -> str:
    """`amount` of b blended into a."""
    channels = (round(x + (y - x) * amount) for x, y in zip(_rgb(a), _rgb(b)))
    return "#" + "".join(f"{c:02x}" for c in channels)


def luminance(color: str) -> float:
    def linear(channel: int) -> float:
        c = channel / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = _rgb(color)
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def readable_on(background: str) -> str:
    """White or near-black, whichever reads better on the background."""
    return WHITE if contrast(WHITE, background) >= contrast(INK, background) else INK


def ensure_contrast(color: str, background: str, minimum: float = MIN_TEXT_CONTRAST) -> str:
    """Move the color toward black or white until it is readable on the background."""
    target = readable_on(background)
    for step in range(11):
        candidate = mix(color, target, step / 10)
        if contrast(candidate, background) >= minimum:
            return candidate
    return target


@dataclass(frozen=True)
class Tone:
    background: str
    card: str
    text: str
    muted: str
    border: str
    accent_text: str  # eyebrows, links and icons on this background
    primary: str  # primary button background
    on_primary: str


@dataclass(frozen=True)
class Design:
    accent: str
    background: str
    surface: str
    text: str
    muted: str
    heading_font: str
    body_font: str
    corners: str = "soft"

    @property
    def card_radius(self) -> str:
        return CORNERS[self.corners][0]

    @property
    def button_radius(self) -> str:
        return CORNERS[self.corners][1]

    @property
    def is_dark(self) -> bool:
        return luminance(self.background) < 0.2

    def tone(self, name: str) -> Tone:
        card, text, muted = self.surface, self.text, self.muted
        accent = self.accent
        if name == "alt":
            background = mix(self.background, self.text, 0.04)
        elif name == "dark":
            if self.is_dark:
                background = mix(self.background, BLACK, 0.4)
            else:
                background = self.text if luminance(self.text) < 0.05 else INK
                text = PAPER
                muted = mix(PAPER, background, 0.3)
            card = mix(background, text, 0.08)
        elif name == "accent":
            background = accent
            text = readable_on(background)
            muted = mix(text, background, 0.15)
            card = mix(background, text, 0.12)
            accent = text
        else:
            background = self.background
        primary = text if name == "accent" else self.accent
        return Tone(
            background=background,
            card=card,
            text=text,
            muted=ensure_contrast(muted, background),
            border=mix(background, text, 0.14),
            accent_text=ensure_contrast(accent, background),
            primary=primary,
            on_primary=background if name == "accent" else readable_on(primary),
        )


def font_value(name: str) -> str | None:
    """The stored fontFamily for a font's label or value, or None if it isn't available."""
    key = name.strip().lower()
    for font in templates.fonts():
        if key in (font["label"].lower(), font["value"].lower()):
            return font["value"]
    return None


def make_design(
    *,
    accent: str,
    background: str,
    surface: str,
    text: str,
    muted: str,
    heading_font: str,
    body_font: str,
    corners: str = "soft",
) -> Design:
    """Build a design from normalized hex colors, keeping its text readable."""
    fixed_text = ensure_contrast(text, background)
    return Design(
        accent=accent,
        background=background,
        surface=surface,
        text=fixed_text,
        muted=ensure_contrast(muted, background),
        heading_font=heading_font,
        body_font=body_font,
        corners=corners,
    )


def _hex_style(el: Element, prop: str) -> str | None:
    value = (el.get("styles") or {}).get(prop)
    return normalize_hex(value) if is_hex(value) else None


def _corners_from(radius: Any) -> str:
    value = str(radius or "")
    match = re.match(r"\d+", value)
    if not match:
        return "soft"
    px = int(match.group())
    if px == 0:
        return "sharp"
    if px >= 100:
        return "pill"
    return "round" if px >= 12 else "soft"


def infer_design(elements: list[Element]) -> Design:
    """Read the design from an existing page, so new sections match what's there
    (including anything the user changed by hand)."""
    body = elements[0]
    background = _hex_style(body, "backgroundColor") or WHITE
    is_dark = luminance(background) < 0.2
    text = _hex_style(body, "color") or (PAPER if is_dark else INK)

    accent = None
    corners = "soft"
    heading_font = None
    body_font = (body.get("styles") or {}).get("fontFamily")
    for el in walk(elements):
        styles = el.get("styles") or {}
        if el.get("type") == "button" and accent is None:
            color = _hex_style(el, "backgroundColor")
            # Neutral buttons (white, black, gray) don't carry the brand color.
            if color and max(_rgb(color)) - min(_rgb(color)) > 24:
                accent = color
                corners = _corners_from(styles.get("borderRadius"))
        if el.get("type") == "heading" and heading_font is None:
            heading_font = styles.get("fontFamily")
    fallback_font = templates.fonts()[0]["value"]
    return make_design(
        accent=accent or "#4f46e5",
        background=background,
        surface=WHITE if not is_dark else mix(background, WHITE, 0.06),
        text=text,
        muted=mix(text, background, 0.35),
        heading_font=heading_font or body_font or fallback_font,
        body_font=body_font or fallback_font,
        corners=corners,
    )
