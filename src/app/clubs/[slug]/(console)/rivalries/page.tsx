import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import RivalryTable from "@/components/clubs/RivalryTable";
import MyRivalries from "@/components/clubs/MyRivalries";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getMyMembership } from "@/services/memberships.service";
import { getProfile } from "@/services/profiles.service";
import { getClubRivalries } from "@/services/games.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params, searchParams,
}: PageProps<"/clubs/[slug]/rivalries">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) return { title: "Club not found" };

  // The narrowed list is a different page, so the tab says so. A link to one
  // person's rivalries that reads as the club's whole list is a link that
  // arrives saying the wrong thing in somebody else's bookmarks.
  const memberId = typeof query.member === "string" ? query.member : "";
  const name = memberId ? (await getProfile(memberId).catch(() => null))?.fullName : null;

  return { title: name
    ? `${name}'s rivalries · ${club.name}`
    : `Rivalries · ${club.name}` };
}

/**
 * Who plays whom at this club.
 *
 * Members only, like the roster it sits beside: it is a list of the club's
 * people and their results, which is not a visitor's business. The function
 * behind it checks membership itself, since it reads past RLS.
 *
 * `?member=` narrows it to one person, which is what the button on their
 * profile means by "Joe's rivals": that button said one thing and landed on
 * every pairing at the club. In the address rather than in state, the same
 * call the badges list makes, so the narrowed list can be sent to somebody,
 * survives a refresh, and is undone by the back button.
 */
export default async function ClubRivalriesPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/rivalries">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/rivalries`);

  const access = await getClubAccess(club.id, viewer);
  const canManage = access.role !== null;
  const membership = await getMyMembership(club.id, viewer.id);
  if (!canManage && membership.status !== "approved") notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const everything = await getClubRivalries(club.id).catch(() => []);

  const memberId = typeof query.member === "string" ? query.member : "";
  const rivalries = memberId
    ? everything.filter((row) => row.one.id === memberId || row.two.id === memberId)
    : everything;

  // The name comes out of the rows where there are any, because both sides
  // carry it. Only a member with no pairings at all costs a second read, and
  // that is exactly the case where the heading has nothing else to say.
  const fromRows = rivalries[0]
    ? (rivalries[0].one.id === memberId ? rivalries[0].one.name : rivalries[0].two.name)
    : "";
  const memberName = !memberId ? ""
    : fromRows || (await getProfile(memberId).catch(() => null))?.fullName || "This member";
  const isSelf = memberId === viewer.id;

  const back = memberId
    ? { href: `/members/${memberId}`, label: isSelf ? "Your profile" : memberName }
    : backTarget(query.from, club);

  const games = rivalries.reduce((total, row) => total + row.played, 0);
  const level = rivalries.filter((row) => row.level && row.played > 1).length;
  const mutual = rivalries.filter((row) => row.mutual).length;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        title={memberId
          ? (isSelf ? "Your rivalries" : `${memberName.trim().split(" ")[0] || memberName}'s rivalries`)
          : "Rivalries"}
        clubName={club.name}
        clubSlug={club.slug}
        back={back}
        faction={faction}
        note={!rivalries.length ? null
          : memberId
            ? `Every pair ${isSelf ? "you have" : `${memberName} has`} a result with at ${club.name}, ranked by games played.`
            : "Ranked by games played, so the pairs who keep meeting come first."}
        stats={[
          { label: rivalries.length === 1 ? "pairing" : "pairings",
            value: String(rivalries.length), emphasis: true },
          { label: "games", value: String(games) },
          ...(level ? [{ label: "level", value: String(level) }] : []),
          // Shown even at zero, unlike the others: "0 mutual" is the answer to
          // "has anybody named each other back", and hiding it loses the
          // question as well as the answer.
          { label: "mutual", value: String(mutual) },
        ]}
      />

      {/* The way back out of the narrowing, said once above the list. Without
          it the only route to the club's own list is the browser's back
          button, which is not a control. */}
      {memberId ? (
        <Box sx={{ mb: 2.5 }}>
          <NextLink href={`/clubs/${slug}/rivalries`} style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              Show everyone at {club.name}
            </Typography>
          </NextLink>
        </Box>
      ) : null}

      {rivalries.length ? (
        <Stack spacing={3}>
          {/* Your own shortcuts, and only on the club's full list. On a list
              already narrowed to one person they are either the same rows
              again or a second person's rivalries above the first's, which is
              the ambiguity this page is being fixed for. */}
          {memberId ? null : (
            <MyRivalries slug={slug} rivalries={rivalries} viewerId={viewer.id} faction={faction} />
          )}
          <RivalryTable slug={slug} rivalries={rivalries} viewerId={viewer.id} faction={faction} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Built from table bookings and competition rounds with a result on
            them. Add the score after a game and it counts here.
          </Typography>
        </Stack>
      ) : memberId ? (
        <EmptyState
          title={isSelf ? "You have no rivalries here yet" : `${memberName} has no rivalries here yet`}
          description={`A pairing appears once two members finish a game at ${club.name} with a score on it.`}
          action={{ label: "See everyone at the club", href: `/clubs/${slug}/rivalries` }}
        />
      ) : (
        <EmptyState
          title="No rivalries yet"
          description="Book a table against another member, add the score afterwards, and the pairing appears here."
          action={{ label: "Book a table", href: `/clubs/${club.slug}/bookings` }}
        />
      )}
    </Container>
  );
}
