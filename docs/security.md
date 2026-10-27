# Security

## Tenant isolation

The browser may select an organisation in the demo console, but the gateway resolves the tenant from the bearer API key. Repository methods that read requests or ledger lines take a `tenantId`. Cache reads and writes refuse a key whose tenant segment does not match.

Demo keys are published fixtures (`vk_demo_...`). They are not production secrets. Provider keys and `CACHE_HMAC_SECRET` are read only on the server and are never exposed through `NEXT_PUBLIC_` variables.

## Privacy pipeline

Detection, validation and tokenisation happen before a provider adapter is invoked. Placeholders are deterministic for one request (`<NHS_1>`, `<EMAIL_1>`). The map used to restore the response lives only for that call. It is not written to the audit log, the ledger, or the cache key.

If the privacy service is marked unavailable, or if detection throws, the gateway returns `PII_SERVICE_UNAVAILABLE` and does not call a provider. A recorded fail-open preference does not change that. Unscreened prompts are never forwarded.

## Logging

`AuditService` accepts a typed metadata event. There is no field for the raw prompt, an NHS number, an email address, or the restoration map. Unit tests assert that a sample request containing all of those does not appear in the structured log.

## Cache

See `docs/cache-design.md`. Raw sensitive values are HMAC inputs, not key material.

## Fail closed

Budget exhaustion and the daily request limit also stop the call before a provider is contacted. A provider failure is returned as `PROVIDER_UNAVAILABLE` after screening; the raw prompt is not copied into the error or the log.
