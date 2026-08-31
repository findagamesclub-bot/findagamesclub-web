/**
 * Public buckets, and how a stored path becomes a URL.
 *
 * The URL is built rather than fetched: `getPublicUrl` is a pure string join
 * in the SDK too, and going through the client would drag it into Server
 * Components that have no other reason to hold one.
 */
export const DISCUSSION_PHOTOS = "discussion-photos";

export function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
