import "server-only";

import { createClient } from "@/lib/supabase/server";

const AUTHOR = "profiles!club_discussion_posts_author_profile_id_fkey(id, full_name)";
const REPLY_AUTHOR = "profiles!club_discussion_replies_author_profile_id_fkey(id, full_name)";

/** The board. RLS drops any category the viewer's tier does not reach. */
export async function findPosts(clubId: number, category?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("club_discussion_posts")
    .select(
      `id, club_id, category, title, content, poll, created_at, updated_at, author_profile_id,
       removed_at, removed_by,
       ${AUTHOR},
       club_discussion_replies(id, created_at, removed_at),
       club_discussion_poll_votes(option_key, profile_id)`,
    )
    .eq("club_id", clubId);

  if (category) query = query.eq("category", category);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Failed to load the board: ${error.message}`);
  return data ?? [];
}

export async function findPost(postId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_discussion_posts")
    .select(
      `id, club_id, category, title, content, poll, created_at, updated_at, author_profile_id,
       removed_at, removed_by,
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
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_discussion_posts")
    .insert({
      club_id: params.clubId,
      category: params.category,
      title: params.title,
      content: params.content,
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
