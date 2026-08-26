import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import ClubArt from "@/components/clubs/ClubArt";
import { mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
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
export default function EventCard({ event }: { event: EventSummary }) {
  const { faction } = clubIdentity(event.club.slug, event.club.name);
  const [weekday, day, month] = event.startDate
    ? nightLabel(event.startDate).split(" ")
    : [null, null, null];

  const facts = [
    event.startTime,
    event.price,
    event.roundCount ? `${event.roundCount} rounds` : null,
  ].filter(Boolean) as string[];

  return (
    <NextLink
      href={`/clubs/${event.club.slug}/events/${event.legacyId}`}
      style={{ color: "inherit", textDecoration: "none", display: "block", height: "100%" }}
    >
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
        <Box sx={{ position: "relative" }}>
          <ClubArt
            slug={event.club.slug}
            name={event.club.name}
            image={event.image}
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
            </Stack>
          ) : null}

          <Stack direction="row" spacing={0.75}
            sx={{ position: "absolute", top: 12, right: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {event.eventType ? (
              <Chip size="small" label={event.eventType}
                sx={{ bgcolor: "rgba(255,255,255,0.92)", color: tokens.ink,
                      fontWeight: 700, fontSize: "0.68rem", textTransform: "capitalize" }} />
            ) : null}
            {!event.hasEnded && event.ticketsAvailable ? (
              <Chip size="small" icon={<ConfirmationNumberIcon sx={{ fontSize: 14 }} />}
                label={`${event.ticketsAvailable} left`}
                sx={{ bgcolor: tokens.brass, color: "#fff", fontWeight: 700, fontSize: "0.68rem",
                      "& .MuiChip-icon": { color: "#fff" } }} />
            ) : null}
          </Stack>
        </Box>

        <Stack spacing={1.25} sx={{ p: 2.25, flex: 1 }}>
          <Box>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {event.club.name.toUpperCase()}
              {event.club.city ? ` · ${event.club.city.toUpperCase()}` : ""}
            </Typography>
            <Typography variant="h4" sx={{ fontSize: "1.1rem", lineHeight: 1.25 }}>
              {event.title}
            </Typography>
          </Box>

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

          <Box sx={{ mt: "auto" }}>
            {facts.length ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", color: tokens.inkMuted,
                                pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
                {facts.join("  ·  ")}
              </Typography>
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
  );
}
