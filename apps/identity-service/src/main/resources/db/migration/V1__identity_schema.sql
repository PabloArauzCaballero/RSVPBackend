CREATE TABLE identity_user (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE organization (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES identity_user(id)
);
CREATE TABLE organization_member (
  organization_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES identity_user(id),
  role TEXT NOT NULL CHECK (role IN ('HOST', 'PLANNER')),
  PRIMARY KEY (organization_id, user_id)
);

