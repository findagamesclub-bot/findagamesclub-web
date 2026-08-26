#!/usr/bin/env node
/**
 * Catch `component={NextLink}` in a Server Component.
 *
 * MUI's `component` prop takes a function, and a Server Component cannot pass a
 * function to a client one — so this throws at request time, never at build
 * time. tsc and `next build` both stay green while the page is broken, which is
 * why it has been shipped four times on this project despite being written up
 * in CLAUDE.md. A grep is a better memory than a note.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];
const PATTERN = /component=\{(NextLink|Link)\}/;

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

  return source
    .split("\n")
    .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
    .filter(({ text }) =>
      PATTERN.test(text)
      // Prose about the trap is not the trap.
      && !text.startsWith("//") && !text.startsWith("*") && !text.startsWith("{/*"));
});

if (offenders.length) {
  console.error("\n`component={NextLink}` in a Server Component — wrap in a plain next/link instead:\n");
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  ${o.text}`);
  console.error("");
  process.exit(1);
}

console.log("server links ok");
