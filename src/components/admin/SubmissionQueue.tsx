"use client";

import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { QUEUE_TABS } from "@/utils/submission-status";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { QueueFilters, QueueRow } from "@/services/submissionReview.service";

/**
 * Listings waiting to be looked at.
 *
 * Filtered and paged in SQL rather than in the browser, from the first version
 * rather than when it gets big. A platform with five thousand submissions is a
 * platform that is working, and a list that loads all of them to hide most of
 * them cannot be retrofitted into one that does not.
 *
 * The five tab counts are five index counts, which cost the same at five
 * thousand rows as at five.
 */
export default function SubmissionQueue({
  rows, counts, filters, total, page, perPage,
}: {
  rows: QueueRow[];
  counts: Map<string, number>;
  filters: QueueFilters;
  total: number;
  page: number;
  perPage: number;
}) {
  const [sifting, setSifting] = useState(false);
  const waiting = filters.status === "review_pending" || filters.status === "changes_requested";

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={filters.query}
        placeholder="Search by club name or town"
        tab={filters.status}
        tabs={QUEUE_TABS.map((tab) => ({
          value: tab.key, label: tab.label, count: counts.get(tab.key) ?? 0,
        }))}
        sort={filters.sort}
        sorts={[
          { value: "oldest", label: "Longest waiting" },
          { value: "newest", label: "Newest first" },
        ]}
        defaults={{ state: "review_pending", sort: "oldest" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering requests">
        <Stack spacing={1}>
          {rows.length === 0 ? (
            counts.get("all") === 0 ? (
              <EmptyState
                title="Nobody has asked to list a club yet"
                description="When somebody sends one in it lands here, oldest first, with everything they filled in."
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {filters.query
                  ? `Nothing matching "${filters.query}" in this group.`
                  : filters.status === "review_pending"
                    ? "Nothing waiting. The queue is clear."
                    : "Nothing in this group."}
              </Typography>
            )
          ) : (
            rows.map((row) => (
              <NextLink key={row.id} href={`/admin/submissions/${row.id}`}
                style={{ textDecoration: "none", color: "inherit" }}>
                <Stack direction="row" spacing={2}
                  sx={{ alignItems: "center", p: 2, borderRadius: 1.5,
                        border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                        // A row somebody has already moved past is still worth
                        // finding, and is not worth the same weight as one that
                        // has not been answered.
                        opacity: row.supersededBy ? 0.72 : 1,
                        transition: "border-color 120ms ease, opacity 120ms ease",
                        "&:hover": { borderColor: tokens.brand, opacity: 1 } }}>
                  <Stack spacing={0.4} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="h4" sx={{ fontSize: "1rem" }}>
                        {row.clubName}
                      </Typography>
                      <Chip size="small"
                        // "Approved and live" beside "Paused by the club" is
                        // the row arguing with itself. The request is approved
                        // either way; only the second chip speaks for the club.
                        label={row.clubStatus === "paused" && row.status === "approved"
                          ? "Approved" : row.statusLabel}
                        sx={{ fontSize: "0.68rem", fontWeight: 700,
                              bgcolor: row.tone === "good" ? tokens.positive
                                : row.tone === "bad" ? tokens.danger
                                  : row.tone === "warn" ? tokens.brass : tokens.inkMuted,
                              color: "#fff" }} />
                      {/* How much work this one has already had, which is the
                          number a reviewer wants before opening it. It replaces
                          two chips that each said less: "Back for another look",
                          which said a round had happened without saying how
                          many, and "Second attempt", which counted submission
                          rows and got read as rounds on a listing that had been
                          round four times. */}
                      {row.sentBack > 0 ? (
                        <Chip size="small"
                          label={row.sentBack === 1
                            ? "Sent back once" : `Sent back ${row.sentBack} times`}
                          sx={{ fontSize: "0.68rem", fontWeight: 700,
                                bgcolor: tokens.brand, color: "#fff" }} />
                      ) : null}
                      {/* No chip for "this one was started again from an
                          earlier try". Two words cannot carry it: the client
                          read it as the round count, and then as nothing at all.
                          The review screen says it in a sentence with a link to
                          the earlier one, which is where it belongs. */}
                      {/* And the other end of it. The decline stays on this tab
                          because it is a decision somebody took, but a row
                          reading only "Declined" beside a club that is now live
                          tells the reviewer something that stopped being
                          true. */}
                      {/* The request is approved and stays approved; whether
                          the club is live is a different question, and the row
                          read "Approved and live" about a club that had taken
                          itself out of the directory. */}
                      {row.clubStatus === "paused" ? (
                        <Chip size="small" label="Paused by the club"
                          sx={{ fontSize: "0.68rem", fontWeight: 700,
                                bgcolor: tokens.brass, color: "#fff" }} />
                      ) : null}
                      {row.supersededBy ? (
                        <Chip size="small" variant="outlined"
                          label={`They came back · now ${row.supersededBy.statusLabel}`}
                          sx={{ fontSize: "0.68rem", fontWeight: 700,
                                color: tokens.inkMuted, borderColor: tokens.rule }} />
                      ) : null}
                    </Stack>

                    <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                      color: tokens.inkMuted }}>
                      {[
                        row.city,
                        // Which date matters depends on which list you are in.
                        waiting && row.submittedAt
                          ? `sent ${shortDate(row.submittedAt.slice(0, 10))}`
                          : `updated ${shortDate(row.updatedAt.slice(0, 10))}`,
                      ].filter(Boolean).join(" · ")}
                    </Typography>
                  </Stack>

                  <ChevronRightIcon sx={{ color: tokens.inkMuted, flexShrink: 0 }} />
                </Stack>
              </NextLink>
            ))
          )}

          {/* Href mode, not a callback: the rows came from the server, so a
              page of the queue is a link somebody can send. The filters ride
              along or turning the page would drop the tab. */}
          <Pager page={page} total={total} size={perPage} noun="requests"
            href={{ path: "/admin/submissions", params: {
              state: filters.status === "review_pending" ? undefined : filters.status,
              q: filters.query || undefined,
              sort: filters.sort === "oldest" ? undefined : filters.sort,
            } }} />
        </Stack>
      </BusyOverlay>
    </Stack>
  );
}
