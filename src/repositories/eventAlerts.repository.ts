import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Saved event searches. The filters ride as jsonb; see migration 0023. */
export type AlertFilters = Record<string, string>;

export type AlertRow = {
  id: number;
  label: string;
  filters: AlertFilters | null;
  created_at: string;
};

/**
 * `src/types/database.ts` is generated from the live schema and does not know
 * this table until 0023 is applied and the types are regenerated. Rather than
 * hand-editing the generated file, the table is described here and the client
 * is narrowed to the calls this repository actually makes.
 *
 * Delete this block after regenerating; the rest of the file needs no change.
 */
type AlertsTable = {
  select(columns: string): {
    eq(column: string, value: string): {
      order(column: string, options: { ascending: boolean }): Promise<
        { data: AlertRow[] | null; error: { message: string } | null }
      >;
    };
  };
  insert(row: { profile_id: string; label: string; filters: AlertFilters }): {
    select(columns: string): {
      maybeSingle(): Promise<{ data: AlertRow | null; error: { message: string } | null }>;
    };
  };
  delete(): {
    eq(column: string, value: number): {
      eq(column: string, value: string): {
        select(columns: string): {
          maybeSingle(): Promise<{ data: { id: number } | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

async function alerts(): Promise<AlertsTable> {
  const supabase = await createClient();
  return (supabase as unknown as { from(table: string): AlertsTable })
    .from("club_event_alerts");
}

export async function findMyAlerts(profileId: string) {
  const { data, error } = await (await alerts())
    .select("id, label, filters, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your alerts: ${error.message}`);
  return data ?? [];
}

export async function insertAlert(profileId: string, label: string, filters: AlertFilters) {
  const { data, error } = await (await alerts())
    .insert({ profile_id: profileId, label, filters })
    .select("id, label")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // RLS filtering an insert returns no row and no error — see CLAUDE.md.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function deleteAlert(id: number, profileId: string) {
  const { data, error } = await (await alerts())
    .delete()
    .eq("id", id)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}
