/**
 * Import the legacy export into Supabase.
 *
 * Idempotent: run it as many times as you like. Club ids are preserved from the
 * legacy data so the 297 user references and every child record keep pointing
 * at the right rows.
 *
 * Uses the service role key, so RLS is bypassed. Never run this against
 * production without checking which project .env.local points at.
 *
 *   node --env-file=.env.local scripts/import-to-supabase.mjs
 *   node --env-file=.env.local scripts/import-to-supabase.mjs --verify-only
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPORT_PATH = new URL("./legacy-export.json", import.meta.url);
const verifyOnly = process.argv.includes("--verify-only");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync(EXPORT_PATH, "utf8"));

function fail(step, error) {
  console.error(`\n✗ ${step}\n  ${error.message ?? error}`);
  process.exit(1);
}

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) fail(`upsert ${table}`, error);
}

async function replaceChildren(table, clubIds, rows) {
  const { error: delError } = await db.from(table).delete().in("club_id", clubIds);
  if (delError) fail(`clear ${table}`, delError);
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) fail(`insert ${table}`, error);
}

async function importVocab() {
  const map = {};
  for (const [table, entries] of Object.entries(data.vocab)) {
    await upsert(table, entries, "slug");
    const { data: rows, error } = await db.from(table).select("id, slug");
    if (error) fail(`read ${table}`, error);
    map[table] = new Map(rows.map((r) => [r.slug, r.id]));
    console.log(`  ${table.padEnd(16)} ${rows.length}`);
  }
  return map;
}

async function main() {
  if (verifyOnly) return verify();

  console.log("Vocabularies");
  const vocab = await importVocab();

  console.log("\nClubs");
  const clubs = data.clubs;
  const clubIds = clubs.map((c) => c.id);

  await upsert(
    "clubs",
    clubs.map((c) => ({
      id: c.id, slug: c.slug, name: c.name, status: c.status,
      city: c.city, neighbourhood: c.neighbourhood, country: c.country,
      venue_name: c.venue_name, venue_address: c.venue_address,
      venue_postcode: c.venue_postcode, venue_postcode_district: c.venue_postcode_district,
      venue_postcode_area: c.venue_postcode_area,
      latitude: c.latitude, longitude: c.longitude, coordinates_label: c.coordinates_label,
      summary: c.summary, description: c.description, logo_url: c.logo_url,
      tables_available: c.tables_available, member_count: c.member_count,
      price_drop_in: c.price_drop_in, price_membership: c.price_membership,
      ages: c.ages, accessibility: c.accessibility, tags: c.tags,
      spotlight: c.spotlight, announcement: c.announcement,
      contact_email: c.contact_email, website_url: c.website_url,
      search_haystack: c.search_haystack ?? "",
      owner_legacy_id: c.owner_legacy_id ?? null,
    })),
    "id",
  );
  console.log(`  clubs            ${clubs.length}`);

  // Only three clubs have a real creation date. It goes in legacy_created_at so
  // "unknown" stays distinguishable from "created at import time".
  for (const c of clubs) {
    const { error } = await db.from("clubs")
      .update({ legacy_created_at: c.created_at ?? null }).eq("id", c.id);
    if (error) fail(`set legacy_created_at for ${c.slug}`, error);
  }

  // Join tables, rebuilt from scratch each run.
  const joins = [
    ["club_formats", "format_slugs", "formats", "format_id"],
    ["club_games", "game_slugs", "games", "game_id"],
    ["club_facilities", "facility_slugs", "facilities", "facility_id"],
    ["club_payment_methods", "payment_slugs", "payment_methods", "payment_method_id"],
  ];
  for (const [table, field, vocabKey, column] of joins) {
    const rows = clubs.flatMap((c) =>
      [...new Set(c[field])]
        .map((slug) => vocab[vocabKey].get(slug))
        .filter(Boolean)
        .map((id) => ({ club_id: c.id, [column]: id })),
    );
    const { error } = await db.from(table).delete().in("club_id", clubIds);
    if (error) fail(`clear ${table}`, error);
    await upsert(table, rows, `club_id,${column}`);
    console.log(`  ${table.padEnd(16)} ${rows.length}`);
  }

  console.log("\nClub content");
  const children = [
    ["club_sessions", clubs.flatMap((c) => c.sessions.map((s, i) => ({ club_id: c.id, day: s.day, time: s.time, label: s.label, position: i })))],
    ["club_images", clubs.flatMap((c) => c.images.map((im, i) => ({ club_id: c.id, src: im.src, alt: im.alt, position: i })))],
    ["club_social_links", clubs.flatMap((c) => c.social_links.map((s, i) => ({ club_id: c.id, label: s.label, url: s.url, position: i })))],
    ["club_pricing_models", clubs.flatMap((c) => c.pricing_models.map((p, i) => ({ club_id: c.id, label: p.label, price: p.price, notes: p.notes, position: i })))],
    ["club_discussion_categories", clubs.flatMap((c) => [...new Set(c.discussion_categories)].map((label, i) => ({ club_id: c.id, label, position: i })))],
    ["club_members", clubs.flatMap((c) => c.members.map((m, i) => ({ club_id: c.id, legacy_member_id: m.legacy_member_id, name: m.name, initials: m.initials, position: i })))],
    ["club_membership_tiers", clubs.flatMap((c) => c.membership_tiers.map((t, i) => ({ club_id: c.id, tier_key: t.tier_key, label: t.label, price: t.price, price_duration: t.price_duration, description: t.description, tone: t.tone, profile_flair: t.profile_flair, premium_badge_label: t.premium_badge_label, is_basic: t.is_basic, position: i, benefits: t.benefits, billing_options: t.billing_options })))],
  ];
  for (const [table, rows] of children) {
    await replaceChildren(table, clubIds, rows);
    console.log(`  ${table.padEnd(26)} ${rows.length}`);
  }

  const settings = clubs.filter((c) => c.membership_settings).map((c) => ({ club_id: c.id, ...c.membership_settings }));
  await upsert("club_membership_settings", settings, "club_id");
  console.log(`  club_membership_settings   ${settings.length}`);

  // Legacy announcement ids are per-club, so they key on (club_id, legacy_id).
  const announcements = clubs.flatMap((c) => c.announcements.map((a) => ({ club_id: c.id, legacy_id: a.id, message: a.message, created_at: a.created_at ?? new Date().toISOString() })));
  await replaceChildren("club_announcements", clubIds, announcements);
  console.log(`  club_announcements         ${announcements.length}`);

  console.log("\nEvents");
  // Events cascade-delete their children, so clearing them first keeps reruns clean.
  const { error: evDel } = await db.from("club_events").delete().in("club_id", clubIds);
  if (evDel) fail("clear club_events", evDel);

  const eventRows = clubs.flatMap((c) =>
    c.events.map((e) => ({
      club_id: c.id, legacy_id: e.legacy_id, title: e.title, summary: e.summary,
      start_date: e.start_date, start_time: e.start_time, end_date: e.end_date, end_time: e.end_time,
      event_type: e.event_type, event_types: e.event_types, formats: e.formats,
      featured_games: e.featured_games, facilities: e.facilities,
      round_count: e.round_count, price: e.price, tickets_available: e.tickets_available,
      logo_src: e.logo_src, logo_alt: e.logo_alt,
      venue_name: e.venue_name, venue_address: e.venue_address, venue_postcode: e.venue_postcode,
      info_board: e.info_board, bestcoast_link: e.bestcoast_link,
    })),
  );
  const { data: inserted, error: evErr } = await db.from("club_events").insert(eventRows).select("id, club_id, legacy_id");
  if (evErr) fail("insert club_events", evErr);
  console.log(`  club_events                ${inserted.length}`);

  const eventId = new Map(inserted.map((e) => [`${e.club_id}::${e.legacy_id}`, e.id]));
  const idFor = (clubId, legacyId) => eventId.get(`${clubId}::${legacyId}`);

  const eventChildren = [
    ["club_event_social_links", clubs.flatMap((c) => c.events.flatMap((e) => e.social_links.map((s, i) => ({ event_id: idFor(c.id, e.legacy_id), label: s.label, url: s.url, position: i }))))],
    ["club_event_ticket_types", clubs.flatMap((c) => c.events.flatMap((e) => e.ticket_types.map((t, i) => ({ event_id: idFor(c.id, e.legacy_id), label: t.label, price: t.price, audience: t.audience, audience_label: t.audience_label, minimum_tier_key: t.minimum_tier_key, quantity_available: t.quantity_available, position: i }))))],
    ["club_event_notices", clubs.flatMap((c) => c.events.flatMap((e) => e.notices.map((n) => ({ event_id: idFor(c.id, e.legacy_id), message: n.message }))))],
    ["club_event_results", clubs.flatMap((c) => c.events.flatMap((e) => e.results.map((r) => ({ event_id: idFor(c.id, e.legacy_id), rank: r.rank, placement: r.placement, member_name: r.member_name, member_legacy_id: r.member_legacy_id, is_member: r.is_member, army: r.army }))))],
    ["club_event_pairings", clubs.flatMap((c) => c.events.flatMap((e) => e.pairings.map((p) => ({ event_id: idFor(c.id, e.legacy_id), round: p.round, label: p.label, matches: p.matches }))))],
  ];
  for (const [table, rows] of eventChildren) {
    const clean = rows.filter((r) => r.event_id);
    if (clean.length) {
      const { error } = await db.from(table).insert(clean);
      if (error) fail(`insert ${table}`, error);
    }
    console.log(`  ${table.padEnd(26)} ${clean.length}`);
  }

  // Vocabulary rows from an earlier run can be left behind when a label gets
  // merged (warhammer-40k folding into warhammer-40-000). Nothing references
  // them once the joins are rebuilt, so drop them.
  console.log("\nPruning stale vocabulary");
  for (const [table, entries] of Object.entries(data.vocab)) {
    const keep = entries.map((e) => e.slug);
    const { data: removed, error } = await db.from(table).delete().not("slug", "in", `(${keep.map((s) => `"${s}"`).join(",")})`).select("slug");
    if (error) fail(`prune ${table}`, error);
    if (removed.length) console.log(`  ${table.padEnd(16)} removed ${removed.map((r) => r.slug).join(", ")}`);
    else console.log(`  ${table.padEnd(16)} nothing stale`);
  }

  console.log("\nReviews");
  await upsert("club_reviews", data.reviews, "id");
  console.log(`  club_reviews               ${data.reviews.length}`);

  console.log("");
  await verify();
}

async function verify() {
  console.log("Verification");
  const expected = {
    clubs: data.clubs.length,
    club_sessions: data.clubs.reduce((n, c) => n + c.sessions.length, 0),
    club_images: data.clubs.reduce((n, c) => n + c.images.length, 0),
    club_social_links: data.clubs.reduce((n, c) => n + c.social_links.length, 0),
    club_members: data.clubs.reduce((n, c) => n + c.members.length, 0),
    club_membership_tiers: data.clubs.reduce((n, c) => n + c.membership_tiers.length, 0),
    club_events: data.clubs.reduce((n, c) => n + c.events.length, 0),
    club_event_results: data.clubs.reduce((n, c) => n + c.events.reduce((m, e) => m + e.results.length, 0), 0),
    club_event_ticket_types: data.clubs.reduce((n, c) => n + c.events.reduce((m, e) => m + e.ticket_types.length, 0), 0),
    club_reviews: data.reviews.length,
    games: data.vocab.games.length,
    facilities: data.vocab.facilities.length,
    formats: data.vocab.formats.length,
    payment_methods: data.vocab.payment_methods.length,
  };

  let bad = 0;
  for (const [table, want] of Object.entries(expected)) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) fail(`count ${table}`, error);
    const ok = count === want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${table.padEnd(26)} ${String(count).padStart(4)} / ${want}`);
  }

  // Counts alone can pass with every relationship scrambled, so spot-check one.
  const { data: didcot, error } = await db
    .from("clubs")
    .select("name, city, tables_available, club_sessions(day, time), club_events(title, club_event_results(member_name, rank))")
    .eq("slug", "didcot-wargames-didcot")
    .single();
  if (error) fail("relationship spot check", error);

  console.log("\n  Spot check — Didcot Wargames");
  console.log(`    city     ${didcot.city}`);
  console.log(`    tables   ${didcot.tables_available}`);
  console.log(`    sessions ${didcot.club_sessions.map((s) => `${s.day} ${s.time}`).join(", ")}`);
  for (const e of didcot.club_events) {
    console.log(`    event    ${e.title} (${e.club_event_results.length} results)`);
  }

  console.log(bad === 0 ? "\n✓ All counts match." : `\n✗ ${bad} table(s) out of step.`);
  if (bad > 0) process.exit(1);
}

main();
