import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import HeadToHead from "@/components/clubs/HeadToHead";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getRivalryDetail } from "@/services/games.service";
import { clubIdentity } from "@/utils/club-identity";
import { shortDate } from "@/utils/dates";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/rivalries/[pair]">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Head to head · ${club.name}` : "Club not found" };
}

/**
 * One rivalry, in full.
 *
 * Members only, like the leaderboard it hangs off: a list of two people's
 * results is not a visitor's business. The function behind it checks membership
 * itself, since it reads past RLS.
 */
export default async function RivalryDetailPage({
  params,
}: PageProps<"/clubs/[slug]/rivalries/[pair]">) {
  const { slug, pair } = await params;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/rivalries/${pair}`);

  const canManage = club.ownerId === viewer.id || viewer.role === "admin";
  const membership = await getMyMembership(club.id, viewer.id);
  if (!canManage && membership.status !== "approved") notFound();

  // The pair arrives as "one_two". An underscore rather than a hyphen because
  // both halves are UUIDs and those are full of hyphens: splitting on one took
  // the first hyphen inside the first id and produced a pair that matched
  // nothing.
  const detail = await getRivalryDetail(club.id, pair.replace("_", ":"));
  if (!detail) notFound();

  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        title="Head to head"
        clubName={club.name}
        clubSlug={club.slug}
        back={{ href: `/clubs/${slug}/rivalries`, label: "Rivalries" }}
        faction={faction}
        note={`Every scored game between ${detail.rivalry.one.name} and ${detail.rivalry.two.name} at ${club.name}.`}
        stats={[
          { label: detail.matches.length === 1 ? "game" : "games",
            value: String(detail.matches.length) },
          { label: "record", value: detail.rivalry.record },
          { label: "intensity", value: detail.rivalry.intensity.toUpperCase() },
          // Named, not just counted. "24 POINTS AHEAD" between two people is
          // a number with nobody attached to it.
          ...(detail.rivalry.differential !== 0
            ? [{
                label: `${(detail.rivalry.differential > 0
                  ? detail.rivalry.one.name
                  : detail.rivalry.two.name).split(" ")[0]} ahead on points`,
                value: `+${Math.abs(detail.rivalry.differential)}`,
              }]
            : []),
          ...(detail.rivalry.lastPlayed
            ? [{ label: "last played",
                 value: (shortDate(detail.rivalry.lastPlayed) ?? "").toUpperCase() }]
            : []),
        ]}
      />

      <HeadToHead detail={detail} faction={faction} viewerId={viewer.id} slug={slug} />
    </Container>
  );
}
