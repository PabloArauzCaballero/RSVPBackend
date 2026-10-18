"""Template rules, free of Django: what a theme is, which templates fit an event type, and how a
template renders a celebration without ever touching its content (REQ-16-05)."""
from __future__ import annotations

import re
from dataclasses import dataclass

from rsvp_template_media.problems import unprocessable

LAYOUTS = ("classic", "minimal", "editorial", "festive", "corporate")
SECTIONS = ("story", "schedule", "venues", "gallery", "dressCode", "faq", "recommendations", "gifts", "rsvp")
SECTION_STYLES = ("plain", "cards", "bands")
PALETTE_KEYS = ("canvas", "surface", "text", "accent", "muted")

# Hex colour. Matches "#FFFBF4" and "#fff"; rejects "red".
HEX_COLOUR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
# Kebab-case tag. Matches "wedding"; rejects "Wedding".
TAG = re.compile(r"^[a-z][a-z0-9-]{0,39}$")


def validate_theme(theme: object) -> dict:
    """A theme is data: palette, typography and section style. Unknown or malformed parts are a 422."""
    if not isinstance(theme, dict):
        raise unprocessable("INVALID_THEME", "theme must be an object", field="theme")
    palette = theme.get("palette")
    if not isinstance(palette, dict) or set(palette) != set(PALETTE_KEYS) or not all(isinstance(v, str) and HEX_COLOUR.match(v) for v in palette.values()):
        raise unprocessable("INVALID_THEME", f"palette needs hex colours for exactly {', '.join(PALETTE_KEYS)}", field="theme.palette")
    typography = theme.get("typography")
    if not isinstance(typography, dict) or not all(isinstance(typography.get(key), str) and typography.get(key).strip() for key in ("heading", "body")):
        raise unprocessable("INVALID_THEME", "typography needs heading and body font stacks", field="theme.typography")
    if theme.get("sectionStyle") not in SECTION_STYLES:
        raise unprocessable("INVALID_THEME", f"sectionStyle must be one of {', '.join(SECTION_STYLES)}", field="theme.sectionStyle")
    return {"palette": dict(palette), "typography": {"heading": typography["heading"], "body": typography["body"]}, "sectionStyle": theme["sectionStyle"]}


def validate_section_order(order: object) -> list[str]:
    if not isinstance(order, list) or not order or len(set(order)) != len(order) or not all(section in SECTIONS for section in order):
        raise unprocessable("INVALID_SECTIONS", f"sectionOrder must list unique sections of {', '.join(SECTIONS)}", field="sectionOrder")
    return list(order)


def validate_tags(tags: object) -> list[str]:
    if not isinstance(tags, list) or not tags or len(set(tags)) != len(tags) or not all(isinstance(tag, str) and TAG.match(tag) for tag in tags):
        raise unprocessable("INVALID_TAGS", "eventTypeTags must be unique kebab-case tags", field="eventTypeTags")
    return sorted(tags)


def validate_layout(layout: object) -> str:
    if layout not in LAYOUTS:
        raise unprocessable("INVALID_LAYOUT", f"layout must be one of {', '.join(LAYOUTS)}", field="layout")
    return str(layout)


def is_compatible(template_tags: list[str], event_type_tags: list[str]) -> bool:
    """A template is offered for an event type when they share a tag (REQ-16-01 / REQ-11-04)."""
    return bool(set(template_tags) & set(event_type_tags))


@dataclass(frozen=True)
class RenderPlan:
    visible: list[str]
    hidden: list[str]
    content: dict


def render_plan(section_order: list[str], enabled_sections: list[str], content: dict) -> RenderPlan:
    """Which sections a template shows for a celebration. Sections the template does not place are
    hidden, never dropped: the content is returned as received, so switching back restores everything."""
    visible = [section for section in section_order if section in enabled_sections]
    hidden = [section for section in enabled_sections if section not in section_order]
    return RenderPlan(visible=visible, hidden=hidden, content=content)
