/**
 * The Match context on a game result.
 *
 * Every vocabulary here is legacy's, verbatim: RESULT_DEPLOYMENT_LABELS,
 * RESULT_MISSION_SUGGESTIONS, RESULT_TERRAIN_SUGGESTIONS and
 * RESULT_CONFIRMATION_STATE_LABELS from club_store.py and detail.js. Missions
 * and terrain are suggestions rather than a fixed list because clubs invent
 * their own; deployment and confirmation are closed sets and the database
 * enforces both.
 */

import { playsFortyK } from "./event-meta";

export const DEPLOYMENTS = [
  { value: "search-and-destroy", label: "Search and Destroy" },
  { value: "dawn-of-war", label: "Dawn of War" },
  { value: "hammer-and-anvil", label: "Hammer and Anvil" },
  { value: "sweeping-engagement", label: "Sweeping Engagement" },
  { value: "tipping-point", label: "Tipping Point" },
  { value: "crucible-of-battle", label: "Crucible of Battle" },
] as const;

export const MISSION_SUGGESTIONS = [
  "Linchpin", "Purge the Foe", "Take and Hold", "Terraform", "Scorched Earth",
  "The Ritual", "Supply Drop", "Hidden Supplies", "Sites of Power", "Priority Targets",
];

export const TERRAIN_SUGGESTIONS = [
  "Games Workshop", "UKTC", "WTC", "Player placed", "Custom terrain",
];

export type ConfirmationState = "submitted" | "disputed" | "confirmed" | "admin-confirmed";

export const CONFIRMATIONS: { value: ConfirmationState; label: string; help: string }[] = [
  { value: "submitted", label: "Submitted",
    help: "Recorded by a player. Either player can still change it." },
  { value: "confirmed", label: "Confirmed by both players",
    help: "Both players agree. Players can still edit it." },
  { value: "disputed", label: "Disputed",
    help: "Players disagree. Locked until the club settles it." },
  { value: "admin-confirmed", label: "Admin confirmed",
    help: "Settled by the club. Only the club can change it now." },
];

/** Whatever the column holds, reduced to a state the page can render. */
export function toConfirmation(value: unknown): ConfirmationState {
  const clean = String(value ?? "").trim().toLowerCase();
  return CONFIRMATIONS.some((c) => c.value === clean)
    ? (clean as ConfirmationState)
    : "submitted";
}

export function confirmationLabel(value: unknown): string {
  const state = toConfirmation(value);
  return CONFIRMATIONS.find((c) => c.value === state)?.label ?? "Submitted";
}

export function deploymentLabel(value: unknown): string {
  const clean = String(value ?? "").trim().toLowerCase();
  return DEPLOYMENTS.find((d) => d.value === clean)?.label ?? "";
}

/**
 * Whether this result is closed to the players.
 *
 * Mirrors _can_update_booking_result: a disputed or admin-confirmed result
 * belongs to the club. The database refuses the write either way; this is so
 * the page can say why rather than letting somebody type into a dead form.
 */
export function isLocked(value: unknown): boolean {
  const state = toConfirmation(value);
  return state === "disputed" || state === "admin-confirmed";
}

/** A deployment the database will accept, or empty. */
export function safeDeployment(value: unknown): string {
  const clean = String(value ?? "").trim().toLowerCase();
  return DEPLOYMENTS.some((d) => d.value === clean) ? clean : "";
}

/**
 * Whether the match setup fields mean anything for this game.
 *
 * Mission, deployment and terrain are 40k's own vocabulary: a Blood Bowl
 * result has no deployment and the six this file lists are 40k's six. The
 * client asked for them to be "hidden unless Warhammer 40k game is selected.
 * Any other game result should just record the score and the result state."
 *
 * The result state is NOT setup. It is the club's ruling on the game and
 * applies whatever was played, which is why it is not in here.
 */
export function recordsMatchSetup(game: string | null | undefined): boolean {
  return playsFortyK([game ?? ""]);
}

export type MatchSetup = { mission: string; deployment: string; terrain: string };

const NO_SETUP: MatchSetup = { mission: "", deployment: "", terrain: "" };

/**
 * What to store for a game that no longer shows those fields.
 *
 * Hiding a field is not the same as emptying it. Without this, a 40k result
 * corrected to Blood Bowl keeps a mission and a deployment nobody can see or
 * edit, and the tracker goes on counting them. Same shape and the same reason
 * as `armiesFor` in `games.service`, which 0165 added for the army half.
 *
 * An undefined game means "not being changed", so the setup is left alone.
 */
export function matchSetupFor(
  game: string | undefined, setup: MatchSetup,
): MatchSetup {
  if (game !== undefined && !recordsMatchSetup(game)) return NO_SETUP;
  return setup;
}
