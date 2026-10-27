CREATE INDEX IF NOT EXISTS gateway_requests_tenant_provider_idx
  ON gateway_requests (tenant_id, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS gateway_requests_tenant_cache_idx
  ON gateway_requests (tenant_id, cache_status, created_at DESC);
CREATE INDEX IF NOT EXISTS gateway_requests_created_idx
  ON gateway_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS savings_ledger_tenant_provider_idx
  ON savings_ledger (tenant_id, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_tenant_idx
  ON api_keys (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx
  ON api_keys (key_hash);
