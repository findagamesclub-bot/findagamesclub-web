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
