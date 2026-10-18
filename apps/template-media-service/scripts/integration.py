"""Runs the whole suite against the real docker compose stack (Postgres as template_owner, MinIO),
RUNS times in a row. The test database is created owned by template_owner, so Row Level Security
really applies (a superuser would bypass it), and dropped at the end."""
import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

import psycopg

ROOT = Path(__file__).resolve().parents[1]
ADMIN_URL = os.environ.get("TEMPLATE_IT_ADMIN_URL", "postgresql://postgres:local-postgres-password@localhost:5432/postgres")
OWNER_PASSWORD = os.environ.get("TEMPLATE_OWNER_PASSWORD", "local-template-password")
RUNS = int(os.environ.get("RUNS", "3"))


def main() -> int:
    database = f"template_it_{uuid.uuid4().hex[:12]}"
    host = urlparse(ADMIN_URL).netloc.split("@")[-1]
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(f"CREATE DATABASE {database} OWNER template_owner")
    env = {
        **os.environ,
        "TEMPLATE_DATABASE_URL": f"postgresql://template_owner:{OWNER_PASSWORD}@{host}/{database}",
        "TEMPLATE_TEST_DATABASE_NAME": database,
        "MEDIA_STORAGE_BACKEND": "memory",
        "MEDIA_IT": os.environ.get("MEDIA_IT", "1"),
        "MINIO_ENDPOINT": os.environ.get("MINIO_ENDPOINT", "http://localhost:9000"),
        "LOG_LEVEL": "ERROR",
    }
    try:
        for run in range(1, RUNS + 1):
            print(f"--- integration run {run}/{RUNS}", flush=True)
            result = subprocess.run([sys.executable, "manage.py", "test", "tests", "--keepdb", "--noinput"], cwd=ROOT, env=env)
            if result.returncode:
                return result.returncode
        return 0
    finally:
        with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
            admin.execute(f"DROP DATABASE IF EXISTS {database} WITH (FORCE)")


if __name__ == "__main__":
    sys.exit(main())
