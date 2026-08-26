import "server-only";

import * as repo from "@/repositories/discussions.repository";
import { parsePoll, tally, type Poll } from "@/utils/poll";
import type { BoardPost, BoardReply, BoardThread } from "@/types/discussion";

/**
 * The club discussion board.
 *
 * Nothing here decides who may read what — RLS does, through
 * can_use_discussion_category(). A category the viewer's tier does not reach
 * simply returns no rows, so the board cannot leak by forgetting a filter.
 */

type Viewer = { id: string; canManageClub: boolean };

/**
 * How a removed thread should read to whoever is looking at it.
 *
 * "You deleted this" and "the club removed this" are different facts and the
 * author needs to be able to tell them apart — one is something they did, the
 * other is something done to them.
 */
function removalOf(
  row: { removed_at: string | null; removed_by: string | null; author_profile_id: string },
  viewerId: string,
) {
  if (!row.removed_at) return null;
  return {
    byMe: row.removed_by === viewerId,
    byClub: row.removed_by !== null && row.removed_by !== row.author_profile_id,
  };
}

type Author = { id: string; full_name: string | null } | null;

function nameOf(author: Author): string {
  return author?.full_name?.trim() || "Club member";
}

function pollOf(
  raw: unknown,
  votes: { option_key: string; profile_id: string }[],
  viewerId: string,
) {
  const poll = parsePoll(raw) as Poll | null;
  if (!poll) return null;

  const mine = votes.find((v) => v.profile_id === viewerId)?.option_key ?? null;
  return tally(poll, votes.map((v) => ({ optionKey: v.option_key })), mine);
}

export async function getBoard(
  clubId: number,
  viewer: Viewer,
  category?: string | null,
): Promise<BoardPost[]> {
  const rows = await repo.findPosts(clubId, category);

  return rows.map((row) => {
    const r = row as unknown as {
      profiles: Author;
      club_discussion_replies: { id: number; created_at: string; removed_at: string | null }[] | null;
      club_discussion_poll_votes: { option_key: string; profile_id: string }[] | null;
    };
    const isMine = row.author_profile_id === viewer.id;
    const live = (r.club_discussion_replies ?? []).filter((x) => !x.removed_at);

    return {
      id: row.id,
      category: row.category,
      title: row.title,
      content: row.content,
      authorId: row.author_profile_id,
      authorName: nameOf(r.profiles),
      createdAt: row.created_at,
      replyCount: live.length,
      // A board sorts by the last thing said in a thread, not by when it was
      // started. A question answered an hour ago belongs above one posted
      // yesterday that nobody replied to.
      lastActivityAt: live.reduce((latest, x) =>
        x.created_at > latest ? x.created_at : latest, row.created_at),
      poll: pollOf(row.poll, r.club_discussion_poll_votes ?? [], viewer.id),
      isMine,
      canRemove: isMine || viewer.canManageClub,
      removed: removalOf(row, viewer.id),
    };
  })
  .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export async function getThread(postId: number, viewer: Viewer): Promise<BoardThread | null> {
  const row = await repo.findPost(postId);
  if (!row) return null;

  const r = row as unknown as {
    profiles: Author;
    clubs: { slug: string; name: string };
    club_discussion_poll_votes: { option_key: string; profile_id: string }[] | null;
    club_discussion_replies: {
      id: number; content: string; created_at: string; author_profile_id: string;
      removed_at: string | null; profiles: Author;
    }[] | null;
  };

  const isMine = row.author_profile_id === viewer.id;

  // Removed replies are filtered here rather than in the query: postgrest
  // cannot filter an embedded table without also dropping parents that have
  // none, which would hide a thread the moment its only reply went.
  const replies: BoardReply[] = (r.club_discussion_replies ?? [])
    .filter((reply) => !reply.removed_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((reply) => ({
      id: reply.id,
      content: reply.content,
      authorId: reply.author_profile_id,
      authorName: nameOf(reply.profiles),
      createdAt: reply.created_at,
      isMine: reply.author_profile_id === viewer.id,
      canRemove: reply.author_profile_id === viewer.id || viewer.canManageClub,
    }));

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    authorId: row.author_profile_id,
    authorName: nameOf(r.profiles),
    createdAt: row.created_at,
    lastActivityAt: replies.at(-1)?.createdAt ?? row.created_at,
    replyCount: replies.length,
    poll: pollOf(row.poll, r.club_discussion_poll_votes ?? [], viewer.id),
    isMine,
    canRemove: isMine || viewer.canManageClub,
    removed: removalOf(row, viewer.id),
    clubSlug: r.clubs.slug,
    clubName: r.clubs.name,
    replies,
  };
}
