"""RS256 bearer authentication against the Identity JWKS. Only RS256 is accepted."""
from __future__ import annotations

import json
import threading
import time
import urllib.request
from dataclasses import dataclass, field

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

ALGORITHM = "RS256"
JWKS_TTL_SECONDS = 300


@dataclass(frozen=True)
class Actor:
    """The authenticated caller, as the Celebration service understands it."""

    user_id: str
    roles: tuple[str, ...] = ()
    organization_ids: tuple[str, ...] = ()
    is_authenticated: bool = field(default=True)

    @property
    def is_admin(self) -> bool:
        return "ADMIN" in self.roles

    @property
    def is_planner(self) -> bool:
        return "PLANNER" in self.roles


class _JwksCache:
    def __init__(self) -> None:
        self._keys: dict[str, object] = {}
        self._fetched_at = 0.0
        self._lock = threading.Lock()

    def _load(self) -> dict:
        if settings.JWKS_STATIC is not None:
            return settings.JWKS_STATIC
        with urllib.request.urlopen(settings.IDENTITY_JWKS_URL, timeout=5) as response:  # noqa: S310 - fixed internal URL
            return json.loads(response.read())

    def key(self, kid: str, refresh: bool = False) -> object | None:
        with self._lock:
            if refresh or not self._keys or time.monotonic() - self._fetched_at > JWKS_TTL_SECONDS:
                document = self._load()
                self._keys = {item["kid"]: jwt.PyJWK(item).key for item in document.get("keys", []) if "kid" in item}
                self._fetched_at = time.monotonic()
            return self._keys.get(kid)

    def clear(self) -> None:
        with self._lock:
            self._keys = {}


jwks_cache = _JwksCache()


def _strings(value: object) -> tuple[str, ...]:
    return tuple(item for item in value if isinstance(item, str)) if isinstance(value, list) else ()


def actor_from_token(token: str) -> Actor:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as error:
        raise AuthenticationFailed("Malformed token") from error
    if header.get("alg") != ALGORITHM or not header.get("kid"):
        raise AuthenticationFailed("Only RS256 tokens with a kid are accepted")
    key = jwks_cache.key(header["kid"]) or jwks_cache.key(header["kid"], refresh=True)
    if key is None:
        raise AuthenticationFailed("Unknown signing key")
    try:
        claims = jwt.decode(token, key=key, algorithms=[ALGORITHM], options={"require": ["sub", "exp"], "verify_aud": False})
    except jwt.PyJWTError as error:
        raise AuthenticationFailed("Invalid or expired token") from error
    return Actor(user_id=str(claims["sub"]), roles=_strings(claims.get("roles")), organization_ids=_strings(claims.get("organizationIds")))


class JwksAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header:
            return None
        if not header.startswith(f"{self.keyword} "):
            raise AuthenticationFailed("Bearer token required")
        actor = actor_from_token(header[len(self.keyword) + 1:])
        return actor, None

    def authenticate_header(self, request) -> str:
        return self.keyword
