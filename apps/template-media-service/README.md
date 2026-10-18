# Template / Media Service

Django + DRF (lane 16). The template catalogue — layouts and themes as data — and the media of each celebration, uploaded straight to MinIO/S3 with presigned URLs.

## Run

```bash
yarn workspace @rsvp/template-media-service setup     # once: .venv + requirements.txt
yarn workspace @rsvp/template-media-service start     # SQLite, runserver on :8002
docker compose --profile apps up -d --build template-media-service template-media-relay template-media-consumer
```

The container runs migrations, publishes the five base templates (`manage.py seed_templates`) and serves with gunicorn. Two workers run beside it: `relay_outbox` (outbox → `template-media.events`) and `consume_events` (`celebration.*` → `celebration_access`).

## Tests

| Command | What |
|---|---|
| `yarn test` | Rules, API, consumer, relay and envelope contract (RLS and MinIO tests skip) |
| `yarn test:integration` | Postgres as `template_owner` (forced RLS really applies) and real MinIO uploads, three runs |

## How an upload works

1. `POST /uploads/presign` — checks access (404 stranger, 403 viewer), MIME and size (422), returns a presigned `PUT`.
2. The browser `PUT`s the bytes to MinIO. The service never sees them.
3. `POST /uploads/{id}/complete` — compares the stored object with what was declared, decodes it with Pillow, writes thumb/medium/full/webp (EXIF stripped) and emits `template.media.uploaded.v1` and `template.media-variants.generated.v1`.

API: [`template-media.openapi.json`](../../packages/contracts-openapi/specs/template-media.openapi.json). The envelope is identical to the Node services' (`outbox/envelope.py`), checked from both sides.
