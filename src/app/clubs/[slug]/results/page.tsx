import { permanentRedirect } from "next/navigation";

/**
 * Moved into the console in Milestone 3.
 *
 * Kept as a redirect rather than deleted: the old address is in bookmarks and
 * in the emails the club has already sent, and a 404 there reads as the
 * feature having been taken away.
 */
export default async function MovedResultsPage({
  params,
}: PageProps<"/clubs/[slug]/results">) {
  const { slug } = await params;
  permanentRedirect(`/clubs/${slug}/manage/results`);
}
