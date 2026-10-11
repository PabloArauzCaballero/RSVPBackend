import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).parents[1]))
from templates_app.models import Template, TemplateStatus
from templates_app.views import compatible_templates
from media_app.storage import MediaValidationError, issue_presigned_upload, variant_keys
from outbox.envelope import event_envelope

class TemplateMediaTests(unittest.TestCase):
    def test_only_published_compatible_templates_are_exposed(self):
        published = Template("1", "Boda", {"wedding"}, {"hero": {}}, TemplateStatus.PUBLISHED)
        draft = Template("2", "Borrador", {"wedding"}, {}, TemplateStatus.DRAFT)
        self.assertEqual([item["id"] for item in compatible_templates([published, draft], {"wedding"})], ["1"])
    def test_upload_is_direct_and_validated_before_signing(self):
        upload = issue_presigned_upload("http://minio:9000/media", "image/jpeg", 1024, "hero.jpg")
        self.assertIn("uploads/", upload.put_url)
        self.assertEqual(set(variant_keys(upload.object_key)), {"thumb", "medium", "full", "webp"})
        with self.assertRaises(MediaValidationError): issue_presigned_upload("http://minio", "application/pdf", 4, "x.pdf")
        with self.assertRaises(MediaValidationError): issue_presigned_upload("http://minio", "image/png", 11 * 1024 * 1024, "x.png")
    def test_event_envelope_matches_shared_contract_shape(self):
        envelope = event_envelope("template.media.uploaded.v1", "11111111-1111-1111-1111-111111111111", {"assetId": "a"}, "22222222-2222-2222-2222-222222222222")
        self.assertTrue({"eventId", "eventType", "eventVersion", "occurredAt", "producer", "correlationId", "tenant", "actor", "payload"}.issubset(envelope))
        self.assertEqual(envelope["eventVersion"], 1)
        self.assertEqual(envelope["tenant"]["celebrationId"], "11111111-1111-1111-1111-111111111111")

if __name__ == "__main__": unittest.main()
