"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import Pager from "@/components/ui/Pager";
import UrlFilterBar, { type UrlTab } from "@/components/ui/UrlFilterBar";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import ModerationDialog from "@/components/moderation/ModerationDialog";
import type { ModerationState } from "@/app/admin/moderation/actions";
import type { FlagRow } from "@/services/moderation.service";
import { MODERATION_TARGETS, targetLabel } from "@/utils/moderation-targets";
import { statusTag } from "@/utils/moderation-status";
import { clubIdentity } from "@/utils/club-identity";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

const TYPES = [
  { value: "", label: "Anything" },
  ...MODERATION_TARGETS.map((t) => ({ value: t.key, label: t.plural })),
];

/**
 * Reported content, oldest first while it is waiting.
 *
 * One component for both queues. A club sees the reports on its own club and
 * the admin sees every one on the site, but the card, the filters, the dialog
 * and the two answers are identical, and a second copy would have drifted the
 * first time either changed. What differs is handed in: which action answers a
 * report, where the pager points, and whether there is an Accounts screen to
 * open the author in.
 */
export default function ModerationQueue({
  rows, tabs, tab, type, query, total, page, perPage, failed,
  action, basePath, scope = "site", extraFields,
}: {
  rows: FlagRow[];
  tabs: UrlTab[];
  tab: string; type: string; query: string;
  total: number; page: number; perPage: number; failed: boolean;
  /** A server action, which does cross the boundary. Plain functions do not. */
  action: (prev: ModerationState, data: FormData) => Promise<ModerationState>;
  basePath: string;
  scope?: "site" | "club";
  /**
   * Anything the action needs besides the report itself. The club's one wants
   * a slug to revalidate; the admin's wants nothing. It shipped without this
   * and every answer from a club console came back "That club is not here any
   * more", because the form carried no slug for the action to read.
   */
  extraFields?: Record<string, string>;
}) {
  const [state, act, working] =
    useActionState<ModerationState, FormData>(action, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [sifting, setSifting] = useState(false);
  const [open, setOpen] = useState<FlagRow | null>(null);

  // Closed by the answer landing, not by the click. Closing on the click meant
  // a refusal took the report off the screen along with any note typed into it.
  useActionSuccess(state, () => setOpen(null));

  return (
    <Stack spacing={2}>
      <UrlFilterBar
        query={query}
        placeholder="Search the words, or the reason given"
        tab={tab}
        tabs={tabs}
        sort="oldest"
        sorts={[{ value: "oldest", label: "Longest waiting" }]}
        second={{ label: "Kind", value: type, options: TYPES, param: "type" }}
        defaults={{ state: "", sort: "oldest", type: "" }}
        onBusy={setSifting}
      />

      {/* Said out loud, not only in the empty state. The admin's queue holds
          more than this one, and without a line saying why, a club counting
          four on one screen and three on theirs has no way to tell a rule from
          a bug. Which is exactly how it was found. */}
      {scope === "club" ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                          color: tokens.inkMuted, px: 0.5 }}>
          A review of your club, and anything your own team wrote, goes to a
          site admin instead of here. Nobody rules on themselves.
        </Typography>
      ) : null}

      <BusyOverlay busy={sifting} variant="dim" label="Filtering reports">
        <Stack spacing={2}>
          {failed ? (
            <EmptyState title="The queue would not load"
              description="Nothing was read, so this is not an empty queue. Check the database is reachable and that the latest migrations have been run, then try again." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={tab === "" ? "Nothing is waiting" : "Nothing in this group"}
              description={tab !== ""
                ? "Try a different kind, or clear the filters to see everything."
                : scope === "club"
                  ? "Members can report a board post, a reply or a message. Anything reported at this club lands here. A review of the club, and anything your own team wrote, goes to a site admin instead."
                  : "Members can report a review, a board post, a reply or a message. Anything they report lands here."} />
          ) : (
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {rows.map((row) => {
                const { faction, monogram } =
                  clubIdentity(row.club_slug || row.target_type, row.club_name || "Site");
                const waiting = row.status === "open";
                return (
                  <Stack key={row.id} component="button" type="button"
                    onClick={() => setOpen(row)}
                    sx={{ height: "100%", p: 2, borderRadius: 1.5, textAlign: "left",
                          font: "inherit", color: "inherit", cursor: "pointer",
                          border: `1px solid ${waiting ? tokens.brass : tokens.rule}`,
                          backgroundColor: tokens.paper,
                          transition: "border-color 120ms ease",
                          "&:hover": { borderColor: faction.base } }}>
                    <Stack direction="row" spacing={1.5}
                      sx={{ alignItems: "center", width: "100%" }}>
                      <Box aria-hidden sx={{
                        flexShrink: 0, width: 40, height: 40, borderRadius: 1.25,
                        display: "grid", placeItems: "center",
                        backgroundColor: faction.base, color: "#FFFFFF",
                        fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
                        {monogram}
                      </Box>
                      <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontFamily: display, fontWeight: 700,
                                          fontSize: "1rem", minWidth: 0, overflow: "hidden",
                                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {targetLabel(row.target_type)} by {row.author_name}
                        </Typography>
                        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                          color: tokens.inkMuted, minWidth: 0,
                                          overflow: "hidden", textOverflow: "ellipsis",
                                          whiteSpace: "nowrap" }}>
                          {row.club_name || "Not about a club"}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={0.75}
                      sx={{ flexWrap: "wrap", mt: 1.5 }} useFlexGap>
                      <StatusChip {...statusTag(row.status)} />
                      {row.target_gone ? (
                        <StatusChip label="Words are gone" marker />
                      ) : null}
                    </Stack>

                    {/* Two lines of it, so a card is a card and reading the
                        whole thing is a deliberate act. */}
                    <Typography sx={{ mt: 1.5, fontSize: "0.9rem", color: tokens.inkMuted,
                                      display: "-webkit-box", WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {row.target_gone
                        ? "Taken down, so there is nothing left to read."
                        : (row.title ? `${row.title}. ` : "") + row.body}
                    </Typography>

                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ width: "100%", mt: 1.5, pt: 1.25,
                                      borderTop: `1px solid ${tokens.rule}`,
                                      fontFamily: mono, fontSize: "0.7rem",
                                      color: tokens.inkMuted }}>
                      {/* The reporter's name on both queues (0129). Only an
                          account that has gone has none, and "a member" is the
                          same words the dialog uses for that case. */}
                      {`${row.reporter_name === "Somebody" ? "Reported by a member"
                        : row.reporter_name} · ${shortDate(row.created_at.slice(0, 10))}`}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
          )}

          <Pager page={page} total={total} size={perPage} noun="reports"
            href={{ path: basePath, params: {
              q: query || undefined, state: tab || undefined, type: type || undefined,
            } }} />
        </Stack>
      </BusyOverlay>

      <ModerationDialog
        flag={open}
        busy={working}
        authorBase={scope === "site" ? "/admin/accounts" : "/members"}
        canReopen={scope === "site"}
        onAnswer={(action, reason) => {
          const data = new FormData();
          data.set("flag", String(open?.id ?? 0));
          data.set("action", action);
          data.set("reason", reason);
          for (const [key, value] of Object.entries(extraFields ?? {})) {
            data.set(key, value);
          }
          start(() => act(data));
        }}
        onClose={() => setOpen(null)}
      />
    </Stack>
  );
}
