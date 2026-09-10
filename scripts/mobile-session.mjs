/**
 * Saves a signed-in session so the overflow check can reach the pages behind
 * the login.
 *
 * Opens a real browser, waits for you to sign in, then writes the cookies to
 * .mobile-session.json. Nothing is typed for you and no password is stored:
 * the file holds the same session cookie your browser already has, and it
 * expires the way any other session does.
 *
 * The admin console needs its own, because those routes redirect anybody who
 * is not an admin and a member's session would measure the page they land on
 * instead:
 *
 *   node scripts/mobile-session.mjs [--base http://localhost:3100] [--out FILE]
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3100").replace(/\/$/, "");
const OUT = arg("out", ".mobile-session.json");

// Signing in needs a browser you can see, and a visible browser is the full
// Chromium download. The overflow check only ever needed the headless shell,
// so that is all this repo has. Rather than 140MB for one sign-in, drive the
// Chrome already on the machine and fall back to Playwright's own.
const browser = await chromium
  .launch({ headless: false, channel: "chrome" })
  .catch(() => chromium.launch({ headless: false }))
  .catch((error) => {
    console.error("No browser to sign in with. Either install Google Chrome, or run:\n\n  npx playwright install chromium\n");
    throw error;
  });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${BASE}/auth/sign-in`);

console.log("Sign in in the browser window, then come back here and press Enter.");
await new Promise((resolve) => process.stdin.once("data", resolve));

await context.storageState({ path: OUT });
await browser.close();
console.log(`Saved ${OUT}. Now run the check that reads it.`);
