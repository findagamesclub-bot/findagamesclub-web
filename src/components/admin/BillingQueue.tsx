"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { BILLING_TABS, standingLabel, standingTone } from "@/utils/listing-billing";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";
import type { SubscriptionRow } from "@/repositories/billing.repository";

/**
 * Who owes what.
 *
 * Filtered and paged in SQL from the first version, like the submissions queue
 * and for the same reason: standing is a computed column on the view, so
 * "everybody overdue" is a filter rather than a pass over every club in the
 * browser.
 */
export default function BillingQueue({
  rows, counts, standing, query, total, page, perPage,
}: {
  rows: SubscriptionRow[];
  counts: Map<string, number>;
  standing: string;
  query: string;
  total: number;
  page: number;
  perPage: number;
}) {
  const [sifting, setSifting] = useState(false);

  const toneOf = (tone: string) =>
    tone === "good" ? tokens.positive
      : tone === "bad" ? tokens.danger
        : tone === "warn" ? tokens.brass : tokens.inkMuted;

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={query}
        placeholder="Search by club name"
        tab={standing}
        tabs={BILLING_TABS.map((tab) => ({
          value: tab.key, label: tab.label, count: counts.get(tab.key) ?? 0,
        }))}
        // Soonest to run out first, which is the order money gets chased in.
        // No second sort: "by name" is not a thing anybody wants here.
        sort="due"
        sorts={[{ value: "due", label: "Soonest first" }]}
        defaults={{ state: "in_grace", sort: "due" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering subscriptions">
        <Stack spacing={2}>
          {rows.length === 0 ? (
            counts.get("all") === 0 ? (
              <EmptyState
                title="Nothing is being billed yet"
                description="Subscriptions appear here as clubs are listed. Until billing is switched on, every listing is free and nothing lands in this queue."
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {query
                  ? `Nothing matching "${query}" in this group.`
                  : standing === "in_grace"
                    ? "Nothing is overdue. Everybody is paid up."
                    : "Nothing in this group."}
              </Typography>
            )
          ) : (
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {rows.map((row) => {
                const name = row.club?.name ?? row.submission?.club_name
                  ?? "A listing with no club on it";
                const { faction, monogram } = clubIdentity(row.club?.slug ?? name, name);
                return (
                  <NextLink key={row.id} href={`/admin/billing/${row.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <Stack spacing={1.5}
                      sx={{ height: "100%", p: 2, borderRadius: 1.5,
                            border: `1px solid ${tokens.rule}`,
                            backgroundColor: tokens.paper,
                            transition: "border-color 120ms ease",
                            "&:hover": { borderColor: faction.base } }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
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
                            {name}
                          </Typography>
                          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                            color: tokens.inkMuted }}>
                            {row.club?.city ?? "Town unknown"}
                          </Typography>
                        </Stack>
                        <ChevronRightIcon sx={{ color: tokens.inkMuted, flexShrink: 0 }} />
                      </Stack>

                      <Stack direction="row" spacing={0.75}
                        sx={{ flexWrap: "wrap" }} useFlexGap>
                        <Chip size="small" label={standingLabel(row.standing)}
                          sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#fff",
                                bgcolor: toneOf(standingTone(row.standing)) }} />
                        {/* A club already out of the directory for lapsing is a
                            different problem from one merely late. */}
                        {row.club?.status === "suspended" ? (
                          <Chip size="small" variant="outlined" label="Hidden"
                            sx={{ fontSize: "0.68rem", fontWeight: 700,
                                  color: tokens.inkMuted, borderColor: tokens.rule }} />
                        ) : null}
                      </Stack>

                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted, pt: 1.25,
                                        borderTop: `1px solid ${tokens.rule}` }}>
                        {[
                          formatPence(row.price_pence) + (row.plan_interval === "yearly"
                            ? " a year" : " a month"),
                          row.current_period_end
                            ? `to ${shortDate(row.current_period_end.slice(0, 10))}`
                            : "never paid",
                        ].join(" · ")}
                      </Typography>
                    </Stack>
                  </NextLink>
                );
              })}
            </Box>
          )}

          <Pager page={page} total={total} size={perPage} noun="subscriptions"
            href={{ path: "/admin/billing", params: {
              state: standing === "in_grace" ? undefined : standing,
              q: query || undefined,
            } }} />
        </Stack>
      </BusyOverlay>
    </Stack>
  );
}
