"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import BadgeChip from "@/components/ui/BadgeChip";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar, { type UrlTab } from "@/components/ui/UrlFilterBar";
import type { BadgeAwardPageRow, ClubBadgeRow } from "@/services/badges.service";
import { AWARD_SORTS, type BadgeFilters } from "@/utils/badge-filters";
import { display, mono, tokens } from "@/lib/tokens";

export type AwardedPage = {
  rows: BadgeAwardPageRow[];
  total: number; page: number; perPage: number; failed: boolean; tabs: UrlTab[];
};

/**
 * Who holds what, and the way back.
 *
 * Its own file because `BadgeBoard` went past the 200-line rule, and because
 * the two tabs are two screens rather than two halves of one: this is a list
 * of people, the other is a list of badges.
 *
 * Searched, counted and paged in SQL. One row per badge per member means a
 * club a few seasons in has thousands, which is the case the scale rules are
 * about. The badge picker is the same filter the count on a badge card writes,
 * so arriving from a card lands on a control that says which badge is in view
 * and can clear it.
 */
export default function AwardedList({
  page, slug, badges, filters, busy, onRevoke,
}: {
  page: AwardedPage;
  slug: string;
  badges: ClubBadgeRow[];
  filters: BadgeFilters;
  busy: boolean;
  onRevoke: (award: BadgeAwardPageRow) => void;
}) {
  const [taking, setTaking] = useState<BadgeAwardPageRow | null>(null);
  const [sifting, setSifting] = useState(false);
  const [, start] = useTransition();

  const narrowed = filters.badge !== null;
  const filtered = narrowed || Boolean(filters.query) || Boolean(filters.state);

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={filters.query}
        placeholder="Search by member, badge or why they got it"
        tab={filters.state}
        tabs={page.tabs}
        sort={filters.sort || "recent"}
        sorts={AWARD_SORTS}
        second={{
          label: "Badge", param: "badge", value: String(filters.badge ?? ""),
          options: [
            { value: "", label: "Every badge" },
            ...badges.map((badge) => ({
              value: String(badge.id),
              label: badge.active ? badge.label : `${badge.label} (retired)`,
            })),
          ],
        }}
        defaults={{ state: "", sort: "recent", badge: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering the awards">
        <Stack spacing={2}>
          {page.failed ? (
            <EmptyState title="The list would not load"
              description="Nothing was read, so this is not an empty list. Check the latest migrations have been run, then try again." />
          ) : page.rows.length === 0 ? (
            <EmptyState
              title={filtered ? "Nothing matches that" : "Nobody holds a badge yet"}
              description={filtered
                ? "Try a different word, or clear the filters to see everybody holding one."
                : "Give one out from a badge card and it shows up here, with who has it and why."}
            />
          ) : (
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {page.rows.map((award) => (
                <Stack key={award.id} spacing={1.5}
                  sx={{ height: "100%", p: 2, borderRadius: 1.5,
                        border: `1px solid ${tokens.rule}`,
                        backgroundColor: tokens.paper }}>
                  <Typography component={NextLink} href={`/members/${award.profile_id}`}
                    sx={{ fontFamily: display, fontWeight: 700, fontSize: "1rem",
                          color: tokens.ink, textDecoration: "none",
                          "&:hover": { textDecoration: "underline" } }}>
                    {award.member_name}
                  </Typography>
                  {/* Every card carries the same badge once the list is
                      narrowed to one, and the picker above already names it. */}
                  {narrowed ? null : (
                    <Stack direction="row" spacing={0.75} useFlexGap
                      sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <BadgeChip label={award.label} icon={award.icon} tone={award.tone} />
                      {award.badge_active ? null : (
                        <Typography sx={{ fontFamily: mono, fontSize: "0.58rem",
                                          fontWeight: 700, letterSpacing: "0.1em",
                                          color: tokens.inkMuted, px: 0.75, py: 0.25,
                                          border: `1px solid ${tokens.rule}`,
                                          borderRadius: 0.75 }}>
                          RETIRED
                        </Typography>
                      )}
                    </Stack>
                  )}
                  {award.note ? (
                    <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
                      {award.note}
                    </Typography>
                  ) : null}

                  <Box sx={{ flex: 1 }} />
                  <Stack direction="row"
                    sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}`,
                          alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                      color: tokens.inkMuted }}>
                      {new Date(award.awarded_at).toLocaleDateString("en-GB",
                        { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    </Typography>
                    <Button variant="text" size="small" onClick={() => setTaking(award)}
                      sx={{ color: tokens.danger, mr: -1 }}>
                      Take it back
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Box>
          )}

          <Pager page={page.page} total={page.total} size={page.perPage} noun="awards"
            href={{ path: `/clubs/${slug}/manage/badges`, params: {
              tab: "awarded",
              q: filters.query || undefined,
              state: filters.state || undefined,
              sort: filters.sort || undefined,
              badge: filters.badge ? String(filters.badge) : undefined,
            } }} />
        </Stack>
      </BusyOverlay>

      <ConfirmDialog
        open={taking !== null}
        title={`Take ${taking?.label ?? "this badge"} back from ${taking?.member_name ?? "them"}?`}
        body="It goes from their profile and the roster. The record of it having been given stays, so this can be undone by giving it again."
        confirmLabel="Take it back"
        destructive
        busy={busy}
        onConfirm={() => start(() => { if (taking) onRevoke(taking); })}
        onClose={() => setTaking(null)}
      />
    </Stack>
  );
}
