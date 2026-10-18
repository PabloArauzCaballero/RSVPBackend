"""Same access rules as celebration-site-service/src/domain/policy/access.ts:
owner, CO_HOST and organization PLANNER manage; VIEWER and organization members read;
ADMIN manages everything; anyone else gets 404 (never 403)."""
from __future__ import annotations

from enum import IntEnum

from rsvp_template_media.auth import Actor
from rsvp_template_media.problems import forbidden, not_found

from .models import CelebrationAccess


class Level(IntEnum):
    NONE = 0
    READ = 1
    MANAGE = 2


def level_of(access: CelebrationAccess | None, actor: Actor | None) -> Level:
    if access is None or actor is None:
        return Level.NONE
    if actor.is_admin or str(access.owner_id) == actor.user_id:
        return Level.MANAGE
    levels = [Level.NONE]
    if access.organization_id and str(access.organization_id) in actor.organization_ids:
        levels.append(Level.MANAGE if actor.is_planner else Level.READ)
    levels += [Level.MANAGE if item.get("role") == "CO_HOST" else Level.READ for item in access.collaborators if item.get("userId") == actor.user_id]
    return max(levels)


def require(celebration_id: str, actor: Actor | None, needed: Level) -> CelebrationAccess:
    access = CelebrationAccess.objects.filter(celebration_id=celebration_id).first()
    level = level_of(access, actor)
    if level == Level.NONE or access is None:
        raise not_found("Celebration")
    if level < needed:
        raise forbidden("Only the hosts or a planner of the organization can change the media of this celebration")
    return access
