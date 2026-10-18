"""Image variants (REQ-16-04): thumb, medium, full and webp, all WebP-encoded. Re-encoding also
drops EXIF, so GPS coordinates in guests' photos never reach the public site."""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from rsvp_template_media.problems import unprocessable

SIZES = {"thumb": 320, "medium": 960, "full": 1920}
WEBP = "image/webp"
QUALITY = 82
MAX_PIXELS = 60_000_000
FORMAT_BY_MIME = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


@dataclass(frozen=True)
class Variant:
    body: bytes
    content_type: str
    width: int
    height: int


def _encode(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=QUALITY, method=4)
    return buffer.getvalue()


def generate_variants(body: bytes, declared_type: str) -> tuple[dict[str, Variant], tuple[int, int]]:
    """Decodes the upload, checks it really is the declared format, and builds the four variants."""
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(io.BytesIO(body)) as probe:
            actual = probe.format
            probe.verify()
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(body)))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise unprocessable("INVALID_IMAGE", "The file is not a readable image", field="file") from error
    if FORMAT_BY_MIME.get(declared_type) != actual:
        raise unprocessable("MEDIA_TYPE_MISMATCH", f"Declared {declared_type} but the file is {actual}", field="contentType")
    rgb = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
    variants: dict[str, Variant] = {}
    for name, longest in SIZES.items():
        copy = rgb.copy()
        copy.thumbnail((longest, longest))
        variants[name] = Variant(_encode(copy), WEBP, copy.width, copy.height)
    variants["webp"] = Variant(_encode(rgb), WEBP, rgb.width, rgb.height)
    return variants, (rgb.width, rgb.height)
