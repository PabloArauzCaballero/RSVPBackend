from datetime import datetime, timezone
from uuid import uuid4

def event_envelope(event_type: str, celebration_id: str | None, payload: dict, correlation_id: str, actor_id: str | None = None) -> dict:
    """Matches the AsyncAPI EventEnvelope: versioned, tenant-aware and JSON serializable."""
    return {"eventId": str(uuid4()), "eventType": event_type, "eventVersion": 1, "occurredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "producer": "template-media-service", "correlationId": correlation_id, "tenant": {"celebrationId": celebration_id, "organizationId": None}, "actor": {"type": "USER" if actor_id else "SYSTEM", "id": actor_id}, "payload": payload}
