import "server-only";

import * as repo from "@/repositories/notifications.repository";

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

/** What the panel shows when opened. Twenty is a screenful and a bit. */
const PANEL = 20;

/**
 * The bell.
 *
 * The badge is a count, never a list: it renders on every page for every
 * signed-in person, so it has to be one indexed read. The rows are fetched
 * only when the panel opens.
 *
 * Every read is wrapped: a bell that fails must not take a page down with it,
 * and the table does not exist until 0027 is applied.
 */
export async function getUnreadCount(profileId: string): Promise<number> {
  try {
    return await repo.countUnread(profileId);
  } catch {
    return 0;
  }
}

export async function getNotifications(profileId: string): Promise<Notification[]> {
  try {
    const rows = await repo.findRecent(profileId, PANEL);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      createdAt: row.created_at,
      read: Boolean(row.read_at),
    }));
  } catch {
    return [];
  }
}

export async function readAll(profileId: string): Promise<{ ok: boolean }> {
  try {
    await repo.markAllRead(profileId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function readOne(profileId: string, id: number): Promise<{ ok: boolean }> {
  try {
    await repo.markOneRead(profileId, id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
