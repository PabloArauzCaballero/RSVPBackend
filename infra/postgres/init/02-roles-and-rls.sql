-- Tenant-scoped tables must enable RLS in each service migration.
-- The owner roles are intentionally isolated: no cross-database privileges are granted.
REVOKE CONNECT ON DATABASE identity_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE celebration_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE guest_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE notification_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE gift_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE provider_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE template_db FROM PUBLIC;

