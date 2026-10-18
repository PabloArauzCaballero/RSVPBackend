"""Consumes celebration.* events to keep `celebration_access` current. Idempotent by eventId
(inbox) and by aggregate version, so redeliveries and out-of-order messages change nothing."""
from __future__ import annotations

import json
import logging
import os

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from rsvp_template_media.scope import apply_scope

from .models import InboxEvent

logger = logging.getLogger("template-media.consumer")
CONSUMER = "template-media.celebration-access"
# Two deployments sharing a broker must use different prefixes (TEMPLATE_MEDIA_QUEUE_PREFIX).
QUEUE = f"{os.environ.get('TEMPLATE_MEDIA_QUEUE_PREFIX', 'template-media')}.celebration-access"
SNAPSHOT_EVENTS = {
    "celebration.celebration.created.v1",
    "celebration.celebration.configured.v1",
    "celebration.celebration.type-assigned.v1",
    "celebration.celebration.published.v1",
}
STATE_EVENTS = {"celebration.celebration.unpublished.v1", "celebration.celebration.archived.v1"}
ROUTING_KEYS = sorted(SNAPSHOT_EVENTS | STATE_EVENTS)


def _apply(envelope: dict) -> None:
    from media_app.models import CelebrationAccess

    event_type = envelope["eventType"]
    payload = envelope["payload"]
    if event_type in SNAPSHOT_EVENTS:
        snapshot = payload["celebration"]
        celebration_id = snapshot["celebrationId"]
        version = snapshot["aggregateVersion"]
        values = {
            "owner_id": snapshot["ownerId"], "organization_id": snapshot["organizationId"], "collaborators": snapshot["collaborators"],
            "published": snapshot["status"] == "PUBLISHED", "archived": snapshot["status"] == "ARCHIVED",
        }
    else:
        celebration_id = payload["celebrationId"]
        version = payload["aggregateVersion"]
        values = {"published": False, "archived": event_type == "celebration.celebration.archived.v1"}
    current = CelebrationAccess.objects.select_for_update().filter(celebration_id=celebration_id).first()
    if current is not None and current.aggregate_version >= version:
        return
    if current is None and "owner_id" not in values:
        return
    CelebrationAccess.objects.update_or_create(celebration_id=celebration_id, defaults={**values, "aggregate_version": version, "updated_at": timezone.now()})


def handle(envelope: dict) -> bool:
    """Returns False for duplicates and for events this consumer does not care about."""
    if envelope.get("eventType") not in ROUTING_KEYS:
        return False
    with transaction.atomic():
        apply_scope(None, "consumer")
        try:
            with transaction.atomic():
                InboxEvent.objects.create(event_id=envelope["eventId"], consumer=CONSUMER)
        except IntegrityError:
            return False
        _apply(envelope)
    return True


def consume_forever(url: str | None = None) -> None:  # pragma: no cover - exercised by the broker integration test
    import pika

    connection = pika.BlockingConnection(pika.URLParameters(url or settings.RABBITMQ_URL))
    channel = connection.channel()
    channel.exchange_declare(settings.CELEBRATION_EXCHANGE, exchange_type="topic", durable=True)
    channel.queue_declare(QUEUE, durable=True)
    channel.queue_declare(f"{QUEUE}.parking", durable=True)
    for key in ROUTING_KEYS:
        channel.queue_bind(QUEUE, settings.CELEBRATION_EXCHANGE, key)

    def on_message(ch, method, properties, body):
        try:
            handle(json.loads(body))
        except Exception as error:  # noqa: BLE001 - a poison message is parked, not retried forever
            logger.error("message parked", extra={"queue": QUEUE, "error": str(error)})
            ch.basic_publish("", f"{QUEUE}.parking", body, properties)
        ch.basic_ack(method.delivery_tag)

    channel.basic_qos(prefetch_count=20)
    channel.basic_consume(QUEUE, on_message)
    logger.info("consumer started", extra={"queue": QUEUE})
    channel.start_consuming()
