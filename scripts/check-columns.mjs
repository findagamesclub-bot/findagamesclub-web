#!/usr/bin/env node
/**
 * Every column named in a `.select("…")` really exists.
 *
 * 27 repositories reach the database through `table()`, which casts the client
 * through `as unknown as` because the generated types lagged the schema. That
 * cast buys a working repository and costs every check inside it: a column
 * renamed in a migration, or mistyped when the query was written, compiles
 * cleanly and fails at request time with "column does not exist".
 *
 * The generated types are the schema, so the select strings can be checked
 * against them without converting anything. This is the cheap half of that
 * job; converting the repositories is the thorough half.
 *
 * Embedded relations (`clubs!inner(slug, name)`) are read as their own table
 * when the name resolves, and skipped when it does not: a relationship can be
 * named after a foreign key rather than a table, and guessing would cry wolf.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TYPES = readFileSync("src/types/database.ts", "utf8");

/** Every table and view the generated types know, with their columns. */
function schema() {
  const tables = new Map();
  // Tables: { … } then Views: { … }. Each entry is `name: { Row: { … } }`.
  const entry = /^      (\w+): \{\n        Row: \{\n([\s\S]*?)\n        \}/gm;
  for (const [, name, body] of TYPES.matchAll(entry)) {
    const cols = new Set();
    for (const [, col] of body.matchAll(/^          (\w+)(\??):/gm)) cols.add(col);
    if (cols.size) tables.set(name, cols);
  }
  return tables;
}

const TABLES = schema();
if (TABLES.size < 40) {
  console.error(`Only parsed ${TABLES.size} tables from the generated types. `
    + "The shape of that file has changed and this check needs updating.");
  process.exit(2);
}

/** Split a PostgREST select list on commas that are not inside brackets. */
function fields(list) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) { out.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out.map((f) => f.trim()).filter(Boolean);
}

const problems = [];

function checkList(file, table, list, line) {
  const cols = TABLES.get(table);
  if (!cols) return;

  for (const field of fields(list)) {
    const nested = field.match(/^([\w!.:]+)\s*\(([\s\S]*)\)$/);
    if (nested) {
      // `clubs!inner(...)`, `club_images(...)`, `alias:table(...)`.
      const name = nested[1].split("!")[0].split(":").pop();
      if (TABLES.has(name)) checkList(file, name, nested[2], line);
      continue;
    }
    // `count`, `*` and `alias:column` all appear and are all legal. `count` is
    // PostgREST's own aggregate rather than a column, and every table has it.
    const col = field.split(":").pop().trim();
    if (!col || col === "*" || col === "count" || col.includes("(")) continue;
    // An interpolation that could not be resolved. Reporting it would be
    // reporting the parser rather than the code.
    if (col.includes("${")) continue;
    if (!cols.has(col)) problems.push({ file, line, table, col });
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(p) ? [p] : [];
  });
}

/**
 * Column lists are usually a shared constant, so a select reads
 * `select(`${COLUMNS}, clubs(name)`)`. Resolving them is the difference between
 * checking most of the queries and checking almost none: nine repositories put
 * every column behind one.
 */
function resolveConstants(source) {
  const values = new Map();

  // `const COLUMNS = "a, b" + "c, d";` as well as a single literal. A long
  // column list is nearly always wrapped across lines with `+`, so handling
  // only the single-literal form resolved almost none of them.
  for (const [, name, expr] of source.matchAll(
    /^const ([A-Z][A-Z0-9_]*)\s*=\s*((?:[`"'][^`"']*[`"']\s*\+?\s*)+);/gm)) {
    const joined = [...expr.matchAll(/[`"']([^`"']*)[`"']/g)].map((m) => m[1]).join("");
    values.set(name, joined);
  }

  // Twice, so a constant built from another constant resolves too.
  let out = source;
  for (let pass = 0; pass < 2; pass += 1) {
    out = out.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g,
      (whole, name) => values.get(name) ?? whole);
  }
  return out;
}

for (const file of walk("src/repositories")) {
  const source = resolveConstants(readFileSync(file, "utf8"));

  // Which table each query is against. `.from("x")` and `table<T>("x")` both
  // appear, and a file may hold several.
  const calls = [...source.matchAll(
    /(?:\.from\(|table<[^>]*>\(|table\()\s*["'`](\w+)["'`][\s\S]{0,400}?\.select\(\s*(["'`])([\s\S]*?)\2/g)];

  for (const [match, table, , list] of calls) {
    checkList(file, table, list, source.slice(0, source.indexOf(match)).split("\n").length);
  }
}

if (problems.length) {
  console.error("\nColumns named in a select that the schema does not have:\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ${p.table}.${p.col}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`column names ok (${TABLES.size} tables and views known)`);
