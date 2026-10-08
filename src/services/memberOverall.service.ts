import "server-only";

import * as repo from "@/repositories/memberOverall.repository";
import { allSources, combine, type SourceRecord } from "@/utils/overall-record";
import { winRate } from "@/utils/meta-signal";

export type OverallRecord = {
  sources: SourceRecord[];
  total: Omit<SourceRecord, "source">;
  /** Null when they have played nothing, never 0: see `winRate`. */
  rate: number | null;
};

/**
 * Everything a member has played, in one answer.
 *
 * The client asked for event and competition results to count towards the
 * same figure as club nights, and until now the three lived on three screens
 * and nothing added them up. The split is kept beside the total because the
 * three are different kinds of evidence, which the panel says in a line.
 */
export async function getOverallRecord(profileId: string): Promise<OverallRecord> {
  const rows = await repo.findOverallRecord(profileId);
  const total = combine(rows);
  return { sources: allSources(rows), total, rate: winRate(total.played, total.wins) };
}
