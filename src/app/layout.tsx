import type { Metadata } from "next";
import Box from "@mui/material/Box";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SiteHeader from "@/components/layout/SiteHeader";
import Toaster from "@/components/ui/Toaster";
import { getUnreadCount } from "@/services/messages.service";
import { getUnreadCount as getUnreadNotifications } from "@/services/notifications.service";
import { getOwnerInbox } from "@/services/ownerInbox.service";
import SiteFooter from "@/components/layout/SiteFooter";
import QueryProvider from "@/lib/query/Providers";
import { getCurrentProfile } from "@/services/auth.service";
import theme from "@/lib/theme";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FindAGamesClub", template: "%s · FindAGamesClub" },
  description: "Find tabletop and wargaming clubs near you, book a table, and enter events.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  const viewer = profile
    ? { id: profile.id, fullName: profile.full_name, email: profile.email, role: profile.role }
    : null;

  // One indexed read, and it is the only thing on every page that needs it.
  const unread = viewer ? await getUnreadCount(viewer.id) : 0;

  // Owners are rare, so this is one indexed read that returns nothing for
  // almost everybody. The badge is the only reason a header needs it.
  const owned = viewer ? await getOwnerInbox(viewer.id) : [];
  // One indexed count, on every page. The panel itself is fetched on open.
  const notifications = viewer ? await getUnreadNotifications(viewer.id) : 0;
  const ownerTasks = owned.reduce((n, c) => n + c.tasks.length, 0);

  return (
    <html lang="en-GB" className={fontVariables}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryProvider>
              <Toaster>
              <SiteHeader
                viewer={viewer}
                unreadMessages={unread}
                ownerTasks={ownerTasks}
                ownsClubs={owned.length > 0}
                notifications={notifications}
              />
              <Box sx={{ flex: 1 }}>{children}</Box>
              <SiteFooter signedIn={Boolean(viewer)} />
              </Toaster>
            </QueryProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
