"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubTracker } from "@/services/grudgeTracker.service";
import MonoLabel from "@/components/ui/MonoLabel";
import { PER_PAGE } from "@/utils/paging";

/** Five rivals is the shape of a club; a full list belongs on the leaderboard. */
const RIVALS = 5;
const MATCHES = PER_PAGE.rows;

/**
 * Who they play, and what happened last time.
 *
 * The rivals list links straight through to the head-to-head page rather than
 * repeating it, so this stays a summary and the detail lives in one place.
 */
export default function GrudgeOverview({
  tracker, faction, memberId,
}: {
  tracker: ClubTracker;
  faction: Faction;
  /** Whose profile this is. Half of every head-to-head link. */
  memberId: string;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(tracker.matches, MATCHES, top);
  const rivals = tracker.headToHeads.slice(0, RIVALS);

  return (
    <Stack spacing={2.5}>
      {rivals.length ? (
        <Box>
          <MonoLabel>{`Head to head leaders · ${rivals.length} of ${tracker.headToHeads.length}`}</MonoLabel>
          <Stack spacing={0}
            sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
            {rivals.map((r, i) => (
              <Box key={r.id ?? r.name}
                sx={{ display: "grid", gap: 1.5, px: 2, py: 1.25, alignItems: "baseline",
                      gridTemplateColumns: { xs: "minmax(0, 1fr) auto",
                                             sm: "minmax(0, 1fr) 88px 104px auto" },
                      borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                      backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
                <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>{r.name}</Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.84rem", fontWeight: 700,
                                  fontVariantNumeric: "tabular-nums",
                                  textAlign: { sm: "right" } }}>
                  {`${r.won}-${r.drawn}-${r.lost}`}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted,
                                  textAlign: { sm: "right" },
                                  display: { xs: "none", sm: "block" } }}>
                  {`${r.scoreFor} – ${r.scoreAgainst} PTS`}
                </Typography>
                {r.id ? (
                  <NextLink href={pairHref(tracker.club.slug, memberId, r.id)}
                    style={{ textDecoration: "none" }}>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                                      letterSpacing: "0.06em", color: tokens.brand,
                                      display: { xs: "none", sm: "block" },
                                      "&:hover": { color: faction.deep } }}>
                      HEAD TO HEAD
                    </Typography>
                  </NextLink>
                ) : <Box />}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <MonoLabel>Recent match results</MonoLabel>
        <Box ref={top}
          sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
          {paged.shown.map((m, i) => (
            <Box key={`${m.source}-${m.id}`}
              sx={{ display: "grid", gap: { xs: 0.5, sm: 1.5 }, px: 2, py: 1.5,
                    alignItems: { sm: "baseline" },
                    gridTemplateColumns: { xs: "1fr", sm: "76px minmax(0, 1fr) 96px 66px" },
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                    backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                {(shortDate(m.date) ?? "NO DATE").toUpperCase()}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{`vs ${m.opponentName}`}</Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.06em",
                                  color: tokens.inkMuted, mt: 0.25 }}>
                  {`${m.game.toUpperCase()} · ${m.source === "competition"
                    ? m.competition.toUpperCase() : "TABLE BOOKING"}`}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                                fontSize: "0.9rem", fontWeight: 700,
                                textAlign: { sm: "right" } }}>
                {`${m.myScore} – ${m.theirScore}`}
              </Typography>
              {/* Named, not only coloured: a result that reads as a green pill
                  and nothing else says nothing to a reader who cannot tell the
                  pills apart. */}
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                                textAlign: { sm: "right" },
                                color: m.outcome === "won" ? tokens.positive
                                  : m.outcome === "lost" ? tokens.danger : tokens.inkMuted }}>
                {m.outcome === "won" ? "WON" : m.outcome === "lost" ? "LOST" : "DREW"}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Pager page={paged.page} total={paged.total} noun="matches" size={MATCHES}
            onChange={paged.goTo} />
        </Box>
      </Box>
    </Stack>
  );
}

/**
 * The rivalry key is the two ids in uuid order, joined by an underscore.
 *
 * Sorted here because the database keys the pair on least/greatest, so the
 * link has to name them in the same order whichever profile it was built from.
 * A hyphen cannot separate them: a uuid is full of hyphens, so splitting on
 * one takes the first hyphen inside the first id.
 */
function pairHref(slug: string, memberId: string, rivalId: string) {
  return `/clubs/${slug}/rivalries/${[memberId, rivalId].sort().join("_")}`;
}
