import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoorList from "@/components/tickets/DoorList";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getAttendees } from "@/services/eventBookings.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget, fromParam } from "@/utils/back-link";
import { nightLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Who is coming" };

export default async function AttendeesPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/events/[eventId]/attendees">) {
  const { slug, eventId } = await params;
  const query = await searchParams;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/events/${eventId}/attendees`);

  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();
  // Booking rows are the club's alone, so this is the club's page alone.
  if (!event.canManageClub) notFound();

  const { faction } = clubIdentity(event.clubSlug, event.clubName);
  // A dashboard trail wins over the event: you came from a list, so that is
  // where "back" means. Without one, up a level is the event itself.
  const back = fromParam(query.from)
    ? backTarget(query.from, { slug: event.clubSlug, name: event.clubName })
    : { href: `/clubs/${slug}/events/${eventId}`, label: event.title };
  const attendees = await getAttendees(event.id);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={back.href} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2"
            sx={{ color: tokens.inkMuted, "&:hover": { color: faction.base } }}>
            {back.label}
          </Typography>
        </Stack>
      </NextLink>

      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>{event.clubName}</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>
          Who is coming
        </Typography>
        {event.startDate ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                            letterSpacing: "0.04em", color: tokens.inkMuted }}>
            {(nightLabel(event.startDate) ?? "").toUpperCase()}
            {event.startTime ? ` · ${event.startTime}` : ""}
          </Typography>
        ) : null}
      </Stack>

      <DoorList attendees={attendees} faction={faction} />
    </Container>
  );
}
