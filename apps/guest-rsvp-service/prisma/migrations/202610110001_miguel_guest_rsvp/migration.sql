-- Lanes 17-22.  Reversal: drop tables in reverse dependency order.
CREATE TABLE IF NOT EXISTS guest (id text PRIMARY KEY, celebration_id text NOT NULL, email text NOT NULL, name text NOT NULL, locale text, allowed_companions integer NOT NULL CHECK (allowed_companions >= 0), group_id text, consent_given_at timestamptz NOT NULL, erased_at timestamptz);
CREATE TABLE IF NOT EXISTS guest_access_token (hash text PRIMARY KEY, guest_id text NOT NULL, celebration_id text NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rsvp (guest_id text PRIMARY KEY, status text NOT NULL, dietary_notes text, message text, requested_companions integer NOT NULL DEFAULT 0, approved_companions integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS read_guest_list (guest_id text PRIMARY KEY, celebration_id text NOT NULL, status text NOT NULL, group_id text, name text NOT NULL, approved_companions integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS read_guest_list_filter_idx ON read_guest_list (celebration_id, status, group_id);
CREATE TABLE IF NOT EXISTS processed_projection_event (id text PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
