"""REQ-16-06: the Django envelope is the NestJS envelope, field by field, and every event we
produce validates against its AsyncAPI channel."""
import json
import shutil
import subprocess
import unittest
import uuid
from pathlib import Path

from django.test import SimpleTestCase

from outbox.envelope import event_envelope

from .json_schema import ASYNCAPI, validate_event

NODE_SERVICE = Path(__file__).resolve().parents[2] / "celebration-site-service"
NODE_SCRIPT = """
import { buildEnvelope } from './dist/index.js';
process.stdout.write(JSON.stringify(buildEnvelope({ eventId: crypto.randomUUID(), eventType: 'template.media.uploaded.v1', occurredAt: new Date().toISOString(),
  correlationId: crypto.randomUUID(), celebrationId: crypto.randomUUID(), organizationId: null, actorId: crypto.randomUUID(), payload: {} })));
"""


def shape(value):
    if value is None or isinstance(value, str):
        return "null|string"
    if isinstance(value, dict):
        return {key: shape(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return "array"
    return type(value).__name__


def our_envelopes() -> list[dict]:
    celebration, asset, template = (str(uuid.uuid4()) for _ in range(3))
    common = {"assetId": asset, "celebrationId": celebration}
    return [
        event_envelope("template.template.published.v1", None, {"templateId": template, "name": "Clásico", "eventTypeTags": ["wedding"], "layout": "classic", "status": "PUBLISHED", "version": 2}, str(uuid.uuid4())),
        event_envelope("template.template.archived.v1", None, {"templateId": template, "name": "Clásico", "eventTypeTags": ["wedding"], "layout": "classic", "status": "ARCHIVED", "version": 3}, str(uuid.uuid4()), str(uuid.uuid4())),
        event_envelope("template.media.uploaded.v1", celebration, {**common, "objectKey": "uploads/x.png", "contentType": "image/png", "sizeBytes": 10}, str(uuid.uuid4()), str(uuid.uuid4())),
        event_envelope("template.media-variants.generated.v1", celebration, {**common, "variants": {"thumb": "a", "medium": "b", "full": "c", "webp": "d"}}, str(uuid.uuid4()), str(uuid.uuid4())),
        event_envelope("template.media.deleted.v1", celebration, common, str(uuid.uuid4()), str(uuid.uuid4())),
    ]


class EnvelopeContractTests(SimpleTestCase):
    def test_every_template_media_channel_is_produced_and_valid(self):
        envelopes = our_envelopes()
        ours = sorted(channel for channel in ASYNCAPI["channels"] if channel.startswith("template."))
        self.assertEqual(sorted(envelope["eventType"] for envelope in envelopes), ours)
        for envelope in envelopes:
            with self.subTest(event=envelope["eventType"]):
                self.assertEqual(validate_event(envelope), [])

    def test_the_validator_can_fail(self):
        broken = {**our_envelopes()[2], "eventVersion": 2}
        broken["payload"] = {**broken["payload"], "extra": 1}
        errors = validate_event(broken)
        self.assertTrue(any("eventVersion" in error for error in errors))
        self.assertTrue(any("extra" in error for error in errors))

    @unittest.skipUnless(shutil.which("node") and (NODE_SERVICE / "dist" / "index.js").exists(), "celebration-site-service must be built")
    def test_same_shape_as_the_nestjs_envelope(self):
        output = subprocess.run(["node", "--input-type=module", "-e", NODE_SCRIPT], cwd=NODE_SERVICE, capture_output=True, text=True, check=True).stdout
        node = json.loads(output)
        python = event_envelope("template.media.uploaded.v1", str(uuid.uuid4()), {}, str(uuid.uuid4()), str(uuid.uuid4()))
        strip = lambda envelope: {key: value for key, value in envelope.items() if key not in ("payload", "producer")}
        self.assertEqual(shape(strip(python)), shape(strip(node)))
        self.assertEqual(node["producer"], "celebration-site-service")
        self.assertEqual(python["producer"], "template-media-service")
