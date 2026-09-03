import Box from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import Container from "@mui/material/Container";
import AccountSidebar from "@/components/account/AccountSidebar";
import { getCurrentProfile } from "@/services/auth.service";
import { getAccountCounts } from "@/services/dashboard.service";
import { headerHeight, tokens } from "@/lib/tokens";

/**
 * The shell every page of the member's own area sits in.
 *
 * In the layout rather than on each page so the navigation does not remount
 * between sections, and so a new section cannot be added without it.
 */
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const viewer = await getCurrentProfile();

  // Signed out, the page below redirects — and it knows which section was
  // wanted, which a layout does not. Redirecting from here sent everybody to
  // the overview after signing in, whatever they had clicked.
  if (!viewer) return <Container maxWidth="xl" component="main">{children}</Container>;

  const counts = await getAccountCounts(viewer.id);

  return (
    <>
      {/* An app shell has no page scroll to put a footer at the end of, so the
          site's own is hidden here and its links live in the sidebar instead.
          Scoped to this route: every other page keeps its footer. */}
      <GlobalStyles styles={{
        "body footer": { display: "none" },
        // Both, and a real height on both: locking only body leaves html free
        // to grow, which is where the second scrollbar was coming from.
        "@media (min-width: 900px)": {
          "html, body": { height: "100%", overflow: "hidden" },
        },
      }} />

      <Container maxWidth="xl" component="main" disableGutters sx={{ px: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "grid", gap: { xs: 2, md: 4 },
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" },
                 alignItems: { xs: "start", md: "stretch" },
                 // The shell is exactly the room left under the header, and
                 // each column keeps its own scroll inside it.
                 height: { md: `calc(100dvh - ${headerHeight.md}px)` } }}>
        {/* Fixed beside the content. On a phone the sidebar is a drawer and
            all that sits here is the row that opens it, so nothing is capped
            or scrolled: navigation should cost a row when shut and cover the
            page when open, not take a screen and a half of it. */}
        <Box sx={{
          minWidth: 0,
          minHeight: 0,
          // Its own scroll on desktop, for a nav taller than a short screen. A
          // fixed column that cannot reach its last item is worse than one
          // that moves. On a phone the page scroll is the only one.
          overflowY: { xs: "visible", md: "auto" },
          py: { xs: 1.5, md: 3 },
          // No rule under it on a phone: the trigger already has its own
          // border, and two lines a few pixels apart read as a mistake.
          borderBottom: { md: "none" },
          borderRight: { md: `1px solid ${tokens.rule}` },
          pr: { md: 2 },
        }}>
          <AccountSidebar counts={counts} />
        </Box>

        {/* The only thing that moves. */}
        <Box sx={{ minWidth: 0, minHeight: 0, overflowY: { md: "auto" },
                   // Nothing in here may widen the grid and squeeze the nav.
                   overflowX: "hidden",
                   // The scrollbar is drawn inside this padding, so 8px put it
                   // hard against the card borders. Enough room that it reads
                   // as the edge of the page rather than part of a card.
                   py: { xs: 1, md: 3 }, pr: { md: 2.5 } }}>
          {children}
        </Box>
      </Box>
      </Container>
    </>
  );
}
