import json
import uuid
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from outbox.service import enqueue
from rsvp_template_media.auth import Actor
from rsvp_template_media.scope import SYSTEM_USER, apply_scope
from templates_app.domain import validate_layout, validate_section_order, validate_tags, validate_theme
from templates_app.models import Template

SEEDS = Path(__file__).resolve().parents[2] / "seeds"
NAMESPACE = uuid.UUID("5f0c8a52-6f1e-4b8e-9d55-1d7d2b8a9e10")


def seed(correlation_id: str | None = None) -> list[str]:
    """Idempotent: deterministic ids, and an event only when a template is new or changed."""
    changed: list[str] = []
    with transaction.atomic():
        apply_scope(Actor(user_id=SYSTEM_USER, roles=("ADMIN",)))
        for file in sorted(SEEDS.glob("*.json")):
            data = json.loads(file.read_text(encoding="utf-8"))
            values = {
                "name": data["name"], "description": data.get("description", ""), "event_type_tags": validate_tags(data["eventTypeTags"]),
                "layout": validate_layout(data["layout"]), "theme": validate_theme(data["theme"]), "section_order": validate_section_order(data["sectionOrder"]),
            }
            template_id = uuid.uuid5(NAMESPACE, data["key"])
            current = Template.objects.filter(id=template_id).first()
            same = current is not None and current.status == Template.Status.PUBLISHED and all(getattr(current, key) == value for key, value in values.items())
            if same:
                continue
            now = timezone.now()
            template, _ = Template.objects.update_or_create(id=template_id, defaults={
                **values, "status": Template.Status.PUBLISHED, "version": (current.version + 1) if current else 1,
                "updated_at": now, "published_at": current.published_at if current and current.published_at else now,
            })
            enqueue("template.template.published.v1", aggregate_type="Template", aggregate_id=str(template.id), celebration_id=None,
                    payload=template.lifecycle_payload(), correlation_id=correlation_id or str(uuid.uuid4()), actor_id=None)
            changed.append(data["key"])
    return changed


class Command(BaseCommand):
    help = "Publishes the base templates (one per layout) from templates_app/seeds."

    def handle(self, *args, **options):
        self.stdout.write(json.dumps({"seeded": seed()}))
