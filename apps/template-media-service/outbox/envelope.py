"""The standard RSVP event envelope, field by field as EventEnvelope in contracts-asyncapi.

celebration-site-service builds the same shape in TypeScript (domain/event/envelope.ts);
tests on both sides compare the two structurally.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

PRODUCER = "template-media-service"
ENVELOPE_VERSION = 1


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def event_envelope(
    event_type: str,
    celebration_id: str | None,
    payload: dict,
    correlation_id: str,
    actor_id: str | None = None,
    *,
    organization_id: str | None = None,
    event_id: str | None = None,
    occurred_at: str | None = None,
    causation_id: str | None = None,
) -> dict:
    envelope = {
        "eventId": event_id or str(uuid4()),
        "eventType": event_type,
        "eventVersion": ENVELOPE_VERSION,
        "occurredAt": occurred_at or utc_now_iso(),
        "producer": PRODUCER,
        "correlationId": correlation_id,
        "tenant": {"celebrationId": celebration_id, "organizationId": organization_id},
        "actor": {"type": "USER" if actor_id else "SYSTEM", "id": actor_id},
        "payload": payload,
    }
    if causation_id:
        envelope["causationId"] = causation_id
    return envelope
