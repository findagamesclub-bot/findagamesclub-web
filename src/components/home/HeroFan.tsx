import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ClubArt from "@/components/clubs/ClubArt";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { ClubSummary } from "@/types/club";

/**
 * Offsets are small on purpose: wide ones hid every name but the front card's
 * and the group read as a dropped pile. Tight offsets read as a deck with the
 * top card face up, which is tidier and still shows three pieces of artwork.
 */
const LAYOUT = [
  { rotate: -5, x: -18, y: -14, z: 1 },
  { rotate: -2, x: -6, y: -4, z: 2 },
  { rotate: 3, x: 10, y: 8, z: 3 },
];

/**
 * Three clubs fanned like dealt cards.
 *
 * The hero needs to prove there's something behind it, and a stock photo would
 * say nothing. These are real listings with their real artwork, angled the way
 * cards land on a table.
 */
export default function HeroFan({ clubs }: { clubs: ClubSummary[] }) {
  const picks = clubs.slice(0, 3);
  if (picks.length < 3) return null;

  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        width: 400,
        height: 300,
        flexShrink: 0,
        display: { xs: "none", md: "block" },
      }}
    >
      {picks.map((club, i) => {
        const { faction } = clubIdentity(club.slug, club.name);
        const { rotate, x, y, z } = LAYOUT[i];
        return (
          <Box
            key={club.slug}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 250,
              zIndex: z,
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg)`,
              backgroundColor: tokens.paper,
              border: `1px solid ${tokens.rule}`,
              borderRadius: "3px",
              overflow: "hidden",
              boxShadow: "0 18px 40px rgba(6,14,28,0.42)",
            }}
          >
            <ClubArt slug={club.slug} name={club.name} image={club.image} ratio="16 / 10" />
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: tokens.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {club.name}
              </Typography>
              <Typography
                variant="overline"
                sx={{ color: faction.base, display: "block", lineHeight: 1.6 }}
              >
                {club.city}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
