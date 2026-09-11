#!/usr/bin/env node
/**
 * Catch a non-function export from a "use server" module.
 *
 * Next.js allows only async functions there, because every export becomes a
 * callable endpoint. A constant among them throws when the module is first
 * loaded, which means the page renders the error boundary and says nothing
 * useful — while `tsc` and `next build` both stay green.
 *
 * That is exactly how the loyalty settings page shipped broken: an array of
 * four milestone labels sitting beside the action that used them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

// Types are erased before the module is ever loaded, so they are not exports.
const ALLOWED = /^export\s+(async\s+function|type|interface)\b/;

const offenders = walk(ROOT).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  if (!/^\s*["']use server["']/.test(source)) return [];

  return source
    .split("\n")
    .map((line, index) => ({ line: line.trimEnd(), number: index + 1 }))
    .filter(({ line }) => /^export\s/.test(line) && !ALLOWED.test(line))
    .map(({ line, number }) => `${file}:${number}  ${line}`);
});

if (offenders.length) {
  console.error(
    "A \"use server\" module may only export async functions and types.\n"
    + "Move the value into a plain module both sides can import.\n",
  );
  offenders.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}

console.log("No stray exports from a \"use server\" module.");
