-- Lanes 23-24. Reversal: DROP TABLE processed_notification_event, delivery_attempt, device_token.
CREATE TABLE IF NOT EXISTS device_token (token text PRIMARY KEY, user_id text NOT NULL, platform text NOT NULL CHECK (platform IN ('ios','android')), disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS device_token_active_idx ON device_token (user_id, disabled_at);
CREATE TABLE IF NOT EXISTS delivery_attempt (id text PRIMARY KEY, token text NOT NULL, attempt integer NOT NULL, status text NOT NULL, error_code text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS processed_notification_event (id text PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now());
