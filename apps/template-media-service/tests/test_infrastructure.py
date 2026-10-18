"""Against the real docker compose stack. Opt in:
  TEMPLATE_DATABASE_URL=postgresql://template_owner:...@localhost:5432/<db>  → RLS tests
  MEDIA_IT=1 (+ MINIO_ENDPOINT/MINIO_PUBLIC_ENDPOINT=http://localhost:9000)  → real presigned upload to MinIO
"""
import os
import unittest
import urllib.request
import uuid

from django.db import ProgrammingError, connection, transaction
from django.test import TestCase, override_settings

from media_app.models import CelebrationAccess, MediaAsset
from media_app.storage import get_storage
from outbox.consumers import handle
from outbox.models import OutboxEvent
from rsvp_template_media.auth import Actor, jwks_cache
from rsvp_template_media.scope import apply_scope

from .helpers import JWKS, auth, celebration_event, image_bytes


@unittest.skipUnless(connection.vendor == "postgresql", "set TEMPLATE_DATABASE_URL to run the RLS tests")
class RowLevelSecurityTests(TestCase):
    def test_every_table_has_rls_enabled_and_forced(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT relname FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND NOT (relrowsecurity AND relforcerowsecurity)")
            self.assertEqual(cursor.fetchall(), [])
            cursor.execute("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")
            self.assertEqual(cursor.fetchone()[0], False, "tests must run as the owner role, not a superuser")

    def test_strangers_see_no_media_and_nobody_reads_the_outbox_without_the_relay_flag(self):
        owner, stranger, celebration = (str(uuid.uuid4()) for _ in range(3))
        handle(celebration_event("celebration.celebration.created.v1", celebration, owner))
        apply_scope(Actor(owner))
        MediaAsset.objects.create(celebration_id=celebration, uploaded_by=owner, object_key=f"k/{uuid.uuid4()}", filename="a.png", content_type="image/png", size_bytes=1)
        self.assertEqual(MediaAsset.objects.filter(celebration_id=celebration).count(), 1)
        apply_scope(Actor(stranger))
        self.assertEqual(MediaAsset.objects.filter(celebration_id=celebration).count(), 0, "RLS hides other tenants' rows from the ORM")
        self.assertEqual(CelebrationAccess.objects.filter(celebration_id=celebration).count(), 0)
        with self.assertRaises(ProgrammingError, msg="RLS rejects writing media into a foreign celebration"):
            with transaction.atomic():
                MediaAsset.objects.create(celebration_id=celebration, uploaded_by=stranger, object_key=f"k/{uuid.uuid4()}", filename="x.png", content_type="image/png", size_bytes=1)
        self.assertEqual(OutboxEvent.objects.count(), 0, "the outbox is unreadable without app.outbox_relay")
        apply_scope(None, "outbox_relay")
        self.assertGreaterEqual(OutboxEvent.objects.count(), 0)


@unittest.skipUnless(os.environ.get("MEDIA_IT") == "1", "set MEDIA_IT=1 with MinIO running to upload for real")
@override_settings(JWKS_STATIC=JWKS, MEDIA_STORAGE_BACKEND="s3")
class MinioUploadTests(TestCase):
    def test_REQ_16_02_and_04_real_presigned_put_then_variants_in_minio(self):
        jwks_cache.clear()
        get_storage.cache_clear()
        owner, celebration = str(uuid.uuid4()), str(uuid.uuid4())
        handle(celebration_event("celebration.celebration.created.v1", celebration, owner))
        png = image_bytes("PNG", (1200, 800))
        intent = self.client.post("/uploads/presign", {"celebrationId": celebration, "filename": "real.png", "contentType": "image/png", "sizeBytes": len(png)}, content_type="application/json", **auth(owner)).json()
        request = urllib.request.Request(intent["uploadUrl"], data=png, method="PUT", headers=intent["requiredHeaders"])
        with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310 - local MinIO
            self.assertEqual(response.status, 200)
        done = self.client.post(f"/uploads/{intent['assetId']}/complete", content_type="application/json", **auth(owner)).json()
        self.assertEqual(done["status"], "PROCESSED")
        storage = get_storage()
        variants = MediaAsset.objects.get(id=intent["assetId"]).variants
        self.assertTrue(all(storage.head(key) is not None for key in variants.values()))
        with urllib.request.urlopen(done["variants"]["thumb"], timeout=10) as response:  # noqa: S310 - local MinIO
            self.assertEqual(response.headers["Content-Type"], "image/webp")
        self.assertEqual(self.client.delete(f"/assets/{intent['assetId']}", **auth(owner)).status_code, 204)
        self.assertTrue(all(storage.head(key) is None for key in [intent["objectKey"], *variants.values()]))
