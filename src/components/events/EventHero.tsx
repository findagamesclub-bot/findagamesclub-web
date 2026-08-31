import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubArt from "@/components/clubs/ClubArt";
import { nightLabel } from "@/utils/dates";
import { ticketsLeft } from "@/utils/tickets-left";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubEventDetail } from "@/types/event";

/** The event's own hero: art, standing, headline, and the figures under it. */
export default function EventHero({
  event, faction,
}: {
  event: ClubEventDetail;
  faction: Faction;
}) {
  const when = [
    event.startDate ? nightLabel(event.startDate) : null,
    event.startTime,
    event.endDate && event.endDate !== event.startDate ? `to ${nightLabel(event.endDate)}` : null,
  ].filter(Boolean).join(" \u00b7 ");

  const tickets = ticketsLeft(event.ticketsAvailable, true);

  const facts = [
    event.price ? { label: "entry", value: event.price } : null,
    event.roundCount ? { label: "rounds", value: String(event.roundCount) } : null,
    tickets ? { label: tickets.soldOut ? "tickets" : "tickets left",
                value: tickets.soldOut ? "None" : String(event.ticketsAvailable) } : null,
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


    </>
  );
}
