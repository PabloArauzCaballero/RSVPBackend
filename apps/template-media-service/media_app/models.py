import uuid

from django.db import models
from django.utils import timezone


class CelebrationAccess(models.Model):
    """Local copy of who may act on each celebration, kept current from celebration.* events.
    It mirrors the access policy of celebration-site-service (domain/policy/access.ts)."""

    celebration_id = models.UUIDField(primary_key=True)
    owner_id = models.UUIDField()
    organization_id = models.UUIDField(null=True)
    collaborators = models.JSONField(default=list)
    published = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    aggregate_version = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "celebration_access"


class MediaAsset(models.Model):
    class Status(models.TextChoices):
        PENDING_UPLOAD = "PENDING_UPLOAD"
        PROCESSED = "PROCESSED"
        REJECTED = "REJECTED"
        DELETED = "DELETED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    celebration_id = models.UUIDField(db_index=True)
    uploaded_by = models.UUIDField()
    object_key = models.TextField(unique=True)
    filename = models.TextField()
    content_type = models.TextField()
    size_bytes = models.PositiveIntegerField()
    status = models.TextField(choices=Status.choices, default=Status.PENDING_UPLOAD)
    variants = models.JSONField(default=dict)
    width = models.PositiveIntegerField(null=True)
    height = models.PositiveIntegerField(null=True)
    sort_order = models.IntegerField(default=0)
    is_cover = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "media_asset"
        ordering = ["sort_order", "created_at", "id"]
