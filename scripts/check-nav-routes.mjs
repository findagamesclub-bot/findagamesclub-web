/**
 * Every path a nav rail points at must be a real route.
 *
 * `console-nav.ts` and `admin-nav.ts` build their hrefs as template strings, so
 * nothing types them: Next's typed routes only reach a `<Link href>` literal,
 * and a nav entry is a string in a data file. The Badges entry shipped as
 * `at("/badges")` when the page is at `/manage/badges`, and tsc, next build,
 * check:links, check:actions and check:nav were all green while the only way
 * into the page 404'd.
 *
 * This resolves each path against `src/app`, treating any `[param]` segment as
 * a wildcard and ignoring route groups like `(console)`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NAV_FILES = [
  "src/components/console/console-nav.ts",
  "src/components/admin/admin-nav.ts",
  "src/components/account/account-nav.ts",
];

/** Every route `src/app` actually serves, as segment arrays. */
function routes(dir, trail = []) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (/^(page|route)\.tsx?$/.test(name)) found.push(trail);
      continue;
    }
    if (name.startsWith("_") || name === "api") continue;
    // A route group is a folder, not a segment.
    const next = /^\(.*\)$/.test(name) ? trail : [...trail, name];
    found.push(...routes(full, next));
  }
  return found;
}

const known = routes("src/app");

function served(path) {
  const want = path.split("/").filter(Boolean);
  return known.some((route) =>
    route.length === want.length
    && route.every((seg, i) =>
      seg === want[i] || seg.startsWith("[")));
}

let bad = 0;
for (const file of NAV_FILES) {
  let source;
  try { source = readFileSync(file, "utf8"); } catch { continue; }

  // Only `href`. `owns` is a prefix used to decide which entry lights up, so
  // it is deliberately a path that serves nothing of its own.
  const paths = [
    ...[...source.matchAll(/href:\s*at\(\s*"([^"]+)"/g)].map((m) => `/clubs/x${m[1]}`),
    ...[...source.matchAll(/href:\s*"(\/[^"]+)"/g)].map((m) => m[1]),
  ];

  for (const path of [...new Set(paths)]) {
    if (served(path)) continue;
    bad += 1;
    console.log(`  ${file}\n    ${path} is not a route`);
  }
}

console.log(bad
  ? `\n${bad} nav ${bad === 1 ? "link points" : "links point"} at a route that does not exist.`
  : "nav routes ok");
process.exit(bad ? 1 : 0);
