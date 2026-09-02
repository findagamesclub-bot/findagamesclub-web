// server-links-ok: only ever rendered from ClubMapView, which is a client
// component, so `component={NextLink}` never crosses the server boundary here.
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { milesLabel } from "@/utils/geo";
import { tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import type { SimilarClub } from "@/utils/similar-clubs";

/**
 * "More clubs you might like", under the map.
 *
 * Ranked by shared games first and distance second, so the reason each card is
 * here is visible on it: the game they have in common is highlighted and the
 * distance is stated. A recommendation you cannot see the reason for is just a
 * second copy of the list.
 */
export default function SimilarClubs({ items }: { items: SimilarClub[] }) {
  if (!items.length) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.14em", color: tokens.inkMuted }}>
        SIMILAR CLUBS
      </Typography>
      <Typography variant="h2" sx={{ fontSize: { xs: "1.5rem", md: "1.8rem" }, mt: 0.5 }}>
        More clubs you might like
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Closest matches from this search, by the games they share.
      </Typography>

      <Box sx={{ display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
        {items.map(({ club, sharedGames, miles }) => {
          const { faction, monogram } = clubIdentity(club.slug, club.name);
          return (
            <Stack
              key={club.slug}
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
                    {[club.city, club.neighbourhood].filter(Boolean).join(" · ").toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle1" noWrap>{club.name}</Typography>
                </Box>
              </Stack>

              {club.meetingLabel ? (
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <ScheduleIcon aria-hidden sx={{ fontSize: 15, color: tokens.brass }} />
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                    {club.meetingLabel}
                  </Typography>
                </Stack>
              ) : null}

              {/* The reason this club is here, said plainly. */}
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

              <Button
                component={NextLink}
                href={`/clubs/${club.slug}`}
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon />}
                sx={{ alignSelf: "flex-start", mt: "auto", color: tokens.ink,
                      borderColor: tokens.rule,
                      "&:hover": { borderColor: faction.base, color: faction.deep } }}
              >
                View club
              </Button>
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}
