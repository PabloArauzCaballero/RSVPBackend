"""Row Level Security for every table of template_db, enabled AND forced (the owning role is subject too).
Mirrors celebration-site-service: the session scope comes from transaction-local app.* settings."""
from django.db import migrations

FUNCTIONS = """
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_organization_ids() RETURNS uuid[] LANGUAGE sql STABLE AS
$$ SELECT coalesce(string_to_array(nullif(current_setting('app.organization_ids', true), ''), ',')::uuid[], '{}'::uuid[]) $$;
CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.is_admin', true), '') = 'on' $$;
CREATE OR REPLACE FUNCTION app_flag(flag text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.' || flag, true), '') = 'on' $$;
CREATE OR REPLACE FUNCTION app_has_role(role text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT role = ANY (string_to_array(coalesce(current_setting('app.roles', true), ''), ',')) $$;
CREATE OR REPLACE FUNCTION app_is_collaborator(collaborators jsonb, wanted_role text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(collaborators) c
     WHERE c->>'userId' = app_user_id()::text AND (wanted_role IS NULL OR c->>'role' = wanted_role)) $$;
"""

TABLES = ["template", "celebration_access", "media_asset", "outbox_event", "inbox_event", "django_migrations"]

POLICIES = """
CREATE POLICY template_read ON template FOR SELECT USING (status = 'PUBLISHED' OR app_is_admin());
CREATE POLICY template_admin_insert ON template FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY template_admin_update ON template FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());

CREATE POLICY access_read ON celebration_access FOR SELECT USING (
  app_flag('consumer') OR app_is_admin() OR owner_id = app_user_id() OR organization_id = ANY (app_organization_ids())
  OR app_is_collaborator(collaborators, NULL) OR (published AND NOT archived));
CREATE POLICY access_consumer_insert ON celebration_access FOR INSERT WITH CHECK (app_flag('consumer'));
CREATE POLICY access_consumer_update ON celebration_access FOR UPDATE USING (app_flag('consumer')) WITH CHECK (app_flag('consumer'));

CREATE POLICY media_read ON media_asset FOR SELECT USING (EXISTS (SELECT 1 FROM celebration_access a WHERE a.celebration_id = media_asset.celebration_id));
CREATE POLICY media_manage_insert ON media_asset FOR INSERT WITH CHECK (app_is_admin() OR EXISTS (SELECT 1 FROM celebration_access a WHERE a.celebration_id = media_asset.celebration_id
  AND (a.owner_id = app_user_id() OR app_is_collaborator(a.collaborators, 'CO_HOST') OR (a.organization_id = ANY (app_organization_ids()) AND app_has_role('PLANNER')))));
CREATE POLICY media_manage_update ON media_asset FOR UPDATE USING (app_is_admin() OR EXISTS (SELECT 1 FROM celebration_access a WHERE a.celebration_id = media_asset.celebration_id
  AND (a.owner_id = app_user_id() OR app_is_collaborator(a.collaborators, 'CO_HOST') OR (a.organization_id = ANY (app_organization_ids()) AND app_has_role('PLANNER')))));

CREATE POLICY outbox_insert ON outbox_event FOR INSERT WITH CHECK (true);
CREATE POLICY outbox_relay_read ON outbox_event FOR SELECT USING (app_flag('outbox_relay'));
CREATE POLICY outbox_relay_update ON outbox_event FOR UPDATE USING (app_flag('outbox_relay')) WITH CHECK (app_flag('outbox_relay'));

CREATE POLICY inbox_consumer ON inbox_event USING (app_flag('consumer')) WITH CHECK (app_flag('consumer'));
CREATE POLICY migrations_tooling ON django_migrations USING (true) WITH CHECK (true);
"""

DROP_POLICIES = [
    ("template", ["template_read", "template_admin_insert", "template_admin_update"]),
    ("celebration_access", ["access_read", "access_consumer_insert", "access_consumer_update"]),
    ("media_asset", ["media_read", "media_manage_insert", "media_manage_update"]),
    ("outbox_event", ["outbox_insert", "outbox_relay_read", "outbox_relay_update"]),
    ("inbox_event", ["inbox_consumer"]),
    ("django_migrations", ["migrations_tooling"]),
]


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(FUNCTIONS)
    for table in TABLES:
        schema_editor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        schema_editor.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    schema_editor.execute(POLICIES)


def backwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table, policies in DROP_POLICIES:
        for policy in policies:
            schema_editor.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")
        schema_editor.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        schema_editor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    schema_editor.execute("DROP FUNCTION IF EXISTS app_is_collaborator(jsonb, text); DROP FUNCTION IF EXISTS app_has_role(text); DROP FUNCTION IF EXISTS app_flag(text); DROP FUNCTION IF EXISTS app_is_admin(); DROP FUNCTION IF EXISTS app_organization_ids(); DROP FUNCTION IF EXISTS app_user_id();")


class Migration(migrations.Migration):
    dependencies = [("outbox", "0001_initial"), ("templates_app", "0001_initial"), ("media_app", "0001_initial")]
    operations = [migrations.RunPython(forwards, backwards)]
