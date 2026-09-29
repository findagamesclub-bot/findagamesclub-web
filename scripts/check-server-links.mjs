#!/usr/bin/env node
/**
 * Catch a function being handed to a client component from a Server Component.
 *
 * React refuses it at request time and nothing before that notices: tsc,
 * `next build` and this script's own first version all stay green while the
 * page 500s with "Functions cannot be passed directly to Client Components".
 * A grep is a better memory than a note in CLAUDE.md, which is where both of
 * these were already written down when they shipped.
 *
 * Two shapes, both paid for:
 *
 *   component={NextLink}   MUI's `component` prop takes the component itself.
 *                          Shipped four times.
 *   sx={(theme) => ({…})}  The callback form of `sx`, which reads the theme.
 *                          Shipped once, in LongText, and took a 500 on a
 *                          preview page to find.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOTS = ["src/app", "src/components"];

const TRAPS = [
  {
    pattern: /component=\{(NextLink|Link)\}/,
    say: "`component={NextLink}` in a Server Component — wrap in a plain next/link instead",
  },
  {
    // sx={(theme) => …} and sx={t => …}. The object form is fine, so the arrow
    // is what this is looking for.
    pattern: /\bsx=\{\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
    say: "callback `sx` in a Server Component — use a plain object, or copy the value out of the theme",
  },
];

/**
 * Which imported components are client components.
 *
 * Needed because a function prop is only a trap when it crosses the boundary.
 * `<RankedBars suffix={(v) => ...}>` is a server component handing another
 * server component a function, which is ordinary code; the same line pointed
 * at a client component throws at request time. Without resolving the target
 * this check would have to choose between missing the bug and crying wolf on
 * the legal case.
 */
function clientComponentsIn(file, source) {
  const names = new Set();
  const imports = source.matchAll(
    /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g);

  for (const [, fallback, named, from] of imports) {
    const base = from.startsWith("@/")
      ? join("src", from.slice(2))
      : from.startsWith(".") ? join(dirname(file), from) : null;
    if (!base) continue;

    const target = [".tsx", ".ts", "/index.tsx", "/index.ts"]
      .map((ext) => base + ext)
      .find((candidate) => existsSync(candidate));
    if (!target) continue;
    if (!/^\s*["']use client["']/.test(readFileSync(target, "utf8"))) continue;

    if (fallback) names.add(fallback);
    for (const one of (named ?? "").split(",")) {
      const clean = one.split(" as ").pop().trim();
      if (/^[A-Z]/.test(clean)) names.add(clean);
    }
  }
  return names;
}

/**
 * Every opening tag for one of those components, as a span of text.
 *
 * Scanned rather than matched with a regex because `=>` contains a `>`, so
 * "up to the first angle bracket" ends in the middle of the very thing being
 * looked for. Brace depth is what says which `>` closes the tag.
 */
function openingTags(source, names) {
  const spans = [];
  for (const name of names) {
    const opener = new RegExp(`<${name}[\\s/>]`, "g");
    let hit;
    while ((hit = opener.exec(source))) {
      let depth = 0;
      let i = hit.index + name.length;
      for (; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        else if (ch === ">" && depth === 0) break;
      }
      spans.push({ name, at: hit.index, text: source.slice(hit.index, i) });
    }
  }
  return spans;
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx$/.test(path) ? [path] : [];
  });
}

/**
 * A component with no directive of its own that is only ever rendered from a
 * client component is fine — it is already in the client bundle. Those opt out
 * by saying so, so the exemption is a decision on the record rather than a
 * silent hole in the check.
 */
const OPT_OUT = /server-links-ok/;

const offenders = ROOTS.flatMap(walk).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  // The directive has to be the first thing in the file to count.
  if (/^\s*["']use client["']/.test(source)) return [];
  if (OPT_OUT.test(source)) return [];

  return source.split("\n").flatMap((raw, i) => {
    const text = raw.trim();
    // Prose about the trap is not the trap.
    if (text.startsWith("//") || text.startsWith("*") || text.startsWith("{/*")) return [];

    const trap = TRAPS.find(({ pattern }) => pattern.test(text));
    return trap ? [{ file, line: i + 1, text, say: trap.say }] : [];
  });
});

/**
 * A function handed to a client component.
 *
 * React refuses to serialize one across the boundary, so the page 500s at
 * request time while tsc, `next build` and every other check here stay green.
 * It has cost a round trip twice: `sx={(theme) => …}` above, and a
 * `hrefFor={(list) => …}` on the army list board.
 */
const FUNCTION_PROP =
  /\b(?!sx=)([A-Za-z_$][\w$]*)=\{\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;

for (const file of ROOTS.flatMap(walk)) {
  const source = readFileSync(file, "utf8");
  if (/^\s*["']use client["']/.test(source)) continue;
  if (OPT_OUT.test(source)) continue;

  const names = clientComponentsIn(file, source);
  if (!names.size) continue;

  for (const span of openingTags(source, names)) {
    const hit = span.text.match(FUNCTION_PROP);
    if (!hit) continue;
    offenders.push({
      file,
      line: source.slice(0, span.at).split("\n").length,
      text: `<${span.name} ${hit[1]}={(…) => …}`,
      say: "a function passed to a Client Component — pass a string or an array instead",
    });
  }
}

if (offenders.length) {
  for (const say of new Set(offenders.map((o) => o.say))) {
    console.error(`\n${say}:\n`);
    for (const o of offenders.filter((x) => x.say === say)) {
      console.error(`  ${o.file}:${o.line}  ${o.text}`);
    }
  }
  console.error("");
  process.exit(1);
}

console.log("server links ok");
