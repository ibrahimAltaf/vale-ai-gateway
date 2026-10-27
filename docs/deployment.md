# Deployment

Vale runs as a Next.js app on Vercel. Neon Postgres is the system of record. Redis holds exact-cache entries. Provider credentials stay in server environment variables.

## Vercel

1. Import the `vale-gateway` project.
2. Set the environment variables below for Production. Do not prefix them with `NEXT_PUBLIC_`. Required: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (never the local default), `SESSION_SECRET` (never the demo default), `CACHE_HMAC_SECRET`.
3. Deploy. `npm run build` is the production build. The app does not write to the local filesystem at runtime.
4. Open `/api/v1/health` after deploy. Postgres and Redis should report healthy once the variables are present.

There is no localhost URL in the request path. Provider and database hosts come from environment variables.

## Neon

Use the pooled `DATABASE_URL` for the running app. Keep `DATABASE_URL_UNPOOLED` for schema changes if you want a direct connection. The app applies `src/server/repositories/schema.sql` and SQL files in `src/server/repositories/migrations` on first use. Applied files are recorded in `schema_migrations`.

Do not commit `.env.local`.

## Redis

Set `REDIS_URL` to a Redis-compatible URL reachable from Vercel, such as Redis Cloud or Upstash (`rediss://` when TLS is required). If the variable is missing, the process uses an in-memory cache and health reports that fallback. A Redis outage does not skip PII protection; the cache status becomes unavailable and a masked provider call can still proceed.

## Provider keys

Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and/or `GOOGLE_API_KEY`. Set `LITELLM_BASE_URL` when LiteLLM should front those models. Leave `DEMO_MODE` unset or `false` in production. Set `CACHE_HMAC_SECRET` to a long random string; it is required when demo mode is off.

## Seed

Demo organisations are created only when `tenants` is empty. Create further organisations in the console. Copy the API key when it is shown. It is not displayed again.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
