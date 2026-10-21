-- Platform roles per user. Organization roles stay in organization_member.
-- Rollback: DROP TABLE identity_user_role; (no other object depends on it).
CREATE TABLE identity_user_role (
  user_id UUID NOT NULL REFERENCES identity_user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'HOST', 'PLANNER', 'PROVIDER')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX organization_member_user_id_idx ON organization_member(user_id);
