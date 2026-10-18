"""Structured JSON logs with the same redaction rule as @rsvp/platform-telemetry."""
import json
import logging
import re

# Keys whose values must never be logged. Matches "email", "Authorization"; rejects "eventType".
SENSITIVE_KEY = re.compile(r"email|e-mail|phone|telefono|teléfono|password|secret|token|authorization", re.IGNORECASE)
STANDARD = set(vars(logging.makeLogRecord({})))


def redact(value):
    if isinstance(value, dict):
        return {key: "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else redact(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        fields = {key: value for key, value in vars(record).items() if key not in STANDARD}
        entry = {"level": record.levelname.lower(), "message": record.getMessage(), "logger": record.name, **fields}
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info).splitlines()[-1]
        return json.dumps(redact(entry), default=str)
