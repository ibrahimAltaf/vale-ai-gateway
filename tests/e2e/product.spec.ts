import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("overview, organisations, savings and health load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Every AI request")).toBeVisible();
  await page.goto("/organisations");
  await expect(page.getByRole("heading", { name: "Apps, keys and budgets." })).toBeVisible();
  await page.goto("/savings");
  await expect(page.getByText("Verified gateway savings.")).toBeVisible();
  await page.goto("/health");
  await expect(page.getByText("If privacy is down, the request stops.")).toBeVisible();
  await expect(page.getByText("not configured").first()).toBeVisible();
});

test("create app flow produces a key and an organisation page", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/organisations/new");
  await page.getByLabel("App name").fill(`Review App ${stamp}`);
  await page.getByLabel("Slug").fill(`review-app-${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Choose AI providers")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Generate API key" }).click();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByText("GET /api/v1/models")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send test request" }).click();
  await expect(page.getByText(/tokens|not configured|blocked|unavailable/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Open app overview" }).click();
  await expect(page.getByRole("heading", { name: `Review App ${stamp}` })).toBeVisible();
});
