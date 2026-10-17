import { notFound, redirect } from "next/navigation";
import MemberProfileView from "@/components/members/MemberProfileView";
import { getMemberMeta } from "@/services/meta.service";
import { getProfile } from "@/services/profiles.service";
import { getMemberContext } from "@/services/memberContext.service";
import { getMemberRecords } from "@/services/memberRecords.service";
import { getOverallRecord } from "@/services/memberOverall.service";
import { getHeldBadges } from "@/services/memberBadges.service";
import { getGrudgeTracker } from "@/services/grudgeTracker.service";
import { getGameDetails } from "@/services/gameDetails.service";
import { NO_GAME_DETAILS } from "@/utils/game-details";
import { getRivalMarks } from "@/services/clubExtras.service";
import { getCurrentProfile } from "@/services/auth.service";

export async function generateMetadata({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile ? profile.fullName : "Member not found" };
}

export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;

  // Profiles are readable by signed-in people only, matching the RLS policy in
  // migration 0001. Sending a signed-out visitor to an empty page would look
  // like the member does not exist.
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(`/members/${id}`)}`);

  const profile = await getProfile(id);
  if (!profile) notFound();

  const isSelf = viewer.id === profile.id;

  // Where they play, and how the reader has done against them. Both are
  // limited by policy to what the reader may already see.
  const [context, records, held, armies, overall] = await Promise.all([
    getMemberContext(viewer.id, profile.id)
      .catch(() => ({ clubs: [], events: [], meetings: [],
                      record: { played: 0, won: 0, drawn: 0, lost: 0 } })),
    getMemberRecords(profile.id)
      .catch(() => ({ competitions: [], podiums: [], badges: [] })),
    // What their clubs have given them, and how long they have been about.
    // Both are derived or stored elsewhere than the standings, so they ride
    // in the same wave rather than costing a round trip of their own.
    getHeldBadges(profile.id).catch(() => []),
    // What they play. Read through RLS rather than a guard: the rows already
    // say who may see them, so a reader who shares no club with them gets an
    // empty list and the panel draws nothing.
    getMemberMeta(profile.id).catch(() => []),
    // Everything they have played, across club nights, event draws and league
    // tables. One definer read rather than three, because the three tables
    // have three select policies and this is one audience.
    getOverallRecord(profile.id).catch(() => ({
      sources: [], total: { played: 0, wins: 0, draws: 0, losses: 0 }, rate: null })),
  ]);

  // Their playing record, one card per club the reader also belongs to. Read
  // through a members-only function because RLS deliberately hides other
  // people's past bookings from the table itself.
  const trackers = await getGrudgeTracker(profile.id, context.clubs)
    .catch(() => []);

  // Whether the reader has already named them, club by club, so the button on
  // each card says which of the three states it is in. Its own read rather
  // than a field on the tracker, because the tracker answers "how have they
  // done" and this answers "what have I said about them": a failure here
  // should cost the button and not the record. Nothing is read on your own
  // profile, where the button is not drawn at all.

  // What was played in those games. One read for every club on the page,
  // because the key already carries the source and the id, and it has to wait
  // for the tracker: there are no game ids to ask about until it answers.
  const played = await getGameDetails(
    trackers.flatMap((t) => t.matches.map((m) => ({ source: m.source, id: m.id }))),
  ).catch(() => NO_GAME_DETAILS);

  const rivalMarks = isSelf || !trackers.length
    ? undefined
    : await getRivalMarks(trackers.map((t) => t.club.id), viewer.id, profile.id)
        .catch(() => undefined);

  return (
    <MemberProfileView
      profile={profile}
      isSelf={isSelf}
      context={context}
      records={{ ...records, badges: [...held, ...records.badges] }}
      trackers={trackers}
      rivalMarks={rivalMarks}
      played={played}
      armies={armies}
      overall={overall}
    />
  );
}
