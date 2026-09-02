"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import MonoLabel from "@/components/ui/MonoLabel";
import Pager from "@/components/ui/Pager";
import PlacingCard from "./PlacingCard";
import PlacingRow from "./PlacingRow";
import PlacingEditor, { type PlacingTarget } from "./PlacingEditor";
import { usePagedList } from "@/hooks/usePagedList";
import { fold } from "@/utils/text";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";
import { PER_PAGE } from "@/utils/paging";

/** Below this the whole field fits as podium cards and nothing is gained by paging. */
const PODIUM_ONLY = 6;
/** How many get the full card treatment once a field is big. */
const PODIUM = 3;
const PAGE = PER_PAGE.rows;

/** What the club needs to edit its own results. Absent for everybody else. */
export type PlacingAdmin = {
  slug: string;
  eventKey: string;
  eventId: number;
  roster: { id: string; name: string }[];
};

/**
 * The results table, and the reason to visit a past event.
 *
 * Legacy records a whole army against a placing: faction, detachment, the
 * units that did the work, and sometimes the full list with points. That is
 * what wargamers read a tournament page for, so the top of the table is a
 * podium rather than a row of names.
 *
 * It does not stay a podium. A fifty-player RTT is fifty of those cards, each
 * carrying an army list, and nobody scrolls that. Past a handful the top three
 * keep the cards and the rest of the field becomes a scannable table, searched
 * and paged like every other long list in the app. Searching drops the podium:
 * "Custodes" should answer with Custodes, not with the winner as well.
 *
 * Rank is a numeral in the display face, not a medal colour: gold and silver
 * do not survive a greyscale print and mean nothing past third.
 */
export default function EventPlacings({
  placings, faction, admin, viewerName,
}: {
  placings: EventPlacing[];
  faction: Faction;
  admin?: PlacingAdmin;
  /** Marks the reader's own row in a long field. */
  viewerName?: string | null;
}) {
  const [target, setTarget] = useState<PlacingTarget | null>(null);
  const [query, setQuery] = useState("");
  const settled = useDeferredValue(query);
  const busy = settled !== query;
  const needle = fold(settled);
  const me = viewerName ? fold(viewerName) : "";

  // Working down a printed results sheet in order, so the next place is the
  // one they are about to type.
  const nextRank = placings.reduce((n, p) => Math.max(n, p.rank), 0) + 1;
  const small = placings.length <= PODIUM_ONLY;

  const matches = useMemo(() => {
    if (!needle) return placings;
    return placings.filter((p) =>
      fold(p.name).includes(needle)
      || fold(p.army?.factionLabel ?? "").includes(needle)
      || fold(p.army?.detachment ?? "").includes(needle));
  }, [placings, needle]);

  // Memoised, both of them. usePagedList resets the page whenever the list
  // it is given changes identity, and `placings.slice(...)` is a new array on
  // every render: it set state during render, which re-rendered, which sliced
  // again. That is an infinite loop, not a slow page.
  const podium = useMemo(
    () => (needle || small ? [] : placings.slice(0, PODIUM)),
    [needle, small, placings],
  );
  const field = useMemo(
    () => (needle ? matches : small ? [] : placings.slice(PODIUM)),
    [needle, small, matches, placings],
  );

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(field, PAGE, top);

  return (
    <Stack spacing={2}>
      {/* Only once scanning is the job. Six results are read, not searched. */}
      {!small ? (
        <TextField
          size="small" fullWidth placeholder="Find a player, faction or detachment"
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

      <BusyOverlay busy={busy} variant="dim" label="Filtering results">
        <Stack spacing={1.5}>
          {small ? (
            placings.map((p) => (
              <PlacingCard key={p.id} p={p} faction={faction}
                onEdit={admin ? () => setTarget({ placing: p }) : undefined} />
            ))
          ) : null}

          {podium.map((p) => (
            <PlacingCard key={p.id} p={p} faction={faction}
              onEdit={admin ? () => setTarget({ placing: p }) : undefined} />
          ))}

          {field.length ? (
            <Box>
              <MonoLabel>
                {needle
                  ? `${matches.length} of ${placings.length} results`
                  : `The rest of the field · ${field.length}`}
              </MonoLabel>
              <Box ref={top}
                sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                      overflow: "hidden",
                      // The first row draws its own top border, so the box
                      // would otherwise double it.
                      "& > :first-of-type": { borderTop: "none" } }}>
                {paged.shown.map((p, i) => (
                  <PlacingRow key={p.id} p={p} faction={faction} striped={i % 2 === 1}
                    mine={Boolean(me) && fold(p.name) === me}
                    onEdit={admin ? () => setTarget({ placing: p }) : undefined} />
                ))}
              </Box>

              <Box sx={{ mt: 2 }}>
                <Pager page={paged.page} total={paged.total} noun="results"
                  size={PAGE} onChange={paged.goTo} />
              </Box>
            </Box>
          ) : null}

          {needle && matches.length === 0 ? (
            <EmptyState
              title="Nobody by that name"
              description="Check the spelling, or clear the search to see the whole table."
            />
          ) : null}
        </Stack>
      </BusyOverlay>

      {admin ? (
        <>
          <Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setTarget({ placing: null })}
              sx={{ minHeight: 44, color: faction.deep, borderColor: faction.base,
                    "&:hover": { borderColor: faction.deep, backgroundColor: faction.soft } }}
            >
              {placings.length ? "Add another place" : "Record the winner"}
            </Button>
          </Box>

          <PlacingEditor
            open={target !== null}
            target={target}
            nextRank={nextRank}
            roster={admin.roster}
            slug={admin.slug}
            eventKey={admin.eventKey}
            eventId={admin.eventId}
            onClose={() => setTarget(null)}
          />
        </>
      ) : null}
    </Stack>
  );
}
