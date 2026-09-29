// Folds the free-text armies members have been typing since Milestone 2 into
// real rows in game_result_armies, so the meta tracker in stage 9 has a history
// to read rather than starting empty.
//
// It only ever writes what it is sure of. A faction that matches exactly one in
// the club's pinned catalogue becomes a faction-only row; everything else is
// printed for a person to read. Detachments are deliberately not guessed at: a
// detachment has to be one that faction actually has, and a wrong one is a game
// filed under an army nobody played.
//
// A booking that already has an army row is left alone. Somebody who filled the
// fields in properly must not have that overwritten by a guess at their old
// free text.
//
// Reads through put_result_army, which is the same writer the app uses, so the
// validation and the catalogue's own spelling are not bypassed.
//
//   npx tsx scripts/backfill-result-armies.mjs           # says what it would do
//   npx tsx scripts/backfill-result-armies.mjs --apply   # does it

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { matchFaction, splitArmyText } from "../src/utils/faction-aliases.ts";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../.env.local"), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const URL_BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

async function api(path, init = {}) {
  const res = await fetch(`${URL_BASE}/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const rpc = (name, args) =>
  api(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });

/** The factions in one published version, for matching against. */
const factionsOf = async (edition, version) => {
  const rows = await api(
    `army_catalogue_snapshots?edition_id=eq.${encodeURIComponent(edition)}`
    + `&catalogue_version=eq.${encodeURIComponent(version)}&select=catalogue&limit=1`);
  const factions = rows[0]?.catalogue?.systems?.[0]?.factions ?? [];
  return factions.map((one) => ({ id: one.id, label: one.label }));
};

async function main() {
  // Only clubs that record armies. A club with the builder off has nothing to
  // validate against and nothing the tracker would show.
  const settings = await api(
    "club_army_builder_settings?enabled=is.true&select=club_id,edition_id");
  if (!settings.length) {
    console.log("No club runs the army builder yet, so there is nothing to fold.");
    return;
  }

  const editions = await api("army_editions?select=id,catalogue_version,status");
  const active = editions.find((one) => one.status === "active");
  const versionOf = (id) => editions.find((one) => one.id === id) ?? active;

  const byClub = new Map();
  for (const row of settings) {
    const edition = versionOf(row.edition_id);
    if (edition?.catalogue_version) byClub.set(row.club_id, edition);
  }
  if (!byClub.size) {
    console.log("No club has a published catalogue pinned. Publish one first.");
    return;
  }

  const factions = new Map();
  for (const edition of new Set([...byClub.values()])) {
    factions.set(edition.id, await factionsOf(edition.id, edition.catalogue_version));
  }

  const clubs = [...byClub.keys()].join(",");
  const bookings = await api(
    `club_bookings?club_id=in.(${clubs})&booked_by_score=not.is.null`
    + "&select=id,club_id,session_date,booked_by,opponent_profile_id,opponent_name,"
    + "booked_by_army,opponent_army&order=id");

  // What is already recorded properly. Never overwritten.
  const ids = bookings.map((one) => one.id);
  const already = new Set();
  for (let at = 0; at < ids.length; at += 200) {
    const slice = ids.slice(at, at + 200).join(",");
    const rows = await api(
      `game_result_armies?source_type=eq.booking&source_id=in.(${slice})&select=source_id,side`);
    for (const row of rows) already.add(`${row.source_id}:${row.side}`);
  }

  // A booking names only the account that booked it, so the opponent's typed
  // name is on the row and the booker's has to be looked up.
  const bookerIds = [...new Set(bookings.map((one) => one.booked_by).filter(Boolean))];
  const people = new Map();
  for (let at = 0; at < bookerIds.length; at += 200) {
    const slice = bookerIds.slice(at, at + 200).join(",");
    const rows = await api(`profiles?id=in.(${slice})&select=id,full_name`);
    for (const row of rows) people.set(row.id, row.full_name ?? "");
  }

  let written = 0, skipped = 0;
  const unmatched = new Map();

  for (const booking of bookings) {
    const edition = byClub.get(booking.club_id);
    const known = factions.get(edition.id) ?? [];

    for (const side of ["one", "two"]) {
      if (already.has(`${booking.id}:${side}`)) { skipped += 1; continue; }

      const text = side === "one" ? booking.booked_by_army : booking.opponent_army;
      if (!String(text ?? "").trim()) continue;

      const matched = matchFaction(text, known);
      if (!matched) {
        const key = splitArmyText(text).faction || text.trim();
        unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        continue;
      }

      written += 1;
      if (!APPLY) continue;

      await rpc("put_result_army", {
        p_source: "booking",
        p_source_id: booking.id,
        p_side: side,
        p_club: booking.club_id,
        p_played_on: booking.session_date,
        p_profile: side === "one" ? booking.booked_by : booking.opponent_profile_id,
        p_name: side === "one"
          ? (people.get(booking.booked_by) ?? "")
          : (booking.opponent_name ?? ""),
        // The faction and nothing else. What was typed after it is not a
        // detachment until somebody says it is.
        p_army: { factionId: matched.id, factionLabel: matched.label },
        p_edition: edition.id,
        p_version: edition.catalogue_version,
      });
    }
  }

  console.log(`${bookings.length} scored games at ${byClub.size} club(s).`);
  console.log(`${written} ${APPLY ? "written" : "would be written"}, `
    + `${skipped} already recorded properly and left alone.`);

  if (unmatched.size) {
    console.log(`\n${unmatched.size} thing(s) nobody can match automatically:`);
    for (const [text, count] of [...unmatched].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)} × ${text}`);
    }
    console.log("\nAdd an alias to src/utils/faction-aliases.ts, or leave them:");
    console.log("a game filed under the wrong faction is worse than one not filed.");
  }

  if (!APPLY) console.log("\nNothing was written. Run again with --apply.");
}

main().catch((error) => {
  // The one failure worth explaining rather than dumping: this script is the
  // last step of stage 8 and the tables it reads arrive with 0133 to 0137.
  if (String(error.message).includes("PGRST205")) {
    console.error("The army tables are not there yet. Run migrations 0133 to 0137,"
      + " then try again.");
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
