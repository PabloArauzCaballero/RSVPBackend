"""Session scope for Postgres Row Level Security, transaction-local like the Node services."""
from __future__ import annotations

from django.db import connection

from .auth import Actor

SYSTEM_USER = "00000000-0000-0000-0000-000000000000"
FLAGS = ("consumer", "outbox_relay")


def apply_scope(actor: Actor | None = None, *flags: str) -> None:
    """Must run inside a transaction (ATOMIC_REQUESTS or transaction.atomic). No-op on SQLite.
    Every flag is written on every call, so a scope never inherits a flag set earlier in the same transaction."""
    if connection.vendor != "postgresql":
        return
    unknown = set(flags) - set(FLAGS)
    if unknown:
        raise ValueError(f"Unknown scope flags {sorted(unknown)}")
    settings = {
        "app.user_id": actor.user_id if actor else SYSTEM_USER,
        "app.organization_ids": ",".join(actor.organization_ids) if actor else "",
        "app.roles": ",".join(actor.roles) if actor else "",
        "app.is_admin": "on" if actor and actor.is_admin else "off",
        **{f"app.{flag}": "on" if flag in flags else "off" for flag in FLAGS},
    }
    with connection.cursor() as cursor:
        for key, value in settings.items():
            cursor.execute("SELECT set_config(%s, %s, true)", [key, value])
