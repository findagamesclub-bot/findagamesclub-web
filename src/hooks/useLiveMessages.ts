"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when a message arrives for the viewer.
 *
 * It refreshes rather than appending the payload to local state. The payload
 * is the raw row — no sender name, no `isMine`, no club — so appending it
 * would mean a second copy of the mapping in `messages.service`, and the two
 * would drift. A refresh costs a round trip and keeps one source of truth.
 *
 * Filtered on `recipient_id` because messages you sent are already on screen:
 * the send is a server action that revalidates. Subscribing to your own writes
 * would refresh the page twice for every message you send.
 *
 * The Supabase client is normally a repository's business. A realtime channel
 * is not a query and cannot run on the server, so it lives here instead.
 */
export function useLiveMessages(viewerId: string | null) {
  const router = useRouter();

  useEffect(() => {
    if (!viewerId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime authorises with the access token, and the browser client reads
    // its session from cookies asynchronously. Subscribing first means the
    // socket opens unauthenticated and RLS drops every row.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`messages:${viewerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "club_messages",
            filter: `recipient_id=eq.${viewerId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [viewerId, router]);
}
