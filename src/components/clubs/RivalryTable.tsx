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
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { Rivalry } from "@/services/games.service";
import { PER_PAGE } from "@/utils/paging";

/** Rows drawn before the table stops and offers more. */
const PAGE = PER_PAGE.rows;

const fold = (value: string) => value.trim().toLowerCase();

/**
 * Who plays whom at this club, and how it stands.
 *
 * A table rather than cards: this is scanned down a column for a name, and
 * fifty cards would be fifty things to read. Searchable for the same reason,
 * because at a big club the row you want is somebody specific.
 */
export default function RivalryTable({
  rivalries, viewerId, faction, slug,
}: {
  rivalries: Rivalry[];
  /** For the head-to-head link behind each row. */
  slug: string;
  /** Your own rows are marked, so you can find yourself in a long table. */
  viewerId: string | null;
  faction: Faction;
}) {
  const [query, setQuery] = useState("");
  const settled = useDeferredValue(query);
  const busy = settled !== query;

  const results = useMemo(() => {
    const needle = fold(settled);
    if (!needle) return rivalries;
    return rivalries.filter((row) =>
      fold(row.one.name).includes(needle) || fold(row.two.name).includes(needle));
  }, [rivalries, settled]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);

  return (
    <Stack spacing={2}>
      {rivalries.length > 8 ? (
        <TextField
          size="small" fullWidth placeholder="Find a member"
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

      <BusyOverlay busy={busy} variant="dim" label="Updating rivalries">
        <Box ref={top} sx={{ borderRadius: 2, overflow: "hidden",
                   border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          {paged.shown.map((row, i) => {
            const mine = viewerId === row.one.id || viewerId === row.two.id;
            const oneAhead = row.one.wins > row.two.wins;
            const twoAhead = row.two.wins > row.one.wins;

            const person = (side: Rivalry["one"], ahead: boolean) => (
              <NextLink href={`/members/${side.id}`}
                style={{ textDecoration: "none", color: "inherit" }}>
                <Typography sx={{ fontFamily: display, fontWeight: ahead ? 700 : 500,
                                  "&:hover": { color: faction.base } }} noWrap>
                  {viewerId === side.id ? "You" : side.name}
                </Typography>
              </NextLink>
            );

            return (
              <Stack key={row.key} direction="row" spacing={1.5}
                sx={{ px: 2, py: 1.5, alignItems: "center",
                      borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                      backgroundColor: mine ? faction.soft : "transparent" }}>
                <Box sx={{ width: 26, flexShrink: 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                    color: tokens.inkMuted }}>
                    {i + 1}
                  </Typography>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                  {person(row.one, oneAhead)}
                </Box>

                <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                                  flexShrink: 0, minWidth: 76, textAlign: "center" }}>
                  {`${row.one.wins}-${row.draws}-${row.two.wins}`}
                </Typography>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {person(row.two, twoAhead)}
                </Box>

                {/* How hot it is, on legacy's rating: close, frequent and
                    recent beats a long-finished whitewash. Named as well as
                    tinted, since a colour alone ranks nothing. */}
                <Typography
                  sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                        letterSpacing: "0.08em", flexShrink: 0, minWidth: 62,
                        textAlign: "center", px: 0.75, py: 0.25, borderRadius: 0.75,
                        display: { xs: "none", md: "block" },
                        color: row.intensity === "High" ? faction.deep : tokens.inkMuted,
                        backgroundColor: row.intensity === "High"
                          ? faction.soft : tokens.surface }}>
                  {row.intensity.toUpperCase()}
                </Typography>

                <Stack sx={{ alignItems: "flex-end", flexShrink: 0, minWidth: 96,
                             display: { xs: "none", sm: "flex" } }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                    color: tokens.inkMuted }}>
                    {`${row.played} PLAYED`}
                  </Typography>
                  {/* What each of them scores, which is the half of a rivalry a
                      win-loss record cannot tell you: two people can be level
                      on wins and nowhere near on points. */}
                  {row.one.average !== null ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      fontVariantNumeric: "tabular-nums",
                                      color: tokens.inkMuted }}>
                      {`${row.one.average} – ${row.two.average} AVG`}
                    </Typography>
                  ) : null}
                  {row.lastPlayed ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      color: tokens.inkMuted }}>
                      {(shortDate(row.lastPlayed) ?? "").toUpperCase()}
                    </Typography>
                  ) : null}
                  {/* Nobody nominated means the pair simply played each other,
                      which is not the same as one of them having called it. */}
                  {row.nominations > 0 ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                      letterSpacing: "0.08em",
                                      color: row.mutual ? faction.deep : tokens.inkMuted }}>
                      {row.mutual ? "MUTUAL" : "ONE-SIDED"}
                    </Typography>
                  ) : null}
                </Stack>

                {/* The row itself is not a link: it already holds two of them,
                    and a link inside a link is invalid. */}
                {/* Underscore, not a hyphen: the key is two UUIDs and those
                    are full of hyphens, so a hyphen separator cannot be split
                    back apart. */}
                <NextLink href={`/clubs/${slug}/rivalries/${row.key.replace(":", "_")}`}
                  style={{ textDecoration: "none", flexShrink: 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                    letterSpacing: "0.06em", color: tokens.brand,
                                    "&:hover": { color: tokens.brandDeep } }}>
                    HEAD TO HEAD
                  </Typography>
                </NextLink>
              </Stack>
            );
          })}

          {!paged.shown.length ? (
            <Typography variant="body2" sx={{ p: 3, color: tokens.inkMuted }}>
              {`Nobody matching "${query}".`}
            </Typography>
          ) : null}
        </Box>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="rivalries" size={PAGE}
        onChange={paged.goTo} />
    </Stack>
  );
}
