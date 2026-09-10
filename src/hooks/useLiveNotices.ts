"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the notifications page when a notice arrives for the viewer.
 *
 * The badge beside it is already live, so without this the count would climb
 * while the list under it stayed the same length: the worst of both, because
 * the reader can see they have been told something and cannot see what.
 *
 * The topic carries the mount's own id. Two components can want the same rows
 * at once, and two channels sharing a name on one socket is a collision rather
 * than two subscriptions.
 */
export function useLiveNotices(viewerId: string | null) {
  const router = useRouter();
  const mount = useId();

  useEffect(() => {
    if (!viewerId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let live = true;

    // Realtime authorises with the access token, and the browser client reads
    // its session from cookies asynchronously. Subscribing first opens the
    // socket unauthenticated and RLS drops every row.
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`notices:${viewerId}:${mount}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications",
            filter: `profile_id=eq.${viewerId}` },
          () => router.refresh())
        .subscribe();
    });

    return () => {
      live = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [viewerId, router, mount]);
}
