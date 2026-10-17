"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import StatusChip from "@/components/ui/StatusChip";
import UrlFilterBar, { type UrlTab } from "@/components/ui/UrlFilterBar";
import { useActionToast } from "@/components/ui/Toaster";
import { withdrawAction, type WithdrawState } from "@/app/account/reports/actions";
import { MODERATION_TARGETS, targetLabel } from "@/utils/moderation-targets";
import { MY_REPORT_SORTS } from "@/utils/reported-set";
import { statusTag } from "@/utils/moderation-status";
import { shortDate } from "@/utils/dates";
import type { MyReportRow } from "@/services/myReports.service";
import { display, mono, tokens } from "@/lib/tokens";

export type MyReportsPage = {
  rows: MyReportRow[];
  total: number; page: number; perPage: number; failed: boolean; tabs: UrlTab[];
};

const TYPES = [
  { value: "", label: "Anything" },
  ...MODERATION_TARGETS.map((t) => ({ value: t.key, label: t.plural })),
];

/**
 * Whether this row came from a database that knows who answers a report.
 *
 * 0196 added `with_club`, and the app is deployed before anybody runs a
 * migration in a window measured in minutes. A missing value is falsy, which
 * would read as "a site admin has it" about every report on the page, so the
 * line is drawn only once the answer is really there. Deleting this is safe
 * once 0196 is on every environment.
 */
const knows = (row: { with_club?: boolean }) => typeof row.with_club === "boolean";

export default function MyReports({
  page, tab, type, query, sort,
}: {
  page: MyReportsPage;
  tab: string; type: string; query: string; sort: string;
}) {
  const [state, act, busy] = useActionState<WithdrawState, FormData>(withdrawAction, {});
  useActionToast(state);
  const [taking, setTaking] = useState<MyReportRow | null>(null);
  const [sifting, setSifting] = useState(false);
  const [, start] = useTransition();

  return (
    <Stack spacing={2}>
      {/* The same bar as the two moderation queues. It shipped with tabs and
          nothing else, on the grounds that a handful of rows needs no search;
          consistency is the stronger argument, and somebody who reports often
          has more than a handful. */}
      <UrlFilterBar
        query={query}
        placeholder="Search the words, your reason, or the answer"
        tab={tab}
        tabs={page.tabs}
        sort={sort || "recent"}
        sorts={MY_REPORT_SORTS}
        second={{ label: "Kind", value: type, options: TYPES, param: "type" }}
        defaults={{ state: "", sort: "recent", type: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering your reports">
        <Stack spacing={2}>
          {page.failed ? (
            <EmptyState title="That would not load"
              description="Nothing was read, so this is not an empty list. Try again in a moment." />
          ) : page.rows.length === 0 ? (
            <EmptyState
              title={tab || type || query ? "Nothing matches that" : "Nothing waiting"}
              description={tab || type || query
                ? "Try a different word, or clear the filters to see everything you have reported."
                : "Report something with the flag beside it and it lands here, with what was decided."}
            />
          ) : (
            // A grid, like every other list in the consoles. One report a row
            // was a band of mostly empty screen each, and six of them made a
            // scroll out of something that fits on one screen.
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {page.rows.map((row) => (
                <Stack key={row.id} spacing={1.25}
                  sx={{ height: "100%", p: 2, borderRadius: 1.5,
                        border: `1px solid ${tokens.rule}`,
                        backgroundColor: tokens.paper }}>
                  {/* The same tag the two moderation queues draw, from the
                      same map. It was a line of mono here and a filled chip
                      there, which is one fact wearing two faces. */}
                  <Stack direction="row" spacing={0.75} useFlexGap
                    sx={{ flexWrap: "wrap" }}>
                    <StatusChip {...statusTag(row.status, row.target_gone)} />
                    {row.target_gone && row.status === "actioned" ? (
                      <StatusChip label="Words are gone" marker />
                    ) : null}
                  </Stack>
                  <Stack direction="row" spacing={0.75} useFlexGap
                    sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
                    <Typography sx={{ fontFamily: display, fontWeight: 700,
                                      fontSize: "1rem" }}>
                      {targetLabel(row.target_type)}
                    </Typography>
                    {row.club_name ? (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted, minWidth: 0 }}>
                        at {row.club_name}
                      </Typography>
                    ) : null}
                  </Stack>

                  {/* The words, so somebody can tell which of three reports
                      this is. Gone when it has been taken down, which is the
                      normal ending rather than something missing. */}
                  {row.target_gone ? (
                    <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted,
                                      fontStyle: "italic" }}>
                      The words are no longer on the site.
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: "0.95rem",
                                      display: "-webkit-box", WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {row.title ? `${row.title}. ` : ""}{row.body}
                    </Typography>
                  )}

                  <Typography sx={{ fontSize: "0.85rem", color: tokens.inkMuted }}>
                    You said: {row.reason}
                  </Typography>

                  {/* Who has it, which nothing on this page used to say.
                      0128 sends a review, and anything a club's own team
                      wrote, to a site admin instead of to the club. The rule
                      is right and it was invisible, so a member comparing this
                      list against the club's own queue saw one report in both
                      and one in only this one, and read that as the routing
                      being broken. Reported three times.

                      "not the club" is the half that closes it: it says the
                      absence from the club's queue is the rule working. */}
                  {row.status === "open" && knows(row) ? (
                    <Typography sx={{ fontSize: "0.85rem", color: tokens.inkMuted }}>
                      {row.with_club && row.club_name
                        ? `${row.club_name} is looking at it.`
                        : "A site admin is looking at it, not the club."}
                    </Typography>
                  ) : null}

                  {/* This read "They said" because, since 0128, the club
                      answers its own reports first and naming the wrong person
                      is worse than naming nobody. 0196 returns which it was,
                      so it can be named. */}
                  {row.resolution ? (
                    <Typography sx={{ fontSize: "0.85rem", color: tokens.ink,
                                      pl: 1.5, borderLeft: `2px solid ${tokens.rule}` }}>
                      {!knows(row) ? "They said: "
                        : row.with_club && row.club_name ? `${row.club_name} said: `
                        : "A site admin said: "}
                      {row.resolution}
                    </Typography>
                  ) : null}

                  {/* Pushed to the bottom so every card in a row lines its
                      footer up, however long the words above it ran. */}
                  <Box sx={{ flex: 1 }} />
                  <Stack direction="row"
                    sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}`,
                          alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                      color: tokens.inkMuted }}>
                      {shortDate(row.created_at)}
                      {row.resolved_at ? ` · answered ${shortDate(row.resolved_at)}` : ""}
                    </Typography>
                    {/* Only while it is waiting. Once an admin has ruled, the
                        ruling is theirs and not something to erase. */}
                    {row.status === "open" ? (
                      <Button variant="text" size="small" onClick={() => setTaking(row)}
                        sx={{ color: tokens.inkMuted, mr: -1 }}>
                        Take it back
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ))}
            </Box>
          )}

          <Pager page={page.page} total={page.total} size={page.perPage}
            noun="reports"
            href={{ path: "/account/reports", params: {
              state: tab || undefined,
              type: type || undefined,
              q: query || undefined,
              sort: sort || undefined,
            } }} />
        </Stack>
      </BusyOverlay>

      <ConfirmDialog
        open={taking !== null}
        title="Take this report back?"
        body="It leaves the admin queue and nobody looks at it. You can report the same thing again later if you change your mind."
        confirmLabel="Take it back"
        busy={busy}
        onConfirm={() => {
          // Built outside the transition and dispatched inside it, which is
          // both the rule and what `check:actions` can see.
          const data = new FormData();
          data.set("flag", String(taking?.id ?? 0));
          start(() => act(data));
        }}
        onClose={() => setTaking(null)}
      />
    </Stack>
  );
}
