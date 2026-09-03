import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubArt from "@/components/clubs/ClubArt";
import { nightLabel } from "@/utils/dates";
import EventWhen from "./EventWhen";
import BestCoastButton from "./BestCoastButton";
import BestCoastLinkEditor from "./BestCoastLinkEditor";
import { ticketsLeft } from "@/utils/tickets-left";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubEventDetail } from "@/types/event";

/** The event's own hero: art, standing, headline, and the figures under it. */
export default function EventHero({
  event, faction, admin, ticketsRemaining,
}: {
  event: ClubEventDetail;
  faction: Faction;
  /** Present only for the club, and only to set the Best Coast link. */
  admin?: { slug: string; eventKey: string };
  /**
   * What is actually left, counted from the ticket types and what has sold.
   *
   * `event.ticketsAvailable` is a number the club typed once and nothing ever
   * decrements, so after four sales the hero read "50 TICKETS LEFT" beside a
   * sales panel saying "46 LEFT" — two figures for one thing on one screen.
   * Null when the event sells no typed tickets, and then the club's own number
   * is the only answer there is.
   */
  ticketsRemaining?: number | null;
}) {
  // Over the artwork this stays a glance: the day, and the second day when
  // there is one. The exact times are labelled STARTS and ENDS underneath,
  // where a reader can see which is which without parsing a run-on line.
  const spansDays = Boolean(
    event.endDate && event.startDate && event.endDate !== event.startDate,
  );
  const when = event.startDate
    ? spansDays
      ? `${nightLabel(event.startDate)} to ${nightLabel(event.endDate!)}`
      : nightLabel(event.startDate)
    : "";


  const counted = ticketsRemaining ?? event.ticketsAvailable;
  const tickets = ticketsLeft(counted, true);

  const facts = [
    event.price ? { label: "entry", value: event.price } : null,
    event.roundCount ? { label: "rounds", value: String(event.roundCount) } : null,
    // Nothing is left of an event that has been played. "50 tickets left"
    // beside a Finished badge is a number that cannot mean anything, and the
    // badge has already said what the reader needs.
    tickets && !event.hasEnded
      ? { label: tickets.soldOut ? "tickets" : "tickets left",
          value: tickets.soldOut ? "None" : String(counted) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      {/* Same treatment as the club page: the page opens with the thing, not
          with a heading above a picture of it. */}
      <Box sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden", mb: 3 }}>
        <ClubArt
          slug={event.clubSlug}
          name={event.clubName}
          image={event.image}
          ratio="21 / 9"
          showPlate={false}
        />
        <Box sx={{ position: "absolute", inset: 0,
                   background: "linear-gradient(to top, rgba(16,27,45,.82) 0%, rgba(16,27,45,.15) 55%, transparent 100%)" }} />

        <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.75 }}>
            {event.eventType ? (
              <Chip size="small" label={event.eventType}
                sx={{ bgcolor: faction.base, color: "#fff", fontWeight: 700,
                      textTransform: "capitalize" }} />
            ) : null}
            {event.hasEnded ? (
              <Chip size="small" label="Finished"
                sx={{ bgcolor: "rgba(255,255,255,.9)", color: tokens.ink, fontWeight: 600 }} />
            ) : tickets ? (
              <Chip size="small" label={tickets.label}
                sx={{ bgcolor: tickets.soldOut ? tokens.danger : tokens.brass,
                      color: "#fff", fontWeight: 700 }} />
            ) : null}
            {when ? (
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                color: "#E8EFF8", letterSpacing: "0.04em" }}>
                {when.toUpperCase()}
              </Typography>
            ) : null}
          </Stack>

          <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.6rem" },
                                         lineHeight: 1.1, color: "#FFFFFF" }}>
            {event.title}
          </Typography>
        </Box>
      </Box>

      {/* Label above value, not trailing it. "£30 ENTRY" reads as a figure and
          its unit; "Sat 26 Sep · 09:30 STARTS" buried the one word that said
          which end of the event you were looking at. */}
      <Box sx={{ mb: 2 }}>
        <EventWhen event={event} faction={faction} />
      </Box>

      {facts.length ? (
        <Stack direction="row" spacing={3} useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "baseline", mb: 1 }}>
          {facts.map((f) => (
            <Stack key={f.label} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.15rem",
                                fontWeight: 600, lineHeight: 1 }}>
                {f.value}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {f.label.toUpperCase()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}

      {/* Where the club runs registration and pairings for this tournament,
          and, for the club itself, the way to set it. The control sits beside
          the button it fills rather than on a settings screen somewhere: an
          organiser looking at an event with no link should not have to go and
          find where links are kept. */}
      <Stack direction="row" spacing={1.5} useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", mt: 1.5, mb: 1 }}>
        <BestCoastButton href={event.bestcoastLink} faction={faction} size="medium" />
        {admin ? (
          <BestCoastLinkEditor
            current={event.bestcoastLink}
            faction={faction}
            slug={admin.slug}
            eventKey={admin.eventKey}
            eventId={event.id}
          />
        ) : null}
      </Stack>
    </>
  );
}

