"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import NextLink from "next/link";
import LockIcon from "@mui/icons-material/Lock";
import { tokens, type Faction } from "@/lib/tokens";
import type { CategoryOption } from "@/utils/discussion-categories";

/**
 * Categories as links, not a select.
 *
 * A club has five to seven of them, which fits on a line, and links mean a
 * filtered board can be sent to somebody. A locked one stays visible and
 * unclickable so the tier it needs is discoverable.
 */
export default function CategoryFilter({
  options, active, slug, faction,
}: {
  options: CategoryOption[];
  active: string | null;
  slug: string;
  faction: Faction;
}) {
  // Index tabs, not pills: a board's categories are the dividers on it, so the
  // selected one joins the sheet below rather than floating over it.
  const tab = (selected: boolean) => ({
    px: 1.5,
    py: 0.9,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    fontWeight: selected ? 700 : 500,
    color: selected ? faction.deep : tokens.inkMuted,
    borderBottom: `2px solid ${selected ? faction.base : "transparent"}`,
    transition: "color 140ms ease, border-color 140ms ease",
    "&:hover": { color: faction.deep, borderBottomColor: faction.base },
  });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        gap: 0.5,
        overflowX: "auto",
        borderBottom: `1px solid ${tokens.rule}`,
        // The strip scrolls on a narrow screen rather than wrapping to three
        // rows and pushing the board off the fold.
        "&::-webkit-scrollbar": { height: 0 },
        scrollbarWidth: "none",
      }}
    >
      <Box component={NextLink} href={`/clubs/${slug}/board`}
        sx={{ ...tab(!active), textDecoration: "none" }}>
        ALL
      </Box>

      {options.map((option) =>
        option.lockedBy ? (
          <Tooltip key={option.label} title={`${option.lockedBy} members only`}>
            <Box sx={{ ...tab(false), cursor: "not-allowed", opacity: 0.55,
                       display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <LockIcon sx={{ fontSize: 13 }} />
              {option.label.toUpperCase()}
            </Box>
          </Tooltip>
        ) : (
          <Box
            key={option.label}
            component={NextLink}
            href={`/clubs/${slug}/board?category=${encodeURIComponent(option.label)}`}
            sx={{ ...tab(active === option.label), textDecoration: "none" }}
          >
            {option.label.toUpperCase()}
          </Box>
        ),
      )}
    </Box>
  );
}
