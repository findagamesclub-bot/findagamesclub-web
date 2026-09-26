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
import type { AdminEventRow } from "@/repositories/adminLists.repository";
import { dateParts } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";

const STATUSES = [
  { value: "", label: "Any status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "cancelled", label: "Cancelled" },
];

/** Every event on the site, filtered and paged in SQL. */
export default function AdminEventList({
  rows, query, when, status, tabs, total, page, perPage, failed,
}: {
  rows: AdminEventRow[];
  query: string; when: string; status: string; tabs: UrlTab[];
  total: number; page: number; perPage: number; failed: boolean;
}) {
  const [sifting, setSifting] = useState(false);

  const tone = (s: string) => s === "published" ? tokens.positive
    : s === "cancelled" ? tokens.danger : tokens.inkMuted;

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={query}
        placeholder="Search by event, club or town"
        tab={when}
        tabs={tabs}
        sort="date"
        sorts={[{ value: "date", label: "By date" }]}
        second={{ label: "Status", value: status, options: STATUSES, param: "status" }}
        defaults={{ state: "upcoming", sort: "date", status: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering events">
        <Stack spacing={2}>
          {failed ? (
            <EmptyState title="The list would not load"
              description="Nothing was read, so this is not an empty directory. Check the database is reachable and that the latest migrations have been run, then try again." />
          ) : rows.length === 0 ? (
            <EmptyState title="No event matches that"
              description="Try a different club or date, or clear the filters to see everything." />
          ) : (
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {rows.map((event) => {
                const when = dateParts(event.start_date);
                const { faction } = clubIdentity(event.club_slug, event.club_name);
                const pct = event.places > 0
                  ? Math.round((event.sold / event.places) * 100) : 0;
                return (
                  <NextLink key={event.id}
                    href={`/clubs/${event.club_slug}/events/${event.legacy_id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <Stack spacing={1.5}
                      sx={{ height: "100%", p: 2, borderRadius: 1.5,
                            border: `1px solid ${tokens.rule}`,
                            backgroundColor: tokens.paper,
                            transition: "border-color 120ms ease",
                            "&:hover": { borderColor: faction.base } }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        {/* The date as a tile rather than a sentence, the same
                            way My events prints it. A date you can find at a
                            glance is the point of an events list. */}
                        <Stack aria-hidden sx={{
                          flexShrink: 0, width: 46, py: 0.75, borderRadius: 1.25,
                          alignItems: "center", justifyContent: "center", gap: 0,
                          backgroundColor: tokens.ink, color: "#FFFFFF" }}>
                          {when ? (
                            <>
                              <Typography sx={{ fontFamily: mono, fontSize: "0.56rem",
                                                letterSpacing: "0.08em",
                                                color: tokens.brassOnDark }}>
                                {when.weekday}
                              </Typography>
                              <Typography sx={{ fontFamily: mono, fontSize: "1.05rem",
                                                fontWeight: 700, lineHeight: 1.1 }}>
                                {when.day}
                              </Typography>
                              <Typography sx={{ fontFamily: mono, fontSize: "0.56rem",
                                                letterSpacing: "0.06em", color: "#B9C9DD" }}>
                                {when.month}
                              </Typography>
                            </>
                          ) : (
                            <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                                              color: "#B9C9DD" }}>TBC</Typography>
                          )}
                        </Stack>

                        <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontFamily: display, fontWeight: 700,
                                            fontSize: "1rem", minWidth: 0,
                                            overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" }}>
                            {event.title}
                          </Typography>
                          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                            color: tokens.inkMuted, minWidth: 0,
                                            overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" }}>
                            {event.club_name}
                          </Typography>
                        </Stack>
                        <ChevronRightIcon sx={{ color: tokens.inkMuted, flexShrink: 0 }} />
                      </Stack>

                      <Chip size="small" label={event.status}
                        sx={{ alignSelf: "flex-start", fontSize: "0.68rem",
                              fontWeight: 700, color: "#fff", bgcolor: tone(event.status) }} />

                      <Box sx={{ flex: 1 }} />
                      <Stack spacing={0.6} sx={{ pt: 1.25,
                                                 borderTop: `1px solid ${tokens.rule}` }}>
                        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                          color: tokens.inkMuted }}>
                          {/* A club that sells no tickets has no capacity to
                              miss, so it says how many are coming instead of
                              "0 of 0". */}
                          {event.places > 0
                            ? `${event.sold} of ${event.places} sold · ${pct}%`
                            : `${event.sold} booked`}
                        </Typography>
                        {event.places > 0 ? (
                          <Box sx={{ height: 4, borderRadius: 2, overflow: "hidden",
                                     backgroundColor: tokens.rule }}>
                            <Box sx={{ width: `${Math.min(Math.max(pct, 2), 100)}%`,
                                       height: "100%",
                                       backgroundColor: pct >= 90
                                         ? tokens.positive : tokens.brass }} />
                          </Box>
                        ) : null}
                      </Stack>
                    </Stack>
                  </NextLink>
                );
              })}
            </Box>
          )}

          <Pager page={page} total={total} size={perPage} noun="events"
            href={{ path: "/admin/events", params: {
              q: query || undefined,
              state: when === "upcoming" ? undefined : when,
              status: status || undefined,
            } }} />
        </Stack>
      </BusyOverlay>
    </Stack>
  );
}
