import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubArt from "./ClubArt";
import DirectoryStats from "./DirectoryStats";
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";
import type { ClubSummary } from "@/types/club";

type Props = {
  /** The whole directory, not the filtered view — these counts describe what's on offer. */
  clubs: ClubSummary[];
  total: number;
  towns: number;
};

/**
 * Directory hero.
 *
 * The homepage fans three clubs like dealt cards; repeating that here would
 * make the two pages read as one. A mosaic suits this page better: it's a
 * directory, so the opening image is the set rather than a sample.
 */
export default function DirectoryHero({ clubs, total, towns }: Props) {
  const tiles = clubs.slice(0, 6);
  const games = new Set(clubs.flatMap((c) => c.featuredGames)).size;

  return (
    <Box
      sx={{
        backgroundColor: tokens.ink,
        color: "#FFFFFF",
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px)`,
        borderBottom: `2px solid ${tokens.brassOnDark}`,
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 4, md: 6 }}
          sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}
        >
          <Stack spacing={2} sx={{ maxWidth: 620 }}>
            <Typography
              sx={{
                fontFamily: mono,
                fontSize: "0.88rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: tokens.brassOnDark,
              }}
            >
              Directory
            </Typography>

            <Typography variant="h1" sx={{ color: "#FFFFFF" }}>
              Find a club you will actually turn up to
            </Typography>

            <Typography sx={{ color: "#B9C9DD", maxWidth: 560, lineHeight: 1.6 }}>
              Tabletop and wargaming clubs across the UK. Filter by town, what they
              play, the night they meet, or how far you will travel.
            </Typography>

            <Box sx={{ pt: 0.5 }}>
              <DirectoryStats clubs={total} towns={towns} games={games} />
            </Box>
          </Stack>

          <Box
            aria-hidden
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: "repeat(3, 116px)",
              gap: 1,
              flexShrink: 0,
            }}
          >
            {tiles.map((club) => {
              const { faction, monogram } = clubIdentity(club.slug, club.name);
              return (
                <Box
                  key={club.slug}
                  sx={{
                    position: "relative",
                    borderRadius: "3px",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  <ClubArt
                    slug={club.slug}
                    name={club.name}
                    image={club.image}
                    ratio="1 / 1"
                    showPlate={false}
                  />
                  {/* The drawn fallback already carries the monogram, so a badge
                      on top of it would print the same letters twice. */}
                  {club.image ? (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 6,
                      bottom: 6,
                      fontFamily: "var(--font-display)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "#FFFFFF",
                      backgroundColor: faction.deep,
                      border: `1px solid ${tokens.brassOnDark}`,
                      borderRadius: "2px",
                      px: 0.625,
                      py: "1px",
                    }}
                  >
                    {monogram}
                  </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
