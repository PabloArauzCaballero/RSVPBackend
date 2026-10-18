"""HTTP behaviour of the Template/Media service, end to end through DRF with real RS256 tokens."""
import uuid

from django.test import TestCase, override_settings

from media_app.models import CelebrationAccess, MediaAsset
from media_app.storage import MAX_BYTES, get_storage
from outbox.consumers import handle
from outbox.models import OutboxEvent
from outbox.relay import relay_batch
from rsvp_template_media.auth import jwks_cache
from rsvp_template_media.scope import apply_scope
from templates_app.management.commands.seed_templates import seed

from .helpers import JWKS, auth, celebration_event, image_bytes, token
from .test_template_media import THEME

JSON = "application/json"


@override_settings(JWKS_STATIC=JWKS, MEDIA_STORAGE_BACKEND="memory")
class ApiTestCase(TestCase):
    def setUp(self):
        jwks_cache.clear()
        get_storage.cache_clear()
        self.storage = get_storage()
        self.owner = str(uuid.uuid4())
        self.celebration = str(uuid.uuid4())
        handle(celebration_event("celebration.celebration.created.v1", self.celebration, self.owner))

    def post(self, path, body=None, **headers):
        return self.client.post(path, body or {}, content_type=JSON, **headers)

    def events(self, event_type):
        # Only the relay scope may read the outbox (RLS); tests read it the same way.
        apply_scope(None, "outbox_relay")
        return [event.payload for event in OutboxEvent.objects.filter(event_name=event_type).order_by("created_at")]


class HealthAndAuthTests(ApiTestCase):
    def test_health_and_ready_are_public(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
        self.assertEqual(self.client.get("/ready").json(), {"status": "ready"})

    def test_401_for_missing_hs256_expired_and_garbage_tokens(self):
        presign = {"celebrationId": self.celebration, "filename": "a.png", "contentType": "image/png", "sizeBytes": 10}
        self.assertEqual(self.post("/uploads/presign", presign).status_code, 401)
        for bad in (token(alg="HS256"), token(expires_in=-10), "a.b.c"):
            response = self.post("/uploads/presign", presign, HTTP_AUTHORIZATION=f"Bearer {bad}")
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response["WWW-Authenticate"], "Bearer")
            self.assertEqual(response["Content-Type"], "application/problem+json")

    def test_correlation_id_is_echoed_or_generated(self):
        given = "0b6f8c1e-2a1d-4c5e-9f00-1234567890ab"
        self.assertEqual(self.client.get("/health", HTTP_X_CORRELATION_ID=given)["X-Correlation-Id"], given)
        self.assertEqual(len(self.client.get("/health", HTTP_X_CORRELATION_ID="nope")["X-Correlation-Id"]), 36)


class TemplateApiTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        seed()
        self.admin = auth(roles=["ADMIN"])

    def test_REQ_16_01_only_published_and_compatible_templates_are_offered(self):
        quince = self.client.get("/templates?eventTypeTags=quinceanera").json()["items"]
        self.assertEqual(sorted(item["name"] for item in quince), ["Editorial", "Festivo", "Minimalista"])
        self.assertNotIn("Clásico marfil", [item["name"] for item in quince])
        draft = self.post("/templates", {"name": "Borrador", "eventTypeTags": ["quinceanera"], "layout": "festive", "theme": THEME, "sectionOrder": ["story"]}, **self.admin)
        self.assertEqual(draft.status_code, 201)
        self.assertNotIn("Borrador", [item["name"] for item in self.client.get("/templates?eventTypeTags=quinceanera").json()["items"]])
        self.assertEqual(self.client.get(f"/templates/{draft.json()['id']}").status_code, 404, "a draft is invisible to the public")
        self.assertEqual(self.client.get(f"/templates/{draft.json()['id']}", **self.admin).status_code, 200)
        self.assertEqual(len(self.client.get("/templates").json()["items"]), 5)

    def test_five_base_layouts_are_seeded_once(self):
        layouts = sorted(item["layout"] for item in self.client.get("/templates").json()["items"])
        self.assertEqual(layouts, ["classic", "corporate", "editorial", "festive", "minimal"])
        self.assertEqual(seed(), [], "seeding is idempotent")
        self.assertEqual(len(self.events("template.template.published.v1")), 5)

    def test_admin_only_validation_and_lifecycle_with_events(self):
        body = {"name": "Nuevo", "eventTypeTags": ["wedding"], "layout": "classic", "theme": THEME, "sectionOrder": ["story", "gallery"]}
        self.assertEqual(self.post("/templates", body, **auth()).status_code, 403)
        self.assertEqual(self.post("/templates", {**body, "colour": "red"}, **self.admin).status_code, 400)
        self.assertEqual(self.post("/templates", {**body, "layout": "brutalist"}, **self.admin).status_code, 422)
        created = self.post("/templates", body, **self.admin).json()
        self.assertEqual(self.post(f"/templates/{created['id']}/publish", **self.admin).status_code, 428)
        self.assertEqual(self.post(f"/templates/{created['id']}/publish", HTTP_IF_MATCH='"9"', **self.admin).status_code, 409)
        published = self.post(f"/templates/{created['id']}/publish", HTTP_IF_MATCH='"1"', **self.admin)
        self.assertEqual(published.json()["status"], "PUBLISHED")
        event = self.events("template.template.published.v1")[-1]
        self.assertEqual(event["payload"], {"templateId": created["id"], "name": "Nuevo", "eventTypeTags": ["wedding"], "layout": "classic", "status": "PUBLISHED", "version": 2})
        edited = self.client.patch(f"/templates/{created['id']}", {"name": "Nuevo 2"}, content_type=JSON, HTTP_IF_MATCH='"2"', **self.admin)
        self.assertEqual(edited.json()["version"], 3)
        archived = self.post(f"/templates/{created['id']}/archive", HTTP_IF_MATCH='"3"', **self.admin)
        self.assertEqual(archived.json()["status"], "ARCHIVED")
        self.assertEqual(self.events("template.template.archived.v1")[-1]["payload"]["status"], "ARCHIVED")
        self.assertEqual(self.post(f"/templates/{created['id']}/publish", HTTP_IF_MATCH='"4"', **self.admin).status_code, 409, "archived is terminal")
        self.assertEqual(self.client.patch(f"/templates/{created['id']}", {"name": "x"}, content_type=JSON, HTTP_IF_MATCH='"4"', **self.admin).status_code, 409)
        self.assertEqual(len(self.client.get("/admin/templates", **self.admin).json()["items"]), 6)

    def test_REQ_16_05_render_plan_switching_back_restores_the_same_site(self):
        by_name = {item["name"]: item["id"] for item in self.client.get("/templates").json()["items"]}
        content = {"title": "Ana y Luis", "story": "Historia", "dressCode": "Formal", "faq": [{"q": "¿Hora?", "a": "19:00"}]}
        enabled = ["story", "schedule", "venues", "gallery", "dressCode", "faq", "recommendations", "gifts", "rsvp"]
        plan = lambda name, body: self.post(f"/templates/{by_name[name]}/render-plan", {"enabledSections": enabled, "content": body}).json()
        classic = plan("Clásico marfil", content)
        minimal = plan("Minimalista", classic["content"])
        self.assertIn("dressCode", minimal["hidden"])
        back = plan("Clásico marfil", minimal["content"])
        self.assertEqual(back, classic)
        self.assertEqual(back["content"], content)


class MediaApiTests(ApiTestCase):
    def presign(self, actor_headers=None, **overrides):
        body = {"celebrationId": self.celebration, "filename": "Portada Boda.PNG", "contentType": "image/png", "sizeBytes": len(self.png), **overrides}
        return self.post("/uploads/presign", body, **(actor_headers or auth(self.owner)))

    def setUp(self):
        super().setUp()
        self.png = image_bytes("PNG", (2400, 1600))

    def upload(self):
        intent = self.presign().json()
        self.storage.upload(intent["objectKey"], self.png, "image/png")
        return intent, self.post(f"/uploads/{intent['assetId']}/complete", **auth(self.owner))

    def test_REQ_10_06_strangers_get_404_viewers_get_403(self):
        viewer = str(uuid.uuid4())
        handle(celebration_event("celebration.celebration.configured.v1", self.celebration, self.owner, version=2, collaborators=[{"userId": viewer, "role": "VIEWER"}]))
        self.assertEqual(self.presign(auth()).status_code, 404)
        self.assertEqual(self.presign(auth(viewer)).status_code, 403)
        self.assertEqual(self.client.get(f"/celebrations/{self.celebration}/assets", **auth(viewer)).status_code, 200)
        self.assertEqual(self.client.get(f"/celebrations/{self.celebration}/assets", **auth()).status_code, 404)
        self.assertEqual(self.presign(auth(), celebrationId=str(uuid.uuid4())).status_code, 404)

    def test_planner_of_the_organization_manages_media(self):
        organization = str(uuid.uuid4())
        celebration = str(uuid.uuid4())
        handle(celebration_event("celebration.celebration.created.v1", celebration, str(uuid.uuid4()), organization_id=organization))
        self.assertEqual(self.presign(auth(roles=["PLANNER"], organization_ids=[organization]), celebrationId=celebration).status_code, 201)
        self.assertEqual(self.presign(auth(organization_ids=[organization]), celebrationId=celebration).status_code, 403)

    def test_REQ_16_02_presign_returns_a_direct_put_url_and_never_receives_bytes(self):
        response = self.presign()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["method"], "PUT")
        self.assertIn("X-Amz-Signature", body["uploadUrl"])
        self.assertTrue(body["objectKey"].startswith(f"uploads/{self.celebration}/"))
        self.assertEqual(body["requiredHeaders"], {"Content-Type": "image/png"})
        self.assertEqual(MediaAsset.objects.get(id=body["assetId"]).status, "PENDING_UPLOAD")
        self.assertEqual(self.storage.objects, {}, "the service stored nothing itself")

    def test_REQ_16_03_bad_mime_or_size_is_rejected_before_signing(self):
        self.assertEqual(self.presign(contentType="application/pdf").json()["code"], "UNSUPPORTED_MEDIA_TYPE")
        too_big = self.presign(sizeBytes=MAX_BYTES + 1)
        self.assertEqual((too_big.status_code, too_big.json()["code"]), (422, "MEDIA_TOO_LARGE"))
        self.assertEqual(self.presign(sizeBytes="many").status_code, 400)
        self.assertFalse(MediaAsset.objects.exists())

    def test_REQ_16_04_completion_builds_four_variants_and_emits_events(self):
        intent, response = self.upload()
        self.assertEqual(response.status_code, 200)
        asset = response.json()
        self.assertEqual(asset["status"], "PROCESSED")
        self.assertEqual(set(asset["variants"]), {"thumb", "medium", "full", "webp"})
        self.assertTrue(asset["isCover"], "the first photo becomes the cover")
        stored = MediaAsset.objects.get(id=intent["assetId"])
        self.assertTrue(all(key in self.storage.objects for key in stored.variants.values()))
        uploaded = self.events("template.media.uploaded.v1")[-1]
        self.assertEqual(uploaded["tenant"]["celebrationId"], self.celebration)
        self.assertEqual(uploaded["payload"]["sizeBytes"], len(self.png))
        self.assertEqual(set(self.events("template.media-variants.generated.v1")[-1]["payload"]["variants"]), {"thumb", "medium", "full", "webp"})
        self.assertEqual(self.post(f"/uploads/{intent['assetId']}/complete", **auth(self.owner)).status_code, 409)

    def test_completion_without_or_with_a_different_file_is_refused(self):
        intent = self.presign().json()
        self.assertEqual(self.post(f"/uploads/{intent['assetId']}/complete", **auth(self.owner)).json()["code"], "UPLOAD_NOT_FOUND")
        self.storage.upload(intent["objectKey"], self.png + b"extra", "image/png")
        mismatch = self.post(f"/uploads/{intent['assetId']}/complete", **auth(self.owner))
        self.assertEqual((mismatch.status_code, mismatch.json()["code"]), (422, "UPLOAD_MISMATCH"))
        self.assertNotIn(intent["objectKey"], self.storage.objects)
        lying = self.presign(contentType="image/jpeg").json()
        self.storage.upload(lying["objectKey"], self.png, "image/jpeg")
        self.assertEqual(self.post(f"/uploads/{lying['assetId']}/complete", **auth(self.owner)).json()["code"], "MEDIA_TYPE_MISMATCH")

    def test_reorder_choose_cover_and_delete(self):
        first, _ = self.upload()
        second, _ = self.upload()
        listed = self.client.get(f"/celebrations/{self.celebration}/assets", **auth(self.owner)).json()["items"]
        self.assertEqual([item["id"] for item in listed], [first["assetId"], second["assetId"]])
        reordered = self.client.put(f"/celebrations/{self.celebration}/assets/order", {"assetIds": [second["assetId"], first["assetId"]], "coverAssetId": second["assetId"]}, content_type=JSON, **auth(self.owner)).json()["items"]
        self.assertEqual([(item["id"], item["isCover"]) for item in reordered], [(second["assetId"], True), (first["assetId"], False)])
        self.assertEqual(self.client.put(f"/celebrations/{self.celebration}/assets/order", {"assetIds": [first["assetId"]]}, content_type=JSON, **auth(self.owner)).status_code, 422)
        keys = MediaAsset.objects.get(id=second["assetId"]).variants.values()
        self.assertEqual(self.client.delete(f"/assets/{second['assetId']}", **auth(self.owner)).status_code, 204)
        self.assertTrue(all(key not in self.storage.objects for key in keys))
        self.assertEqual(self.events("template.media.deleted.v1")[-1]["payload"]["assetId"], second["assetId"])
        self.assertEqual(self.client.delete(f"/assets/{second['assetId']}", **auth(self.owner)).status_code, 404)

    def test_public_gallery_only_for_published_celebrations(self):
        self.upload()
        self.assertEqual(self.client.get(f"/public/celebrations/{self.celebration}/assets").status_code, 404)
        handle(celebration_event("celebration.celebration.published.v1", self.celebration, self.owner, version=2, status="PUBLISHED"))
        public = self.client.get(f"/public/celebrations/{self.celebration}/assets")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(len(public.json()["items"]), 1)
        thumb = public.json()["items"][0]["variants"]["thumb"]
        self.assertTrue(thumb.startswith("http://localhost:8000/media/public/assets/"), "stable URL, no signature in the page")
        redirect = self.client.get(thumb.removeprefix("http://localhost:8000/media"))
        self.assertEqual(redirect.status_code, 302)
        self.assertIn("X-Amz-Signature", redirect["Location"])
        self.assertEqual(self.client.get(thumb.removeprefix("http://localhost:8000/media").replace("/thumb", "/huge")).status_code, 404)
        handle(celebration_event("celebration.celebration.unpublished.v1", self.celebration, self.owner, version=3))
        self.assertEqual(self.client.get(f"/public/celebrations/{self.celebration}/assets").status_code, 404)
        self.assertEqual(self.client.get(thumb.removeprefix("http://localhost:8000/media")).status_code, 404, "unpublished photos stop resolving")


class ConsumerAndRelayTests(ApiTestCase):
    def test_consumer_is_idempotent_and_ignores_older_versions(self):
        event = celebration_event("celebration.celebration.configured.v1", self.celebration, self.owner, version=5, collaborators=[{"userId": "x", "role": "CO_HOST"}])
        self.assertTrue(handle(event))
        self.assertFalse(handle(event), "same eventId is a no-op")
        handle(celebration_event("celebration.celebration.configured.v1", self.celebration, self.owner, version=4))
        self.assertEqual(CelebrationAccess.objects.get(celebration_id=self.celebration).collaborators, [{"userId": "x", "role": "CO_HOST"}])
        self.assertFalse(handle({**event, "eventId": str(uuid.uuid4()), "eventType": "celebration.settings.updated.v1"}))
        archived = celebration_event("celebration.celebration.archived.v1", self.celebration, self.owner, version=6)
        handle(archived)
        self.assertTrue(CelebrationAccess.objects.get(celebration_id=self.celebration).archived)

    def test_relay_publishes_with_confirms_and_backs_off_on_failure(self):
        seed()
        sent = []

        class Broken:
            def publish(self, envelope):
                raise ConnectionError("broker down")

        class Healthy:
            def publish(self, envelope):
                sent.append(envelope["eventId"])

        self.assertEqual(relay_batch(Broken()), {"published": 0, "failed": 5})
        self.assertTrue(all(event.status == "PENDING" and event.attempts == 1 for event in OutboxEvent.objects.all()))
        self.assertEqual(relay_batch(Healthy()), {"published": 0, "failed": 0}, "backoff holds retries back")
        OutboxEvent.objects.update(available_at="2000-01-01T00:00:00Z")
        self.assertEqual(relay_batch(Healthy()), {"published": 5, "failed": 0})
        self.assertEqual(len(sent), 5)
        self.assertTrue(all(event.status == "PUBLISHED" for event in OutboxEvent.objects.all()))
