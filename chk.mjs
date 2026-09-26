import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ storageState: ".mobile-session-admin.json" });
const p = await ctx.newPage();
for (const base of ["http://localhost:3000", "http://localhost:3100"]) {
  await p.goto(base + "/admin/claims?state=declined", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const cols = await p.evaluate(() => {
    const grid = [...document.querySelectorAll("main div")]
      .find(d => getComputedStyle(d).display === "grid"
                 && getComputedStyle(d).gridTemplateColumns.split(" ").length > 1);
    return grid ? getComputedStyle(grid).gridTemplateColumns : "(no multi-column grid)";
  });
  console.log(base, "->", cols);
}
await ctx.storageState({ path: ".mobile-session-admin.json" });
await b.close();
