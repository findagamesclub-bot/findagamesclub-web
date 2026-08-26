import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { matGrid, tokens, type Faction } from "@/lib/tokens";

/**
 * The board's masthead.
 *
 * A page title over a list of cards reads as a feed. A club board is a fixed
 * thing on a wall, so it gets a header board: the club's colour as the ground,
 * the mat grid over it, the monogram punched into the corner, and the figures
 * set in mono along the foot. Everything below it is then paper pinned to it.
 */
export default function BoardMasthead({
  clubName, clubSlug, faction, monogram, threads, replies, children, back,
}: {
  clubName: string;
  clubSlug: string;
  /** Where the back link goes. Defaults to the club's own page. */
  back?: { href: string; label: string };
  faction: Faction;
  monogram: string;
  threads: number;
  replies: number;
  /** The category strip, which sits on the masthead's foot. */
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <NextLink href={back?.href ?? `/clubs/${clubSlug}`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted,
                                            "&:hover": { color: faction.base } }}>
            {back?.label ?? clubName}
          </Typography>
        </Stack>
      </NextLink>

      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 1.5,
          px: { xs: 2.5, sm: 3.5 },
          pt: { xs: 3, sm: 3.5 },
          pb: { xs: 2.5, sm: 3 },
          backgroundImage: `linear-gradient(140deg, ${faction.deep} 0%, ${faction.base} 100%)`,
        }}
      >
        <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: matGrid() }} />

        {/* Punched into the corner rather than set beside the title: it is the
            club's mark on its own board, not a logo in a header. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute", top: -18, right: -14,
            width: 132, height: 132, borderRadius: 2,
            display: "grid", placeItems: "center",
            border: "1px solid rgba(255,255,255,0.16)",
            transform: "rotate(-8deg)",
          }}
        >
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                            fontSize: "3.4rem", color: "rgba(255,255,255,0.13)",
                            lineHeight: 1 }}>
            {monogram}
          </Typography>
        </Box>

        <Stack spacing={0.5} sx={{ position: "relative" }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                            letterSpacing: "0.18em", color: "rgba(255,255,255,0.72)" }}>
            CLUB BOARD
          </Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.5rem" },
                                         lineHeight: 1.05, color: "#FFFFFF" }}>
            {clubName}
          </Typography>

          <Stack direction="row" spacing={3} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "baseline", pt: 1.25 }}>
            <Figure value={threads} label={threads === 1 ? "thread" : "threads"} />
            <Figure value={replies} label={replies === 1 ? "reply" : "replies"} />
          </Stack>
        </Stack>
      </Box>

      {children ? <Box sx={{ mt: 2 }}>{children}</Box> : null}
    </Box>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <Stack direction="row" spacing={0.9} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", fontWeight: 700,
                        color: tokens.brassOnDark, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.12em", color: "rgba(255,255,255,0.66)" }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
