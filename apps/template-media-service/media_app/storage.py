"""Upload policy and object storage. The browser uploads straight to MinIO/S3 with a presigned URL:
the file never passes through this service (REQ-16-02). MIME type and size are checked before
signing (REQ-16-03) and again against the stored object when the upload is confirmed."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from django.conf import settings

from rsvp_template_media.problems import unprocessable

ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
MAX_BYTES = 10 * 1024 * 1024
MAX_FILENAME = 80
# Anything that is not a safe filename character. "Foto de boda (1).JPG" → "foto-de-boda-1-.jpg".
UNSAFE = re.compile(r"[^a-z0-9._-]+")


def validate_upload(content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_MIME_TYPES:
        raise unprocessable("UNSUPPORTED_MEDIA_TYPE", f"Only {', '.join(sorted(ALLOWED_MIME_TYPES))} are accepted", field="contentType")
    if not isinstance(size_bytes, int) or size_bytes <= 0 or size_bytes > MAX_BYTES:
        raise unprocessable("MEDIA_TOO_LARGE", f"Media size must be between 1 byte and {MAX_BYTES // (1024 * 1024)} MiB", field="sizeBytes", maxBytes=MAX_BYTES)


def safe_filename(filename: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode().lower()
    cleaned = UNSAFE.sub("-", ascii_name).strip("-.") or "file"
    return cleaned[-MAX_FILENAME:]


def object_key_for(celebration_id: str, asset_id: str, filename: str) -> str:
    return f"uploads/{celebration_id}/{asset_id}/{safe_filename(filename)}"


def variant_keys(object_key: str) -> dict[str, str]:
    stem = object_key.rsplit(".", 1)[0]
    return {"thumb": f"{stem}-thumb.webp", "medium": f"{stem}-medium.webp", "full": f"{stem}-full.webp", "webp": f"{stem}.webp"}


@dataclass(frozen=True, slots=True)
class StoredObject:
    size_bytes: int
    content_type: str


class Storage(Protocol):
    def presign_put(self, key: str, content_type: str) -> str: ...
    def presign_get(self, key: str) -> str: ...
    def head(self, key: str) -> StoredObject | None: ...
    def get(self, key: str) -> bytes: ...
    def put(self, key: str, body: bytes, content_type: str) -> None: ...
    def delete(self, keys: list[str]) -> None: ...


class S3Storage:
    """boto3 against MinIO/S3. URLs handed to browsers are signed for the public endpoint."""

    def __init__(self, config: dict) -> None:
        import boto3
        from botocore.config import Config

        options = {"aws_access_key_id": config["access_key"], "aws_secret_access_key": config["secret_key"], "region_name": config["region"],
                   "config": Config(signature_version="s3v4", s3={"addressing_style": "path"})}
        self._internal = boto3.client("s3", endpoint_url=config["endpoint"], **options)
        self._public = boto3.client("s3", endpoint_url=config["public_endpoint"], **options)
        self._bucket = config["bucket"]
        self._expires = config["presign_seconds"]

    def presign_put(self, key: str, content_type: str) -> str:
        return self._public.generate_presigned_url("put_object", Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type}, ExpiresIn=self._expires)

    def presign_get(self, key: str) -> str:
        return self._public.generate_presigned_url("get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=self._expires)

    def head(self, key: str) -> StoredObject | None:
        from botocore.exceptions import ClientError

        try:
            response = self._internal.head_object(Bucket=self._bucket, Key=key)
        except ClientError:
            return None
        return StoredObject(size_bytes=int(response["ContentLength"]), content_type=response.get("ContentType", ""))

    def get(self, key: str) -> bytes:
        return self._internal.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self._internal.put_object(Bucket=self._bucket, Key=key, Body=body, ContentType=content_type)

    def delete(self, keys: list[str]) -> None:
        if keys:
            self._internal.delete_objects(Bucket=self._bucket, Delete={"Objects": [{"Key": key} for key in keys], "Quiet": True})


class MemoryStorage:
    """Deterministic object store for tests; `upload` plays the browser's PUT to the presigned URL."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def presign_put(self, key: str, content_type: str) -> str:
        return f"http://memory.test/rsvp-media/{key}?X-Amz-Signature=test&content-type={content_type}"

    def presign_get(self, key: str) -> str:
        return f"http://memory.test/rsvp-media/{key}?X-Amz-Signature=test"

    def head(self, key: str) -> StoredObject | None:
        stored = self.objects.get(key)
        return StoredObject(len(stored[0]), stored[1]) if stored else None

    def get(self, key: str) -> bytes:
        return self.objects[key][0]

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.objects[key] = (body, content_type)

    def upload(self, key: str, body: bytes, content_type: str) -> None:
        self.put(key, body, content_type)

    def delete(self, keys: list[str]) -> None:
        for key in keys:
            self.objects.pop(key, None)


@lru_cache(maxsize=1)
def get_storage() -> Storage:
    return MemoryStorage() if settings.MEDIA_STORAGE_BACKEND == "memory" else S3Storage(settings.MEDIA_STORAGE)
