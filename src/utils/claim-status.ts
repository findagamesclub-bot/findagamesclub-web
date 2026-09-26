/**
 * What state a claim is in, and what that allows.
 *
 * Same shape as `submission-status.ts`, deliberately: an admin works two queues
 * and should not have to learn two vocabularies. The wording differs because
 * the thing differs — a submission is a club asking to exist, a claim is
 * somebody saying an existing one is theirs.
 */

export const CLAIM_STATUSES = ["open", "approved", "declined", "withdrawn"] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value);
}

export const CLAIM_LABELS: Record<ClaimStatus, string> = {
  open: "Waiting for an answer",
  approved: "Handed over",
  declined: "Turned down",
  withdrawn: "Taken back",
};

export type ClaimTone = "neutral" | "warn" | "good" | "bad";

export const CLAIM_TONES: Record<ClaimStatus, ClaimTone> = {
  open: "warn",
  approved: "good",
  declined: "bad",
  withdrawn: "neutral",
};

export function claimLabel(value: string): string {
  return isClaimStatus(value) ? CLAIM_LABELS[value] : value;
}

export function claimTone(value: string): ClaimTone {
  return isClaimStatus(value) ? CLAIM_TONES[value] : "neutral";
}

/** An admin acts on exactly one state. Everything else is already answered. */
export function adminCanAnswer(status: string): boolean {
  return status === "open";
}

/** And the claimant can take back exactly one. */
export function claimantCanWithdraw(status: string): boolean {
  return status === "open";
}

export const CLAIM_TABS: { key: ClaimStatus | "all"; label: string }[] = [
  { key: "open", label: "Waiting" },
  { key: "approved", label: "Handed over" },
  { key: "declined", label: "Turned down" },
  { key: "all", label: "All" },
];

/**
 * The one sentence the claimant's own view leads with.
 *
 * Says what happened and what to do next, the same job `ownerNextStep` does for
 * a listing.
 */
export function claimantNextStep(
  status: string, detail: { note?: string; club?: string } = {},
): string {
  switch (status) {
    case "open":
      return "We have your claim. Somebody will look at it and we will email you "
        + "either way, usually within a few days.";
    case "approved":
      return detail.club
        ? `${detail.club} is yours. You can run it from the console now.`
        : "The club is yours. You can run it from the console now.";
    case "declined":
      return detail.note
        ? `We could not hand this one over: ${detail.note}`
        : "We could not hand this one over.";
    case "withdrawn":
      return "You took this one back. You can claim it again if it is still open.";
    default:
      return "";
  }
}
