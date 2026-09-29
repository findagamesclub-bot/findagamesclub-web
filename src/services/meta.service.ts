import "server-only";

import * as repo from "@/repositories/meta.repository";
import { londonToday } from "./bookingCalendar.service";
import { lensWindow, previousWindow, type LensKey } from "@/utils/meta-lens";
import { readsFor, type MetaTab } from "@/utils/meta-tabs";

/**
 * What the Meta Tracker reads.
 *
 * Only the open tab's reads run, in one wave, which is the lesson the events
 * console and the analytics page both paid for. Each one catches its own
 * failure: a matchup query that will not answer should cost the matchups, not
 * the page.
 *
 * Every refusal the rollups raise is the scope guard in 0142, which is a real
 * answer rather than an error: somebody has asked for a club they are not in.
 */

export type Faction = {
  factionId: string; label: string;
  appearances: number; games: number; wins: number; draws: number; losses: number;
  winRate: number | null; representation: number; podiums: number;
  averageVp: number | null; earlySignal: boolean;
};

export type Depth = {
  factionId: string; label: string; parent: string;
  appearances: number; games: number; winRate: number | null; earlySignal: boolean;
};

export type Matchup = {
  label: string; opponent: string;
  games: number; winRate: number | null; earlySignal: boolean;
};

export type Context = {
  kind: string; value: string; games: number; winRate: number | null;
  earlySignal: boolean;
};

export type Unit = {
  label: string; unitName: string; mvp: number; underwhelming: number;
  games: number; earlySignal: boolean;
};

export type MetaView = {
  factions: Faction[];
  detachments: Depth[];
  dispositions: Depth[];
  matchups: Matchup[];
  context: Context[];
  units: Unit[];
  /** The same factions over the window before, for the direction. */
  before: Faction[];
  /** Said out loud rather than shown as an empty page. */
  refused: boolean;
};

/** A rate of 0 from no games is not a rate. Null says so. */
const rate = (games: number, value: number) =>
  Number(games) > 0 ? Number(value) : null;

const toFaction = (r: repo.FactionRollup): Faction => ({
  factionId: r.faction_id,
  label: r.faction_label || r.faction_id,
  appearances: Number(r.appearances),
  games: Number(r.games),
  wins: Number(r.wins),
  draws: Number(r.draws),
  losses: Number(r.losses),
  winRate: rate(Number(r.games), Number(r.win_rate)),
  representation: Number(r.representation),
  podiums: Number(r.podiums),
  averageVp: r.average_vp === null ? null : Number(r.average_vp),
  earlySignal: r.early_signal,
});

const toDepth = (r: repo.DepthRollup, deep: boolean): Depth => ({
  factionId: r.faction_id,
  label: deep ? (r.disposition ?? "") : r.detachment,
  parent: deep ? r.detachment : (r.faction_label || r.faction_id),
  appearances: Number(r.appearances),
  games: Number(r.games),
  winRate: rate(Number(r.games), Number(r.win_rate)),
  earlySignal: r.early_signal,
});

const EMPTY: MetaView = {
  factions: [], detachments: [], dispositions: [], matchups: [],
  context: [], units: [], before: [], refused: false,
};

export async function getMeta(params: {
  tab: MetaTab; club: number | null; lens: LensKey;
}): Promise<MetaView> {
  const { from, to } = lensWindow(params.lens, londonToday());
  const w = { club: params.club, from, to };
  const wanted = new Set(readsFor(params.tab));
  const want = (name: string) => wanted.has(name as never);

  // One wave. Nothing here needs anything else's answer.
  const [factions, detachments, dispositions, matchups, context, units, before] =
    await Promise.all([
      want("factions") ? repo.findFactions(w).catch(() => null) : null,
      want("detachments") ? repo.findDetachments(w).catch(() => []) : [],
      want("dispositions") ? repo.findDispositions(w).catch(() => []) : [],
      want("matchups") ? repo.findMatchups(w).catch(() => []) : [],
      want("context") ? repo.findBattleContext(w).catch(() => []) : [],
      want("units") ? repo.findUnits(w).catch(() => []) : [],
      // The window before this one, which is what makes a trend a direction
      // rather than a list of months.
      want("before")
        ? repo.findFactions({ ...w, ...previousWindow(params.lens, londonToday()) })
            .catch(() => [])
        : [],
    ]);

  // The factions read carries the scope guard, so its failure is the one that
  // means "not yours" rather than "nothing here".
  if (factions === null) return { ...EMPTY, refused: true };

  return {
    factions: factions.map(toFaction),
    detachments: (detachments ?? []).map((r) => toDepth(r, false)),
    dispositions: (dispositions ?? []).map((r) => toDepth(r, true)),
    matchups: (matchups ?? []).map((r) => ({
      label: r.faction_label || r.faction_id,
      opponent: r.opponent_label || r.opponent_id,
      games: Number(r.games),
      winRate: rate(Number(r.games), Number(r.win_rate)),
      earlySignal: r.early_signal,
    })),
    context: (context ?? []).map((r) => ({
      kind: r.kind, value: r.value,
      games: Number(r.games),
      winRate: rate(Number(r.games), Number(r.win_rate)),
      earlySignal: r.early_signal,
    })),
    // Ordered by how much people have said about a unit, not by how kindly.
    // The database orders by MVP tags first, which put every unit anybody had
    // praised twice and never criticised at the top: nine cards reading 100%
    // off two games each, which is the shape of a list that cannot be wrong
    // and cannot be useful. The biggest samples lead now, and the rate is the
    // thing you read once you are there.
    units: (units ?? []).map((r) => ({
      label: r.faction_label || r.faction_id,
      unitName: r.unit_name,
      mvp: Number(r.mvp),
      underwhelming: Number(r.underwhelming),
      games: Number(r.games),
      earlySignal: r.early_signal,
    })).sort((a, b) => b.games - a.games
      || b.mvp - a.mvp
      || a.unitName.localeCompare(b.unitName)),
    before: (before ?? []).map(toFaction),
    refused: false,
  };
}

/** The clubs this reader may narrow to, with how much each has. */
export async function getScopes() {
  const rows = await repo.findScopes().catch(() => []);
  return rows.map((row) => ({
    clubId: row.club_id,
    name: row.club_name,
    tracked: Number(row.tracked),
  }));
}

/**
 * One club's factions and dispositions, for the panel on its own page.
 *
 * The client asked for this by name as "missing from M2". No window: a club
 * panel is the club's whole history, and the tracker is where you narrow it.
 */
export async function getClubMeta(club: number) {
  const w = { club, from: null, to: null };
  const [factions, dispositions] = await Promise.all([
    repo.findFactions(w).catch(() => []),
    repo.findDispositions(w).catch(() => []),
  ]);
  return {
    factions: factions.map(toFaction),
    dispositions: dispositions.map((r) => toDepth(r, true)),
  };
}

/**
 * What one member plays.
 *
 * Empty for a reader who shares no club with them, because the policy on the
 * rows says so rather than because this asked.
 */
export async function getMemberMeta(profile: string) {
  const rows = await repo.findMemberArmies(profile).catch(() => []);
  return rows.map((r) => ({
    factionId: r.faction_id,
    label: r.faction_label || r.faction_id,
    games: Number(r.games),
    wins: Number(r.wins),
    draws: Number(r.draws),
    losses: Number(r.losses),
    winRate: r.win_rate === null ? null : Number(r.win_rate),
    appearances: Number(r.appearances),
    earlySignal: r.early_signal,
  }));
}

/** What was taken to one event. */
export async function getEventMeta(event: number) {
  const rows = await repo.findEventArmies(event).catch(() => []);
  return rows.map((r) => toDepth(r, true));
}
