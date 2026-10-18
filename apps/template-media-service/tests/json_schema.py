"""Just enough JSON Schema to validate envelopes against packages/contracts-asyncapi (same as the Node test)."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

ASYNCAPI = json.loads((Path(__file__).resolve().parents[3] / "packages" / "contracts-asyncapi" / "asyncapi.yaml").read_text(encoding="utf-8"))
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def _resolve(ref: str):
    node = ASYNCAPI
    for key in ref.removeprefix("#/").split("/"):
        node = node[key]
    return node


def _type_of(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def validate(schema: dict, value, path: str = "$") -> list[str]:
    if "$ref" in schema:
        return validate(_resolve(schema["$ref"]), value, path)
    errors: list[str] = []
    for part in schema.get("allOf", []):
        errors += validate(part, value, path)
    if "type" in schema:
        allowed = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        actual = _type_of(value)
        if actual not in allowed and not (actual == "integer" and "number" in allowed):
            return errors + [f"{path}: expected {'|'.join(allowed)}, got {actual}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum")
    if isinstance(value, str):
        if schema.get("format") == "uuid" and not UUID.match(value):
            errors.append(f"{path}: not a uuid")
        if schema.get("format") == "date-time":
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"{path}: not a date-time")
    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            errors += validate(schema["items"], item, f"{path}[{index}]")
    if isinstance(value, dict):
        errors += [f"{path}.{key}: required" for key in schema.get("required", []) if key not in value]
        for key, nested in value.items():
            if key in schema.get("properties", {}):
                errors += validate(schema["properties"][key], nested, f"{path}.{key}")
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}.{key}: not allowed")
    return errors


def validate_event(envelope: dict) -> list[str]:
    channel = ASYNCAPI["channels"].get(envelope["eventType"])
    if channel is None:
        return [f"unknown channel {envelope['eventType']}"]
    return validate(_resolve(channel["publish"]["message"]["$ref"])["payload"], envelope)
