"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailableOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { PerkGroup } from "@/utils/tier-benefits";
import { tokens, type Faction } from "@/lib/tokens";

/** One icon per heading, from the same set, same weight. */
const ICONS: Record<PerkGroup, typeof SavingsIcon> = {
  savings: SavingsIcon,
  access: EventAvailableIcon,
  tools: AutoAwesomeIcon,
};

/**
 * What the tier you are actually on gets you.
 *
 * The Membership section lists every tier and asks a member to find their own
 * and read it like a stranger. This is the same perks, grouped, for the one
 * tier that applies to them.
 *
 * Grouped rather than a flat list because a flat list has to be truncated, and
 * "and 14 more" tells somebody they are missing something without saying what.
 * Only the longest group folds, and it folds behind a real count.
 */
const FOLD_AFTER = 6;

export default function MembershipPerks({
  groups, tierLabel, faction,
}: {
  groups: { group: string; label: string; items: string[] }[];
  tierLabel: string;
  faction: Faction;
}) {
  // Per group, not one flag for all three. A single piece of state meant
  // opening Savings also opened Tools, which is not what the button said.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (group: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  if (!groups.length) return null;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        You are on <Box component="span" sx={{ color: faction.deep, fontWeight: 700 }}>
          {tierLabel}
        </Box>. This is what it gets you here.
      </Typography>

      <Box sx={{ display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
        {groups.map(({ group, label, items }) => {
          const Icon = ICONS[group as PerkGroup] ?? AutoAwesomeIcon;
          const folds = items.length > FOLD_AFTER;
          const open = opened.has(group);
          const head = folds ? items.slice(0, FOLD_AFTER) : items;
          const rest = folds ? items.slice(FOLD_AFTER) : [];

          return (
            <Stack key={group} spacing={1.25}
              sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.paper,
                    border: `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={0.875} sx={{ alignItems: "center" }}>
                <Icon aria-hidden sx={{ fontSize: 18, color: faction.base }} />
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                  letterSpacing: "0.12em", color: tokens.inkMuted,
                                  fontWeight: 700 }}>
                  {label.toUpperCase()}
                </Typography>
              </Stack>

              <PerkList items={head} faction={faction} />

              {folds ? (
                <>
                  <Collapse in={open}>
                    <Box sx={{ pt: 1.25 }}>
                      <PerkList items={rest} faction={faction} />
                    </Box>
                  </Collapse>
                  {/* A real count, not "more". 44px so it is a target, not a link. */}
                  <Button
                    onClick={() => toggle(group)}
                    aria-expanded={open}
                    endIcon={
                      <ExpandMoreIcon sx={{ transition: "transform 180ms ease",
                                            transform: open ? "rotate(180deg)" : "none" }} />
                    }
                    sx={{ alignSelf: "flex-start", minHeight: 44, px: 1,
                          color: faction.deep, textTransform: "none",
                          fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {open ? "Show fewer" : `${rest.length} more`}
                  </Button>
                </>
              ) : null}
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}

function PerkList({ items, faction }: { items: string[]; faction: Faction }) {
  return (
    <Stack component="ul" spacing={0.875} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {items.map((item) => (
        <Stack key={item} component="li" direction="row" spacing={0.875}
          sx={{ alignItems: "flex-start" }}>
          <CheckIcon aria-hidden
            sx={{ fontSize: 15, color: faction.base, mt: 0.35, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{item}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}
