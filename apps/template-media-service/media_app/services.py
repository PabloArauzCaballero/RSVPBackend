"""Media use cases. Each runs in the request transaction; events go through the outbox."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from outbox.service import enqueue
from rsvp_template_media.auth import Actor
from rsvp_template_media.problems import conflict, not_found, unprocessable

from .access import Level, require
from .models import CelebrationAccess, MediaAsset
from .storage import get_storage, object_key_for, validate_upload, variant_keys
from .variants import generate_variants

UPLOADED = "template.media.uploaded.v1"
VARIANTS_GENERATED = "template.media-variants.generated.v1"
DELETED = "template.media.deleted.v1"


def _iso(value) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None


def serialize_asset(asset: MediaAsset, with_urls: bool = True) -> dict:
    storage = get_storage()
    processed = asset.status == MediaAsset.Status.PROCESSED
    return {
        "id": str(asset.id), "celebrationId": str(asset.celebration_id), "filename": asset.filename, "contentType": asset.content_type,
        "sizeBytes": asset.size_bytes, "status": asset.status, "width": asset.width, "height": asset.height, "sortOrder": asset.sort_order,
        "isCover": asset.is_cover, "createdAt": _iso(asset.created_at),
        "variants": {name: storage.presign_get(key) for name, key in asset.variants.items()} if with_urls and processed else {},
    }


def _emit(event_type: str, asset: MediaAsset, payload: dict, actor: Actor, correlation_id: str) -> None:
    enqueue(event_type, aggregate_type="MediaAsset", aggregate_id=str(asset.id), celebration_id=str(asset.celebration_id), payload=payload,
            correlation_id=correlation_id, actor_id=actor.user_id)


def issue_upload(actor: Actor, celebration_id: str, filename: str, content_type: str, size_bytes: int) -> dict:
    """Validates before signing and returns a presigned PUT; the bytes go straight to object storage."""
    require(celebration_id, actor, Level.MANAGE)
    validate_upload(content_type, size_bytes)
    asset_id = uuid.uuid4()
    asset = MediaAsset.objects.create(
        id=asset_id, celebration_id=celebration_id, uploaded_by=actor.user_id, object_key=object_key_for(celebration_id, str(asset_id), filename),
        filename=filename[:200], content_type=content_type, size_bytes=size_bytes,
    )
    return {
        "assetId": str(asset.id), "objectKey": asset.object_key, "uploadUrl": get_storage().presign_put(asset.object_key, content_type),
        "method": "PUT", "requiredHeaders": {"Content-Type": content_type}, "maxBytes": size_bytes,
    }


def _owned_asset(actor: Actor, asset_id: str, needed: Level) -> MediaAsset:
    asset = MediaAsset.objects.select_for_update().filter(id=asset_id).exclude(status=MediaAsset.Status.DELETED).first()
    if asset is None:
        raise not_found("Media asset")
    require(str(asset.celebration_id), actor, needed)
    return asset


def complete_upload(actor: Actor, asset_id: str, correlation_id: str) -> dict:
    """The browser finished its PUT: verify the stored object, build variants, publish the events."""
    asset = _owned_asset(actor, asset_id, Level.MANAGE)
    if asset.status != MediaAsset.Status.PENDING_UPLOAD:
        raise conflict("UPLOAD_ALREADY_COMPLETED", f"Asset is {asset.status}")
    storage = get_storage()
    stored = storage.head(asset.object_key)
    if stored is None:
        raise conflict("UPLOAD_NOT_FOUND", "Nothing was uploaded to the presigned URL yet")
    if stored.size_bytes != asset.size_bytes or stored.content_type != asset.content_type:
        storage.delete([asset.object_key])
        asset.status = MediaAsset.Status.REJECTED
        asset.save(update_fields=["status"])
        raise unprocessable("UPLOAD_MISMATCH", "The uploaded file does not match the declared type or size", declared={"sizeBytes": asset.size_bytes, "contentType": asset.content_type})
    variants, (width, height) = generate_variants(storage.get(asset.object_key), asset.content_type)
    keys = variant_keys(asset.object_key)
    for name, variant in variants.items():
        storage.put(keys[name], variant.body, variant.content_type)
    has_cover = MediaAsset.objects.filter(celebration_id=asset.celebration_id, is_cover=True).exclude(id=asset.id).exists()
    last = MediaAsset.objects.filter(celebration_id=asset.celebration_id, status=MediaAsset.Status.PROCESSED).aggregate(Max("sort_order"))["sort_order__max"]
    asset.status, asset.variants, asset.width, asset.height = MediaAsset.Status.PROCESSED, keys, width, height
    asset.is_cover, asset.sort_order, asset.updated_at = not has_cover, (last + 1 if last is not None else 0), timezone.now()
    asset.save()
    common = {"assetId": str(asset.id), "celebrationId": str(asset.celebration_id)}
    _emit(UPLOADED, asset, {**common, "objectKey": asset.object_key, "contentType": asset.content_type, "sizeBytes": asset.size_bytes}, actor, correlation_id)
    _emit(VARIANTS_GENERATED, asset, {**common, "variants": keys}, actor, correlation_id)
    return serialize_asset(asset)


def list_assets(actor: Actor, celebration_id: str) -> list[dict]:
    require(celebration_id, actor, Level.READ)
    return [serialize_asset(asset) for asset in MediaAsset.objects.filter(celebration_id=celebration_id).exclude(status=MediaAsset.Status.DELETED)]


VARIANTS = ("thumb", "medium", "full", "webp")


def _published(celebration_id: str) -> CelebrationAccess:
    access = CelebrationAccess.objects.filter(celebration_id=celebration_id, published=True, archived=False).first()
    if access is None:
        raise not_found("Celebration")
    return access


def public_variant_url(asset_id: str, variant: str) -> str:
    """Stable public URL of a variant (it redirects to a fresh presigned URL on every request)."""
    return f"{settings.PUBLIC_MEDIA_BASE_URL.rstrip('/')}/public/assets/{asset_id}/{variant}"


def public_assets(celebration_id: str) -> list[dict]:
    """Gallery of a published celebration; anything else is a 404 that reveals nothing.
    URLs are stable (no expiry) so they can live in cached HTML and in Open Graph cards."""
    _published(celebration_id)
    assets = MediaAsset.objects.filter(celebration_id=celebration_id, status=MediaAsset.Status.PROCESSED)
    return [{**serialize_asset(asset, with_urls=False), "variants": {name: public_variant_url(str(asset.id), name) for name in asset.variants}} for asset in assets]


def public_variant_redirect(asset_id: str, variant: str) -> str:
    """Presigned GET for one variant of a published celebration's photo; 404 otherwise."""
    if variant not in VARIANTS:
        raise not_found("Media asset")
    asset = MediaAsset.objects.filter(id=asset_id, status=MediaAsset.Status.PROCESSED).first()
    if asset is None or variant not in asset.variants:
        raise not_found("Media asset")
    _published(str(asset.celebration_id))
    return get_storage().presign_get(asset.variants[variant])


def reorder(actor: Actor, celebration_id: str, asset_ids: list[str], cover_id: str | None) -> list[dict]:
    require(celebration_id, actor, Level.MANAGE)
    assets = {str(asset.id): asset for asset in MediaAsset.objects.select_for_update().filter(celebration_id=celebration_id, status=MediaAsset.Status.PROCESSED)}
    if sorted(asset_ids) != sorted(assets) or (cover_id is not None and cover_id not in assets):
        raise unprocessable("INVALID_ORDER", "Send every processed asset of the celebration exactly once", field="assetIds")
    for position, asset_id in enumerate(asset_ids):
        asset = assets[asset_id]
        asset.sort_order = position
        asset.is_cover = asset_id == (cover_id if cover_id is not None else next((key for key, item in assets.items() if item.is_cover), None))
        asset.updated_at = timezone.now()
        asset.save(update_fields=["sort_order", "is_cover", "updated_at"])
    return list_assets(actor, celebration_id)


def delete_asset(actor: Actor, asset_id: str, correlation_id: str) -> None:
    asset = _owned_asset(actor, asset_id, Level.MANAGE)
    get_storage().delete([asset.object_key, *asset.variants.values()])
    asset.status, asset.is_cover, asset.updated_at = MediaAsset.Status.DELETED, False, timezone.now()
    asset.save(update_fields=["status", "is_cover", "updated_at"])
    _emit(DELETED, asset, {"assetId": str(asset.id), "celebrationId": str(asset.celebration_id)}, actor, correlation_id)
