"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import NavTabs from "@/components/ui/NavTabs";
import MetaCaveats from "./MetaCaveats";
import MetaFilters, { type Scope } from "./MetaFilters";
import MetaRows, { type MetaRow } from "./MetaRows";
import { META_TABS, type MetaTab } from "@/utils/meta-tabs";
import { metaSummary, metaTakeaways } from "@/utils/meta-takeaways";
import { lensLabel, type LensKey } from "@/utils/meta-lens";
import { trendRows, trendNote } from "@/utils/meta-trend";
import type { MetaView } from "@/services/meta.service";
import { tokens } from "@/lib/tokens";

/**
 * The tracker: one ranking at a time, with the sentence that explains it.
 *
 * Tabs rather than one long page, because the analytics page shipped as a
 * scroll with a jump-to bar and the client asked for tabs. Only the open tab
 * is read, so the address is what decides the query.
 */
export default function MetaBoard({
  view, tab, scope, lens, scopes, at,
}: {
  view: MetaView;
  tab: MetaTab;
  scope: string;
  lens: LensKey;
  scopes: Scope[];
  /** Built on the server: a function cannot cross into a client component. */
  at: { value: MetaTab; href: string }[];
}) {
  const [sifting, setSifting] = useState(false);

  const summary = metaSummary({
    lensLabel: lensLabel(lens),
    factions: view.factions,
    detachments: view.detachments,
    dispositions: view.dispositions,
  });

  const takeaways = metaTakeaways({
    factions: view.factions,
    detachments: view.detachments,
    dispositions: view.dispositions,
    matchups: view.matchups,
    missions: view.context.filter((c) => c.kind === "mission"),
    terrain: view.context.filter((c) => c.kind === "terrain"),
    units: view.units,
  });

  const rows: MetaRow[] = pick(view, tab, lensLabel(lens));

  return (
    <Stack spacing={2.5}>
      <MetaFilters scope={scope} lens={lens} scopes={scopes} onBusy={setSifting} />

      {view.refused ? (
        <EmptyState
          title="That club is not yours to read"
          description="The tracker narrows to clubs you belong to. Pick one of yours, or read the site-wide sample." />
      ) : (
        <BusyOverlay busy={sifting} variant="dim" label="Reading the meta">
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2}
              sx={{ alignItems: "flex-start", flexWrap: "wrap" }} useFlexGap>
              <Typography sx={{ fontSize: "1rem", flex: 1, minWidth: 260 }}>
                {summary}
              </Typography>
              <MetaCaveats />
            </Stack>

            {takeaways.length ? (
              <Stack component="ul" spacing={0.75}
                sx={{ pl: 2.5, m: 0, "& li": { color: tokens.inkMuted } }}>
                {takeaways.map((line) => (
                  <Typography key={line} component="li" variant="body2">{line}</Typography>
                ))}
              </Stack>
            ) : null}

            <NavTabs ariaLabel="The meta" value={tab}
              tabs={META_TABS.map((one) => ({
                value: one.value, label: one.label,
                href: at.find((a) => a.value === one.value)?.href ?? "/meta-tracker",
              }))} />

            <MetaRows rows={rows} noun={NOUN[tab]}
              empty={emptyTitle(tab)}
              emptyNote="Results appear here once a club has confirmed them. Until then they are one player's word." />
          </Stack>
        </BusyOverlay>
      )}
    </Stack>
  );
}

/** What the pager counts on each tab. */
const NOUN: Record<MetaTab, string> = {
  factions: "factions", detachments: "detachments", matchups: "matchups",
  context: "settings", units: "units", trend: "months",
};

const KIND_LABEL: Record<string, string> = {
  mission: "Mission", deployment: "Deployment", terrain: "Terrain",
  first_turn: "Turn order", battle_role: "Battle role",
};

/** One tab, one list. Everything the tracker shows is a ranking. */
function pick(view: MetaView, tab: MetaTab, lens: string): MetaRow[] {
  if (tab === "detachments") {
    return [...view.detachments, ...view.dispositions];
  }
  if (tab === "matchups") {
    return view.matchups.map((m) => ({
      label: m.label, parent: `into ${m.opponent}`,
      winRate: m.winRate, games: m.games, earlySignal: m.earlySignal,
    }));
  }
  if (tab === "context") {
    return view.context.map((c) => ({
      label: c.value, parent: KIND_LABEL[c.kind] ?? c.kind,
      winRate: c.winRate, games: c.games, earlySignal: c.earlySignal,
    }));
  }
  if (tab === "units") {
    return view.units.map((u) => ({
      label: u.unitName, parent: u.label,
      // A unit has no win rate of its own: it is tagged, not scored. The bar
      // shows how often it was named as the one that earned it.
      winRate: u.games > 0 ? Math.round((1000 * u.mvp) / u.games) / 10 : null,
      games: u.games, earlySignal: u.earlySignal,
      note: `${u.mvp} earned it · ${u.underwhelming} did not`,
    }));
  }
  if (tab === "trend") {
    // One row per faction, not one per faction per month: ninety-six cards is
    // the data behind a trend, not the trend.
    return trendRows(view.factions, view.before).map((t) => ({
      label: t.label, parent: trendNote(t, lens),
      winRate: t.winRate, games: t.games, earlySignal: t.earlySignal,
      note: t.delta === null ? undefined
        : `${t.delta > 0 ? "+" : ""}${t.delta.toFixed(1)} points`,
    }));
  }
  return view.factions.map((f) => ({
    label: f.label, winRate: f.winRate, games: f.games,
    earlySignal: f.earlySignal,
    note: `${f.representation}% of what was taken`
      + (f.podiums ? ` · ${f.podiums} on a podium` : ""),
  }));
}

function emptyTitle(tab: MetaTab): string {
  if (tab === "matchups") return "No matchups yet";
  if (tab === "context") return "No missions recorded yet";
  if (tab === "units") return "No units tagged yet";
  if (tab === "trend") return "Not enough months yet";
  if (tab === "detachments") return "No detachments recorded yet";
  return "Nothing has been recorded yet";
}
