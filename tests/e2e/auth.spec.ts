import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test("unauthenticated visitors are sent to login", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("an administrator can sign in and sign out", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("link", { name: "Playground" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 20_000 });
});
