import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import LockIcon from "@mui/icons-material/Lock";
import { display, tokens, type Faction } from "@/lib/tokens";
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
 *
 * WHICH tier opens it was in a Tooltip, which was wrong twice over. A tooltip
 * is hover, and a rule nobody can read on a phone is a rule that is not on the
 * screen, which is the same fault the hover-only Report control had. And MUI's
 * Tooltip clones its child to attach the handlers, so this Server Component
 * sent a `<span>` and the browser built a `<div>`: a hydration mismatch on the
 * club page, with every check green. The reason is a line under the row now,
 * said once rather than once per chip.
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

  // The tiers that lock something, in the order they appear, each named once.
  const locks = [...new Set(options.map((o) => o.lockedBy).filter(Boolean))] as string[];

  return (
    <Stack spacing={1.25}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {options.map((option) =>
        option.lockedBy ? (
          <Box key={option.label} sx={chip(true)}>
            <LockIcon sx={{ fontSize: 15 }} />
            {option.label}
          </Box>
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

    {locks.length ? (
      <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                        lineHeight: 1.6, color: tokens.inkMuted }}>
        {`The padlocked boards are for ${
          locks.length === 1 ? locks[0] : `${locks.slice(0, -1).join(", ")} and ${locks.at(-1)}`
        } members.`}
      </Typography>
    ) : null}
    </Stack>
  );
}
