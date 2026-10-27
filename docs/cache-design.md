# Cache design

Exact cache keys are built in one place: `buildCacheKey`.

```text
cache:v1:{tenantId}:{provider}:{model}:{maskedPromptHash}:{privacyContextHmac}:{settingsHash}
```

- `maskedPromptHash` is SHA-256 of the normalised masked prompt.
- `privacyContextHmac` is HMAC-SHA256 over the tenant id and the sensitive values, using `CACHE_HMAC_SECRET`.
- `settingsHash` covers temperature, max tokens and batch eligibility.
- Serialisation is canonical, so key order cannot fork the cache.

Two patients in the same organisation can produce the same masked string (`Summarise the record for <NHS_1>`). Their HMAC segments differ, so they cannot share a completion. Two organisations cannot share an entry even when the masked text and the sensitive value match, because the tenant id is both a key segment and part of the HMAC payload.

The cache stores the masked provider response, not the restored text. Restoration uses the placeholder map from the current request.

A cache outage does not skip privacy. The gateway continues with the masked prompt and does not claim a saving. A cache hit does not contact the provider; the saving is attributed to exact cache.

Semantic cache is a stored organisation preference and a historical ledger reason. The live demo matcher is exact-only, so a near-duplicate cannot accidentally cross a privacy context. The provider port is the extension point for a future tenant-scoped matcher.

Provider-native prompt-cache discounts are a separate input to `attributeGatewaySaving` and are subtracted from gateway-attributed savings. Seeded ledger lines record that discount as zero.
