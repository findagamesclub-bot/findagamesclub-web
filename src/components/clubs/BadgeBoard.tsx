"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import UrlFilterBar, { type UrlTab } from "@/components/ui/UrlFilterBar";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import BadgeCard from "@/components/clubs/BadgeCard";
import BadgeDialog from "@/components/clubs/BadgeDialog";
import AwardDialog from "@/components/clubs/AwardDialog";
import AwardedList, { type AwardedPage } from "@/components/clubs/AwardedList";
import { badgeAction, type BadgeState } from "@/app/clubs/[slug]/(console)/manage/badges/actions";
import type { ClubBadgeRow } from "@/services/badges.service";
import { BADGE_SORTS, type BadgeFilters } from "@/utils/badge-filters";

/**
 * A club's own badges, and who holds them.
 *
 * Grid, like every other list in the consoles now. A definition card carries
 * how many hold it, because that is the number somebody wants before retiring
 * one, and the number is a link into the awarded list narrowed to that badge.
 */
export default function BadgeBoard({
  slug, badges, allBadges, awarded, members, showing, filters, badgeTabs,
}: {
  slug: string;
  /** The definitions tab, already sifted. */
  badges: ClubBadgeRow[];
  /** Every badge, for the awarded tab's badge picker and the dialogs. */
  allBadges: ClubBadgeRow[];
  /** The awarded tab's page, or null when that tab is not the one showing. */
  awarded: AwardedPage | null;
  /** The roster, for the award picker. Approved members only. */
  members: { id: string; name: string }[];
  showing: "badges" | "awarded";
  filters: BadgeFilters;
  badgeTabs: UrlTab[];
}) {
  const [state, act, working] = useActionState<BadgeState, FormData>(badgeAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [editing, setEditing] = useState<ClubBadgeRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [giving, setGiving] = useState<ClubBadgeRow | null>(null);
  const [sifting, setSifting] = useState(false);

  // Shut whichever one is open once the work has landed. In an effect, never
  // during render: `useActionState` hands back its initial value on every
  // server render, so a state comparison there never settles and the page
  // 500s with "Too many re-renders". A refusal leaves the dialog up with the
  // typing still in it, which is the whole reason it is not closed on click.
  useActionSuccess(state, () => {
    setAdding(false);
    setEditing(null);
    setGiving(null);
  });

  // Above the early return, not below it. Declared after, the awarded tab
  // returns before this binding is initialised and "Take it back" threw
  // "Cannot access 'send' before initialization" on press.
  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    start(() => act(data));
  };

  if (showing === "awarded" && awarded) {
    return (
      <AwardedList page={awarded} slug={slug} badges={allBadges} filters={filters}
        busy={working}
        onRevoke={(award) => send({ intent: "revoke", award: String(award.id) })} />
    );
  }

  return (
    <>
      <Stack spacing={2}>
        <UrlFilterBar
          query={filters.query}
          placeholder="Search by badge name or what it is for"
          tab={filters.state}
          tabs={badgeTabs}
          sort={filters.sort || "name"}
          sorts={BADGE_SORTS}
          defaults={{ state: "", sort: "name" }}
          onBusy={setSifting}
        />

        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            New badge
          </Button>
        </Stack>

        <BusyOverlay busy={sifting} variant="dim" label="Filtering badges">
          {badges.length === 0 ? (
            <EmptyState
              title={filters.query || filters.state
                ? "No badge matches that"
                : "No badges yet"}
              description={filters.query || filters.state
                ? "Try a different word, or clear the filters to see every badge this club gives out."
                : "A badge is something this club gives out: a tournament win, or painting the terrain nobody else will. Members earn the year ones on their own."}
            />
          ) : (
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              sm: "repeat(2, minmax(0, 1fr))",
                                              lg: "repeat(3, minmax(0, 1fr))" } }}>
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge}
                  holdersHref={`/clubs/${slug}/manage/badges?tab=awarded&badge=${badge.id}`}
                  onEdit={() => setEditing(badge)} onGive={() => setGiving(badge)} />
              ))}
            </Box>
          )}
        </BusyOverlay>
      </Stack>

      <BadgeDialog
        open={adding || editing !== null}
        badge={editing}
        busy={working}
        onSave={(fields) => send({ intent: "save", ...fields })}
        onClose={() => { setAdding(false); setEditing(null); }}
      />

      <AwardDialog
        open={giving !== null}
        badge={giving}
        members={members}
        busy={working}
        onAward={(fields) => {
          // getAll is the only way to post several ids under one name, so this
          // one cannot go through `send`.
          const data = new FormData();
          data.set("slug", slug);
          data.set("intent", "award");
          data.set("badge", String(giving?.id ?? 0));
          data.set("note", fields.note);
          for (const id of fields.members) data.append("member", id);
          start(() => act(data));
        }}
        onClose={() => setGiving(null)}
      />
    </>
  );
}
