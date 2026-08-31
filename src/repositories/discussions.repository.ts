import "server-only";

import { createClient } from "@/lib/supabase/server";
import { orIlike } from "@/utils/postgrest";

const AUTHOR = "profiles!club_discussion_posts_author_profile_id_fkey(id, full_name)";
const REPLY_AUTHOR = "profiles!club_discussion_replies_author_profile_id_fkey(id, full_name)";

/** The board. RLS drops any category the viewer's tier does not reach. */
export async function findPosts(params: {
  clubId: number;
  category?: string | null;
  search?: string | null;
  offset: number;
  limit: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("club_discussion_posts")
    // `*` rather than a column list: `images` and `last_activity_at` arrived in
    // 0036 and 0037 and the generated types predate them. Every column here is
    // a short field the board already reads.
    .select(
      `*,
       ${AUTHOR},
       club_discussion_replies(id, created_at, removed_at),
       club_discussion_poll_votes(option_key, profile_id)`,
      // The total is what tells the reader there is a page two at all.
      { count: "exact" },
    )
    .eq("club_id", params.clubId);

  if (params.category) query = query.eq("category", params.category);
  if (params.search?.trim()) query = query.or(orIlike(["title", "content"], params.search));

  const { data, error, count } = await query
    // Ordered and paged in the database, not after the fetch: a club with a
    // thousand threads must not ship a thousand rows to sort page one.
    .order("last_activity_at" as never, { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) throw new Error(`Failed to load the board: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function findPost(postId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_discussion_posts")
    .select(
      `*,
       ${AUTHOR},
       club_discussion_poll_votes(option_key, profile_id),
       club_discussion_replies(id, content, created_at, author_profile_id, removed_at, ${REPLY_AUTHOR}),
       clubs!inner(id, slug, name, owner_id)`,
    )
    .eq("id", postId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load that thread: ${error.message}`);
  return data;
}

export async function insertPost(params: {
  clubId: number;
  category: string;
  title: string;
  content: string;
  poll: unknown;
  /** Storage paths, at most two. The column enforces the limit. */
  images?: { path: string; alt: string }[];
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_discussion_posts")
    .insert({
      club_id: params.clubId,
      category: params.category,
      title: params.title,
      content: params.content,
      // Same reason as the select above: cast until the types are regenerated.
      ...({ images: params.images ?? [] } as object),
      poll: (params.poll ?? null) as never,
    })
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  // RLS refused it: the category is reserved, or they are not a member.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function insertReply(postId: number, content: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_discussion_replies")
    .insert({ post_id: postId, content })
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Removal goes through a definer function, not an update.
 *
 * A soft delete writes a row the SELECT policy is meant to hide, and Postgres
 * checks that policy against the new row — so the update refused itself, even
 * for the author. The function holds the author-or-club rule instead, which
 * also puts it somewhere auditable.
 */
export async function removePost(postId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_discussion_post", { target: postId });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function removeReply(replyId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_discussion_reply", { target: replyId });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return { post_id: data as number };
}

/**
 * One vote each, changeable.
 *
 * Update first, insert if there was nothing to update — the same shape as the
 * ticket cart, and for the same reason: postgrest writes every payload column
 * into ON CONFLICT DO UPDATE, and the grants allow updating only the choice.
 */
export async function castVote(postId: number, optionKey: string) {
  const supabase = await createClient();

  const { data: changed, error: updateError } = await supabase
    .from("club_discussion_poll_votes")
    .update({ option_key: optionKey, voted_at: new Date().toISOString() })
    .eq("post_id", postId)
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (changed) return;

  const { error } = await supabase
    .from("club_discussion_poll_votes")
    .insert({ post_id: postId, option_key: optionKey });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}
