import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("playground masks and restores a synthetic NHS number", async ({ page }) => {
  await page.goto("/playground");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Restored response")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("John Smith").last()).toBeVisible();
  await expect(page.getByText("<NHS_1>").first()).toBeVisible();
});

test("a repeated playground request is an exact cache hit", async ({ page }) => {
  await page.goto("/playground");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Restored response")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("hit").last()).toBeVisible({ timeout: 20_000 });
});

test("the request is listed and the dashboard reads the ledger", async ({ page }) => {
  await page.goto("/playground");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Restored response")).toBeVisible({ timeout: 20_000 });
  await page.goto("/requests");
  await expect(page.getByText("gpt-4o-mini").first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Verified savings", { exact: true })).toBeVisible();
});

test("privacy failure does not contact a provider", async ({ page }) => {
  await page.goto("/health");
  await expect(page.getByRole("button", { name: "Simulate privacy service failure" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Simulate privacy service failure" }).click();
  await page.getByRole("button", { name: "Send a probe request" }).click();
  await expect(page.getByText("Provider contacted")).toBeVisible();
  await expect(page.getByText("NO").first()).toBeVisible();
});
