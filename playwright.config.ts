import { defineConfig, devices } from "@playwright/test";

const isolated = {
  DEMO_MODE: "true",
  ADMIN_EMAIL: "admin@vale.local",
  ADMIN_PASSWORD: "vale-admin-change-me",
  SESSION_SECRET: "demo-only-session-secret-32chars",
  CACHE_HMAC_SECRET: "demo-only-cache-hmac-secret",
  DATABASE_URL: "",
  DATABASE_URL_UNPOOLED: "",
  REDIS_URL: "",
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GOOGLE_API_KEY: "",
  LITELLM_BASE_URL: "",
  LITELLM_API_KEY: "",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
  },
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      ...isolated,
    },
  },
});
