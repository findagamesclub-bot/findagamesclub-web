/** One conversation in the inbox. */
export type MessageThread = {
  clubId: number;
  clubSlug: string;
  clubName: string;
  /** The other person. Threads are always two people at one club. */
  personId: string;
  personName: string;
  latest: string;
  latestAt: string;
  /** Messages they sent that arrived after your watermark. */
  unread: number;
  messageCount: number;
};

export type DirectMessage = {
  id: number;
  content: string;
  createdAt: string;
  isMine: boolean;
  senderName: string;
};

export type Conversation = {
  clubId: number;
  clubSlug: string;
  clubName: string;
  personId: string;
  personName: string;
  messages: DirectMessage[];
};

/** Somebody the viewer may open a conversation with. */
export type Contact = {
  personId: string;
  personName: string;
  clubId: number;
  clubSlug: string;
  clubName: string;
};

/**
 * One row in the messages rail.
 *
 * Everybody you may write to, whether or not you ever have. A contact with no
 * conversation yet is the same row with nothing said in it — keeping them in
 * separate lists made you go and find a person before you could start.
 */
export type RailEntry = {
  clubId: number;
  clubSlug: string;
  clubName: string;
  personId: string;
  personName: string;
  /** Null until somebody says something. */
  latest: string | null;
  latestAt: string | null;
  unread: number;
};
