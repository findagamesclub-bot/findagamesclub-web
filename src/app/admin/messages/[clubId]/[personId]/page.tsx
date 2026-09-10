import { notFound, redirect } from "next/navigation";
import Conversation from "@/components/messages/Conversation";
import { getCurrentProfile } from "@/services/auth.service";
import { getContacts, getConversation, markRead, SITE_CLUB } from "@/services/messages.service";
import { getAccountBrief } from "@/services/adminAccounts.service";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Conversation" };

/** The same conversation the account area shows, inside the console. */

export default async function AdminConversationPage({
  params,
}: PageProps<"/admin/messages/[clubId]/[personId]">) {
  const { clubId, personId } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/admin/messages/${clubId}/${personId}`);

  const id = Number(clubId);
  if (!Number.isFinite(id)) notFound();

  const existing = await getConversation(id, viewer.id, personId);

  // An empty thread is not an error, it is how a first message starts. What
  // says whether they may open one differs by kind: a club thread needs a club
  // in common, and a site thread needs the writer to be an admin, because
  // nothing else connects them to the person.
  let header = existing;
  if (!header && id === SITE_CLUB) {
    if (viewer.role !== "admin") notFound();
    const account = await getAccountBrief(personId);
    if (!account) notFound();
    header = {
      clubId: SITE_CLUB,
      clubSlug: "",
      clubName: "FindAGamesClub",
      personId,
      personName: account.name || account.email || "An account",
      messages: [],
    };
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

  return <Conversation conversation={header} faction={faction}
    base="/admin/messages" />;
}
