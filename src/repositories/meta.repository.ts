import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * The meta rollups, as the database returns them.
 *
 * Every one takes the same three arguments and carries its own guard, so a
 * club somebody is not in is refused here rather than by the page. `p_club`
 * null is the site-wide sample.
 */

type Window = { club: number | null; from: string | null; to: string | null };
const args = (w: Window) => ({ p_club: w.club, p_from: w.from, p_to: w.to });

export type FactionRollup = {
  faction_id: string; faction_label: string;
  appearances: number; games: number; wins: number; draws: number; losses: number;
  win_rate: number; representation: number; podiums: number;
  average_vp: number | null; early_signal: boolean;
};

export type DepthRollup = {
  faction_id: string; faction_label: string; detachment: string;
  disposition?: string;
  appearances: number; games: number; wins: number; win_rate: number;
  early_signal: boolean;
};

export type MatchupRollup = {
  faction_id: string; faction_label: string;
  opponent_id: string; opponent_label: string;
  games: number; wins: number; win_rate: number; early_signal: boolean;
};

export type ContextRollup = {
  kind: string; value: string; games: number; wins: number;
  win_rate: number; early_signal: boolean;
};

export type UnitRollup = {
  faction_id: string; faction_label: string; unit_name: string;
  mvp: number; underwhelming: number; games: number; early_signal: boolean;
};

export type ScopeRow = { club_id: number; club_name: string; tracked: number };

export const findFactions = (w: Window) =>
  callRpc<FactionRollup[]>("meta_factions", args(w));
export const findDetachments = (w: Window) =>
  callRpc<DepthRollup[]>("meta_detachments", args(w));
export const findDispositions = (w: Window) =>
  callRpc<DepthRollup[]>("meta_dispositions", args(w));
export const findMatchups = (w: Window) =>
  callRpc<MatchupRollup[]>("meta_matchups", args(w));
export const findBattleContext = (w: Window) =>
  callRpc<ContextRollup[]>("meta_battle_context", args(w));
export const findUnits = (w: Window) =>
  callRpc<UnitRollup[]>("meta_units", args(w));

export const findScopes = () => callRpc<ScopeRow[]>("meta_scope_counts", {});

export type MemberRollup = {
  faction_id: string; faction_label: string;
  games: number; wins: number; draws: number; losses: number;
  win_rate: number | null; appearances: number; early_signal: boolean;
};

/** What one member plays. RLS decides what comes back, not an argument. */
export const findMemberArmies = (profile: string) =>
  callRpc<MemberRollup[]>("meta_member", { p_profile: profile });

/** One event's armies. Its own scope, because an event is not a club. */
export const findEventArmies = (event: number) =>
  callRpc<DepthRollup[]>("meta_event", { p_event: event });
