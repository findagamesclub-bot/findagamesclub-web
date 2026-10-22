import { notFound } from "next/navigation";
import NextLink from "next/link";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EventArmyMeta from "@/components/events/EventArmyMeta";
import EventMetaBreakdown from "@/components/events/EventMetaBreakdown";
import { getEventDetail } from "@/services/eventDetail.service";
import { getEventBreakdown, getEventMeta } from "@/services/meta.service";
import { getCurrentProfile } from "@/services/auth.service";
import { eventRecordsArmies } from "@/utils/event-meta";
import { mono, tokens } from "@/lib/tokens";

export async function generateMetadata(
  { params }: PageProps<"/clubs/[slug]/events/[eventId]/armies">,
) {
  const { slug, eventId } = await params;
  const event = await getEventDetail(slug, eventId, null);
  return { title: event ? `Armies at ${event.title}` : "Event not found" };
}

/**
 * Every army taken to one event.
 *
 * The event page shows a top three and stops. A fifty-player RTT is fifty
 * armies, which is four rows of cards and a pager dropped into the middle of a
 * page that already carries the noticeboard, the results, the draw, the roster
 * and the map. The client asked for the split looking at three: "what if we
 * have more than three cards ... suppose we have 50".
 *
 * Same gate as the section it comes from, so a board game night 404s here
 * rather than rendering an empty page about armies.
 */
export default async function EventArmiesPage(
  { params }: PageProps<"/clubs/[slug]/events/[eventId]/armies">,
) {
  const { slug, eventId } = await params;
  const viewer = await getCurrentProfile();
  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();

  const open = eventRecordsArmies(event.featuredGames);
  // One wave. The grouped reading and the per-army list answer two different
  // questions and neither needs the other's answer.
  const [rows, breakdown] = open
    ? await Promise.all([
        getEventMeta(event.id).catch(() => []),
        getEventBreakdown(event.id),
      ])
    : [[], { factions: [], detachments: [], dispositions: [],
             matchups: [], players: [], loaded: true }];
  if (!rows.length) notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          {/* A plain next/link wrapping the MUI bits. Handing the link to MUI
              through its `component` prop cannot work from here: a function
              does not cross the RSC boundary, and the page 500s at request
              time with every check green. Same shape as the event page's own
              back link. */}
          <NextLink href={`/clubs/${slug}/events/${eventId}`}
            style={{ textDecoration: "none" }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {event.title}
              </Typography>
            </Stack>
          </NextLink>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>
            Armies at this event
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.inkMuted }}>
            What was taken to {event.title}, from the finishing places and the draw.
          </Typography>
        </Stack>

        <EventMetaBreakdown breakdown={breakdown} />

        <Stack spacing={1.25}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            WHAT EACH PERSON BROUGHT
          </Typography>
          <EventArmyMeta rows={rows} />
        </Stack>
      </Stack>
    </Container>
  );
}
