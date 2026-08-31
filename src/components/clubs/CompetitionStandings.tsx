"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionStanding } from "@/types/competition";

const HEAD = ["", "Player", "Faction", "Record", "Pts"];

/** A league table's worth of rows. Ranks stay continuous across pages. */
const ROWS_PER_PAGE = 25;

/**
 * The league table.
 *
 * Figures are mono and right-aligned so a column of scores reads as a column.
 * The faction column is text: legacy links it to a stored army list, which
 * needs the army builder, so that link is Milestone 3.
 */
export default function CompetitionStandings({
  standings, faction,
}: {
  standings: CompetitionStanding[];
  faction: Faction;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(standings, ROWS_PER_PAGE, top);

  if (!standings.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Standings appear here once results start coming in.
      </Typography>
    );
  }

  return (
    <Box ref={top}>
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
        <Box component="thead">
          <Box component="tr">
            {HEAD.map((head, i) => (
              <Box component="th" key={head || i}
                sx={{ textAlign: i > 2 ? "right" : "left", py: 0.75,
                      borderBottom: `1px solid ${tokens.rule}`,
                      fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                      letterSpacing: "0.1em", color: tokens.inkMuted,
                      textTransform: "uppercase", whiteSpace: "nowrap",
                      ...(i === 0 ? { width: 34 } : {}) }}>
                {head}
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="tbody">
          {paged.shown.map((entry) => {
            const leads = entry.rank === 1;
            return (
              <Box component="tr" key={`${entry.rank}-${entry.memberName}`}>
                <Box component="td" sx={{ py: 1.1, borderBottom: `1px solid ${tokens.rule}` }}>
                  {/* The leader is the one fact people look for, so it is a
                      mark rather than a number in a row of numbers. */}
                  <Box sx={{ width: 24, height: 24, borderRadius: "50%",
                             display: "grid", placeItems: "center",
                             fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                             backgroundColor: leads ? tokens.brass : faction.soft,
                             color: leads ? "#fff" : faction.deep }}>
                    {entry.rank || "-"}
                  </Box>
                </Box>

                <Box component="td" sx={{ py: 1.1, pr: 1.5,
                                          borderBottom: `1px solid ${tokens.rule}` }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entry.memberName}
                  </Typography>
                  {entry.notes ? (
                    <Typography sx={{ fontSize: "0.76rem", color: tokens.inkMuted }}>
                      {entry.notes}
                    </Typography>
                  ) : null}
                </Box>

                <Box component="td" sx={{ py: 1.1, pr: 1.5,
                                          borderBottom: `1px solid ${tokens.rule}` }}>
                  {entry.faction ? (
                    <>
                      <Typography variant="body2">{entry.faction}</Typography>
                      {entry.detachment ? (
                        <Typography sx={{ fontSize: "0.76rem", color: tokens.inkMuted }}>
                          {entry.detachment}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>—</Typography>
                  )}
                </Box>

                <Box component="td" sx={{ py: 1.1, textAlign: "right", whiteSpace: "nowrap",
                                          borderBottom: `1px solid ${tokens.rule}` }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.84rem" }}>
                    {entry.recordLabel}
                  </Typography>
                </Box>

                <Box component="td" sx={{ py: 1.1, pl: 1.5, textAlign: "right",
                                          borderBottom: `1px solid ${tokens.rule}` }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700 }}>
                    {entry.points}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>

    <Pager page={paged.page} total={paged.total} noun="players"
      size={ROWS_PER_PAGE} onChange={paged.goTo} />
    </Box>
  );
}
