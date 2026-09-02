"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { initialsOf } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import MemberAdmin from "./MemberAdmin";
import { EXPIRING_DAYS, type RenewalRow as Row } from "@/utils/renewal-filter";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * One membership, as a card.
 *
 * A grid rather than full-width rows, matching Merchandise and Coaching: a
 * club scanning for who to chase is comparing cards, and a row stretched
 * across a wide screen puts the name and the state a foot apart.
 *
 * The state is said in words rather than left as a date to work out. "Lapsed 5
 * days ago" is a job; "Paid to 26 Sep" is not.
 */
export default function RenewalRow({
  row, slug, tiers, faction,
}: {
  row: Row;
  slug: string;
  tiers: MembershipTier[];
  faction: Faction;
}) {
  const state = stateOf(row);

  return (
    <Stack
      sx={{
        height: "100%", borderRadius: 2, overflow: "hidden",
        backgroundColor: tokens.paper,
        border: `1px solid ${state.urgent ? state.tone : tokens.rule}`,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "center" }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                   display: "grid", placeItems: "center",
                   backgroundColor: tokens.surface,
                   border: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                            color: tokens.inkMuted }}>
            {initialsOf(row.member.fullName)}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NextLink href={`/members/${row.member.profileId}`} style={{ textDecoration: "none" }}>
            <Typography variant="subtitle2" noWrap
              sx={{ color: tokens.ink, "&:hover": { textDecoration: "underline" } }}>
              {row.member.fullName}
            </Typography>
          </NextLink>
          <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.66rem",
                                   letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {row.tierLabel.toUpperCase()}
            {row.cadence ? ` · ${row.cadence.toUpperCase()}` : ""}
            {row.lastPrice ? ` · ${row.lastPrice}` : ""}
          </Typography>
        </Box>

        {row.member.requestedTierKey ? (
          <Chip size="small" label="Tier asked"
            sx={{ fontSize: "0.62rem", height: 20, flexShrink: 0,
                  backgroundColor: tokens.brassSoft, color: "#5c4310" }} />
        ) : null}
      </Stack>

      {/* The same dialog the roster carries, not a link back to it. This page
          IS the chasing list, so the club is one click from "Due in 29 days"
          to recording the payment that clears it. */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <MemberAdmin
          membershipId={row.member.membershipId}
          slug={slug}
          memberName={row.member.fullName}
          tierKey={row.member.tierKey}
          requestedTierKey={row.member.requestedTierKey}
          tierRequestedAt={row.member.tierRequestedAt}
          tiers={tiers}
          standing={row.standing}
          payments={row.payments}
          faction={faction}
          showStatus={false}
        />
      </Box>

      <Stack direction="row" spacing={1.5}
        sx={{ mt: "auto", px: 2, py: 1.5, alignItems: "baseline",
              justifyContent: "space-between",
              borderTop: `1px solid ${tokens.rule}`,
              backgroundColor: state.urgent ? state.wash : tokens.surface }}>
        <Typography variant="body2"
          sx={{ color: state.tone, fontWeight: state.urgent ? 700 : 500 }}>
          {state.label}
        </Typography>

        {row.paidThrough && !row.free ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted,
                            flexShrink: 0 }}>
            {`TO ${(shortDate(row.paidThrough) ?? "").toUpperCase()}`}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

/** Two clubs read the same row differently, so the wording does the deciding. */
function stateOf(row: Row): { label: string; tone: string; wash: string; urgent: boolean } {
  const quiet = { tone: tokens.inkMuted, wash: tokens.surface, urgent: false };
  const bad = { tone: tokens.danger, wash: "#FBE9E7", urgent: true };
  const soon = { tone: "#5c4310", wash: tokens.brassSoft, urgent: true };

  if (row.free) return { label: "Nothing to pay", ...quiet };

  // Before the never-paid check: a one-off carries no period end, so it looks
  // exactly like somebody who has paid nothing until you ask this.
  if (row.settled) return { label: "Paid once, no renewal", ...quiet };

  // Not "Never paid": somebody moved to a new tier may well have paid on the
  // old one, and money does not carry across. This is true either way.
  if (row.paidThrough === null) return { label: "Nothing paid on this tier", ...bad };

  if (row.overdue) {
    const days = Math.abs(row.daysLeft ?? 0);
    return {
      label: days === 0 ? "Lapsed today" : `Lapsed ${days} day${days === 1 ? "" : "s"} ago`,
      ...bad,
    };
  }

  const days = row.daysLeft ?? 0;
  if (days <= EXPIRING_DAYS) {
    return { label: days === 0 ? "Due today" : `Due in ${days} days`, ...soon };
  }
  return { label: "Paid up", tone: tokens.positive, wash: tokens.surface, urgent: false };
}
