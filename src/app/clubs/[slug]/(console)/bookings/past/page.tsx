import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PastNights from "./PastNights";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getMyMembership } from "@/services/memberships.service";
import { getPlayedLog } from "@/services/clubResults.service";
import { isPlayedSort } from "@/utils/played-log";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/bookings/past">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Nights played · ${club.name}` : "Club not found" };
}

/**
 * The nights that have already happened at this club.
 *
 * The booking calendar next door is about nights to come and shows one at a
 * time, which is right for booking a table and cannot answer "what did we
 * play in September". The client asked for the looking-back half, filtered by
 * date and by member.
 *
 * Its own page rather than a second mode on the calendar: that screen is the
 * booking desk, and a list of a thousand past tables underneath it would push
 * the thing people came for off the bottom.
 *
 * Members only, which needs saying out loud. `club_bookings_select` shows a
 * member only FUTURE bookings of other people, so this reads through 0213's
 * function with the same guard 0056 drew for one member's own record: who
 * played whom and what the score was, which is already on the club's public
 * results page.
 */
export default async function ClubPastNightsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/bookings/past">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/bookings/past`);

  const [access, membership] = await Promise.all([
    getClubAccess(club.id, viewer),
    getMyMembership(club.id, viewer.id),
  ]);
  // The same test the calendar uses to decide whether somebody may see the
  // nights at all, so one page does not open to people the other turns away.
  const isMember = access.can("bookings.manage")
    || access.can("results.manage")
    || membership.status === "approved";
  if (!isMember) notFound();

  const one = (key: string) => {
    const value = query[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };

  const order = one("sort");
  const sort = isPlayedSort(order) ? order : "newest";
  const search = one("q");
  const month = one("month");
  const member = one("member");
  const page = Number(one("page")) || 1;

  const view = await getPlayedLog(
    club.id,
    { tab: "all", sort, query: search, month, game: "", member, page },
    // The trend belongs to the club and asks `results.manage`. A member would
    // spend a round trip being refused and draw no chart either way.
    { trend: false },
  );

  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={`/clubs/${club.slug}/bookings`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2"
            sx={{ color: tokens.inkMuted, "&:hover": { color: faction.base } }}>
            Book a table
          </Typography>
        </Stack>
      </NextLink>

      <Typography variant="h1" sx={{ fontSize: { xs: "2.1rem", md: "2.75rem" }, lineHeight: 1.1 }}>
        Nights played
      </Typography>
      <Box sx={{ width: 76, height: 4, bgcolor: faction.base, borderRadius: 2, mt: 1.75, mb: 2 }} />

      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 3 }}>
        Every table at {club.name} that has already been played, and how each
        game went. Narrow it to a month, or to one person.
      </Typography>

      <PastNights slug={club.slug} faction={faction} view={view}
        filters={{ sort, query: search, month, member, page }} />
    </Container>
  );
}
