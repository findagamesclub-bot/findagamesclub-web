import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An internal link that reloads the whole app.
 *
 * `<Button href="/clubs/x">` renders a plain anchor, so pressing it throws the
 * running app away and downloads it again: a white flash, a spinner in the tab,
 * and every other navigation in the site behaves differently. It is green in
 * tsc, green in next build, green in check:links, and the only symptom is that
 * one button feels slower than the rest of the site.
 *
 * Found twice on the claim flow in one afternoon. Internal paths only, so an
 * external link or a file download is not flagged. A deliberate one opts out
 * with a `client-nav-ok` comment saying why.
 */

const ROOTS = ["src/app", "src/components"];
const OPT_OUT = "client-nav-ok";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const problems = [];

for (const path of ROOTS.flatMap(walk)) {
  const source = readFileSync(path, "utf8");
  if (source.includes(OPT_OUT)) continue;

  for (const match of source.matchAll(/<(Button|a)\b((?:[^>]|\n)*?)>/g)) {
    const [, tag, attrs] = match;

    // Only an internal path. "/clubs/x", `/clubs/${slug}`, not https:// or mailto.
    const href = attrs.match(/href=(?:"(\/[^"]*)"|\{`(\/[^`]*)`\}|\{"(\/[^"]*)"\})/);
    if (!href) continue;

    // Already routed through next/link, which is the whole point.
    if (/component=\{(NextLink|Link)\}/.test(attrs)) continue;

    const line = source.slice(0, match.index).split("\n").length;
    problems.push(
      `${path}:${line}  <${tag} href="${(href[1] ?? href[2] ?? href[3]).slice(0, 44)}">`);
  }
}

if (problems.length) {
  console.error("An internal link here reloads the whole app instead of routing:\n");
  for (const p of problems) console.error("  " + p);
  console.error(
    "\nUse LinkButton from a Server Component, or component={NextLink} from a"
    + `\nClient Component. If a full load is deliberate, say why in a ${OPT_OUT} comment.`);
  process.exit(1);
}

console.log("client navigation ok");
