import { callRpc } from "@/lib/supabase/table";

/**
 * Everything about a member code goes through 0177's own functions.
 *
 * `member_codes` is deliberately not selectable past your own row, and the
 * claim has to answer "could THIS caller claim this", which is a question only
 * the database can answer. Going through functions also keeps
 * `npm run check:columns` honest, since nothing here is in the generated
 * schema yet.
 */

export async function readMyCode(): Promise<string> {
  return callRpc<string>("my_member_code");
}

export async function rotateMyCode(): Promise<string> {
  return callRpc<string>("rotate_member_code");
}

export type CodeHolder = { profile_id: string; full_name: string };

/** Zero rows for a code nobody holds, which is not an error. */
export async function findByCode(
  clubId: number, code: string,
): Promise<CodeHolder[]> {
  return callRpc<CodeHolder[]>("member_by_code", { p_club: clubId, p_code: code });
}

export async function countClaimable(eventId: number): Promise<number> {
  return callRpc<number>("claimable_event_names", { p_event: eventId });
}

export async function claimNames(eventId: number): Promise<number> {
  return callRpc<number>("claim_event_names", { p_event: eventId });
}
