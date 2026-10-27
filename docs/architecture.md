# Architecture

Vale is a multi-tenant AI cost gateway. A client application never calls a model provider directly. The gateway authenticates the API key, resolves the tenant, checks budget, screens the prompt, consults the cache, and only then routes a masked prompt.

```text
Client application
  -> API key authentication
  -> Tenant resolver
  -> Budget / policy engine
  -> PII detection and tokenisation
  -> Cache engine
  -> Provider port (LiteLLM, OpenAI, Anthropic, Google, or demo)
  -> Response restoration
  -> Savings ledger
  -> Client response

Side stores: PostgreSQL, Redis, structured logs, metadata-only audit
```

## Boundaries

HTTP handlers in `src/app/api` validate input and call services. They do not price requests, build cache keys, or mask text.

`GatewayService` is the only orchestrator of a completion. It depends on interfaces:

- `PiiDetector` / `PrivacyService`
- `CacheStore` / `CacheService`
- `AIProvider` / `ProviderService`
- `TenantRepository`, `RequestRepository`, `LedgerRepository`, `AuditRepository`

The demo process uses in-memory repositories and an in-memory cache that implement those interfaces. `src/server/repositories/schema.sql` is the PostgreSQL shape those repositories would persist. Prompt text and placeholder maps are not columns.

## Demo mode

`DEMO_MODE` defaults to true. Provider calls return a deterministic masked completion so the product can be demonstrated without API keys. Setting `DEMO_MODE=false` switches `ProviderService` to the HTTP adapters, or to LiteLLM when `LITELLM_BASE_URL` is set.

## Request identity

Every completion gets a request id. Audit events and logs include that id, the tenant, the provider, latency, cache status and entity counts. They do not include the prompt.
