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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
