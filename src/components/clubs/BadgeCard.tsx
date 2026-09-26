"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import NextLink from "next/link";
import BadgeChip from "@/components/ui/BadgeChip";
import LinkPending from "@/components/ui/LinkPending";
import type { ClubBadgeRow } from "@/services/badges.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * One badge a club gives out, and the way to the people holding it.
 *
 * The count is a link rather than a figure. "1 member has it" answers half a
 * question and the owner's next one is always which member, which used to mean
 * changing tab and reading down every award the club has ever made. It opens
 * the awarded list narrowed to this badge, where taking one back already lives,
 * so seeing who has it and undoing a mistake are one press apart.
 */
export default function BadgeCard({
  badge, holdersHref, onEdit, onGive,
}: {
  badge: ClubBadgeRow;
  holdersHref: string;
  onEdit: () => void;
  onGive: () => void;
}) {
  return (
    <Stack spacing={1.5}
      sx={{ height: "100%", p: 2, borderRadius: 1.5,
            // A retired badge is a different kind of thing, not a faded version
            // of a live one: dimming alone read as a rendering glitch. Dashed
            // and unpainted says "this is not in use" the way an empty state
            // does.
            border: badge.active
              ? `1px solid ${tokens.rule}`
              : `1px dashed ${tokens.rule}`,
            backgroundColor: badge.active ? tokens.paper : tokens.surface }}>
      <Stack direction="row" spacing={1} useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <BadgeChip label={badge.label} icon={badge.icon} tone={badge.tone} />
        {badge.active ? null : (
          <Typography sx={{ fontFamily: mono, fontSize: "0.58rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted,
                            border: `1px solid ${tokens.rule}`, borderRadius: 0.75,
                            px: 0.75, py: 0.25 }}>
            RETIRED
          </Typography>
        )}
      </Stack>
      {badge.description ? (
        <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
          {badge.description}
        </Typography>
      ) : null}

      <Box sx={{ flex: 1 }} />
      {/* Stacked, not side by side. At three columns a card is about 290px, and
          a count beside two buttons left the text wrapping mid-phrase: "Nobody
          has / it yet". The figure gets its own line and the buttons line up
          across the row. */}
      <Stack spacing={1.25}
        sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
        {/* How many hold it is the figure somebody came for, so the number
            carries the weight and the noun stays quiet. Never a bare 0: a badge
            nobody holds says so in words and is not a link to an empty list. */}
        {badge.awarded > 0 ? (
          <Box component={NextLink} href={holdersHref} scroll={false}
            aria-label={`See who holds ${badge.label}`}
            sx={{ position: "relative", display: "block", borderRadius: 1,
                  // Bleeds into the card's own padding so the hit area is the
                  // width of the card rather than the width of the words.
                  mx: -1, px: 1, textDecoration: "none", color: "inherit",
                  "&:hover": { backgroundColor: tokens.brassSoft } }}>
            <LinkPending overlay size={16}>
              <Box component="span"
                sx={{ display: "flex", alignItems: "center", gap: 0.75,
                      minHeight: 44 }}>
                <Typography component="span"
                  sx={{ fontFamily: mono, fontSize: "1.05rem", fontWeight: 700,
                        color: tokens.brass, lineHeight: 1 }}>
                  {badge.awarded}
                </Typography>
                <Typography component="span"
                  sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
                  {badge.awarded === 1 ? "member has it" : "members have it"}
                </Typography>
                <Box component="span" sx={{ flex: 1 }} />
                <ChevronRightIcon aria-hidden
                  sx={{ fontSize: 18, color: tokens.inkMuted }} />
              </Box>
            </LinkPending>
          </Box>
        ) : (
          <Typography sx={{ display: "flex", alignItems: "center", minHeight: 44,
                            fontFamily: mono, fontSize: "0.7rem",
                            color: tokens.inkMuted }}>
            Nobody has it yet
          </Typography>
        )}

        <Stack direction="row" spacing={0.5}
          sx={{ justifyContent: "flex-end", alignItems: "center" }}>
          <Button variant="text" size="small" onClick={onEdit}>Edit</Button>
          {/* Only a badge still being given out. Retiring one is how a club
              stops offering it without taking it off anybody. */}
          {badge.active ? (
            <Button variant="outlined" size="small" onClick={onGive}>
              Give it out
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}
