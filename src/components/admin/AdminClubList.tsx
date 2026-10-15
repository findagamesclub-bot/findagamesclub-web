"use client";

import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Box from "@mui/material/Box";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar, { type UrlTab } from "@/components/ui/UrlFilterBar";
import TakeDownControls from "./TakeDownControls";
import type { AdminClubRow } from "@/repositories/adminLists.repository";
import { CLUB_SORTS } from "@/utils/admin-lists";
import { clubIdentity } from "@/utils/club-identity";
import { monthYear } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

/** Every club on the site, filtered and paged in SQL. */
export default function AdminClubList({
  rows, query, status, sort, tabs, total, page, perPage, failed,
}: {
  rows: AdminClubRow[];
  query: string; status: string; sort: string; tabs: UrlTab[];
  total: number; page: number; perPage: number; failed: boolean;
}) {
  const [sifting, setSifting] = useState(false);

  // "listed Mar 2019" rather than a date: a club's own start is a month, and
  // the exact day of an import is a fact about our database, not about them.
  const started = (iso: string | null) => {
    const label = monthYear(iso);
    return label ? `listed ${label}` : "";
  };

  const tone = (s: string) => s === "active" ? tokens.positive
    : s === "paused" ? tokens.brass
      : s === "suspended" ? tokens.danger : tokens.inkMuted;

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={query}
        placeholder="Search by club name or town"
        tab={status}
        tabs={tabs}
        sort={sort}
        sorts={CLUB_SORTS}
        defaults={{ state: "", sort: "name" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering clubs">
        <Stack spacing={2}>
          {failed ? (
            <EmptyState title="The list would not load"
              description="Nothing was read, so this is not an empty directory. Check the database is reachable and that the latest migrations have been run, then try again." />
          ) : rows.length === 0 ? (
            <EmptyState title="No club matches that"
              description="Try a different town, or clear the filters to see everything." />
          ) : (
            // A grid, not a list. Every row was one club's worth of text across
            // the full width of the page, so fifteen clubs were a scroll and
            // most of the screen was empty to the right of them.
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {rows.map((club) => {
                const { faction, monogram } = clubIdentity(club.slug, club.name);
                return (
                  // The card is no longer one big anchor: the take-down control
                  // in its footer is a button, and a button inside a link is
                  // neither valid nor pressable without fighting the anchor.
                  // The link keeps the part of the card that is about the club.
                  <Stack key={club.id} spacing={1.5}
                    sx={{ height: "100%", p: 2, borderRadius: 1.5,
                          border: `1px solid ${tokens.rule}`,
                          backgroundColor: tokens.paper,
                          transition: "border-color 120ms ease",
                          "&:hover": { borderColor: faction.base } }}>
                    <NextLink href={`/clubs/${club.slug}`}
                      style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        {/* The same monogram and colour the directory gives this
                            club, so an admin learns to skim by it. */}
                        <Box aria-hidden sx={{
                          flexShrink: 0, width: 40, height: 40, borderRadius: 1.25,
                          display: "grid", placeItems: "center",
                          backgroundColor: faction.base, color: "#FFFFFF",
                          fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
                          {monogram}
                        </Box>
                        <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontFamily: display, fontWeight: 700,
                                            fontSize: "1rem", minWidth: 0,
                                            overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" }}>
                            {club.name}
                          </Typography>
                          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                            color: tokens.inkMuted }}>
                            {club.city}
                          </Typography>
                        </Stack>
                        <ChevronRightIcon sx={{ color: tokens.inkMuted, flexShrink: 0 }} />
                      </Stack>
                    </NextLink>

                    <Stack direction="row" spacing={0.75}
                      sx={{ flexWrap: "wrap" }} useFlexGap>
                      <Chip size="small" label={club.status}
                        sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#fff",
                              bgcolor: tone(club.status) }} />
                      {club.spotlight ? (
                        <Chip size="small" variant="outlined" label="Spotlight"
                          sx={{ fontSize: "0.68rem", borderColor: tokens.rule }} />
                      ) : null}
                      {club.claimable ? (
                        <Chip size="small" variant="outlined" label="Open to claims"
                          sx={{ fontSize: "0.68rem", borderColor: tokens.rule }} />
                      ) : null}
                    </Stack>

                    {/* Pushed to the bottom so every card in a row lines its
                        footer up, however long the name above it ran. */}
                    <Box sx={{ flex: 1 }} />
                    <Stack spacing={1.25}
                      sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted }}>
                        {[club.owner_name ? `run by ${club.owner_name}` : "nobody running it",
                          `${club.members} member${club.members === 1 ? "" : "s"}`,
                          // Said on the card because it is what the Newest
                          // first order is built on, and an order whose key is
                          // nowhere on the row is one nobody can check.
                          started(club.started),
                        ].filter(Boolean).join(" · ")}
                      </Typography>
                      <TakeDownControls kind="club" id={club.id} name={club.name}
                        slug={club.slug} down={club.status === "suspended"} />
                    </Stack>
                  </Stack>
                );
              })}
            </Box>
          )}

          <Pager page={page} total={total} size={perPage} noun="clubs"
            href={{ path: "/admin/clubs", params: {
              q: query || undefined, state: status || undefined,
              // The pager has to carry the order, or page two of Newest first
              // is page two of By name wearing the same link.
              sort: sort === "name" ? undefined : sort,
            } }} />
        </Stack>
      </BusyOverlay>
    </Stack>
  );
}
