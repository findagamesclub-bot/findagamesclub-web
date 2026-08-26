import type { PollResult } from "@/utils/poll";

/** One thread on a club's board, as a list row. */
export type BoardPost = {
  id: number;
  category: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  /** The newest reply, or the post itself. What the board sorts on. */
  lastActivityAt: string;
  replyCount: number;
  /** Null when the thread carries no poll. */
  poll: PollResult | null;
  isMine: boolean;
  canRemove: boolean;
  /**
   * Set when the thread has been taken down. Only its author and the club can
   * see it at all; everyone else gets no row. Null on a live thread.
   */
  removed: { byMe: boolean; byClub: boolean } | null;
};

export type BoardReply = {
  id: number;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  isMine: boolean;
  canRemove: boolean;
};

export type BoardThread = BoardPost & {
  clubSlug: string;
  clubName: string;
  replies: BoardReply[];
};
