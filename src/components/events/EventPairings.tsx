"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import ArmyListDialog from "./ArmyListDialog";
import MatchDetailDialog, { type MatchDetail } from "./MatchDetailDialog";
import PairingTable from "./PairingTable";
import { armySummary } from "@/utils/army-snapshot";
import { fold } from "@/utils/text";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventPairing, ResultArmy } from "@/types/event";

/** Above this a tournament is big enough that scanning for a name is the job. */
const SEARCHABLE = 12;

/**
 * Who is on which table, round by round.
 *
 * Rounds are collapsed because a six-round tournament with twenty tables is a
 * hundred and twenty pairings, and only one round is live at a time. The last
 * round published opens first: it is the one everybody is looking for.
 *
 * Searchable, because the real question is never "list the pairings", it is
 * "where am I playing", and the reader's own row is marked so they can stop
 * reading once they find it.
 */
export default function EventPairings({
  pairings, faction, viewerName,
}: {
  pairings: EventPairing[];
  faction: Faction;
  /** Marks the reader's own table. Names are all a pairing carries. */
  viewerName: string | null;
}) {
  const [query, setQuery] = useState("");
  // Deferred so the list keeps the last result while the next one is worked
  // out, and the overlay says so. Every other search in the app behaves this
  // way and a reader should not have to learn a second one.
  const settled = useDeferredValue(query);
  const busy = settled !== query;
  const needle = fold(settled);
  const me = viewerName ? fold(viewerName) : "";

  const total = pairings.reduce((sum, round) => sum + round.matches.length, 0);
  const [open, setOpen] = useState<number | false>(pairings.length - 1);
  const [list, setList] = useState<{ player: string; army: ResultArmy } | null>(null);
  const [game, setGame] = useState<MatchDetail | null>(null);

  const rounds = useMemo(() => pairings.map((round) => ({
    ...round,
    matches: needle
      ? round.matches.filter((m) =>
          fold(m.playerOne).includes(needle)
          || fold(m.playerTwo).includes(needle)
          || fold(m.table ?? "").includes(needle)
          // The armies are on the row now, so a reader looking for who took
          // Custodes should find them here rather than only on the results
          // table further down the page.
          || fold(armySummary(m.armyOne)).includes(needle)
          || fold(armySummary(m.armyTwo)).includes(needle))
      : round.matches,
  })), [pairings, needle]);

  const found = rounds.reduce((sum, round) => sum + round.matches.length, 0);

  return (
    <Stack spacing={2}>
      {total > SEARCHABLE ? (
        <TextField
          size="small" fullWidth placeholder="Find a player, a table or an army"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.inkMuted }} />
                </InputAdornment>
              ),
            },
          }}
        />
      ) : null}

      {needle && found === 0 ? (
        <EmptyState
          title="Nobody by that name"
          description="Check the spelling, or clear the search to see every round."
        />
      ) : (
        <BusyOverlay busy={busy} variant="dim" label="Filtering pairings">
          <Stack spacing={0}
            sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
            {rounds.map((round, index) => (
              <Accordion
                key={round.id}
                disableGutters elevation={0} square
                // A search opens every round that still has a hit: a match
                // hidden inside a collapsed round is a search that found
                // nothing as far as the reader can tell.
                expanded={needle ? round.matches.length > 0 : open === index}
                onChange={() => setOpen(open === index ? false : index)}
                sx={{ "&::before": { display: "none" }, backgroundColor: "transparent",
                      borderTop: index === 0 ? "none" : `1px solid ${tokens.rule}` }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}
                  sx={{ px: 2, minHeight: 52 }}>
                  <Stack direction="row" spacing={1.5}
                    sx={{ alignItems: "baseline", flex: 1, minWidth: 0, pr: 1 }}>
                    <Typography variant="subtitle2" sx={{ minWidth: 0 }} noWrap>
                      {round.label?.trim() || `Round ${round.round ?? index + 1}`}
                    </Typography>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                      color: tokens.inkMuted, flexShrink: 0 }}>
                      {`${round.matches.length} ${round.matches.length === 1 ? "TABLE" : "TABLES"}`}
                    </Typography>
                    {/* An unpublished round only reaches this page for
                        somebody who runs the club. Without the marker they
                        would reasonably think members were looking at it. */}
                    {round.published ? null : (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                        letterSpacing: "0.08em", color: tokens.brass,
                                        flexShrink: 0 }}>
                        NOT SHOWN YET
                      </Typography>
                    )}
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 0 }}>
                  {round.matches.length ? (
                    round.matches.map((m, i) => (
                      <PairingTable key={`${round.id}-${i}`} match={m} faction={faction}
                        me={me}
                        onOpenList={(player, army) => setList({ player, army })}
                        onOpenMatch={() => setGame({
                          // "Round 1 · 1" reads as two round numbers. The
                          // table column is bare because it has a heading
                          // above it; a dialog title has nothing to lean on.
                          label: [round.label || (round.round ? `Round ${round.round}` : ""),
                                  (m.table ?? "").trim()
                                    ? (/^\d+$/.test((m.table ?? "").trim())
                                        ? `Table ${(m.table ?? "").trim()}`
                                        : (m.table ?? "").trim())
                                    : ""].filter(Boolean).join(" · "),
                          playerOne: m.playerOne, playerTwo: m.playerTwo,
                          scoreOne: m.scoreOne === null ? "" : String(m.scoreOne),
                          scoreTwo: m.scoreTwo === null ? "" : String(m.scoreTwo),
                          armyOne: m.armyOne, armyTwo: m.armyTwo, setup: m.setup,
                        })} />
                    ))
                  ) : (
                    <Typography variant="body2"
                      sx={{ px: 2, py: 1.5, color: tokens.inkMuted,
                            borderTop: `1px solid ${tokens.rule}` }}>
                      This round has not been drawn yet.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </BusyOverlay>
      )}

      {/* One dialog for the section rather than one per table: twenty tables
          is forty mounted dialogs, and only one is ever open. */}
      <MatchDetailDialog match={game} onClose={() => setGame(null)} faction={faction} />

      <ArmyListDialog
        open={list !== null}
        onClose={() => setList(null)}
        player={list?.player ?? ""}
        army={list?.army ?? null}
        faction={faction}
      />
    </Stack>
  );
}
