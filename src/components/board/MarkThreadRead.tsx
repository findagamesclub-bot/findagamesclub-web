"use client";

import { useEffect, useRef, useTransition } from "react";
import { markThreadReadAction } from
  "@/app/clubs/[slug]/(console)/board/[postId]/actions";

/**
 * Marks the thread read once it is on screen.
 *
 * Renders nothing. It exists because the write needs a request it can read
 * cookies from, and a Server Component's `after` callback is not one.
 *
 * Once per mount, held in a ref: an effect that fires twice would do no harm,
 * since the write is an upsert, but it would also revalidate the board twice
 * for nothing.
 */
export default function MarkThreadRead({ postId, slug }: { postId: number; slug: string }) {
  const sent = useRef(false);
  const [, start] = useTransition();

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    start(() => { void markThreadReadAction(postId, slug); });
  }, [postId, slug, start]);

  return null;
}
