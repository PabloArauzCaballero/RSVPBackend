import uuid

from django.db import models
from django.utils import timezone

from .domain import LAYOUTS


class Template(models.Model):
    """A row in the template catalogue. Adding a template is inserting one of these, not shipping a component."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        PUBLISHED = "PUBLISHED"
        ARCHIVED = "ARCHIVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.TextField()
    description = models.TextField(blank=True, default="")
    status = models.TextField(choices=Status.choices, default=Status.DRAFT)
    event_type_tags = models.JSONField(default=list)
    layout = models.TextField(choices=[(layout, layout) for layout in LAYOUTS])
    theme = models.JSONField()
    section_order = models.JSONField()
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    published_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "template"
        ordering = ["name", "id"]

    def lifecycle_payload(self) -> dict:
        """Payload of template.template.published.v1 / archived.v1 (TemplateLifecyclePayload)."""
        return {"templateId": str(self.id), "name": self.name, "eventTypeTags": list(self.event_type_tags), "layout": self.layout, "status": self.status, "version": self.version}
