import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import MessagesShell from "@/components/messages/MessagesShell";
import { getCurrentProfile } from "@/services/auth.service";
import { getContacts, getInbox } from "@/services/messages.service";

/**
 * The rail lives in the layout so it survives navigation between threads.
 *
 * Putting it on each page would refetch the inbox and remount the list every
 * time somebody picked a different conversation, which loses the scroll
 * position in a list they are reading down.
 */
export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/messages");

  const [threads, contacts] = await Promise.all([
    getInbox(viewer.id),
    getContacts(viewer.id),
  ]);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 2, md: 4 } }}>
      <MessagesShell threads={threads} contacts={contacts} viewerId={viewer.id}>
        {children}
      </MessagesShell>
    </Container>
  );
}
