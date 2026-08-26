import { notFound, redirect } from "next/navigation";
import Conversation from "@/components/messages/Conversation";
import { getCurrentProfile } from "@/services/auth.service";
import { getContacts, getConversation, markRead } from "@/services/messages.service";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: PageProps<"/messages/[clubId]/[personId]">) {
  const { clubId, personId } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/messages/${clubId}/${personId}`);

  const id = Number(clubId);
  if (!Number.isFinite(id)) notFound();

  const existing = await getConversation(id, viewer.id, personId);

  // An empty thread is not an error — it is how a first message starts. The
  // contact list says whether they are allowed to open one at all.
  let header = existing;
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

  return <Conversation conversation={header} faction={faction} />;
}
