"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import FilterLink from "@/components/ui/FilterLink";
import { tokens, type Faction } from "@/lib/tokens";

export type CategoryOption = {
  label: string;
  /** Set when a tier gates the category, naming the tier that opens it. */
  lockedBy: string | null;
};

/** How many fit before the row starts to read as a wall. */
const VISIBLE = 12;

/**
 * The board's categories.
 *
 * A wrapping row, not a scrolling tab strip. The strip put whatever came after
 * the sixth category off the right-hand edge, which is where the locked ones
 * sit: a Basic member never saw the padlock that exists to tell them a tier
 * they do not hold is there. A club can define any number of these, so the
 * control has to survive twenty of them without hiding nineteen.
 */
export default function CategoryFilter({
  options, active, slug, faction, search,
}: {
  options: CategoryOption[];
  active: string | null;
  slug: string;
  faction: Faction;
  /** Carried across so changing category does not throw the search away. */
  search?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const href = (category: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    const query = params.toString();
    return `/clubs/${slug}/board${query ? `?${query}` : ""}`;
  };

  // A locked one is never hidden behind "show more": it is the one somebody
  // has to see to learn that upgrading would open it.
  const locked = options.filter((o) => o.lockedBy);
  const open = options.filter((o) => !o.lockedBy);
  const hidden = expanded ? 0 : Math.max(0, open.length - VISIBLE);
  const shown = [...(hidden ? open.slice(0, VISIBLE) : open), ...locked];

  const chip = (label: string, isActive: boolean) => ({
    px: 1.5, height: 38, display: "inline-flex", alignItems: "center", gap: 0.75,
    borderRadius: 19, fontSize: "0.875rem", fontWeight: isActive ? 700 : 500,
    border: "1px solid", whiteSpace: "nowrap" as const,
    backgroundColor: isActive ? faction.base : "transparent",
    borderColor: isActive ? faction.base : tokens.rule,
    color: isActive ? "#FFFFFF" : tokens.ink,
    transition: "background-color 140ms ease, border-color 140ms ease",
    "&:hover": isActive ? {} : { backgroundColor: faction.soft, borderColor: faction.base },
  });

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <FilterLink href={href("")}>
          <Box sx={{ ...chip("All", !active), cursor: "pointer" }}>All</Box>
        </FilterLink>

        {shown.map((option) =>
          option.lockedBy ? (
            <Tooltip key={option.label} title={`${option.lockedBy} members only`}>
              {/* Not a link: it would refuse on arrival. The padlock and the
                  tooltip say why, which is more use than a dead click. */}
              <Box
                aria-disabled
                sx={{
                  ...chip(option.label, false),
                  cursor: "not-allowed", color: tokens.inkMuted,
                  borderStyle: "dashed", "&:hover": {},
                }}
              >
                <LockIcon sx={{ fontSize: 15 }} />
                {option.label}
              </Box>
            </Tooltip>
          ) : (
            <FilterLink key={option.label} href={href(option.label)}>
              <Box sx={{ ...chip(option.label, active === option.label), cursor: "pointer" }}>
                {option.label}
              </Box>
            </FilterLink>
          ),
        )}

        {hidden ? (
          <Button size="small" variant="text" onClick={() => setExpanded(true)}
            sx={{ height: 38, borderRadius: 19, color: tokens.inkMuted, fontWeight: 600 }}>
            {`${hidden} more`}
          </Button>
        ) : null}
      </Stack>

      {/* Beside the padlock rather than at the foot of the page, where it was
          answering a question nobody had got to yet. */}
      {locked.length ? (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <LockIcon sx={{ fontSize: 14, color: tokens.inkMuted }} />
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            {locked.length === 1
              ? `${locked[0].label} is open to ${locked[0].lockedBy} members.`
              : `${locked.length} categories are open to higher tiers only.`}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
