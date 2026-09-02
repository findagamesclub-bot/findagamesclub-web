"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import { fold } from "@/utils/text";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventPairing } from "@/types/event";

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

  const rounds = useMemo(() => pairings.map((round) => ({
    ...round,
    matches: needle
      ? round.matches.filter((m) =>
          fold(m.playerOne).includes(needle)
          || fold(m.playerTwo).includes(needle)
          || fold(m.table ?? "").includes(needle))
      : round.matches,
  })), [pairings, needle]);

  const found = rounds.reduce((sum, round) => sum + round.matches.length, 0);

  return (
    <Stack spacing={2}>
      {total > SEARCHABLE ? (
        <TextField
          size="small" fullWidth placeholder="Find a player or a table"
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
                      {`${round.matches.length} ${round.matches.length === 1 ? "PAIRING" : "PAIRINGS"}`}
                    </Typography>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 0 }}>
                  {round.matches.length ? (
                    round.matches.map((m, i) => {
                      const mine = Boolean(me)
                        && (fold(m.playerOne) === me || fold(m.playerTwo) === me);

                      return (
                        <Box key={`${round.id}-${i}`}
                          sx={{ display: "grid", gap: 1.5, px: 2, py: 1.25,
                                alignItems: "baseline",
                                gridTemplateColumns: { xs: "56px minmax(0, 1fr)",
                                                       sm: "72px minmax(0, 1fr) auto" },
                                borderTop: `1px solid ${tokens.rule}`,
                                backgroundColor: mine ? faction.soft : tokens.surface }}>
                          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                            color: mine ? faction.deep : tokens.inkMuted }}>
                            {(m.table ?? "").trim() || "—"}
                          </Typography>
                          <Typography variant="body2"
                            sx={{ minWidth: 0, fontWeight: mine ? 700 : 400 }}>
                            {`${m.playerOne} v ${m.playerTwo}`}
                          </Typography>
                          {/* Named, not only tinted: a coloured row says
                              nothing to a reader who cannot see the tint. */}
                          {mine ? (
                            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                              fontWeight: 700, letterSpacing: "0.1em",
                                              color: faction.deep,
                                              display: { xs: "none", sm: "block" } }}>
                              YOUR TABLE
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })
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
    </Stack>
  );
}
