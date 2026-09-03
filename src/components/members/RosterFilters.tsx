"use client";

import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { ANY, filterRoster, rosterOptions } from "@/utils/roster-filter";
import { tokens } from "@/lib/tokens";
import type { ClubMember } from "@/types/membership";
import { PER_PAGE } from "@/utils/paging";

/**
 * Narrow the roster to the people worth messaging.
 *
 * The cards are rendered on the server and handed in whole: they carry the
 * club's own controls and a member's loyalty, none of which belongs in a
 * filter component. This only decides which of them to show.
 *
 * Options come from the club's own members, so a club that plays one game gets
 * one option rather than a list of forty it has never heard of.
 */
export default function RosterFilters({
  members, cards,
}: {
  members: ClubMember[];
  /** One entry per member, keyed by profile id. */
  cards: { id: string; node: ReactNode }[];
}) {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState(ANY);
  const [army, setArmy] = useState(ANY);
  const [style, setStyle] = useState(ANY);

  const settled = useDeferredValue(query);
  const busy = settled !== query;

  const games = useMemo(() => rosterOptions(members, (m) => m.games), [members]);
  const armies = useMemo(() => rosterOptions(members, (m) => m.armies), [members]);
  const styles = useMemo(() => rosterOptions(members, (m) => m.playStyle), [members]);

  const shown = useMemo(
    () => new Set(
      filterRoster(members, { query: settled, game, army, style })
        .map((member) => member.profileId),
    ),
    [members, settled, game, army, style],
  );

  // Only the cards that match, in roster order. Previously every card stayed
  // mounted and non-matching ones were hidden with CSS, which kept an open
  // dialog alive through a keystroke; at a few thousand members that mounts a
  // few thousand cards, and the page stops responding long before it is read.
  const matching = useMemo(
    () => cards.filter((card) => shown.has(card.id)),
    [cards, shown],
  );
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(matching, PER_PAGE.cards, top);

  const narrowed = query || game || army || style;

  const dropdown = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    options: { value: string; label: string; count: number }[],
    anyLabel: string,
  ) => (
    options.length ? (
      <TextField select size="small" label={label} value={value} fullWidth
        onChange={(event) => onChange(event.target.value)}>
        <MenuItem value={ANY}>{anyLabel}</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {`${option.label} (${option.count})`}
          </MenuItem>
        ))}
      </TextField>
    ) : null
  );

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1.5}
        sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2,
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <TextField
          size="small" fullWidth placeholder="Search by name, game or army"
          value={query} onChange={(event) => setQuery(event.target.value)}
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

        <Box sx={{ display: "grid", gap: 1.5,
                   gridTemplateColumns: {
                     xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))",
                     lg: "repeat(3, minmax(0, 1fr))",
                   } }}>
          {dropdown("Games interested in", game, setGame, games, "All games")}
          {dropdown("Factions or armies", army, setArmy, armies, "All factions or armies")}
          {dropdown("Game style", style, setStyle, styles, "Any game style")}
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, flex: 1 }}>
            {`${shown.size} of ${members.length} ${members.length === 1 ? "member matches" : "members match"} these filters.`}
          </Typography>
          {narrowed ? (
            <Button size="small" variant="text"
              onClick={() => { setQuery(""); setGame(ANY); setArmy(ANY); setStyle(ANY); }}>
              Clear
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {shown.size ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating members">
          <Box ref={top} sx={{ display: "grid", gap: 2,
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))",
                       lg: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((card) => (
              <Box key={card.id}>{card.node}</Box>
            ))}
          </Box>
          <Pager page={paged.page} total={paged.total} noun="members"
            onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 3 }}>
          Nobody matches those filters.
        </Typography>
      )}
    </Stack>
  );
}
