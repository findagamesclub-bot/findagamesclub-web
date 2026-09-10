import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import NotificationList from "@/components/notifications/NotificationList";
import { getCurrentProfile } from "@/services/auth.service";
import { getNotifications } from "@/services/notifications.service";

export const metadata = { title: "Notifications" };

/**
 * Everything the bell has told you, at a public address.
 *
 * The bell holds the last handful and nothing linked anywhere else, so an
 * older notice was unreachable the moment it fell off the bottom. The admin
 * console draws the same list inside its own shell.
 */
export default async function NotificationsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/notifications");

  const notices = await getNotifications(viewer.id).catch(() => []);

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <PageHead
        title="Notifications"
        // Not a count of the unread ones: opening the page reads them, so a
        // line saying two are waiting would contradict itself a moment later.
        lede="Everything the bell has told you, newest first."
      />
      <NotificationList notices={notices} viewerId={viewer.id} isAdmin={viewer.role === "admin"} />
    </Container>
  );
}
