import type { Metadata } from "next";
import { cookies } from "next/headers";
import Box from "@mui/material/Box";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SiteHeader from "@/components/layout/SiteHeader";
import { manageLink } from "@/components/layout/account-links";
import Toaster from "@/components/ui/Toaster";
import { getUnreadCount } from "@/services/messages.service";
import { getUnreadCount as getUnreadNotifications } from "@/services/notifications.service";
import { getOwnerInbox } from "@/services/ownerInbox.service";
import SiteFooter from "@/components/layout/SiteFooter";
import QueryProvider from "@/lib/query/Providers";
import { getCurrentProfile } from "@/services/auth.service";
import { getSiteSettings } from "@/services/siteSettings.service";
import CookieBanner from "@/components/layout/CookieBanner";
import { CONSENT_COOKIE, parseConsent } from "@/utils/consent";
import theme from "@/lib/theme";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FindAGamesClub", template: "%s · FindAGamesClub" },
  description: "Find tabletop and wargaming clubs near you, book a table, and enter events.",
};

/**
 * What the banner says before an admin has written anything.
 *
 * True today and deliberately unexciting: the only cookies the site sets are
 * the ones that keep you signed in. The banner is here so that the day
 * anything optional is added, the consent is already being collected.
 */
const DEFAULT_COOKIE_TEXT =
  "We use cookies to keep you signed in and to remember what you have chosen. "
  + "Accepting all lets us add anonymous usage statistics later; we run none today.";

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

  // Decided on the server, so somebody who answered in March never sees the
  // banner flash before the browser has read its own cookie. The text is the
  // admin's, cached for a minute with the rest of the site settings.
  const answered = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  const cookieText = answered ? "" : (await getSiteSettings()).cookiesMd;

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
                manage={manageLink(owned)}
                notifications={notifications}
              />
              <Box sx={{ flex: 1 }}>{children}</Box>
              <SiteFooter signedIn={Boolean(viewer)} />
              {answered ? null : <CookieBanner text={cookieText || DEFAULT_COOKIE_TEXT} />}
              </Toaster>
            </QueryProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
