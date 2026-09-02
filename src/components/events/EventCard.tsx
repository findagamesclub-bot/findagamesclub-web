import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import Button from "@mui/material/Button";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import PlaceIcon from "@mui/icons-material/Place";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkPending from "@/components/ui/LinkPending";
import ClubArt from "@/components/clubs/ClubArt";
import ClubLogo from "@/components/clubs/ClubLogo";
import FacilityChips from "@/components/clubs/FacilityChips";
import NotifySimilarButton from "./NotifySimilarButton";
import BestCoastButton from "./BestCoastButton";
import { mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
import { ticketsLeft } from "@/utils/tickets-left";
import type { EventSummary } from "@/types/eventList";

/**
 * One event, as a card.
 *
 * No event in the directory has artwork of its own, so the card borrows the
 * club's — which is honest, since it is that club's hall the event runs in —
 * and lands the date on top of it as a tile. The alternative was nineteen
 * identical grey rows, which is what the old app has.
 *
 * The winner strip is the point of the whole thing. A finished tournament's
 * result is the reason anyone opens it, and it was buried a page deep before.
 */
export default function EventCard({
  event, canSaveAlert = false, trail = "",
}: {
  event: EventSummary;
  /** Query string that sends the event's back arrow to this search. */
  trail?: string;
  /** Signed out, the notify dialog explains itself rather than disappearing. */
  canSaveAlert?: boolean;
}) {
  const { faction } = clubIdentity(event.club.slug, event.club.name);
  const [weekday, day, month] = event.startDate
    ? nightLabel(event.startDate).split(" ")
    : [null, null, null];

  // A two-day tournament showed one day and said nothing about the second.
  const spansDays = Boolean(
    event.endDate && event.startDate && event.endDate !== event.startDate,
  );
  const [endWeekday, endDay, endMonth] = spansDays ? nightLabel(event.endDate!).split(" ") : [];

  // A one-hour demo and a full day looked identical with only a start time.
  const when = event.startTime
    ? event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime
    : null;

  const facts = [
    // Two days is a different proposition from an evening, so it leads.
    spansDays ? `${nightLabel(event.startDate!)} to ${nightLabel(event.endDate!)}` : null,
    when,
    // "From £24" rather than "£24": four ticket types is common.
    event.fromPrice ? `From ${event.fromPrice}` : null,
    event.roundCount ? `${event.roundCount} rounds` : null,
  ].filter(Boolean) as string[];

  // The event often runs somewhere other than the club's usual hall, so the
  // town alone does not answer "can I get there".
  const place = [event.venue.name, event.venue.postcode].filter(Boolean).join(" · ");
  const tickets = ticketsLeft(event.ticketsAvailable);

  return (
    <Stack
      sx={{
        height: "100%",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: tokens.paper,
        border: `1px solid ${tokens.rule}`,
        transition: "border-color 120ms ease, transform 120ms ease",
        "&:hover": { borderColor: faction.base, transform: "translateY(-2px)" },
      }}
    >
    <NextLink
      href={`/clubs/${event.club.slug}/events/${event.legacyId}${trail}`}
      style={{ color: "inherit", textDecoration: "none", display: "flex",
               flexDirection: "column", flex: 1 }}
    >
      <Stack
        sx={{
          height: "100%",
        }}
      >
        <Box sx={{ position: "relative" }}>
          <ClubArt
            slug={event.club.slug}
            name={event.club.name}
            image={event.image}
            backdrop={event.club.logoUrl}
            ratio="16 / 9"
            showPlate={false}
          />

          {/* Finished events sit under a wash so a page of past events reads as
              history at a glance, without greying out the artwork entirely. */}
          {event.hasEnded ? (
            <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(16,27,45,0.42)" }} />
          ) : null}

          {day ? (
            <Stack
              sx={{
                position: "absolute", top: 12, left: 12,
                alignItems: "center", px: 1.25, py: 0.75, borderRadius: 1.5,
                bgcolor: event.hasEnded ? "rgba(16,27,45,0.85)" : faction.base,
                color: "#FFFFFF", minWidth: 52,
                boxShadow: "0 2px 8px rgba(16,27,45,.3)",
              }}
            >
              <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.1em", opacity: 0.9 }}>
                {weekday?.toUpperCase()}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "1.3rem", fontWeight: 700, lineHeight: 1.05 }}>
                {day}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.65rem", letterSpacing: "0.08em", opacity: 0.9 }}>
                {month?.toUpperCase()}
              </Typography>
              {spansDays ? (
                <>
                  <Box aria-hidden sx={{ width: 14, height: "1px", my: 0.4,
                                         bgcolor: "rgba(255,255,255,0.55)" }} />
                  {/* The weekday again, so the tile reads as a span rather than
                      two loose numbers. */}
                  <Typography sx={{ fontFamily: mono, fontSize: "0.58rem",
                                    letterSpacing: "0.1em", opacity: 0.9 }}>
                    {endWeekday?.toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.05 }}>
                    {endDay}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                                    letterSpacing: "0.08em", opacity: 0.9 }}>
                    {endMonth?.toUpperCase()}
                  </Typography>
                </>
              ) : null}
            </Stack>
          ) : null}

          <Stack direction="row" spacing={0.75}
            sx={{ position: "absolute", top: 12, right: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {event.eventType ? (
              <Chip size="small" label={event.eventType}
                sx={{ bgcolor: "rgba(255,255,255,0.92)", color: tokens.ink,
                      fontWeight: 700, fontSize: "0.68rem", textTransform: "capitalize" }} />
            ) : null}
            {!event.hasEnded && tickets ? (
              <Chip size="small" icon={<ConfirmationNumberIcon sx={{ fontSize: 14 }} />}
                label={tickets.label}
                sx={{ bgcolor: tickets.soldOut ? tokens.danger : tokens.brass,
                      color: "#fff", fontWeight: 700, fontSize: "0.68rem",
                      "& .MuiChip-icon": { color: "#fff" } }} />
            ) : null}
          </Stack>
        </Box>

        <Stack spacing={1.25} sx={{ p: 2.25, flex: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
            {/* Whose hall this runs in, as a mark. Nineteen events across nine
                clubs read as one list without it. */}
            <ClubLogo slug={event.club.slug} name={event.club.name}
              logoUrl={event.club.logoUrl} size={38} ring={tokens.rule} />
            <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {event.club.name.toUpperCase()}
              {event.club.city ? ` · ${event.club.city.toUpperCase()}` : ""}
            </Typography>
            <Typography variant="h4" sx={{ fontSize: "1.1rem", lineHeight: 1.25 }}>
              {event.title}
            </Typography>
            </Box>
          </Stack>

          {place ? (
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "flex-start" }}>
              <PlaceIcon aria-hidden sx={{ fontSize: 16, color: tokens.brass, mt: 0.2, flexShrink: 0 }} />
              <Typography variant="body2"
                sx={{ fontSize: "0.84rem", color: tokens.inkMuted, minWidth: 0 }}>
                {place}
              </Typography>
            </Stack>
          ) : null}

          {event.summary ? (
            <Typography variant="body2" color="text.secondary"
              sx={{ fontSize: "0.88rem", display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {event.summary}
            </Typography>
          ) : null}

          {event.featuredGames.length ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              {event.featuredGames.slice(0, 2).map((g) => (
                <Chip key={g} size="small" label={g}
                  sx={{ bgcolor: faction.soft, color: faction.deep,
                        fontWeight: 600, fontSize: "0.72rem" }} />
              ))}
            </Stack>
          ) : null}

          {/* Labelled, as on the club card. */}
          {event.facilities.length ? (
            <FacilityChips values={event.facilities.slice(0, 3)} />
          ) : null}

          <Box sx={{ mt: "auto" }}>
            {/* Flex, not inline spans: JSX renders no whitespace between
                siblings, so the browser had nowhere to break the line and the
                last fact ran off the card. */}
            {facts.length ? (
              <Box sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}`,
                         display: "flex", flexWrap: "wrap", alignItems: "baseline" }}>
                {facts.map((fact, i) => (
                  <Typography key={fact} component="span"
                    sx={{
                      fontFamily: mono, fontSize: "0.78rem", color: tokens.inkMuted,
                      // Each fact keeps its own separator in front of it, so a
                      // wrap moves the dot down with the text it belongs to.
                      "&::before": i === 0 ? undefined : { content: '"·"', mx: 0.9, opacity: 0.7 },
                      whiteSpace: "nowrap",
                    }}>
                    {fact}
                  </Typography>
                ))}
              </Box>
            ) : null}

            {event.winner ? (
              <Stack direction="row" spacing={0.875}
                sx={{ mt: 1.25, px: 1.25, py: 0.875, borderRadius: 1.5,
                      bgcolor: tokens.brassSoft, alignItems: "center" }}>
                <EmojiEventsIcon sx={{ fontSize: 17, color: "#5c4310", flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontSize: "0.82rem", color: "#5c4310", minWidth: 0 }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{event.winner.name}</Box>
                  {event.winner.army ? ` won with ${event.winner.army}` : " won"}
                </Typography>
              </Stack>
            ) : null}
          </Box>
        </Stack>
      </Stack>
    </NextLink>

      {/* Outside the card-wide link: a link inside a link is invalid, and the
          browser picks one of them for you. */}
      <Stack direction="row" spacing={1} useFlexGap
        sx={{ flexWrap: "wrap", px: 2.25, pb: 2.25, pt: 0 }}>
        {/* Wrapped in a plain next/link rather than `component={NextLink}`:
            this is a Server Component and MUI's `component` prop cannot cross
            that boundary. Same pattern as ClubCard. */}
        <NextLink href={`/clubs/${event.club.slug}/events/${event.legacyId}${trail}`}
          style={{ textDecoration: "none" }}>
          <Button
            size="small"
            variant="contained"
            endIcon={
              <LinkPending size={16} colour="#fff">
                <ArrowForwardIcon sx={{ fontSize: 17 }} />
              </LinkPending>
            }
            sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}
          >
            View event
          </Button>
        </NextLink>
        {!event.hasEnded ? (
          <NotifySimilarButton event={event} canSave={canSaveAlert} />
        ) : null}
        {/* Where the club runs registration and pairings. Subordinate to
            "View event", which is the filled one. */}
        <BestCoastButton href={event.bestcoastLink} faction={faction} />
      </Stack>
    </Stack>
  );
}
