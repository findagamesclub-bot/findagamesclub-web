import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { tokens, type Faction } from "@/lib/tokens";

type Stat = { label: string; value: string; emphasis?: boolean };

/**
 * Page head for a club's own sections — the roster, the board.
 *
 * The figures sit in a mono strip under the title rather than in stat cards:
 * three numbers do not need three boxes, and the strip reads as the header of
 * a roll rather than a dashboard.
 */
export default function ClubSectionHeader({
  clubName, clubSlug, faction, stats, note, title = "Members", back,
}: {
  clubName: string;
  clubSlug: string;
  /** Where the back link goes. Defaults to the club's own page. */
  back?: { href: string; label: string };
  faction: Faction;
  stats: Stat[];
  note?: string | null;
  /** The board and the roster share this head, so it is not always "Members". */
  title?: string;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <NextLink href={back?.href ?? `/clubs/${clubSlug}`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted, "&:hover": { color: faction.base } }}>
            {back?.label ?? clubName}
          </Typography>
        </Stack>
      </NextLink>

      <Typography variant="h1" sx={{ fontSize: { xs: "2.1rem", md: "2.75rem" }, lineHeight: 1.1 }}>
        {title}
      </Typography>

      <Box sx={{ width: 76, height: 4, bgcolor: faction.base, borderRadius: 2, mt: 1.75, mb: 2 }} />

      <Stack
        direction="row"
        spacing={{ xs: 2.5, sm: 4 }}
        useFlexGap
        // useFlexGap makes `spacing` the row gap too, so a strip that wraps
        // onto a second line left a hole the size of a paragraph break.
        sx={{ flexWrap: "wrap", alignItems: "baseline", rowGap: 1.25 }}
      >
        {stats.map((s) => (
          <Stack key={s.label} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography
              sx={{
                fontFamily: "var(--font-mono)", fontSize: "1.35rem", fontWeight: 600,
                color: s.emphasis ? tokens.brass : tokens.ink, lineHeight: 1,
              }}
            >
              {s.value}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.1em",
                color: tokens.inkMuted,
              }}
            >
              {s.label.toUpperCase()}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {note ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 560 }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}
