import { callRpc } from "@/lib/supabase/table";
import type { MoneyScope } from "@/utils/money-events";

/**
 * The money log, read through its function.
 *
 * `club_money_events` is revoked from `authenticated` outright, so there is no
 * PostgREST path to it at all: the guard lives inside `club_money_history`,
 * which decides per row whether this reader is the club, an admin, or the
 * person the money is about. That is also why this goes through `callRpc`
 * rather than the table helper — the generated `database.ts` has never heard
 * of the table.
 */

export type MoneyEventRow = {
  id: number;
  entity_id: number;
  side: string;
  kind: string;
  state: string;
  method: string;
  note: string;
  happened_at: string;
  automatic: boolean;
  author_name: string;
};

/** Many ids at once: a bookings list is twenty rows and one round trip. */
export const findMoneyHistory = (scope: MoneyScope, entities: number[]) =>
  callRpc<MoneyEventRow[]>("club_money_history", {
    p_scope: scope, p_entities: entities,
  });

export const writeMoneyNote = (
  scope: MoneyScope, entity: number, side: string, note: string,
) => callRpc<number>("add_money_note", {
  p_scope: scope, p_entity: entity, p_side: side, p_note: note,
});
