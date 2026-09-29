"use server";

import { after } from "next/server";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getList, getBuildContext } from "@/services/armyLists.service";
import { getMemberMeta } from "@/services/meta.service";
import * as ai from "@/services/aiJobs.service";
import { listHealth } from "@/utils/list-health";
import { unitsFor, dispositionsFor } from "@/utils/army-catalogue";
import { focusKeyFor, isSeasonGoal } from "@/utils/season-goals";

/**
 * A season plan for one list and one goal.
 *
 * Its own action rather than another branch of `runAiAction`, because it does
 * something the other three do not: it files a plan, retiring whatever that
 * focus had. A run is a run either way; the plan is the thing somebody comes
 * back to.
 *
 * **Only confirmed games count.** Same rule as the meta tracker
 * (`_is_season_coach_match_trusted`, club_store.py:7979), and for the same
 * reason: advice built on results nobody agreed to is advice about fiction.
 * `getMemberMeta` only ever returns confirmed rows, so this inherits it.
 */
export async function runSeasonAction(input: {
  slug: string; listId: number; goal: string; force?: boolean;
}) {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to access the army builder." };
  if (!isSeasonGoal(input.goal)) return { error: "Choose a goal for the season." };

  const club = await getClubDetail(input.slug);
  if (!club) return { error: "That club is not here any more." };

  const build = await getBuildContext(club.id);
  if (!build) return { error: "Army builder is not enabled for this club." };

  const held = await getList(input.listId, viewer.id);
  const version = held?.list.current;
  if (!held?.list?.isOwner || !version) return { error: "Army list not found." };

  const armies = await getMemberMeta(viewer.id).catch(() => []);
  const matches = armies.reduce((n, one) => n + one.games, 0);

  const payload = {
    club: club.name,
    goal: input.goal,
    list: {
      name: version.name, faction: version.factionLabel,
      pointsLimit: version.pointsLimit, totalPoints: version.totalPoints,
      units: version.units.map((one) => ({
        unitName: one.unitName, quantity: one.quantity, linePoints: one.linePoints,
      })),
    },
    coachingSignals: listHealth({
      units: version.units,
      totalPoints: version.totalPoints,
      pointsLimit: Number(version.pointsLimit) || 0,
      detachments: version.detachments,
      dispositionsFor: (detachment) =>
        dispositionsFor(build.catalogue, version.factionId, detachment),
    }),
    // Confirmed games only, by faction. This is the whole evidence base, and
    // the count is what makes the plan stale later.
    record: {
      confirmedGames: matches,
      byFaction: armies.map((one) => ({
        faction: one.label, games: one.games, won: one.wins,
        drawn: one.draws, lost: one.losses, winRate: one.winRate,
      })),
    },
  };

  const focusKey = focusKeyFor(held.list.id, input.goal);
  const started = await ai.start({
    club: club.id, feature: "season",
    signature: `${version.id}:${input.goal}`,
    source: {
      listId: held.list.id, listName: version.name,
      versionNumber: version.versionNumber, goal: input.goal,
    },
    payload, force: input.force,
  });

  if (!started.ok) return { error: started.error };
  if (started.cached) return { jobId: started.jobId, cached: true };

  const known = unitsFor(build.catalogue, version.factionId).map((one) => one.name);
  after(async () => {
    const plan = await ai.work({
      job: started.jobId, feature: "season", payload, knownUnits: known });
    if (!plan) return;
    await ai.fileSeasonPlan({
      club: club.id, focusKey, goal: input.goal, plan,
      focus: { listId: held.list.id, listName: version.name,
               versionNumber: version.versionNumber },
      signature: `${version.id}:${input.goal}`,
      matches,
    });
  });

  return { jobId: started.jobId, cached: false };
}
