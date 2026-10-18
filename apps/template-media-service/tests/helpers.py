"""Test support: real RS256 keys, real images, and celebration events shaped like the contract."""
from __future__ import annotations

import io
import json
import time
import uuid

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from PIL import Image

KID = "test-key-1"
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
JWKS = {"keys": [{**json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(_private_key.public_key())), "kid": KID, "alg": "RS256", "use": "sig"}]}


def token(sub: str | None = None, roles: list[str] | None = None, organization_ids: list[str] | None = None, *, alg: str = "RS256", expires_in: int = 900) -> str:
    claims = {"sub": sub or str(uuid.uuid4()), "iat": int(time.time()), "exp": int(time.time()) + expires_in, "roles": roles or ["HOST"], "organizationIds": organization_ids or []}
    if alg != "RS256":
        return jwt.encode(claims, "shared-secret-attack", algorithm=alg, headers={"kid": KID})
    return jwt.encode(claims, _private_key, algorithm="RS256", headers={"kid": KID})


def auth(sub: str | None = None, **kwargs) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {token(sub, **kwargs)}"}


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (2400, 1600), with_gps: bool = False) -> bytes:
    image = Image.new("RGB", size, (200, 120, 80))
    buffer = io.BytesIO()
    if with_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "S", 2: (16.0, 30.0, 0.0), 3: "W", 4: (68.0, 9.0, 0.0)}
        exif[0x010F] = "PhoneMaker"
        image.save(buffer, format=fmt, exif=exif)
    else:
        image.save(buffer, format=fmt)
    return buffer.getvalue()


def celebration_event(event_type: str, celebration_id: str, owner_id: str, *, version: int = 1, status: str = "DRAFT",
                      organization_id: str | None = None, collaborators: list | None = None, event_id: str | None = None) -> dict:
    snapshot = {
        "celebrationId": celebration_id, "slug": f"c-{celebration_id[:8]}", "status": status, "eventTypeCode": "WEDDING", "organizationId": organization_id,
        "defaultLocale": "es-BO", "supportedLocales": ["es-BO"], "timeZone": "America/La_Paz", "currency": "BOB", "templateId": None,
        "content": {}, "translations": {}, "publishedAt": None, "aggregateVersion": version, "ownerId": owner_id, "collaborators": collaborators or [],
    }
    state_only = event_type in ("celebration.celebration.unpublished.v1", "celebration.celebration.archived.v1")
    payload = {"celebrationId": celebration_id, "slug": snapshot["slug"], "aggregateVersion": version, "reason": None} if state_only else {"celebration": snapshot}
    return {
        "eventId": event_id or str(uuid.uuid4()), "eventType": event_type, "eventVersion": 1, "occurredAt": "2026-10-17T12:00:00.000Z",
        "producer": "celebration-site-service", "correlationId": str(uuid.uuid4()), "tenant": {"celebrationId": celebration_id, "organizationId": organization_id},
        "actor": {"type": "USER", "id": owner_id}, "payload": payload,
    }
