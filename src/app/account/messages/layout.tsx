import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
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
export default async function MessagesLayout({ children }: LayoutProps<"/account/messages">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/messages");

  const [threads, contacts] = await Promise.all([
    getInbox(viewer.id),
    getContacts(viewer.id),
  ]);

  return (
    // Fills the account content column rather than measuring the window.
    <Box sx={{ height: { md: "100%" } }}>
      <MessagesShell threads={threads} contacts={contacts} viewerId={viewer.id}>
        {children}
      </MessagesShell>
    </Box>
  );
}
