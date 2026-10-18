"""Template/Media service settings. Everything that varies per environment comes from env vars."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
env = os.environ.get

SECRET_KEY = env("DJANGO_SECRET_KEY", "local-only-template-media-secret")
DEBUG = env("DJANGO_DEBUG", "false") == "true"
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "rest_framework",
    "outbox",
    "templates_app",
    "media_app",
]

MIDDLEWARE = [
    "rsvp_template_media.middleware.CorrelationIdMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "rsvp_template_media.urls"
WSGI_APPLICATION = "rsvp_template_media.wsgi.application"


def _database() -> dict:
    url = env("TEMPLATE_DATABASE_URL")
    if not url:
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": env("TEMPLATE_SQLITE_PATH", str(BASE_DIR / "local.sqlite3")), "ATOMIC_REQUESTS": True}
    parsed = urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username,
        "PASSWORD": parsed.password,
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "ATOMIC_REQUESTS": True,
        "CONN_MAX_AGE": 60,
        "TEST": {"NAME": env("TEMPLATE_TEST_DATABASE_NAME", f"test_{parsed.path.lstrip('/')}")},
    }


DATABASES = {"default": _database()}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rsvp_template_media.auth.JwksAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "rsvp_template_media.problems.exception_handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
}

# Identity publishes its RS256 keys here; tests inject a static key set instead.
IDENTITY_JWKS_URL = env("IDENTITY_JWKS_URL", "http://identity-service:8080/.well-known/jwks.json")
# A static key set for local stacks without Identity (same variable as celebration-site-service).
JWKS_STATIC = json.loads(env("IDENTITY_JWKS_JSON")) if env("IDENTITY_JWKS_JSON") else None

# Object storage (MinIO in local, S3-compatible elsewhere). Uploads go straight from the
# browser to the public endpoint with a presigned URL; the service never proxies bytes.
MEDIA_STORAGE = {
    "endpoint": env("MINIO_ENDPOINT", "http://minio:9000"),
    "public_endpoint": env("MINIO_PUBLIC_ENDPOINT", env("MINIO_ENDPOINT", "http://localhost:9000")),
    "access_key": env("MINIO_ACCESS_KEY", env("MINIO_ROOT_USER", "local-minio")),
    "secret_key": env("MINIO_SECRET_KEY", env("MINIO_ROOT_PASSWORD", "local-minio-password")),
    "bucket": env("MEDIA_BUCKET", "rsvp-media"),
    "region": env("MEDIA_REGION", "us-east-1"),
    "presign_seconds": int(env("MEDIA_PRESIGN_SECONDS", "3600")),
}
MEDIA_STORAGE_BACKEND = env("MEDIA_STORAGE_BACKEND", "s3")
# Public base of this service through the gateway; stable photo URLs for cached pages and Open Graph cards.
PUBLIC_MEDIA_BASE_URL = env("PUBLIC_MEDIA_BASE_URL", "http://localhost:8000/media")

RABBITMQ_URL = env("RABBITMQ_URL")
EVENTS_EXCHANGE = "template-media.events"
CELEBRATION_EXCHANGE = "celebration.events"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "rsvp_template_media.logging.JsonFormatter"}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["stdout"], "level": env("LOG_LEVEL", "INFO")},
    # One structured line per request comes from CorrelationIdMiddleware; Django's own 4xx warnings would duplicate it.
    "loggers": {"django.request": {"level": "ERROR"}},
}
