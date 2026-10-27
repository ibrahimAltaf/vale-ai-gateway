-- PostgreSQL shape the in-memory repositories mirror.
-- Prompt text, placeholder maps and raw PII are intentionally absent.

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  sector text NOT NULL,
  privacy_mode text NOT NULL,
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  spend_micros bigint NOT NULL DEFAULT 0,
  requests_today integer NOT NULL DEFAULT 0,
  month_requests integer NOT NULL DEFAULT 0,
  month_cache_hits integer NOT NULL DEFAULT 0,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id),
  key_hash text NOT NULL UNIQUE,
  label text NOT NULL,
  key_prefix text NOT NULL DEFAULT 'vk_demo',
  created_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gateway_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id),
  created_at timestamptz NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  cache_status text NOT NULL,
  pii_entity_count integer NOT NULL,
  pii_types text[] NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  baseline_micros bigint NOT NULL,
  actual_micros bigint NOT NULL,
  gateway_saving_micros bigint NOT NULL,
  saving_reason text NOT NULL,
  gateway_overhead_ms integer NOT NULL,
  provider_latency_ms integer NOT NULL,
  total_ms integer NOT NULL,
  blocked boolean NOT NULL,
  block_code text,
  trace jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS gateway_requests_tenant_created_idx
  ON gateway_requests (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS savings_ledger (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id),
  request_id text NOT NULL,
  created_at timestamptz NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  pricing_version text NOT NULL,
  baseline_micros bigint NOT NULL,
  actual_micros bigint NOT NULL,
  gateway_saving_micros bigint NOT NULL,
  provider_native_discount_micros bigint NOT NULL,
  saving_reason text NOT NULL
);

CREATE INDEX IF NOT EXISTS savings_ledger_tenant_created_idx
  ON savings_ledger (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants (id),
  request_id text NOT NULL,
  created_at timestamptz NOT NULL,
  event text NOT NULL,
  provider text,
  model text,
  latency_ms integer,
  cache_status text,
  pii_entity_count integer,
  saving_reason text
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operating_metrics (
  id integer PRIMARY KEY,
  pii_entities_protected integer NOT NULL,
  estimated_savings_micros bigint NOT NULL,
  overhead_total_ms bigint NOT NULL,
  overhead_samples integer NOT NULL,
  cache_hits_today integer NOT NULL
);
