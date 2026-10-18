import uuid

from django.db import models
from django.utils import timezone


class OutboxEvent(models.Model):
    """Same columns as packages/platform-outbox/sql/001_outbox_inbox.sql; `payload` holds the full envelope."""

    class Status(models.TextChoices):
        PENDING = "PENDING"
        PROCESSING = "PROCESSING"
        PUBLISHED = "PUBLISHED"
        FAILED = "FAILED"

    id = models.UUIDField(primary_key=True)
    aggregate_type = models.TextField()
    aggregate_id = models.TextField()
    event_name = models.TextField()
    payload = models.JSONField()
    correlation_id = models.TextField()
    tenant_id = models.UUIDField(null=True)
    status = models.TextField(choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    available_at = models.DateTimeField(default=timezone.now)
    lease_expires_at = models.DateTimeField(null=True)
    published_at = models.DateTimeField(null=True)
    last_error = models.TextField(null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "outbox_event"
        indexes = [models.Index(fields=["status", "available_at", "created_at"], name="outbox_event_dispatch_idx")]


class InboxEvent(models.Model):
    """One row per consumed event id: redeliveries are acknowledged and skipped."""

    event_id = models.UUIDField(primary_key=True)
    consumer = models.TextField()
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "inbox_event"


def new_event_id() -> uuid.UUID:
    return uuid.uuid4()
