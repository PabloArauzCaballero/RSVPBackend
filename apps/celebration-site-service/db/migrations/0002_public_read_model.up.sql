-- Lane 15: denormalised public page, written only by the projector, read by anyone.
CREATE TABLE read_public_celebration (
  slug text PRIMARY KEY,
  celebration_id uuid NOT NULL UNIQUE,
  projection_version integer NOT NULL,
  last_event_id uuid NOT NULL,
  updated_at timestamptz NOT NULL,
  document jsonb NOT NULL
);

CREATE TABLE read_public_celebration_processed (
  event_id uuid PRIMARY KEY
);

ALTER TABLE read_public_celebration ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_public_celebration FORCE ROW LEVEL SECURITY;
CREATE POLICY read_public_celebration_read ON read_public_celebration FOR SELECT USING (true);
CREATE POLICY read_public_celebration_projector_insert ON read_public_celebration FOR INSERT WITH CHECK (app_flag('projector'));
CREATE POLICY read_public_celebration_projector_update ON read_public_celebration FOR UPDATE USING (app_flag('projector')) WITH CHECK (app_flag('projector'));
CREATE POLICY read_public_celebration_projector_delete ON read_public_celebration FOR DELETE USING (app_flag('projector'));

ALTER TABLE read_public_celebration_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_public_celebration_processed FORCE ROW LEVEL SECURITY;
CREATE POLICY read_public_celebration_processed_projector ON read_public_celebration_processed
  USING (app_flag('projector')) WITH CHECK (app_flag('projector'));
