-- Adding an event type is inserting rows, not a development task (lane 11).
--
-- The versioned source of truth is db/seeds/event-types/*.json, applied idempotently by
--   CELEBRATION_DATABASE_URL=... yarn workspace @rsvp/celebration-site-service seed
-- or from the admin UI / API (PUT /celebrations/admin/event-types/{CODE}, ADMIN role).
--
-- The equivalent SQL, for an operator with an admin session, is shown here for BAUTIZO.
-- Row Level Security only lets the admin scope write reference data.

BEGIN;
SELECT set_config('app.is_admin', 'on', true);

INSERT INTO event_type_definition (code, status, default_locale, host_roles, enabled_sections, required_fields_for_publish, compatible_template_tags, updated_at)
VALUES ('BAUTIZO', 'ACTIVE', 'es-BO', ARRAY['PARENT', 'GODPARENT'], ARRAY['story', 'schedule', 'venues', 'gallery', 'faq', 'rsvp'],
        ARRAY['title', 'eventDate', 'venueName', 'childName', 'hosts.PARENT'], ARRAY['baptism'], now())
ON CONFLICT (code) DO UPDATE SET status = EXCLUDED.status, default_locale = EXCLUDED.default_locale, host_roles = EXCLUDED.host_roles,
  enabled_sections = EXCLUDED.enabled_sections, required_fields_for_publish = EXCLUDED.required_fields_for_publish,
  compatible_template_tags = EXCLUDED.compatible_template_tags, updated_at = now();

DELETE FROM event_type_translations WHERE event_type_code = 'BAUTIZO';
INSERT INTO event_type_translations (event_type_code, locale, name, description, host_role_labels) VALUES
  ('BAUTIZO', 'es-BO', 'Bautizo', 'Ceremonia de bautizo y celebración familiar.', '{"PARENT": "Madre o padre", "GODPARENT": "Padrino o madrina"}'),
  ('BAUTIZO', 'en-US', 'Baptism', 'Baptism ceremony and family celebration.', '{"PARENT": "Parent", "GODPARENT": "Godparent"}');

COMMIT;
