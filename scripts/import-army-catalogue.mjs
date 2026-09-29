// Brings the Warhammer 40,000 catalogue across from the legacy store.
//
// Reads ../app/data/game-editions/warhammer-40k/11th/catalogue.json, which is
// 936 KB holding one system, 30 factions, 346 detachments and 1409 units. The
// shape here mirrors it exactly, so the snapshot this produces and the file it
// read are the same language.
//
// Two things it refuses to do quietly.
//
// **A points value that will not parse stops the run.** They are strings in the
// file ("165") and `Number("")` is 0, which is how a mistyped price shipped as
// free in stage 5. Anything unparseable is collected and printed, and nothing
// is written until there are none.
//
// **It never publishes on top of a published version.** The draft is filled,
// the counts are printed, and publishing is a second command, so a half-run
// import cannot become the version everybody's results pin to.
//
//   node scripts/import-army-catalogue.mjs             fill the draft
//   node scripts/import-army-catalogue.mjs --publish   and freeze it
//
// Idempotent: every write is an upsert keyed on the slug or the unit name, so
// running it twice changes nothing.

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

const URL_BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISH = process.argv.includes("--publish");

async function rpc(name, args) {
  const res = await fetch(`${URL_BASE}/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${name}: ${body}`);
  return body ? JSON.parse(body) : null;
}

const text = (value) => String(value ?? "").trim();
const slugify = (value) =>
  text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SOURCE = "../../app/data/game-editions/warhammer-40k/11th";
const file = JSON.parse(readFileSync(resolve(here, `${SOURCE}/catalogue.json`), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(here, `${SOURCE}/manifest.json`), "utf8"));

const system = file.systems?.[0];
if (!system) throw new Error("no system in the catalogue file");

const editionId = file.editionId || manifest.editionId;
const version = file.catalogueVersion || manifest.catalogueVersion;
const factions = system.factions || [];

// ---------------------------------------------------------------- the check
//
// Every points value, before anything is written. A unit that will not parse
// is named with its faction, because "one unit is wrong" is not something
// anybody can act on.
const bad = [];
const points = (raw, where) => {
  const value = Number(text(raw));
  if (!Number.isFinite(value) || value <= 0) {
    bad.push(`${where}: points read "${raw}"`);
    return 0;
  }
  return Math.round(value);
};

for (const faction of factions) {
  for (const unit of faction.units || []) {
    points(unit.points, `${faction.id} / ${text(unit.name) || "(unnamed)"}`);
    for (const option of unit.options || []) {
      if (option.points !== undefined) {
        points(option.points, `${faction.id} / ${unit.name} / ${option.label}`);
      }
    }
  }
}

if (bad.length) {
  console.error(`\n${bad.length} points values will not parse. Nothing written.\n`);
  for (const line of bad.slice(0, 30)) console.error(`  ${line}`);
  if (bad.length > 30) console.error(`  ... and ${bad.length - 30} more`);
  process.exit(1);
}

// ---------------------------------------------------------------- the write

console.log(`edition ${editionId} · version ${version}`);

await rpc("save_army_edition", {
  p_system: system.id,
  p_system_label: text(system.label) || system.id,
  p_points: (system.pointsOptions || []).map(text),
  p_edition: editionId,
  p_edition_label: manifest.editionId?.split("-").pop() || "current",
  p_version: version,
});

let detachments = 0;
let units = 0;

for (const [index, faction] of factions.entries()) {
  await rpc("save_army_faction", {
    p_edition: editionId,
    p_id: faction.id,
    p_label: text(faction.label) || faction.id,
    p_position: index,
  });

  // `detachmentOptions` is the structured one: an id, a label and the
  // detachment's own dispositions. The bare `detachments` array beside it is
  // labels only, and the manifest is explicit that the dispositions belong to
  // the detachment, so that is the one to read.
  for (const [i, option] of (faction.detachmentOptions || []).entries()) {
    await rpc("save_army_detachment", {
      p_edition: editionId,
      p_faction: faction.id,
      p_slug: text(option.id) || slugify(option.label),
      p_label: text(option.label),
      p_dispositions: (option.dispositions || []).map(text).filter(Boolean),
      p_position: i,
    });
    detachments += 1;
  }

  for (const [i, unit] of (faction.units || []).entries()) {
    await rpc("save_army_unit", {
      p_edition: editionId,
      p_faction: faction.id,
      p_name: text(unit.name),
      p_points: points(unit.points, faction.id),
      p_options: unit.options || [],
      // Kept verbatim. `fromCopy`, `toCopy` and a null meaning "and every copy
      // after" are what `army-pricing.ts` reads, and rewriting the shape here
      // would mean two readings of one rule.
      p_rules: unit.copyCostRules || [],
      p_position: i,
    });
    units += 1;
  }

  process.stdout.write(`\r  ${index + 1}/${factions.length} factions`);
}

console.log(`\n\n  1 edition`);
console.log(`  ${factions.length} factions`);
console.log(`  ${detachments} detachments`);
console.log(`  ${units} units`);

if (!PUBLISH) {
  console.log(`\nDraft filled. Run again with --publish to freeze it as ${version}.`);
  process.exit(0);
}

await rpc("publish_army_catalogue", {
  p_edition: editionId,
  p_note: `Imported from ${manifest.catalogueSource || "the legacy catalogue"}`,
});
console.log(`\nPublished ${version}. It is now frozen and every result pins it.`);
