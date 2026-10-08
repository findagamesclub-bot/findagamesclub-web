import "server-only";

import { callRpc } from "@/lib/supabase/table";
import type { SourceRecord } from "@/utils/overall-record";

type Row = {
  source: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
};

/**
 * Through `member_overall_record` (0166) rather than the three tables.
 *
 * Bookings, event armies and standings each have their own select policy and
 * none of them would answer a clubmate reading somebody else's page. The
 * function is definer and asks one question instead: do these two share a
 * club. Same shape as `member_loyalty_standing`.
 */
export async function findOverallRecord(profileId: string): Promise<SourceRecord[]> {
  const rows = await callRpc<Row[]>("member_overall_record", { p_profile: profileId });
  return (rows ?? []).map((row) => ({
    source: row.source as SourceRecord["source"],
    played: Number(row.played) || 0,
    wins: Number(row.wins) || 0,
    draws: Number(row.draws) || 0,
    losses: Number(row.losses) || 0,
  }));
}
