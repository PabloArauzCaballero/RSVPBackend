from dataclasses import dataclass
from uuid import uuid4

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 10 * 1024 * 1024

class MediaValidationError(ValueError):
    status_code = 422

@dataclass(frozen=True, slots=True)
class UploadIntent:
    asset_id: str
    object_key: str
    put_url: str
    required_headers: dict[str, str]

def issue_presigned_upload(base_url: str, content_type: str, size_bytes: int, filename: str) -> UploadIntent:
    if content_type not in ALLOWED_MIME_TYPES:
        raise MediaValidationError("Unsupported MIME type")
    if size_bytes <= 0 or size_bytes > MAX_BYTES:
        raise MediaValidationError("Media size must be between 1 byte and 10 MiB")
    asset_id = str(uuid4())
    # The application gives the client an object-store URL; it never proxies bytes.
    object_key = f"uploads/{asset_id}/{filename}"
    return UploadIntent(asset_id, object_key, f"{base_url.rstrip('/')}/{object_key}?signed=development", {"Content-Type": content_type})

def variant_keys(object_key: str) -> dict[str, str]:
    stem = object_key.rsplit('.', 1)[0]
    return {"thumb": f"{stem}-thumb.webp", "medium": f"{stem}-medium.webp", "full": f"{stem}-full.webp", "webp": f"{stem}.webp"}
