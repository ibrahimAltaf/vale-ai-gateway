import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@vale.local");
  await page.getByLabel("Password").fill("vale-admin-change-me");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}
