import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import FilterLink from "@/components/ui/FilterLink";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import BookingNight from "@/components/bookings/BookingNight";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership, getRoster } from "@/services/memberships.service";
import { getBookingCalendar, londonToday } from "@/services/bookingCalendar.service";
import { getBookingStanding } from "@/services/bookingPricing.service";
import { getClubResults } from "@/services/clubResults.service";
import ClubResults from "@/components/bookings/ClubResults";
import Section from "@/components/ui/Section";
import ScoreboardIcon from "@mui/icons-material/ScoreboardOutlined";
import { priceBooking, priceSummary } from "@/utils/booking-pricing";
import { getWaitlist } from "@/services/waitlist.service";
import { getOpenPosts } from "@/services/lookingForGames.service";
import { addDays, bookableSessions } from "@/utils/booking-sessions";
import { clubIdentity } from "@/utils/club-identity";
import { monthYear, nightLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/bookings">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Book a table · ${club.name}` : "Club not found" };
}

export default async function BookingsPage({ params, searchParams }: PageProps<"/clubs/[slug]/bookings">) {
  const { slug } = await params;
  const query = await searchParams;
  const showAll = query.all === "1";
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const viewer = await getCurrentProfile();
  const canManage = Boolean(viewer && (club.ownerId === viewer.id || viewer.role === "admin"));

  const membership = viewer
    ? await getMyMembership(club.id, viewer.id)
    : { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null };
  const isMember = canManage || membership.status === "approved";

  // Who you can name as your opponent. Typing a name records a game against
  // nobody: the head to head has no person to count it against, and the other
  // player never sees it in their own history.
  const everyone = isMember && viewer
    ? (await getRoster(club.id).catch(() => []))
        .map((member) => ({ id: member.profileId, name: member.fullName }))
    : [];
  const roster = viewer ? everyone.filter((member) => member.id !== viewer.id) : [];
  // The club's edit dialog needs the whole list, itself included: the person
  // currently on the booking has to be selectable, and an owner who is also a
  // member can be handed a table like anybody else.
  const people = canManage ? everyone : [];

  const calendar = await getBookingCalendar({
    clubId: club.id,
    clubSlug: club.slug,
    clubName: club.name,
    capacity: club.tablesAvailable ?? 0,
    viewerId: viewer?.id ?? null,
    isMember,
    canManage,
  });

  // What this member pays, as opposed to what the club advertises. The two
  // differ the moment a tier discounts a table, and only the first one is what
  // the booking will actually be written at.
  const standing = viewer && isMember
    ? await getBookingStanding(club.id, viewer.id)
    : null;
  const myPrice = standing ? priceBooking(standing) : null;

  // Only the club needs this, so only the club pays for the query.
  const played = canManage ? await getClubResults(club.id) : [];

  const today = londonToday();
  const until = addDays(today, calendar.settings?.horizonDays ?? 60);
  const [queues, posts] = isMember
    ? await Promise.all([
        getWaitlist(club.id, today, until, viewer?.id ?? null),
        getOpenPosts(club.id, today, until, viewer?.id ?? null),
      ])
    : [new Map(), new Map()];

  // Legacy shows the next `advanceBookingDates` nights and no more
  // (detail.js:1707, limitSessionsToNextAvailableDates), because that is how far
  // ahead a member can book anyway. A quarter of identical empty Thursdays is a
  // scroll with nothing in it; five months would be worse.
  const window = calendar.benefits.advanceBookingDates;
  const visible = showAll ? calendar.sessions : bookableSessions(calendar.sessions, window);
  const hiddenNights = new Set(
    calendar.sessions.slice(visible.length).map((n) => n.date)).size;

  // What every night has in common, so no row has to repeat it.
  const times = [...new Set(visible.map((n) => n.time))];
  const days = [...new Set(calendar.sessions.map((n) => n.day))];
  const nights =
    days.length === 0 ? ""
    : days.length === 1 ? `${days[0]}s`
    : days.map((d) => d.slice(0, 3)).join(", ");

  const takesBookings = Boolean(calendar.settings) && calendar.capacity > 0;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={`/clubs/${club.slug}`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted, "&:hover": { color: faction.base } }}>
            {club.name}
          </Typography>
        </Stack>
      </NextLink>

      <Typography variant="h1" sx={{ fontSize: { xs: "2.1rem", md: "2.75rem" }, lineHeight: 1.1 }}>
        Book a table
      </Typography>
      <Box sx={{ width: 76, height: 4, bgcolor: faction.base, borderRadius: 2, mt: 1.75, mb: 2 }} />

      {takesBookings ? (
        // Said once, not on every night: a weekly club repeats all of this
        // thirteen times a quarter and none of it is the reason you are here.
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem",
                          color: tokens.inkMuted, mb: 3.5, lineHeight: 1.7 }}>
          {[
            nights,
            times.length === 1 ? times[0] : null,
            // The member's own price, so the summary and the dialog agree.
            standing && myPrice
              ? priceSummary(standing, myPrice)
              : calendar.settings?.price ? `${calendar.settings.price} a table` : null,
            `${calendar.capacity} ${calendar.capacity === 1 ? "table" : "tables"}`,
            calendar.benefits.maxUpcomingBookings > 0
              ? `you can hold ${calendar.benefits.maxUpcomingBookings}` : null,
          ].filter(Boolean).join("  ·  ")}
        </Typography>
      ) : null}

      {!takesBookings ? (
        <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                                 p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
            {club.name} does not take table bookings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Turn up on the night, or get in touch with the club first.
          </Typography>
        </Stack>
      ) : !isMember ? (
        <Stack spacing={1.5} sx={{ alignItems: "flex-start", border: `1px solid ${tokens.rule}`,
                                   borderRadius: 2, p: { xs: 2.5, md: 4 }, bgcolor: tokens.paper }}>
          <LockIcon sx={{ color: tokens.inkMuted, fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
            Tables are for members of {club.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {membership.status === "pending"
              ? "Your request is with the club. You can book as soon as they approve it."
              : "Ask to join from the club page and you can book a table once they approve you."}
          </Typography>
          <NextLink href={`/clubs/${club.slug}`} style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              Back to {club.name}
            </Typography>
          </NextLink>
        </Stack>
      ) : !calendar.sessions.length ? (
        <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                                 p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>No club nights scheduled</Typography>
          <Typography variant="body2" color="text.secondary">
            Once {club.name} adds its nights, they will appear here to book.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1}>
          {visible.map((session, i) => {
            // A month rule instead of "this week / next week": a fixture list
            // is a season, and the first row is always this week anyway.
            const month = session.date.slice(0, 7);
            const newMonth = i === 0 || visible[i - 1]!.date.slice(0, 7) !== month;
            return (
              <Box key={`${session.clubSessionId}-${session.date}`}>
                {newMonth ? (
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                    letterSpacing: "0.14em", color: tokens.inkMuted,
                                    mt: i === 0 ? 0 : 2.5, mb: 1 }}>
                    {monthYear(session.date)?.toUpperCase()}
                  </Typography>
                ) : null}
                <BookingNight
                  roster={roster}
                  people={people}
                  session={session}
                  clubId={club.id}
                  slug={club.slug}
                  faction={faction}
                  standing={standing}
                  waitlistEnabled={calendar.settings?.waitlistEnabled ?? false}
                  queue={queues.get(`${session.clubSessionId}:${session.date}`) ?? []}
                  posts={posts.get(`${session.clubSessionId}:${session.date}`) ?? []}
                  lfgEnabled={calendar.settings?.lookingForGamesEnabled ?? false}
                  showTime={times.length > 1}
                  canManage={canManage}
                />
              </Box>
            );
          })}

          {hiddenNights > 0 ? (
            <Box sx={{ pt: 1.5 }}>
              <FilterLink href={`/clubs/${club.slug}/bookings?all=1`}>
                <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                  Show {hiddenNights} more {hiddenNights === 1 ? "night" : "nights"}, to{" "}
                  {nightLabel(calendar.sessions.at(-1)!.date)}
                </Typography>
              </FilterLink>
            </Box>
          ) : null}

          {showAll ? (
            <Box sx={{ pt: 1.5 }}>
              <FilterLink href={`/clubs/${club.slug}/bookings`}>
                <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                  Show fewer
                </Typography>
              </FilterLink>
            </Box>
          ) : null}
        </Stack>
      )}

      {/* The club's own view of what has been played here. Members see only
          their own games on Your games, which left a dispute between two other
          people with nobody able to reach it. */}
      {canManage && played.length ? (
        <Section title="Results" icon={ScoreboardIcon}>
          <ClubResults results={played} slug={slug} faction={faction} />
        </Section>
      ) : null}
    </Container>
  );
}
