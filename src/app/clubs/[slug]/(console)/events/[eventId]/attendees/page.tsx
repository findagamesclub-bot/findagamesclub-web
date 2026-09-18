import { notFound, redirect } from "next/navigation";
import { getClubDetail } from "@/services/clubDetail.service";
import { findEventIdByKey } from "@/repositories/eventEditor.repository";

/**
 * The old door list, kept as a redirect.
 *
 * Stage 3 moved it to `/manage/events/<id>/roster`, where it sits next to the
 * editor and the draw. The address here is in emails the club has already been
 * sent, so it has to keep working.
 *
 * The URL carried the event's legacy id; the console's carries its row id, so
 * the key has to be looked up rather than passed through.
 */
export default async function AttendeesRedirect({
  params,
}: PageProps<"/clubs/[slug]/events/[eventId]/attendees">) {
  const { slug, eventId } = await params;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const id = await findEventIdByKey(club.id, eventId);
  if (!id) notFound();

  redirect(`/clubs/${slug}/manage/events/${id}/roster`);
}
