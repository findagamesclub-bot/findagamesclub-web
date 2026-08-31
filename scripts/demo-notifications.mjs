// Fires notifications one at a time so the bell can be watched counting up.
//
//   node scripts/demo-notifications.mjs                 5 of them, 4s apart
//   node scripts/demo-notifications.mjs --as "sara khan"   somebody else
//   node scripts/demo-notifications.mjs --count 3       three
//   node scripts/demo-notifications.mjs --gap 2         faster
//   node scripts/demo-notifications.mjs --reset         mark everything read first
//   node scripts/demo-notifications.mjs --clean         remove the demo rows
//
// Writes with the service role, which is the point: it stands in for whatever
// would really have inserted the row, so the realtime path is exercised for
// real rather than simulated in the browser.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../.env.local"), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const REST = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEAD = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

// Profiles carry no email — it lives in auth.users, which the data API does
// not expose. Names are unique enough among a handful of test accounts.
const name = arg("as", "Gulnabi Afridi");
const count = Number(arg("count", 5));
const gap = Number(arg("gap", 4)) * 1000;

const api = async (path, init = {}) => {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...HEAD, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${text}`);
  return text ? JSON.parse(text) : [];
};

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// Each one needs its own entity, or the trigger's dedupe folds them into a
// single row and the count never moves — which is correct behaviour, and
// exactly what this script must not accidentally demonstrate.
const SCRIPT = [
  { kind: "message", title: "Joe Matthews messaged you", body: "Didcot Wargames",
    href: "/account/messages" },
  { kind: "join_request", title: "Tom Allen wants to join", body: "Didcot Wargames",
    href: "/clubs/didcot-wargames-didcot/members" },
  { kind: "rival", title: "sara khan named you a rival", body: "Didcot Wargames",
    href: "/clubs/didcot-wargames-didcot/members" },
  { kind: "order", title: "Your order is ready at Didcot Wargames",
    body: "Collect it next time you are in.", href: "/account/orders" },
  { kind: "tier_request", title: "Priya Nair wants a tier change", body: "G Matthews Games Club",
    href: "/clubs/g-matthews-games-club-wantage/members" },
];

const [person] = await api(
  `profiles?select=id,full_name&full_name=eq.${encodeURIComponent(name)}&limit=1`,
);
if (!person) throw new Error(`No profile called ${name}`);

if (flag("clean")) {
  await api(`notifications?entity_type=eq.demo`, { method: "DELETE" });
  console.log("demo notifications removed");
  process.exit(0);
}

if (flag("reset")) {
  await api(`notifications?profile_id=eq.${person.id}&read_at=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  console.log("everything marked read, badge should be clear");
  await wait(2000);
}

console.log(`firing ${count} at ${person.full_name}, ${gap / 1000}s apart`);
console.log("watch the bell, do not reload\n");

for (let i = 0; i < count; i += 1) {
  const item = SCRIPT[i % SCRIPT.length];
  await api("notifications", {
    method: "POST",
    body: JSON.stringify({
      profile_id: person.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      href: item.href,
      entity_type: "demo",
      entity_id: `demo-${Date.now()}-${i}`,
    }),
  });

  const unread = await api(
    `notifications?select=id&profile_id=eq.${person.id}&read_at=is.null`,
  );
  console.log(`  ${i + 1}. ${item.title}   → badge should read ${unread.length}`);

  if (i < count - 1) await wait(gap);
}

console.log("\ndone. remove them with: node scripts/demo-notifications.mjs --clean");
