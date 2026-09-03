/**
 * Saves a signed-in session so the overflow check can reach the pages behind
 * the login.
 *
 * Opens a real browser, waits for you to sign in, then writes the cookies to
 * .mobile-session.json. Nothing is typed for you and no password is stored:
 * the file holds the same session cookie your browser already has, and it
 * expires the way any other session does.
 *
 *   node scripts/mobile-session.mjs [--base http://localhost:3100]
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const i = process.argv.indexOf("--base");
const BASE = (i > -1 ? process.argv[i + 1] : "http://localhost:3100").replace(/\/$/, "");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${BASE}/auth/sign-in`);

console.log("Sign in in the browser window, then come back here and press Enter.");
await new Promise((resolve) => process.stdin.once("data", resolve));

await context.storageState({ path: ".mobile-session.json" });
await browser.close();
console.log("Saved .mobile-session.json — now run: npm run check:mobile:auth");
