import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import GlobalStyles from "@mui/material/GlobalStyles";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getUnreadCount as getUnreadNotifications } from "@/services/notifications.service";
import { getUnreadCount as getUnreadMessages } from "@/services/messages.service";
import { getCurrentProfile } from "@/services/auth.service";
import { countWaitingSubmissions } from "@/services/submissionReview.service";
import { tokens } from "@/lib/tokens";

/**
 * The admin console's shell.
 *
 * Guarded here, and again in every action that touches the service-role
 * client. proxy.ts is deliberately left alone: it refreshes the session and
 * nothing else, and route gating there would put an authorisation decision in
 * a file whose job is to keep a cookie fresh.
 *
 * Somebody who is not an admin is sent home rather than shown a refusal. A
 * page that says "you are not allowed here" also says the page exists.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/admin");
  if (viewer.role !== "admin") redirect("/");

  // The two things addressed to them personally. An admin has no header bell
  // and no visitor tabs, so these counts only exist in the rail. Both caught:
  // a badge is not worth failing the console over.
  // One wave, not three. Each of these is a count rather than a list, so the
  // rail costs one round trip however many rows are behind the numbers.
  const [unreadNotifications, unreadMessages, waitingSubmissions] = await Promise.all([
    getUnreadNotifications(viewer.id).catch(() => 0),
    getUnreadMessages(viewer.id).catch(() => 0),
    countWaitingSubmissions().catch(() => 0),
  ]);

  return (
    <>
      {/* No header inside the console. Everything it carried is in the rail,
          and a bar of site chrome above a dashboard is only a way out of it.
          Hidden rather than not rendered, because the header lives in the root
          layout and every other page still needs it. */}
      <GlobalStyles styles={{
        "body footer": { display: "none" },
        // Targeted by class, not by element: MUI sets display on
        // .MuiAppBar-root, and a two-element selector loses to a class.
        "header.MuiAppBar-root": { display: "none" },
        "@media (min-width: 900px)": {
          "html, body": { height: "100%", overflow: "hidden" },
        },
      }} />

      <Container maxWidth="xl" component="main" disableGutters sx={{ px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: "grid", gap: { xs: 2, md: 4 },
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" },
                   alignItems: { xs: "start", md: "stretch" },
                   // No header above it any more, so the console is the screen.
                   height: { md: "100dvh" } }}>
          <Box sx={{ minWidth: 0, minHeight: 0,
                     overflowY: { xs: "visible", md: "auto" },
                     py: { xs: 1.5, md: 3 },
                     borderRight: { md: `1px solid ${tokens.rule}` },
                     pr: { md: 2 } }}>
            <AdminSidebar counts={{ unreadNotifications, unreadMessages, waitingSubmissions }}
              viewerId={viewer.id} viewerName={viewer.full_name || "Site admin"} />
          </Box>

          <Box sx={{ minWidth: 0, minHeight: 0, overflowY: { md: "auto" },
                     overflowX: "hidden",
                     py: { xs: 1, md: 3 }, pr: { md: 2.5 } }}>
            {children}
          </Box>
        </Box>
      </Container>
    </>
  );
}
