import "server-only";

import { createClient } from "@/lib/supabase/server";

const SENDER = "sender:profiles!club_messages_sender_id_fkey(id, full_name, role)";
const RECIPIENT = "recipient:profiles!club_messages_recipient_id_fkey(id, full_name, role)";

/**
 * Direct messages.
 *
 * Threads are grouped in the service, not in SQL: postgrest cannot group, and
 * the alternative is a view per shape. At the volumes a club generates this is
 * one indexed read, so the cost is the honesty of saying so rather than
 * pretending a view would scale better.
 */
export async function findMyMessages(limit = 500) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_messages")
    .select(
      `id, club_id, sender_id, recipient_id, content, created_at, pair_low, pair_high,
       ${SENDER}, ${RECIPIENT},
       clubs(id, slug, name)`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load your messages: ${error.message}`);
  return data ?? [];
}

/** One conversation, oldest first, which is how a conversation reads. */
export async function findThread(clubId: number | null, low: string, high: string) {
  const supabase = await createClient();
  const query = supabase
    .from("club_messages")
    .select(
      `id, club_id, sender_id, recipient_id, content, created_at,
       ${SENDER}, ${RECIPIENT},
       clubs(id, slug, name)`,
    );
  // eq() cannot express "is null", so the club is filtered either way here.
  const scoped = clubId === null ? query.is("club_id", null) : query.eq("club_id", clubId);
  const { data, error } = await scoped
    .eq("pair_low", low)
    .eq("pair_high", high)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(`Failed to load that conversation: ${error.message}`);
  return data ?? [];
}

export async function findReadMarks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_message_reads")
    .select("club_id, pair_low, pair_high, read_at");

  if (error) throw new Error(`Failed to load read state: ${error.message}`);
  return data ?? [];
}

export async function insertMessage(
  clubId: number | null, recipientId: string, content: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_messages")
    // club_id is nullable since 0075; the generated types catch up when
    // database.ts is regenerated.
    .insert({ club_id: clubId, recipient_id: recipientId, content } as never)
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  // RLS refused: can_message_member said no.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Move the watermark.
 *
 * Update first, insert if there was nothing to move — the same shape as the
 * ticket cart and the poll vote, and for the same reason: the grants allow
 * updating only `read_at`, which an upsert's DO UPDATE would overrun.
 */
export async function markRead(clubId: number | null, low: string, high: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const marks = supabase
    .from("club_message_reads")
    .update({ read_at: now });
  const scoped = clubId === null ? marks.is("club_id", null) : marks.eq("club_id", clubId);

  const { data, error } = await scoped
    .eq("pair_low", low)
    .eq("pair_high", high)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return;

  const { error: insertError } = await supabase
    .from("club_message_reads")
    .insert({ club_id: clubId, pair_low: low, pair_high: high, read_at: now } as never);

  // A second tab marked it read first. The watermark is already where we
  // wanted it, so this is not a failure.
  if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
}

/**
 * Approved members of the clubs the viewer is in, minus the viewer.
 *
 * "In" means joined *or* owns. An owner has no membership row for their own
 * club — they own it — so asking only club_memberships gave every club owner an
 * empty contact list and no way to open a conversation with their own members.
 */
export async function findContacts(profileId: string) {
  const supabase = await createClient();

  const [joined, owned] = await Promise.all([
    supabase.from("club_memberships").select("club_id")
      .eq("profile_id", profileId).eq("status", "approved"),
    supabase.from("clubs").select("id").eq("owner_id", profileId),
  ]);

  if (joined.error) throw new Error(`Failed to load your clubs: ${joined.error.message}`);
  if (owned.error) throw new Error(`Failed to load your clubs: ${owned.error.message}`);

  const clubIds = [...new Set([
    ...(joined.data ?? []).map((m) => m.club_id),
    ...(owned.data ?? []).map((c) => c.id),
  ])];
  if (!clubIds.length) return [];

  const { data, error } = await supabase
    .from("club_memberships")
    .select("club_id, profile_id, profiles!club_memberships_profile_id_fkey(id, full_name), clubs!inner(id, slug, name)")
    .in("club_id", clubIds)
    .eq("status", "approved")
    .neq("profile_id", profileId);

  if (error) throw new Error(`Failed to load club members: ${error.message}`);
  return data ?? [];
}

export type AdminContactRow = { id: string; full_name: string | null; email: string };

/**
 * Every account an admin may write to, which is every account.
 *
 * A definer function rather than a query: nothing ties an admin to these
 * people, so no policy would return them, and the address lives in auth.users
 * where no policy reaches at all.
 */
export async function findAdminContacts(query: string): Promise<AdminContactRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: AdminContactRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("admin_message_contacts", { p_query: query });

  if (error) throw new Error(`Failed to search accounts: ${error.message}`);
  return data ?? [];
}
