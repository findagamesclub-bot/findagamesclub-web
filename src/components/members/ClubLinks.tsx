"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ForumIcon from "@mui/icons-material/Forum";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SchoolIcon from "@mui/icons-material/School";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * The rest of what a club runs.
 *
 * A tiled row rather than a stack of full-width buttons: these are all
 * secondary to booking a table, and five stacked buttons reads as a wall of
 * equal choices. Only the ones this club actually runs appear.
 */
export default function ClubLinks({
  slug, faction, hasLoyalty, hasShop, hasCoaching,
}: {
  slug: string;
  faction: Faction;
  hasLoyalty: boolean;
  hasShop: boolean;
  hasCoaching: boolean;
}) {
  const links = [
    { href: `/clubs/${slug}/board`, label: "Board", Icon: ForumIcon, on: true },
    { href: `/clubs/${slug}/loyalty`, label: "Loyalty", Icon: MilitaryTechIcon, on: hasLoyalty },
    { href: `/clubs/${slug}/shop`, label: "Club kit", Icon: StorefrontIcon, on: hasShop },
    { href: `/clubs/${slug}/coaching`, label: "Coaching", Icon: SchoolIcon, on: hasCoaching },
  ].filter((l) => l.on);

  return (
    <Box sx={{ display: "grid", gap: 1,
               gridTemplateColumns: links.length > 2 ? "repeat(2, 1fr)" : "1fr" }}>
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
          <Icon sx={{ fontSize: 20 }} />
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.1em", fontWeight: 700 }}>
            {label.toUpperCase()}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}
