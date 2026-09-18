#!/usr/bin/env node
/**
 * Catch a `useActionState` dispatch called outside a transition.
 *
 * React 19 warns "An async function with useActionState was called outside of a
 * transition", and the warning understates it: the pending flag never flips. So
 * a confirm dialog handed that flag as `busy` shows no spinner and never closes
 * itself, and a button with `loading={pending}` sits there looking dead while
 * the work happens.
 *
 * It is invisible to everything else. tsc is green, `next build` is green,
 * `check:links` is green, and the only symptom is a console warning nobody sees
 * until they click the button. Found three times in one afternoon: twice in
 * ListingList and once each in ResultDialog and SubmitStep.
 *
 * Fine, and deliberately not flagged:
 *
 *   action={dispatch}                 the form calls it, React wraps it
 *   action={(data) => { … f(data) }}  same, one level in
 *   startTransition(() => f(data))    wrapped by hand
 *   start(() => f(data))              the useTransition pattern this repo uses
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * The names this file gave its dispatches.
 *
 * Only the second slot of the destructuring, so `submit` is a dispatch and
 * `state` and `pending` are not.
 */
function dispatchNames(source) {
  return [...source.matchAll(
    /const\s*\[\s*[\w$]*\s*,\s*([\w$]+)[^\]]*\]\s*=\s*\n?\s*useActionState/g)]
    .map((match) => match[1]);
}

/**
 * Whether this call sits inside a form action.
 *
 * `action={(data) => { … dispatch(data) }}` is the second shape above: React
 * runs the whole callback in its own transition, so the dispatch inside it is
 * already covered. Looking back up the file for an unclosed `action={` is
 * cruder than parsing and enough for the one shape that occurs.
 */
function insideFormAction(lines, at) {
  for (let i = at; i >= 0 && at - i < 20; i--) {
    if (/(^|\s)(action|formAction)=\{\s*(async\s*)?\(/.test(lines[i])) return true;
    // A line that closes the JSX prop list means we have walked out of it.
    if (i < at && /^\s*(>|\/>)/.test(lines[i])) return false;
  }
  return false;
}

const offenders = ROOTS.flatMap(walk).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  if (!source.includes("useActionState")) return [];

  const names = dispatchNames(source);
  if (names.length === 0) return [];

  const lines = source.split("\n");
  return lines.flatMap((raw, i) => {
    const text = raw.trim();
    if (text.startsWith("//") || text.startsWith("*")) return [];

    return names.flatMap((name) => {
      if (!new RegExp(`(^|[^.\\w$])${name}\\s*\\(`).test(raw)) return [];
      // Passed rather than called, or already wrapped.
      if (new RegExp(`(action|formAction)=\\{\\s*${name}\\b`).test(raw)) return [];
      if (/startTransition\s*\(|start\w*\(\s*\(\s*\)\s*=>/.test(raw)) return [];
      if (insideFormAction(lines, i)) return [];
      return [{ file, line: i + 1, text, name }];
    });
  });
});

if (offenders.length) {
  console.error(
    "\n`useActionState` dispatch called outside a transition — the pending flag "
    + "never flips, so spinners never show and confirm dialogs never close.\n"
    + "Wrap it: `const [, start] = useTransition()` then `start(() => dispatch(data))`.\n");
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  ${o.text}`);
  console.error("");
  process.exit(1);
}

console.log("action dispatches ok");
