"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { tokens, type Faction } from "@/lib/tokens";
import type { PollResult } from "@/utils/poll";

/**
 * A poll, as bars you can click.
 *
 * The bar is the control, not a chart beside a set of radio buttons — one thing
 * to read and hit, and the result appears in the same shape you voted in rather
 * than replacing the form with a different picture.
 */
export default function PollBars({
  poll, faction, busy, canVote, onVote,
}: {
  poll: PollResult;
  faction: Faction;
  busy: boolean;
  canVote: boolean;
  onVote: (optionKey: string) => void;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {poll.question}
        </Typography>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {poll.total} {poll.total === 1 ? "VOTE" : "VOTES"}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        {poll.options.map((option) => {
          const mine = poll.myVote === option.key;
          return (
            <Box
              key={option.key}
              component={canVote ? "button" : "div"}
              type={canVote ? "button" : undefined}
              disabled={canVote ? busy : undefined}
              onClick={canVote ? () => onVote(option.key) : undefined}
              aria-pressed={canVote ? mine : undefined}
              sx={{
                position: "relative",
                display: "block",
                width: "100%",
                textAlign: "left",
                font: "inherit",
                p: 0,
                overflow: "hidden",
                borderRadius: 1,
                border: `1px solid ${mine ? faction.base : tokens.rule}`,
                backgroundColor: tokens.paper,
                cursor: canVote ? "pointer" : "default",
                "&:hover": canVote ? { borderColor: faction.base } : undefined,
                "&:disabled": { opacity: 0.6, cursor: "wait" },
              }}
            >
              {/* The fill sits behind the label rather than beside it, so a
                  long answer never squeezes the bar into a sliver. */}
              <Box
                aria-hidden
                sx={{
                  position: "absolute", inset: 0, width: `${option.percent}%`,
                  backgroundColor: mine ? faction.soft : tokens.surface,
                  transition: "width 320ms ease",
                }}
              />
              <Stack direction="row" spacing={1.5}
                sx={{ position: "relative", alignItems: "center", px: 1.5, py: 1 }}>
                {mine ? (
                  <CheckIcon sx={{ fontSize: 16, color: faction.deep, flexShrink: 0 }} />
                ) : null}
                <Typography variant="body2"
                  sx={{ flex: 1, minWidth: 0, fontWeight: mine ? 600 : 400,
                        color: mine ? faction.deep : tokens.ink }}>
                  {option.label}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                                  fontWeight: 600, flexShrink: 0,
                                  color: mine ? faction.deep : tokens.inkMuted }}>
                  {option.percent}%
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      {canVote ? (
        <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
          {poll.myVote ? "Click another answer to change your vote." : "Click an answer to vote."}
        </Typography>
      ) : null}
    </Stack>
  );
}
