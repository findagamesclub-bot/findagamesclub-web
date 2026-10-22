import { notFound, redirect } from "next/navigation";
import Conversation from "@/components/messages/Conversation";
import { getCurrentProfile } from "@/services/auth.service";
import {
  getContacts, getConversation, getSiteContacts, markRead, SITE_CLUB,
} from "@/services/messages.service";
import { clubIdentity } from "@/utils/club-identity";
import { getReported } from "@/services/myReports.service";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: PageProps<"/account/messages/[clubId]/[personId]">) {
  const { clubId, personId } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/account/messages/${clubId}/${personId}`);

  const id = Number(clubId);
  if (!Number.isFinite(id)) notFound();

  const existing = await getConversation(id, viewer.id, personId);

  // An empty thread is not an error — it is how a first message starts. The
  // contact list says whether they are allowed to open one at all.
  let header = existing;

  // A site thread the reader is opening rather than answering (0215). Only an
  // owner with a listing or an event a site admin has taken down reaches this,
  // and `my_site_contacts` is the same rule the insert policy asks, so the
  // page cannot offer a thread the database would refuse.
  if (!header && id === SITE_CLUB) {
    const admins = await getSiteContacts();
    const admin = admins.find((one) => one.personId === personId);
    if (admin) {
      header = {
        clubId: SITE_CLUB,
        clubSlug: admin.clubSlug,
        clubName: admin.clubName,
        personId,
        personName: admin.personName,
        messages: [],
      };
    }
  }

  if (!header) {
    const contacts = await getContacts(viewer.id);
    const contact = contacts.find((c) => c.clubId === id && c.personId === personId);
    if (!contact) notFound();
    header = {
      clubId: id,
      clubSlug: contact.clubSlug,
      clubName: contact.clubName,
      personId,
      personName: contact.personName,
      messages: [],
    };
  }

  // Opening the thread is reading it.
  if (existing) await markRead(id, viewer.id, personId);

  const { faction } = clubIdentity(header.clubSlug, header.clubName);
  const reported = await getReported(viewer.id);

  return <Conversation conversation={header} faction={faction}
    reported={reported} />;
}
