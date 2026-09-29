"use server";

import { after } from "next/server";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getList, getBuildContext } from "@/services/armyLists.service";
import * as ai from "@/services/aiJobs.service";
import { listHealth } from "@/utils/list-health";
import { unitsFor, dispositionsFor } from "@/utils/army-catalogue";
import { getMemberMeta } from "@/services/meta.service";
import { getGrudgeTracker } from "@/services/grudgeTracker.service";
import { getProfile } from "@/services/profiles.service";
import { coverageFor } from "@/utils/scouting-coverage";
import type { AiFeature } from "@/utils/ai-access";

export type RunInput = {
  slug: string;
  feature: AiFeature;
  listId: number;
  /** Matchup only: who is on the other side. */
  opponent?: { factionId: string; factionLabel: string; listId?: number };
  /** Scouting only: the clubmate being scouted. */
  opponentProfileId?: string;
  force?: boolean;
};

/**
 * Start a run and let it finish after the response.
 *
 * `after()` is the whole shape: the row is inserted, the id goes back, and the
 * model is called once nobody is waiting on the HTTP response. Somebody can
 * close the tab on the bus and the answer is there when they open it again.
 *
 * Everything this decides is decided again in SQL. `start_ai_job` re-checks
 * the ladder, the feature's tier, the rolling window and the club's cap, so
 * what arrives here is a request rather than a permission.
 */
export async function runAiAction(input: RunInput) {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to access the army builder." };

  const club = await getClubDetail(input.slug);
  if (!club) return { error: "That club is not here any more." };

  const build = await getBuildContext(club.id);
  if (!build) return { error: "Army builder is not enabled for this club." };

  const held = await getList(input.listId, viewer.id);
  const version = held?.list.current;
  if (!held?.list || !version) return { error: "Army list not found." };
  if (!held.list.isOwner) return { error: "You can only coach your own army lists." };

  const health = listHealth({
    units: version.units,
    totalPoints: version.totalPoints,
    pointsLimit: Number(version.pointsLimit) || 0,
    detachments: version.detachments,
    dispositionsFor: (detachment) =>
      dispositionsFor(build.catalogue, version.factionId, detachment),
  });

  const known = unitsFor(build.catalogue, version.factionId).map((one) => one.name);

  // Scouting is about somebody, so it carries their evidence rather than the
  // reader's. Coverage goes in the payload as well as on the screen, because
  // the prompt is told never to present two games as a habit and it needs the
  // number to obey that.
  const scouting = input.feature === "scouting" && input.opponentProfileId
    ? await scoutingEvidence(club.id, viewer.id, input.opponentProfileId)
    : null;

  const payload = {
    club: club.name,
    list: {
      name: version.name,
      faction: version.factionLabel,
      pointsLimit: version.pointsLimit,
      totalPoints: version.totalPoints,
      detachmentSelections: version.detachments,
      units: version.units.map((one) => ({
        unitName: one.unitName, unitSize: one.optionLabel,
        modelCount: one.optionModelCount, quantity: one.quantity,
        unitPoints: one.unitPoints, linePoints: one.linePoints,
      })),
    },
    // The evidence. Legacy's prompt calls these "the main evidence" and means
    // it: the model is writing up an analysis that already happened.
    coachingSignals: health,
    ...(input.opponent ? { opponent: input.opponent } : {}),
    ...(scouting ? { scouting } : {}),
  };

  const started = await ai.start({
    club: club.id,
    feature: input.feature,
    // The cache key. An opponent makes it a different question about the same
    // list, so it joins the signature.
    signature: [version.id, input.opponent?.factionId ?? "",
                input.opponentProfileId ?? ""].filter(Boolean).join(":"),
    source: {
      listId: held.list.id, listName: version.name,
      versionNumber: version.versionNumber,
      faction: version.factionLabel,
      opponent: input.opponent?.factionLabel ?? scouting?.opponentName ?? "",
    },
    payload,
    force: input.force,
  });

  if (!started.ok) return { error: started.error };
  if (started.cached) return { jobId: started.jobId, cached: true };

  after(async () => {
    await ai.work({
      job: started.jobId, feature: input.feature, payload, knownUnits: known,
    });
  });

  return { jobId: started.jobId, cached: false };
}

/**
 * What is actually known about the person being scouted.
 *
 * Their recorded armies, the reader's own record against them, and how much
 * of it there is. The coverage line is the important one: a briefing built on
 * two games and one built on twenty must not sound equally sure, and the model
 * will not volunteer the difference.
 */
async function scoutingEvidence(
  clubId: number, viewerId: string, opponentId: string,
) {
  const [armies, trackers, profile] = await Promise.all([
    getMemberMeta(opponentId).catch(() => []),
    getGrudgeTracker(viewerId, [{ id: clubId, slug: "", name: "" }]).catch(() => []),
    getProfile(opponentId).catch(() => null),
  ]);

  const head = trackers[0]?.headToHeads.find((one) => one.id === opponentId);
  const played = head?.played ?? 0;
  const withArmies = armies.reduce((n, one) => n + one.games, 0);
  const name = profile?.fullName ?? "your opponent";

  return {
    opponentName: name,
    coverage: coverageFor({ games: played, withArmies, opponentName: name }),
    headToHead: head
      ? { played: head.played, won: head.won, drawn: head.drawn, lost: head.lost,
          scoreFor: head.scoreFor, scoreAgainst: head.scoreAgainst }
      : null,
    theyBring: armies.map((one) => ({
      faction: one.label, games: one.games, won: one.wins,
      drawn: one.draws, lost: one.losses, winRate: one.winRate,
    })),
  };
}
