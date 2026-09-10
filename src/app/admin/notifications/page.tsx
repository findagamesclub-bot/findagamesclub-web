import { redirect } from "next/navigation";
import PageHead from "@/components/ui/PageHead";
import NotificationList from "@/components/notifications/NotificationList";
import { getCurrentProfile } from "@/services/auth.service";
import { getNotifications } from "@/services/notifications.service";

export const metadata = { title: "Notifications" };

/**
 * The same list, inside the console.
 *
 * The rail is an admin's only navigation once the header is hidden, so a rail
 * entry that leaves the console strands them on a page with a header they do
 * not otherwise see and no way back to what they were doing.
 */
export default async function AdminNotificationsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/admin/notifications");

  const notices = await getNotifications(viewer.id).catch(() => []);

  return (
    <>
      <PageHead
        title="Notifications"
        // Not a count of the unread ones: opening the page reads them, so a
        // line saying two are waiting would contradict itself a moment later.
        lede="Everything the bell has told you, newest first."
      />
      <NotificationList notices={notices} viewerId={viewer.id} isAdmin />
    </>
  );
}
