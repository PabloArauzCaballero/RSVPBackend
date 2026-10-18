"""Enqueue events in the caller's transaction; a relay publishes them after commit."""
from __future__ import annotations

from django.db import transaction

from .envelope import event_envelope
from .models import OutboxEvent


def enqueue(event_type: str, *, aggregate_type: str, aggregate_id: str, celebration_id: str | None, payload: dict, correlation_id: str, actor_id: str | None) -> dict:
    """Writes the envelope to outbox_event. Must be called inside the transaction that changed the aggregate."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("enqueue() must run inside the aggregate's transaction")
    envelope = event_envelope(event_type, celebration_id, payload, correlation_id, actor_id)
    OutboxEvent.objects.create(
        id=envelope["eventId"], aggregate_type=aggregate_type, aggregate_id=aggregate_id, event_name=event_type,
        payload=envelope, correlation_id=correlation_id, tenant_id=celebration_id,
    )
    return envelope
