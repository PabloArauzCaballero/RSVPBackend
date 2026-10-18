"""Outbox relay with the platform's semantics: claim with a lease, publish with confirms, back off on failure."""
from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Callable, Protocol

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rsvp_template_media.scope import apply_scope

from .models import OutboxEvent

logger = logging.getLogger("template-media.outbox")
LEASE = timedelta(seconds=60)
MAX_ATTEMPTS = 8
MAX_BACKOFF_SECONDS = 300


class Publisher(Protocol):
    def publish(self, envelope: dict) -> None: ...


def backoff(attempt: int) -> timedelta:
    return timedelta(seconds=min(MAX_BACKOFF_SECONDS, 2 ** max(0, attempt - 1)))


def _claim(limit: int) -> list[OutboxEvent]:
    with transaction.atomic():
        apply_scope(None, "outbox_relay")
        now = timezone.now()
        candidates = (
            OutboxEvent.objects.select_for_update(skip_locked=True)
            .filter(status__in=[OutboxEvent.Status.PENDING, OutboxEvent.Status.PROCESSING], available_at__lte=now)
            .exclude(status=OutboxEvent.Status.PROCESSING, lease_expires_at__gt=now)
            .order_by("created_at")[:limit]
        )
        claimed = list(candidates)
        OutboxEvent.objects.filter(id__in=[event.id for event in claimed]).update(status=OutboxEvent.Status.PROCESSING, lease_expires_at=now + LEASE)
        return claimed


def _finish(event: OutboxEvent, error: Exception | None) -> None:
    with transaction.atomic():
        apply_scope(None, "outbox_relay")
        if error is None:
            OutboxEvent.objects.filter(id=event.id).update(status=OutboxEvent.Status.PUBLISHED, published_at=timezone.now(), lease_expires_at=None)
            return
        attempts = event.attempts + 1
        OutboxEvent.objects.filter(id=event.id).update(
            status=OutboxEvent.Status.FAILED if attempts >= MAX_ATTEMPTS else OutboxEvent.Status.PENDING,
            attempts=attempts, available_at=timezone.now() + backoff(attempts), last_error=str(error)[:500], lease_expires_at=None,
        )


def relay_batch(publisher: Publisher, limit: int = 100) -> dict[str, int]:
    published = failed = 0
    for event in _claim(limit):
        try:
            publisher.publish(event.payload)
        except Exception as error:  # noqa: BLE001 - any broker failure is retried with backoff
            logger.warning("outbox publish failed", extra={"eventId": str(event.id), "error": str(error)})
            _finish(event, error)
            failed += 1
        else:
            _finish(event, None)
            published += 1
    return {"published": published, "failed": failed}


class PikaPublisher:
    """Persistent publish with publisher confirms to template-media.events, routing key = eventType."""

    def __init__(self, url: str | None = None, exchange: str | None = None) -> None:
        import pika

        self._connection = pika.BlockingConnection(pika.URLParameters(url or settings.RABBITMQ_URL))
        self._channel = self._connection.channel()
        self._channel.confirm_delivery()
        self._exchange = exchange or settings.EVENTS_EXCHANGE
        self._channel.exchange_declare(self._exchange, exchange_type="topic", durable=True)
        self._properties: Callable[[dict], object] = lambda envelope: pika.BasicProperties(
            content_type="application/json", delivery_mode=2, message_id=envelope["eventId"], correlation_id=envelope["correlationId"],
            headers={"eventId": envelope["eventId"], "correlationId": envelope["correlationId"]},
        )

    def publish(self, envelope: dict) -> None:
        self._channel.basic_publish(self._exchange, envelope["eventType"], json.dumps(envelope).encode(), self._properties(envelope), mandatory=False)

    def sleep(self, seconds: float) -> None:
        """Waits while answering broker heartbeats; time.sleep would let RabbitMQ drop the connection."""
        self._connection.sleep(seconds)

    def close(self) -> None:
        if self._connection.is_open:
            self._connection.close()
