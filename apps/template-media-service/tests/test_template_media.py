"""Pure rules: themes as data, compatibility, render plans, upload policy, variants."""
from django.test import SimpleTestCase

from media_app.storage import MAX_BYTES, object_key_for, safe_filename, validate_upload, variant_keys
from media_app.variants import generate_variants
from rsvp_template_media.problems import ProblemError
from templates_app.domain import is_compatible, render_plan, validate_layout, validate_section_order, validate_tags, validate_theme

from .helpers import image_bytes

THEME = {"palette": {"canvas": "#FFFBF4", "surface": "#FFFFFF", "text": "#302C28", "accent": "#865E36", "muted": "#6F665D"},
         "typography": {"heading": "Georgia, serif", "body": "Arial, sans-serif"}, "sectionStyle": "bands"}


class ThemeAsDataTests(SimpleTestCase):
    def test_valid_theme_layout_tags_and_sections(self):
        self.assertEqual(validate_theme(THEME)["sectionStyle"], "bands")
        self.assertEqual(validate_layout("editorial"), "editorial")
        self.assertEqual(validate_tags(["wedding", "anniversary"]), ["anniversary", "wedding"])
        self.assertEqual(validate_section_order(["story", "gallery"]), ["story", "gallery"])

    def test_malformed_parts_are_422_with_the_field(self):
        cases = [
            (validate_theme, {**THEME, "palette": {**THEME["palette"], "accent": "red"}}, "theme.palette"),
            (validate_theme, {**THEME, "typography": {"heading": ""}}, "theme.typography"),
            (validate_theme, {**THEME, "sectionStyle": "zigzag"}, "theme.sectionStyle"),
            (validate_layout, "brutalist", "layout"),
            (validate_tags, ["Wedding"], "eventTypeTags"),
            (validate_tags, [], "eventTypeTags"),
            (validate_section_order, ["story", "story"], "sectionOrder"),
            (validate_section_order, ["unknown"], "sectionOrder"),
        ]
        for function, value, field in cases:
            with self.subTest(field=field, value=value), self.assertRaises(ProblemError) as raised:
                function(value)
            self.assertEqual(raised.exception.status_code, 422)
            self.assertEqual(raised.exception.extra["field"], field)


class CompatibilityAndRenderTests(SimpleTestCase):
    def test_a_wedding_template_is_not_offered_to_a_quinceanera(self):
        self.assertTrue(is_compatible(["wedding", "anniversary"], ["wedding"]))
        self.assertFalse(is_compatible(["wedding"], ["quinceanera"]))

    def test_REQ_16_05_switching_templates_and_back_never_loses_content(self):
        content = {"title": "Ana y Luis", "story": "Nos conocimos en La Paz", "faq": [{"q": "¿Niños?", "a": "Sí"}], "dressCode": "Formal"}
        enabled = ["story", "schedule", "dressCode", "faq"]
        classic = ["story", "schedule", "dressCode", "faq"]
        minimal = ["schedule", "story"]
        first = render_plan(classic, enabled, content)
        switched = render_plan(minimal, enabled, first.content)
        self.assertEqual(switched.hidden, ["dressCode", "faq"], "sections the template does not place are hidden, not dropped")
        back = render_plan(classic, enabled, switched.content)
        self.assertEqual(back, first)
        self.assertEqual(back.content, content)


class UploadPolicyTests(SimpleTestCase):
    def test_REQ_16_03_mime_and_size_are_checked_before_signing(self):
        validate_upload("image/jpeg", 1024)
        for content_type, size, code in [("application/pdf", 10, "UNSUPPORTED_MEDIA_TYPE"), ("image/png", MAX_BYTES + 1, "MEDIA_TOO_LARGE"), ("image/png", 0, "MEDIA_TOO_LARGE")]:
            with self.subTest(content_type=content_type, size=size), self.assertRaises(ProblemError) as raised:
                validate_upload(content_type, size)
            self.assertEqual((raised.exception.status_code, raised.exception.code), (422, code))

    def test_object_keys_are_safe_and_tenant_prefixed(self):
        self.assertEqual(safe_filename("Foto de Boda (1).JPG"), "foto-de-boda-1-.jpg")
        self.assertEqual(safe_filename("../../etc/passwd"), "etc-passwd")
        self.assertEqual(object_key_for("c1", "a1", "Niño.png"), "uploads/c1/a1/nino.png")
        self.assertEqual(set(variant_keys("uploads/c/a/x.jpg")), {"thumb", "medium", "full", "webp"})


class VariantTests(SimpleTestCase):
    def test_REQ_16_04_four_variants_with_bounded_sizes(self):
        variants, (width, height) = generate_variants(image_bytes("PNG", (2400, 1600)), "image/png")
        self.assertEqual(set(variants), {"thumb", "medium", "full", "webp"})
        self.assertEqual((width, height), (2400, 1600))
        self.assertEqual(max(variants["thumb"].width, variants["thumb"].height), 320)
        self.assertEqual(max(variants["medium"].width, variants["medium"].height), 960)
        self.assertEqual(max(variants["full"].width, variants["full"].height), 1920)
        self.assertTrue(all(variant.content_type == "image/webp" for variant in variants.values()))

    def test_exif_with_gps_is_stripped(self):
        from io import BytesIO

        from PIL import Image

        original = image_bytes("JPEG", (800, 600), with_gps=True)
        self.assertIn(0x8825, Image.open(BytesIO(original)).getexif())
        variants, _ = generate_variants(original, "image/jpeg")
        for variant in variants.values():
            self.assertNotIn(0x8825, Image.open(BytesIO(variant.body)).getexif())

    def test_lying_about_the_type_or_sending_garbage_is_422(self):
        with self.assertRaises(ProblemError) as mismatch:
            generate_variants(image_bytes("PNG", (10, 10)), "image/jpeg")
        self.assertEqual(mismatch.exception.code, "MEDIA_TYPE_MISMATCH")
        with self.assertRaises(ProblemError) as garbage:
            generate_variants(b"%PDF-1.7 not an image", "image/png")
        self.assertEqual(garbage.exception.code, "INVALID_IMAGE")
