"""Prints one envelope built by the Django service's outbox, for the cross-runtime contract test."""
import json
import sys
import uuid

sys.path.insert(0, sys.argv[1])
from outbox.envelope import event_envelope  # noqa: E402

envelope = event_envelope(
    "template.media.uploaded.v1",
    str(uuid.uuid4()),
    {"assetId": str(uuid.uuid4()), "celebrationId": str(uuid.uuid4()), "objectKey": "uploads/a/b.jpg", "contentType": "image/jpeg", "sizeBytes": 10},
    str(uuid.uuid4()),
    str(uuid.uuid4()),
)
print(json.dumps(envelope))
