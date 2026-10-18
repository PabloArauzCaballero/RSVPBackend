-- Lanes 10-14: Celebration aggregate, event types, settings, translations, audit and outbox.
-- Every date-time column is timestamptz (UTC); every table has Row Level Security enabled AND forced,
-- so even the owning role cannot read across tenants without the session scope.

CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app_organization_ids() RETURNS uuid[] LANGUAGE sql STABLE AS
$$ SELECT coalesce(string_to_array(nullif(current_setting('app.organization_ids', true), ''), ',')::uuid[], '{}'::uuid[]) $$;

CREATE FUNCTION app_is_admin() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.is_admin', true), '') = 'on' $$;

CREATE FUNCTION app_flag(flag text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.' || flag, true), '') = 'on' $$;

-- Reference data: one row per event type. Adding a type is an INSERT, never a deploy.
CREATE TABLE event_type_definition (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED')),
  default_locale text NOT NULL,
  host_roles text[] NOT NULL CHECK (cardinality(host_roles) > 0),
  enabled_sections text[] NOT NULL CHECK (cardinality(enabled_sections) > 0),
  required_fields_for_publish text[] NOT NULL,
  compatible_template_tags text[] NOT NULL CHECK (cardinality(compatible_template_tags) > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_type_translations (
  event_type_code text NOT NULL REFERENCES event_type_definition (code) ON DELETE CASCADE,
  locale text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NULL,
  host_role_labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (event_type_code, locale)
);

CREATE TABLE celebration (
  id uuid PRIMARY KEY,
  slug text NOT NULL,
  owner_id uuid NOT NULL,
  organization_id uuid NULL,
  event_type_code text NOT NULL REFERENCES event_type_definition (code),
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  version integer NOT NULL CHECK (version >= 1),
  default_locale text NOT NULL,
  supported_locales text[] NOT NULL,
  time_zone text NOT NULL,
  currency char(3) NOT NULL,
  content jsonb NOT NULL,
  settings jsonb NOT NULL,
  template_id uuid NULL,
  collaborators jsonb NOT NULL DEFAULT '[]'::jsonb,
  collaborator_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (default_locale = ANY (supported_locales))
);
-- Global uniqueness, not per organization (REQ-13-06).
CREATE UNIQUE INDEX celebration_slug_key ON celebration (slug);
CREATE INDEX celebration_owner_idx ON celebration (owner_id, created_at DESC);
CREATE INDEX celebration_organization_idx ON celebration (organization_id, created_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX celebration_collaborators_idx ON celebration USING gin (collaborator_user_ids);

CREATE TABLE celebration_translations (
  celebration_id uuid NOT NULL REFERENCES celebration (id) ON DELETE CASCADE,
  locale text NOT NULL,
  content jsonb NOT NULL,
  PRIMARY KEY (celebration_id, locale)
);

CREATE TABLE celebration_audit (
  id uuid PRIMARY KEY,
  celebration_id uuid NOT NULL REFERENCES celebration (id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid NULL,
  at timestamptz NOT NULL,
  event_id uuid NOT NULL,
  details jsonb NOT NULL
);
CREATE INDEX celebration_audit_idx ON celebration_audit (celebration_id, at);

-- Local copy of the Template/Media catalog, maintained from template.template.*.v1 events.
CREATE TABLE template_reference (
  template_id uuid PRIMARY KEY,
  tags text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Same table as packages/platform-outbox/sql/001_outbox_inbox.sql, plus a total order for replays.
CREATE TABLE outbox_event (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL,
  correlation_id text NOT NULL,
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_sequence bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX outbox_event_dispatch_idx ON outbox_event (status, available_at, created_at);
CREATE INDEX outbox_event_lease_idx ON outbox_event (status, lease_expires_at) WHERE status = 'PROCESSING';
CREATE UNIQUE INDEX outbox_event_sequence_idx ON outbox_event (event_sequence);

CREATE TABLE inbox_event (
  event_id uuid PRIMARY KEY,
  consumer text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security -----------------------------------------------------------------------
ALTER TABLE celebration ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration FORCE ROW LEVEL SECURITY;
CREATE POLICY celebration_tenant_policy ON celebration
  USING (app_is_admin() OR owner_id = app_user_id() OR organization_id = ANY (app_organization_ids()) OR app_user_id() = ANY (collaborator_user_ids))
  WITH CHECK (app_is_admin() OR owner_id = app_user_id() OR organization_id = ANY (app_organization_ids()) OR app_user_id() = ANY (collaborator_user_ids));

ALTER TABLE celebration_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_translations FORCE ROW LEVEL SECURITY;
CREATE POLICY celebration_translations_tenant_policy ON celebration_translations
  USING (EXISTS (SELECT 1 FROM celebration c WHERE c.id = celebration_id))
  WITH CHECK (EXISTS (SELECT 1 FROM celebration c WHERE c.id = celebration_id));

ALTER TABLE celebration_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY celebration_audit_tenant_policy ON celebration_audit
  USING (EXISTS (SELECT 1 FROM celebration c WHERE c.id = celebration_id))
  WITH CHECK (EXISTS (SELECT 1 FROM celebration c WHERE c.id = celebration_id));

ALTER TABLE event_type_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_type_definition FORCE ROW LEVEL SECURITY;
CREATE POLICY event_type_read ON event_type_definition FOR SELECT USING (true);
CREATE POLICY event_type_admin_insert ON event_type_definition FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY event_type_admin_update ON event_type_definition FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY event_type_admin_delete ON event_type_definition FOR DELETE USING (app_is_admin());

ALTER TABLE event_type_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_type_translations FORCE ROW LEVEL SECURITY;
CREATE POLICY event_type_translations_read ON event_type_translations FOR SELECT USING (true);
CREATE POLICY event_type_translations_admin_insert ON event_type_translations FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY event_type_translations_admin_update ON event_type_translations FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());
CREATE POLICY event_type_translations_admin_delete ON event_type_translations FOR DELETE USING (app_is_admin());

ALTER TABLE template_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_reference FORCE ROW LEVEL SECURITY;
CREATE POLICY template_reference_read ON template_reference FOR SELECT USING (true);
CREATE POLICY template_reference_admin_insert ON template_reference FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY template_reference_admin_update ON template_reference FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin());

-- Events are written inside the tenant's own transaction; only the relay reads them back.
ALTER TABLE outbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_event FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_insert_own_tenant ON outbox_event FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM celebration c WHERE c.id = tenant_id));
CREATE POLICY outbox_relay_read ON outbox_event FOR SELECT USING (app_flag('outbox_relay'));
CREATE POLICY outbox_relay_update ON outbox_event FOR UPDATE USING (app_flag('outbox_relay')) WITH CHECK (app_flag('outbox_relay'));

ALTER TABLE inbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_event FORCE ROW LEVEL SECURITY;
CREATE POLICY inbox_consumer_policy ON inbox_event USING (app_flag('consumer')) WITH CHECK (app_flag('consumer'));
