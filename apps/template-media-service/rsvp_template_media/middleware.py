"""Correlation id in, correlation id out, and one JSON log line per request without PII."""
import logging
import re
import time
import uuid

# Canonical UUID. Matches "0b6f8c1e-2a1d-4c5e-9f00-1234567890ab"; rejects "not-a-uuid".
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
logger = logging.getLogger("template-media.http")


class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        incoming = request.headers.get("X-Correlation-Id", "")
        request.correlation_id = incoming if UUID_PATTERN.match(incoming) else str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Correlation-Id"] = request.correlation_id
        resolver = getattr(request, "resolver_match", None)
        logger.info("http_request", extra={
            "method": request.method,
            "route": resolver.route if resolver else "unmatched",
            "status": response.status_code,
            "durationMs": round((time.perf_counter() - started) * 1000),
            "correlationId": request.correlation_id,
        })
        return response
