"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ArmyListDialog from "@/components/events/ArmyListDialog";
import Pager from "@/components/ui/Pager";
import { listFromSnapshot } from "@/utils/army-snapshot";
import { usePagedList } from "@/hooks/usePagedList";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionStanding } from "@/types/competition";
import { PER_PAGE } from "@/utils/paging";

const HEAD = ["", "Player", "Faction", "Record", "Pts"];

/** A league table's worth of rows. Ranks stay continuous across pages. */
const ROWS_PER_PAGE = PER_PAGE.rows;

/**
 * The league table.
 *
 * Figures are mono and right-aligned so a column of scores reads as a column.
 *
 * The faction column carries the whole answer to "what is this person
 * playing": the army, the detachment under it, and the list itself behind a
 * button (0194). The list opens in the dialog a placing and a table of the
 * draw already use, so the four places a reader meets an army list on this
 * site all behave the same way. It is read-only there, because what it shows
 * is the frozen copy taken when the row was saved rather than whatever the
 * list has become since.
 */
export default function CompetitionStandings({
  standings, faction,
}: {
  standings: CompetitionStanding[];
  faction: Faction;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(standings, ROWS_PER_PAGE, top);
  const [open, setOpen] = useState<CompetitionStanding | null>(null);

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
                      {/* The disposition rides with the detachment it belongs
                          to, on one line: two lines of grey under a name is a
                          column doing more than the eye is reading. */}
                      {entry.detachment ? (
                        <Typography sx={{ fontSize: "0.76rem", color: tokens.inkMuted }}>
                          {[entry.detachment, entry.disposition]
                            .filter(Boolean).join(" · ")}
                        </Typography>
                      ) : null}
                      {/* Only where there is one, and never a disabled button
                          beside the rows that have none: a league is mostly
                          people who did not save a list, and a column of dead
                          controls reads as a feature that is broken rather
                          than one nobody used. */}
                      {entry.listName ? (
                        <Button variant="text" size="small"
                          onClick={() => setOpen(entry)}
                          sx={{ px: 0, minWidth: 0, fontSize: "0.76rem",
                                justifyContent: "flex-start",
                                color: faction.deep, textDecoration: "underline",
                                "&:hover": { background: "none" } }}>
                          {entry.listName}
                        </Button>
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

    <ArmyListDialog
      open={open !== null}
      onClose={() => setOpen(null)}
      player={open?.memberName ?? ""}
      faction={faction}
      army={open ? {
        factionLabel: open.faction,
        detachment: open.detachment,
        disposition: open.disposition,
        mvpUnits: [],
        list: listFromSnapshot(open.listSnapshot, {
          id: open.listId, name: open.listName,
        }),
      } : null}
    />
    </Box>
  );
}
