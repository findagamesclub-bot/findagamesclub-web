"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { fold } from "@/utils/text";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { RosterEntry } from "@/services/eventBoard.service";
import { PER_PAGE } from "@/utils/paging";

/** Past this a roster is scanned for a name rather than read. */
const SEARCHABLE = 12;
const PAGE = PER_PAGE.rows;

/**
 * Who is signed up, as a fellow attendee sees it.
 *
 * No email, reference or money: those belong to the club and live on its door
 * list. This answers "who else is turning up", which is the question anybody
 * holding a ticket has, and legacy shows them.
 */
export default function EventRoster({
  roster, faction, viewerId,
}: {
  roster: RosterEntry[];
  faction: Faction;
  viewerId: string | null;
}) {
  const [query, setQuery] = useState("");
  const settled = useDeferredValue(query);
  const busy = settled !== query;
  const needle = fold(settled);

  const results = useMemo(
    () => (needle ? roster.filter((r) => fold(r.name).includes(needle)) : roster),
    [roster, needle],
  );

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);
  const seats = roster.reduce((n, r) => n + r.tickets, 0);

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", letterSpacing: "0.06em",
                        color: tokens.inkMuted }}>
        {`${roster.length} ${roster.length === 1 ? "PLAYER" : "PLAYERS"} · ${seats} ${seats === 1 ? "TICKET" : "TICKETS"} RESERVED`}
      </Typography>

      {roster.length > SEARCHABLE ? (
        <TextField
          size="small" fullWidth placeholder="Find a player"
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

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Filtering the roster">
          <Box ref={top}
            sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
            {paged.shown.map((r, i) => {
              const mine = Boolean(viewerId) && r.profileId === viewerId;
              return (
                <Box key={r.profileId ?? `${r.name}-${i}`}
                  sx={{ display: "grid", gap: 1.5, px: 2, py: 1.25, alignItems: "baseline",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                        backgroundColor: mine ? faction.soft
                          : i % 2 ? tokens.surface : tokens.paper }}>
                  <Stack direction="row" spacing={1}
                    sx={{ alignItems: "baseline", minWidth: 0 }}>
                    {r.profileId ? (
                      <NextLink href={`/members/${r.profileId}`}
                        style={{ textDecoration: "none" }}>
                        <Typography variant="body2"
                          sx={{ color: tokens.ink, fontWeight: mine ? 700 : 500,
                                "&:hover": { color: faction.base } }} noWrap>
                          {mine ? "You" : r.name}
                        </Typography>
                      </NextLink>
                    ) : (
                      <Typography variant="body2" noWrap>{r.name}</Typography>
                    )}
                    {!r.isMember ? (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                                        letterSpacing: "0.08em", color: tokens.inkMuted,
                                        flexShrink: 0 }}>
                        GUEST
                      </Typography>
                    ) : null}
                  </Stack>

                  <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                    fontVariantNumeric: "tabular-nums",
                                    color: tokens.inkMuted, flexShrink: 0 }}>
                    {`${r.tickets} ${r.tickets === 1 ? "ticket" : "tickets"}`}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ mt: 2 }}>
            <Pager page={paged.page} total={paged.total} noun="players"
              size={PAGE} onChange={paged.goTo} />
          </Box>
        </BusyOverlay>
      ) : needle ? (
        <EmptyState title="Nobody by that name"
          description="Check the spelling, or clear the search to see everybody." />
      ) : (
        <EmptyState title="Nobody has booked yet"
          description="The first ticket sold shows up here." />
      )}
    </Stack>
  );
}
