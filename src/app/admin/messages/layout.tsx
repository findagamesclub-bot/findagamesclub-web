import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import MessagesShell from "@/components/messages/MessagesShell";
import { getCurrentProfile } from "@/services/auth.service";
import { getContacts, getInbox } from "@/services/messages.service";
import { searchAccountsAction } from "./actions";

/**
 * The admin's conversations, inside the console.
 *
 * Two things differ from the member area. The rail is their only navigation
 * once the header is hidden, so this lives here rather than sending them out.
 * And New searches every account rather than the people they share a club
 * with, because an admin writing about a suspension or a declined listing has
 * no club in common with the person they are writing to.
 */
export default async function AdminMessagesLayout({
  children,
}: LayoutProps<"/admin/messages">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/admin/messages");

  const [threads, contacts] = await Promise.all([
    getInbox(viewer.id),
    getContacts(viewer.id),
  ]);

  return (
    <Box sx={{ height: { md: "100%" } }}>
      <MessagesShell threads={threads} contacts={contacts} viewerId={viewer.id}
        base="/admin/messages"
        onSearch={searchAccountsAction}
        searchLabel="Search every account by name or email"
        emptyHint="Nobody matches. Search by name or email address.">
        {children}
      </MessagesShell>
    </Box>
  );
}
