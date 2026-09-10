"use server";

import { getCurrentProfile } from "@/services/auth.service";
import { getUnreadCount as countNotifications } from "@/services/notifications.service";
import { getUnreadCount as countMessages } from "@/services/messages.service";

export type UnreadCounts = { notifications: number; messages: number };

/**
 * The two badges, recounted.
 *
 * Asked for rather than worked out from the event that prompted it. A realtime
 * payload says one row changed, not what the total is now, and a badge that
 * adds and subtracts its own way to a number drifts the first time it misses
 * an event or sees one twice.
 */
export async function unreadCountsAction(): Promise<UnreadCounts> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { notifications: 0, messages: 0 };

  const [notifications, messages] = await Promise.all([
    countNotifications(viewer.id).catch(() => 0),
    countMessages(viewer.id).catch(() => 0),
  ]);
  return { notifications, messages };
}
