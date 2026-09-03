/**
 * Finds anything wider than the phone it is being read on.
 *
 * `overflow-x: clip` on the body stops the page being dragged sideways, which
 * means an element that overruns the viewport is not a scrollbar, it is text
 * with its right-hand side cut off. That is invisible in a desktop browser and
 * obvious on a phone, which is how it reached the client.
 *
 * Geometry survives the clip, so the offenders can still be measured; they
 * just cannot be seen. This walks every element and reports the ones whose box
 * ends past the right edge, keeping only the outermost of a nested run so one
 * wide table does not report forty cells.
 *
 *   npm run check:mobile              public routes
 *   npm run mobile:login             save a session, once
 *   npm run check:mobile:auth        everything behind the login
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = arg("base", "http://localhost:3100").replace(/\/$/, "");
const STORAGE = arg("storage", "");
const ROUTE_FILE = arg("routes", "./overflow-routes.txt");

// 360 is the narrowest phone still in real use; 390 is the iPhone the client
// is testing on. A layout that survives both survives everything between.
const WIDTHS = [360, 390];

const ROUTES = (readFileSync(ROUTE_FILE.startsWith(".") && !ROUTE_FILE.startsWith("./scripts")
  ? new URL(ROUTE_FILE, import.meta.url) : ROUTE_FILE, "utf8"))
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const MEASURE = () => {
  const limit = document.documentElement.clientWidth;
  const bad = [];

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` — "${text}"` : ""}`;
  };

  for (const el of document.querySelectorAll("body *")) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    const over = Math.round(box.right - limit);
    // A pixel or two is subpixel rounding, not a layout fault.
    if (over <= 2) continue;

    // Contained by an ancestor on purpose is not an overflow, it is a design:
    // a bar that scrolls sideways, or a map whose tiles are meant to run past
    // the frame and be clipped by it. The walk stops at body, whose own
    // overflow rule is the thing that was hiding all of this.
    let contained = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const x = getComputedStyle(p).overflowX;
      if (x !== "visible") { contained = true; break; }
    }
    if (contained) continue;

    bad.push({ over, path: describe(el), depth: (() => {
      let d = 0; for (let p = el.parentElement; p; p = p.parentElement) d += 1; return d;
    })() });
  }

  // Keep the outermost of each nested run: the parent is what needs fixing.
  bad.sort((a, b) => a.depth - b.depth || b.over - a.over);
  return bad.slice(0, 12);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  ...(STORAGE && existsSync(STORAGE) ? { storageState: STORAGE } : {}),
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

let failures = 0;
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" })
      .catch((error) => ({ status: () => `ERR ${error.message.slice(0, 60)}` }));
    const status = response?.status?.() ?? "?";
    if (status !== 200) { console.log(`  ${route} @${width} -> ${status}`); continue; }

    const bad = await page.evaluate(MEASURE);
    if (!bad.length) continue;
    failures += 1;
    console.log(`\nOVERFLOW  ${route}  @${width}px`);
    for (const b of bad) console.log(`   +${String(b.over).padStart(4)}px  ${b.path}`);
  }
}

await browser.close();
console.log(failures ? `\n${failures} page/width combinations overflow.` : "\nNo overflow at 360 or 390.");
process.exit(failures ? 1 : 0);
