"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the board when somebody posts, replies or withdraws.
 *
 * A refresh rather than appending the payload, for the same reason
 * `useLiveMessages` refreshes: the payload is the raw row with no author name
 * on it, so appending would mean a second copy of the mapping in
 * `eventBoard.service` and the two would drift.
 *
 * Replies cannot be filtered by event: the row carries a post id, not an event
 * id. RLS narrows them instead, so a subscriber is only woken by replies on a
 * board they already hold a ticket for, which is a handful of rows.
 */
export function useLiveEventBoard(eventId: number, enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime authorises with the access token and the browser client reads
    // its session from cookies asynchronously. Subscribing first opens the
    // socket unauthenticated, and RLS then drops every row.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`event-board:${eventId}`)
        // Removals are updates, not deletes, so "*" rather than INSERT: a
        // thread the club takes down should go on everybody's screen too.
        .on("postgres_changes", {
          event: "*", schema: "public", table: "club_event_board_posts",
          filter: `event_id=eq.${eventId}`,
        }, () => router.refresh())
        .on("postgres_changes", {
          event: "*", schema: "public", table: "club_event_board_replies",
        }, () => router.refresh())
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [eventId, enabled, router]);
}
