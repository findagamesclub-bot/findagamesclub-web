import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EventIcon from "@mui/icons-material/Event";
import { milesLabel } from "@/utils/geo";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { nightLabel } from "@/utils/dates";
import type { SimilarEvent } from "@/utils/similar-events";

/**
 * "More events you might like".
 *
 * The same card as SimilarClubs, so the two views read as one product. Ranked
 * by shared games first and distance second, and the reason each card is here
 * is on it: a recommendation you cannot see the reason for is just a second
 * copy of the list.
 *
 * Rendered from the map, which is a Client Component, and from the bottom of
 * the search page, which is a Server Component. That second caller is why the
 * button below is wrapped in a plain next/link rather than using MUI's
 * `component` prop: passing NextLink into a client component across the server
 * boundary is not serializable, and takes the whole page down with it.
 */
export default function SimilarEvents({ items, trail = "", lede }: {
  items: SimilarEvent[];
  trail?: string;
  /** Why these are here, which differs between the map and the search page. */
  lede?: string;
}) {
  if (!items.length) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.14em", color: tokens.inkMuted }}>
        SIMILAR EVENTS
      </Typography>
      <Typography variant="h2" sx={{ fontSize: { xs: "1.5rem", md: "1.8rem" }, mt: 0.5 }}>
        More events you might like
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {lede ?? "Closest matches from this search, by the games they share."}
      </Typography>

      <Box sx={{ display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" } }}>
        {items.map(({ event, sharedGames, miles }) => {
          const { faction, monogram } = clubIdentity(event.club.slug, event.club.name);
          return (
            <Stack
              key={event.id}
              spacing={1.5}
              sx={{ p: 2.25, borderRadius: 2, bgcolor: tokens.paper,
                    border: `1px solid ${tokens.rule}`,
                    transition: "border-color 120ms ease",
                    "&:hover": { borderColor: faction.base } }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1, flexShrink: 0,
                           display: "grid", placeItems: "center",
                           bgcolor: faction.soft, color: faction.deep,
                           border: `1.5px solid ${faction.base}`,
                           fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.78rem" }}>
                  {monogram}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {[event.club.name, event.club.city].filter(Boolean).join(" · ").toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle1" noWrap>{event.title}</Typography>
                </Box>
              </Stack>

              {event.startDate ? (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <EventIcon aria-hidden sx={{ fontSize: 15, color: tokens.brass }} />
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                    {nightLabel(event.startDate)}
                    {event.startTime ? ` · ${event.startTime}` : ""}
                  </Typography>
                </Stack>
              ) : null}

              {/* The reason this event is here, said plainly. */}
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                {sharedGames.slice(0, 3).map((g) => (
                  <Chip key={g} size="small" label={g}
                    sx={{ bgcolor: faction.soft, color: faction.deep,
                          fontWeight: 600, fontSize: "0.72rem" }} />
                ))}
                {typeof miles === "number" ? (
                  <Chip size="small" variant="outlined"
                    label={milesLabel(miles)}
                    sx={{ borderColor: tokens.rule, fontSize: "0.72rem" }} />
                ) : null}
              </Stack>

              <NextLink
                href={`/clubs/${event.club.slug}/events/${event.legacyId}${trail}`}
                style={{ textDecoration: "none", marginTop: "auto", alignSelf: "flex-start" }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ color: tokens.ink, borderColor: tokens.rule,
                        "&:hover": { borderColor: faction.base, color: faction.deep } }}
                >
                  View event
                </Button>
              </NextLink>
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}
