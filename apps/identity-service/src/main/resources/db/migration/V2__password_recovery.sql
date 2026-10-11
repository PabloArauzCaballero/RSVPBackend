CREATE TABLE password_recovery_token (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES identity_user(id),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_recovery_token_user_id_idx ON password_recovery_token(user_id);
