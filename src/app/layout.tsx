import type { Metadata } from "next";
import Box from "@mui/material/Box";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SiteHeader from "@/components/layout/SiteHeader";
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
    ? { fullName: profile.full_name, email: profile.email, role: profile.role }
    : null;

  return (
    <html lang="en-GB" className={fontVariables}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryProvider>
              <SiteHeader viewer={viewer} />
              <Box sx={{ flex: 1 }}>{children}</Box>
              <SiteFooter signedIn={Boolean(viewer)} />
            </QueryProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
