import "server-only";

import * as repo from "@/repositories/moneyEvents.repository";
import type {
  MoneyAudience, MoneyEvent, MoneyEventKind, MoneyScope,
} from "@/utils/money-events";

/**
 * One history, for however many rows a page is showing.
 *
 * A failure answers with an empty map rather than throwing: a bookings list
 * whose money log will not load should still list the bookings, the same call
 * the analytics dashboard makes about its six reads.
 */
export async function getMoneyHistory(
  scope: MoneyScope, entities: number[],
): Promise<Map<number, MoneyEvent[]>> {
  const out = new Map<number, MoneyEvent[]>();
  const ids = Array.from(new Set(entities.filter((one) => Number.isFinite(one))));
  if (!ids.length) return out;

  const rows = await repo.findMoneyHistory(scope, ids).catch(() => []);
  for (const row of rows ?? []) {
    const event: MoneyEvent = {
      id: Number(row.id),
      entityId: Number(row.entity_id),
      side: row.side ?? "",
      kind: (row.kind ?? "note") as MoneyEventKind,
      state: row.state ?? "",
      method: row.method ?? "",
      note: row.note ?? "",
      at: row.happened_at,
      automatic: Boolean(row.automatic),
      author: row.author_name ?? "",
      // Anything we do not recognise is the club's own, which is the answer
      // that cannot leak a note somebody wrote expecting privacy.
      audience: row.audience === "member" ? "member" : "club",
    };
    const held = out.get(event.entityId);
    if (held) held.push(event);
    else out.set(event.entityId, [event]);
  }
  return out;
}

/** One row's history, for a screen that only ever shows one. */
export async function getMoneyHistoryFor(
  scope: MoneyScope, entity: number,
): Promise<MoneyEvent[]> {
  const map = await getMoneyHistory(scope, [entity]);
  return map.get(entity) ?? [];
}

export async function addMoneyNote(params: {
  scope: MoneyScope; entity: number; side?: string; note: string;
  audience?: MoneyAudience;
}): Promise<void> {
  await repo.writeMoneyNote(
    params.scope, params.entity, params.side ?? "", params.note,
    params.audience ?? "club");
}
