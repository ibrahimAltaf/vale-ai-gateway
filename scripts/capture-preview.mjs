import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "client-preview");
mkdirSync(outDir, { recursive: true });

const pages = [
  ["01-login.png", "/login"],
  ["02-overview.png", "/"],
  ["03-playground.png", "/playground"],
  ["04-requests.png", "/requests"],
  ["05-privacy.png", "/privacy"],
  ["06-cache.png", "/cache"],
  ["07-organisations.png", "/organisations"],
  ["08-savings.png", "/savings"],
  ["09-health.png", "/health"],
  ["10-architecture.png", "/architecture"],
  ["11-settings.png", "/settings"],
  ["12-engineering.png", "/engineering"],
  ["13-create-app.png", "/organisations/new"],
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("vale-theme", "light");
});

await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
await page.addStyleTag({ content: "nextjs-portal,[data-next-mark-loading]{display:none!important}" });
await page.screenshot({ path: join(outDir, "01-login.png"), fullPage: true });
await page.getByLabel("Email").fill("admin@vale.local");
await page.getByLabel("Password").fill("vale-admin-change-me");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });

for (const [file, path] of pages) {
  if (path === "/login") continue;
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal,[data-next-mark-loading]{display:none!important}" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, file), fullPage: true });
  console.log("saved", file);
}

await browser.close();
console.log("done", outDir);
