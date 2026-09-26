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
import { CLAIM_TABS, claimLabel, claimTone } from "@/utils/claim-status";
import { shortDate } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";
import type { ClaimRow } from "@/repositories/claims.repository";

/** Somebody saying a listing is theirs, oldest first. */
export default function ClaimQueue({
  rows, counts, status, total, page, perPage,
}: {
  rows: ClaimRow[];
  counts: Map<string, number>;
  status: string;
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
        query=""
        placeholder=""
        tab={status}
        tabs={CLAIM_TABS.map((tab) => ({
          value: tab.key, label: tab.label, count: counts.get(tab.key) ?? 0,
        }))}
        sort="oldest"
        sorts={[{ value: "oldest", label: "Longest waiting" }]}
        defaults={{ state: "open", sort: "oldest" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering claims">
        <Stack spacing={2}>
          {rows.length === 0 ? (
            counts.get("all") === 0 ? (
              <EmptyState
                title="Nobody has claimed a listing"
                description="Open a listing to claims and anybody who runs that club can ask for it here."
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {status === "open"
                  ? "Nothing waiting. Everybody has had an answer."
                  : "Nothing in this group."}
              </Typography>
            )
          ) : (
            // A grid, like the other admin lists. A claim is a name, a club and
            // a date; across the full width of the page that was one short line
            // and a lot of nothing.
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {rows.map((row) => {
                const name = row.club?.name ?? "A club that has gone";
                const { faction, monogram } = clubIdentity(row.club?.slug ?? "", name);
                return (
                  <NextLink key={row.id} href={`/admin/claims/${row.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <Stack spacing={1.5}
                      sx={{ height: "100%", p: 2, borderRadius: 1.5,
                            border: `1px solid ${tokens.rule}`,
                            backgroundColor: tokens.paper,
                            transition: "border-color 120ms ease",
                            "&:hover": { borderColor: faction.base } }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        {/* The club's own colour, so a run of claims against
                            one listing is obvious at a glance. */}
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

                      <Chip size="small" label={claimLabel(row.status)}
                        sx={{ alignSelf: "flex-start", fontSize: "0.68rem",
                              fontWeight: 700, color: "#fff",
                              bgcolor: toneOf(claimTone(row.status)) }} />

                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted, pt: 1.25,
                                        borderTop: `1px solid ${tokens.rule}` }}>
                        {[row.claimant?.full_name || "Somebody",
                          `asked ${shortDate(row.created_at.slice(0, 10))}`,
                        ].join(" · ")}
                      </Typography>
                    </Stack>
                  </NextLink>
                );
              })}
            </Box>
          )}

          <Pager page={page} total={total} size={perPage} noun="claims"
            href={{ path: "/admin/claims", params: {
              state: status === "open" ? undefined : status,
            } }} />
        </Stack>
      </BusyOverlay>
    </Stack>
  );
}
