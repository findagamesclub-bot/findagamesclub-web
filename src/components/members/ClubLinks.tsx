"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ForumIcon from "@mui/icons-material/Forum";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SchoolIcon from "@mui/icons-material/School";
import SwordsIcon from "@mui/icons-material/SportsKabaddi";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LinkPending from "@/components/ui/LinkPending";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * The rest of what a club runs.
 *
 * A tiled row rather than a stack of full-width buttons: these are all
 * secondary to booking a table, and five stacked buttons reads as a wall of
 * equal choices. Only the ones this club actually runs appear.
 */
export default function ClubLinks({
  slug, faction, hasLoyalty, hasShop, hasCoaching, hasRivalries = false,
  hasCompetitions = false,
}: {
  slug: string;
  faction: Faction;
  hasLoyalty: boolean;
  hasShop: boolean;
  hasCoaching: boolean;
  /** Somebody has played somebody. An empty leaderboard is not worth a tile. */
  hasRivalries?: boolean;
  /** The club runs a league, ladder or campaign. */
  hasCompetitions?: boolean;
}) {
  const links = [
    { href: `/clubs/${slug}/board`, label: "Board", Icon: ForumIcon, on: true },
    { href: `/clubs/${slug}/loyalty`, label: "Loyalty", Icon: MilitaryTechIcon, on: hasLoyalty },
    { href: `/clubs/${slug}/shop`, label: "Merchandise", Icon: StorefrontIcon, on: hasShop },
    { href: `/clubs/${slug}/coaching`, label: "Coaching", Icon: SchoolIcon, on: hasCoaching },
    { href: `/clubs/${slug}/rivalries`, label: "Rivalries", Icon: SwordsIcon,
      on: hasRivalries },
    // A club feature like the rest, so it belongs in the grid rather than only
    // as a section somebody has to scroll to.
    { href: `/clubs/${slug}/competitions`, label: "Competitions",
      Icon: EmojiEventsIcon, on: hasCompetitions },
  ].filter((l) => l.on);

  return (
    <Box sx={{ display: "grid", gap: 1,
               gridTemplateColumns: links.length > 2 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}>
      {links.map(({ href, label, Icon }) => (
        <Stack
          key={href}
          component={NextLink}
          href={href}
          spacing={0.5}
          sx={{
            alignItems: "center", justifyContent: "center",
            py: 1.5, px: 1, borderRadius: 1.5, textDecoration: "none",
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
            color: tokens.inkMuted,
            transition: "border-color 140ms ease, color 140ms ease, background-color 140ms ease",
            "&:hover": { borderColor: faction.base, color: faction.deep,
                         backgroundColor: faction.soft },
          }}
        >
          {/* The icon becomes the spinner, so the tile keeps its size. */}
          <LinkPending size={20}>
            <Icon sx={{ fontSize: 20 }} />
          </LinkPending>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.1em", fontWeight: 700 }}>
            {label.toUpperCase()}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}
