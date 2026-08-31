import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import NextLink from "next/link";
import LockIcon from "@mui/icons-material/Lock";
import { tokens, type Faction } from "@/lib/tokens";
import type { CategoryOption } from "@/utils/discussion-categories";

/**
 * The club's board, by what people talk about.
 *
 * Each category is a link that opens the board already filtered, matching
 * legacy (detail.js:1385 with getClubV2DiscussionCategoryHref). Landing on an
 * unfiltered board and hunting for the category you just read is work the link
 * can do for you.
 *
 * A category a tier reserves is shown but not linked. Hiding it leaves a Basic
 * member with no way to learn a Premium board exists, which is the same call
 * the ticket rows make.
 */
export default function BoardCategories({
  options, slug, faction,
}: {
  options: CategoryOption[];
  slug: string;
  faction: Faction;
}) {
  if (!options.length) return null;

  const chip = (locked: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 0.625,
    // 44px targets: these are links, not decoration.
    minHeight: 40,
    px: 1.5,
    borderRadius: 1,
    border: `1px solid ${locked ? tokens.rule : faction.base}`,
    backgroundColor: locked ? tokens.surface : faction.soft,
    color: locked ? tokens.inkMuted : faction.deep,
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "0.9rem",
    transition: "background-color 140ms ease",
    ...(locked ? { cursor: "not-allowed" } : { "&:hover": { backgroundColor: faction.base, color: "#fff" } }),
  });

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {options.map((option) =>
        option.lockedBy ? (
          <Tooltip key={option.label} title={`${option.lockedBy} members only`}>
            <Box sx={chip(true)}>
              <LockIcon sx={{ fontSize: 15 }} />
              {option.label}
            </Box>
          </Tooltip>
        ) : (
          <NextLink
            key={option.label}
            href={`/clubs/${slug}/board?category=${encodeURIComponent(option.label)}`}
            style={{ textDecoration: "none" }}
          >
            <Box sx={chip(false)}>{option.label}</Box>
          </NextLink>
        ),
      )}
    </Stack>
  );
}
