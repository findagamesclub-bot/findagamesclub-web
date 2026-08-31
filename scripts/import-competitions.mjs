// Brings competitivePlay across from the legacy store.
//
// Reads ../app/data/clubs.json directly rather than the export: unlike images
// and events, competitions are already merged into that file by the store, and
// the copy there is the normalised one (it carries rank and recordLabel, which
// CLUB_ENRICHMENTS does not).
//
// Idempotent: a club's competitions are replaced wholesale on every run.
//
//   node scripts/import-competitions.mjs

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

async function api(path, init = {}) {
  const res = await fetch(`${URL_BASE}/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path}: ${text}`);
  return text ? JSON.parse(text) : [];
}

const text = (value) => String(value ?? "").trim();
const num = (value) => Number(value ?? 0) || 0;

const source = JSON.parse(
  readFileSync(resolve(here, "../../app/data/clubs.json"), "utf8"),
);
const clubs = Array.isArray(source) ? source : source.clubs;

for (const club of clubs) {
  const competitions = club.competitivePlay || [];
  if (!competitions.length) continue;

  const [row] = await api(`clubs?select=id&slug=eq.${club.slug}`);
  if (!row) {
    console.log(`skipped ${club.slug}: not in the database`);
    continue;
  }

  await api(`club_competitions?club_id=eq.${row.id}`, { method: "DELETE" });

  for (const [index, competition] of competitions.entries()) {
    const [saved] = await api("club_competitions", {
      method: "POST",
      body: JSON.stringify({
        club_id: row.id,
        legacy_id: text(competition.id),
        title: text(competition.title) || "Competition",
        type: text(competition.type) || "league",
        type_label: text(competition.typeLabel),
        status: text(competition.status) || "active",
        status_label: text(competition.statusLabel),
        season: text(competition.season),
        game: text(competition.game),
        summary: text(competition.summary),
        start_date: text(competition.startDate) || null,
        end_date: text(competition.endDate) || null,
        position: index,
      }),
    });

    const standings = (competition.standings || []).map((entry) => ({
      competition_id: saved.id,
      member_name: text(entry.memberName) || "Club member",
      rank: num(entry.rank),
      played: num(entry.played),
      wins: num(entry.wins),
      draws: num(entry.draws),
      losses: num(entry.losses),
      points: num(entry.points),
      record_label: text(entry.recordLabel),
      notes: text(entry.notes),
      // The label only. A link to the stored army list needs the army builder.
      faction: text(entry.army?.factionLabel),
      detachment: text(entry.army?.detachment),
    }));
    if (standings.length) {
      await api("club_competition_standings", {
        method: "POST",
        body: JSON.stringify(standings),
      });
    }

    for (const [order, update] of (competition.history || []).entries()) {
      const [savedUpdate] = await api("club_competition_updates", {
        method: "POST",
        body: JSON.stringify({
          competition_id: saved.id,
          posted_on: text(update.date) || null,
          title: text(update.title) || "Competition update",
          summary: text(update.summary),
          position: order,
        }),
      });

      const matches = (update.matches || []).map((match, at) => ({
        update_id: savedUpdate.id,
        player_one: text(match.playerOne),
        player_one_score: text(match.playerOneScore),
        player_two: text(match.playerTwo),
        player_two_score: text(match.playerTwoScore),
        position: at,
      }));
      if (matches.length) {
        await api("club_competition_matches", {
          method: "POST",
          body: JSON.stringify(matches),
        });
      }
    }

    console.log(
      `${club.slug}: ${competition.title} — ${standings.length} standings, ` +
        `${(competition.history || []).length} updates`,
    );
  }
}
