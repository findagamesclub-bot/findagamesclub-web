import "server-only";

import * as repo from "@/repositories/memberRecords.repository";
import { competitionBadges, type Badge } from "@/utils/competition-badges";

export type CompetitionRecord = {
  id: number;
  club: { slug: string; name: string };
  title: string;
  typeLabel: string;
  season: string;
  completed: boolean;
  rank: number;
  played: number;
  recordLabel: string;
  points: number;
};

export type PodiumFinish = {
  id: number;
  club: { slug: string; name: string };
  eventTitle: string;
  eventHref: string;
  date: string | null;
  placement: string;
  rank: number;
};

export type MemberRecords = {
  competitions: CompetitionRecord[];
  podiums: PodiumFinish[];
  badges: Badge[];
};

/** A name in a club's results that nobody has claimed yet. */
export type UnlinkedName = {
  kind: "standing" | "result";
  id: number;
  name: string;
  /** Where it came from, so an owner can tell two people of the same name apart. */
  context: string;
  detail: string;
};

/**
 * A member's competition history, wherever they have been linked to a result.
 *
 * Badges are derived rather than stored, using legacy's rules unchanged. A
 * stored badge goes stale the moment a standing is corrected; a derived one
 * cannot.
 */
export async function getMemberRecords(profileId: string): Promise<MemberRecords> {
  const [standings, results] = await Promise.all([
    repo.findStandingsFor(profileId).catch(() => []),
    repo.findResultsFor(profileId).catch(() => []),
  ]);

  const competitions: CompetitionRecord[] = standings.map((row) => ({
    id: row.id,
    club: { slug: row.club_competitions.clubs.slug, name: row.club_competitions.clubs.name },
    title: row.club_competitions.title,
    typeLabel: row.club_competitions.type_label || row.club_competitions.type,
    season: row.club_competitions.season,
    completed: row.club_competitions.status === "completed",
    rank: row.rank,
    played: row.played,
    recordLabel: row.record_label || `${row.wins}-${row.draws}-${row.losses}`,
    points: row.points,
  }));

  const podiums: PodiumFinish[] = results.map((row) => ({
    id: row.id,
    club: { slug: row.club_events.clubs.slug, name: row.club_events.clubs.name },
    eventTitle: row.club_events.title,
    eventHref: `/clubs/${row.club_events.clubs.slug}/events/${row.club_events.legacy_id}`,
    date: row.club_events.start_date,
    placement: row.placement,
    rank: row.rank,
  }));

  const badges = competitionBadges(standings.map((row) => ({
    competitionId: row.club_competitions.id,
    title: row.club_competitions.title,
    typeLabel: row.club_competitions.type_label || row.club_competitions.type,
    type: row.club_competitions.type,
    completed: row.club_competitions.status === "completed",
    rank: row.rank,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
  })));

  return { competitions, podiums, badges };
}

/**
 * Names at this club that no account has been put against.
 *
 * One list, both sources, because to an owner they are the same job: say who
 * these people are. Sorted by name so the same person's several rows sit
 * together and can be done in one go.
 */
export async function getUnlinkedNames(clubId: number): Promise<UnlinkedName[]> {
  const [standings, results] = await Promise.all([
    repo.findUnlinkedStandings(clubId).catch(() => []),
    repo.findUnlinkedResults(clubId).catch(() => []),
  ]);

  const rows: UnlinkedName[] = [
    ...standings.map((row) => ({
      kind: "standing" as const,
      id: row.id,
      name: row.member_name,
      context: row.club_competitions.title,
      detail: `${row.rank ? `${row.rank}${suffix(row.rank)} · ` : ""}${row.record_label || `${row.wins}-${row.draws}-${row.losses}`}`,
    })),
    ...results.map((row) => ({
      kind: "result" as const,
      id: row.id,
      name: row.member_name,
      context: row.club_events.title,
      detail: row.placement || `${row.rank}${suffix(row.rank)}`,
    })),
  ];

  return rows.sort((a, b) =>
    a.name.localeCompare(b.name) || a.context.localeCompare(b.context));
}

function suffix(rank: number): string {
  if (rank % 100 >= 11 && rank % 100 <= 13) return "th";
  if (rank % 10 === 1) return "st";
  if (rank % 10 === 2) return "nd";
  if (rank % 10 === 3) return "rd";
  return "th";
}

export type MatchedName = UnlinkedName & {
  /** Who it was attached to, so a wrong one can be spotted without leaving. */
  memberId: string;
  memberName: string;
};

export type UnlinkedPerson = {
  /** The name as the old site recorded it. */
  name: string;
  rows: UnlinkedName[];
};

/**
 * The same name's rows gathered together.
 *
 * A club with three years of leagues has one person in fifty rows, and fifty
 * presses for one obvious answer is how an owner abandons the job half done.
 * Grouping also makes the real size of the work visible: four names, not seven
 * results.
 */
export function groupUnlinked(rows: UnlinkedName[]): UnlinkedPerson[] {
  const people = new Map<string, UnlinkedPerson>();

  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const person = people.get(key) ?? { name: row.name.trim(), rows: [] };
    person.rows.push(row);
    people.set(key, person);
  }

  return [...people.values()]
    // Most rows first: the person worth doing in one press leads.
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));
}

/** Attach every row of one name at once. Partial success is reported. */
export async function linkMany(
  rows: { kind: "standing" | "result"; id: number }[],
  profileId: string,
): Promise<{ ok: boolean; done: number; error?: string }> {
  let done = 0;
  for (const row of rows) {
    const result = await linkName(row.kind, row.id, profileId);
    if (!result.ok) {
      // Stops rather than carrying on: whatever refused the first one refuses
      // the rest, and a half-attached person is worse than an untouched one.
      return { ok: false, done, error: result.error };
    }
    done += 1;
  }
  return { ok: true, done };
}

/**
 * Names at this club that have already been attached to somebody.
 *
 * Shown so a match can be undone. Without this a wrong pick is permanent from
 * the club's side: the row leaves the unmatched list and there is no other way
 * back to it.
 */
export async function getMatchedNames(clubId: number): Promise<MatchedName[]> {
  const [standings, results] = await Promise.all([
    repo.findLinkedStandings(clubId).catch(() => []),
    repo.findLinkedResults(clubId).catch(() => []),
  ]);

  const rows: MatchedName[] = [
    ...standings.map((row) => ({
      kind: "standing" as const,
      id: row.id,
      name: row.member_name,
      context: row.club_competitions.title,
      detail: `${row.rank ? `${row.rank}${suffix(row.rank)} · ` : ""}${row.record_label || `${row.wins}-${row.draws}-${row.losses}`}`,
      memberId: row.profile_id ?? "",
      memberName: "",
    })),
    ...results.map((row) => ({
      kind: "result" as const,
      id: row.id,
      name: row.member_name,
      context: row.club_events.title,
      detail: row.placement || `${row.rank}${suffix(row.rank)}`,
      memberId: row.member_profile_id ?? "",
      memberName: "",
    })),
  ];

  return rows.sort((a, b) =>
    a.name.localeCompare(b.name) || a.context.localeCompare(b.context));
}

export async function linkName(
  kind: "standing" | "result",
  id: number,
  profileId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (kind === "standing") await repo.linkStanding(id, profileId);
    else await repo.linkResult(id, profileId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not your club")) {
      return { ok: false, error: "Only the club can match its own results." };
    }
    if (message.includes("not an approved member")) {
      return { ok: false, error: "That person is not an approved member of this club." };
    }
    return { ok: false, error: "Could not save that. Try again." };
  }
}
