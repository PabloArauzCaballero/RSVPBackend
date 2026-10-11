-- Apply in the same PostgreSQL database as the bounded context's aggregate tables.
-- The service adapter must insert the aggregate and outbox row in one transaction.
CREATE TABLE IF NOT EXISTS outbox_event (
  id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS outbox_event_dispatch_idx ON outbox_event (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS outbox_event_lease_idx ON outbox_event (status, lease_expires_at) WHERE status = 'PROCESSING';

CREATE TABLE IF NOT EXISTS inbox_event (
  event_id UUID PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
