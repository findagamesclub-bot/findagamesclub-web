"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { unreadCountsAction, type UnreadCounts } from "@/app/inbox-actions";

/**
 * The notification and message badges, kept true without a reload.
 *
 * The server counts both on every render, which is right until something
 * changes while the page sits there. Something always does: a message arrives,
 * or the reader opens a thread and the notice about it clears — and that
 * second one happens *below* the shell that drew the badge, in the same render
 * pass, so the shell can never learn about it from the server that drew it.
 *
 * Two ways of hearing about it, because one is not enough. Realtime catches
 * what happens while the reader sits still. A recount on every navigation
 * catches the rest, including the case above, and it is the one that still
 * works when the socket does not.
 *
 * The Supabase client is normally a repository's business. A realtime channel
 * is not a query and cannot run on the server, so it lives here, next to
 * useLiveMessages which does the same for the conversation panes.
 */
export function useUnreadCounts(
  viewerId: string | null, initial: UnreadCounts,
): UnreadCounts {
  const [counts, setCounts] = useState(initial);
  const pathname = usePathname();
  // The header is mounted inside the admin console too, hidden rather than
  // absent, so both it and the rail run this at once. Two channels sharing a
  // topic on one socket is a collision, not two subscriptions.
  const mount = useId();
  const live = useRef(true);

  // The server's numbers, and whatever has happened since. Reconciled during
  // render rather than in an effect: an effect that mirrors props into state
  // renders twice on every navigation, and this sits in the shell of every
  // page.
  const [seed, setSeed] = useState(initial);
  if (seed.notifications !== initial.notifications || seed.messages !== initial.messages) {
    setSeed(initial);
    setCounts(initial);
  }

  const recount = useCallback(() => {
    if (!viewerId) return;
    void unreadCountsAction().then((next) => { if (live.current) setCounts(next); });
  }, [viewerId]);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  // Every arrival, and every page opened. Opening a conversation is what marks
  // it read, and that write lands after the shell above it has already counted.
  useEffect(() => { recount(); }, [pathname, recount]);

  useEffect(() => {
    if (!viewerId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let open = true;

    // Realtime authorises with the access token, and the browser client reads
    // its session from cookies asynchronously. Subscribing first opens the
    // socket unauthenticated and RLS drops every row.
    void supabase.auth.getSession().then(({ data }) => {
      if (!open) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`unread:${viewerId}:${mount}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "notifications",
            filter: `profile_id=eq.${viewerId}` }, recount)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "club_messages",
            filter: `recipient_id=eq.${viewerId}` }, recount)
        // Marking a thread read is a write on this table, and it is the only
        // announcement the shell gets that one of its badges is now wrong.
        .on("postgres_changes",
          { event: "*", schema: "public", table: "club_message_reads",
            filter: `profile_id=eq.${viewerId}` }, recount)
        .subscribe();
    });

    return () => {
      open = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [viewerId, mount, recount]);

  return counts;
}
