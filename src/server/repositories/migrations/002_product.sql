ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix text NOT NULL DEFAULT 'vk_demo';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

DELETE FROM savings_ledger WHERE id LIKE 'led_%';
DELETE FROM gateway_requests WHERE id LIKE 'req_seed_%';

UPDATE tenants AS tenant
SET
  spend_micros = COALESCE((
    SELECT SUM(actual_micros) FROM savings_ledger WHERE tenant_id = tenant.id
  ), 0),
  requests_today = COALESCE((
    SELECT COUNT(*) FROM gateway_requests
    WHERE tenant_id = tenant.id AND created_at >= date_trunc('day', now())
  ), 0),
  month_requests = COALESCE((
    SELECT COUNT(*) FROM gateway_requests
    WHERE tenant_id = tenant.id AND created_at >= date_trunc('month', now())
  ), 0),
  month_cache_hits = COALESCE((
    SELECT COUNT(*) FROM gateway_requests
    WHERE tenant_id = tenant.id
      AND cache_status = 'hit'
      AND created_at >= date_trunc('month', now())
  ), 0);

UPDATE operating_metrics
SET
  pii_entities_protected = COALESCE((SELECT SUM(pii_entity_count) FROM gateway_requests), 0),
  estimated_savings_micros = COALESCE((SELECT SUM(gateway_saving_micros) FROM savings_ledger), 0),
  overhead_total_ms = COALESCE((SELECT SUM(gateway_overhead_ms) FROM gateway_requests), 0),
  overhead_samples = COALESCE((SELECT COUNT(*) FROM gateway_requests), 0),
  cache_hits_today = COALESCE((
    SELECT COUNT(*) FROM gateway_requests
    WHERE cache_status = 'hit' AND created_at >= date_trunc('day', now())
  ), 0)
WHERE id = 1;
