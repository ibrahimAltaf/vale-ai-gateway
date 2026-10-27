import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "client-preview");
mkdirSync(outDir, { recursive: true });

const shots = [
  ["01-login.png", "/login", 0],
  ["02-overview.png", "/", 0],
  ["02-overview-lower.png", "/", 780],
  ["03-playground.png", "/playground", 0],
  ["04-requests.png", "/requests", 0],
  ["05-privacy.png", "/privacy", 0],
  ["06-cache.png", "/cache", 0],
  ["07-organisations.png", "/organisations", 0],
  ["13-create-app.png", "/organisations/new", 0],
  ["08-savings.png", "/savings", 0],
  ["09-health.png", "/health", 0],
  ["10-architecture.png", "/architecture", 0],
  ["11-settings.png", "/settings", 0],
  ["12-engineering.png", "/engineering", 0],
];

const hideChrome = `
  nextjs-portal, [data-next-mark-loading] { display: none !important; }
  html, body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("vale-theme", "light");
});

await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: hideChrome });
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, "01-login.png"), fullPage: false, animations: "disabled" });

await page.getByLabel("Email").fill("admin@vale.local");
await page.getByLabel("Password").fill("vale-admin-change-me");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });

for (const [file, path, scroll] of shots) {
  if (path === "/login") continue;
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: hideChrome });
  if (scroll) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, file), fullPage: false, animations: "disabled" });
  console.log("saved", file);
}

await browser.close();
console.log("done", outDir);
