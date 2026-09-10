import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import ConsoleSidebar from "@/components/console/ConsoleSidebar";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getConsoleCounts } from "@/services/console.service";
import { clubIdentity } from "@/utils/club-identity";
import { headerHeight, tokens } from "@/lib/tokens";

/**
 * The shell every working page of a club sits in, for the people who run it.
 *
 * A route group rather than a path segment, so none of these URLs move. The
 * roster is still /clubs/x/members whether you are a visitor reading it or the
 * owner working through it; what changes is whether the club's navigation is
 * beside it.
 *
 * It has to be here rather than under /manage because the sections are the
 * work. Sending an owner from the console out to a full-width page with no way
 * back except the browser is the same mistake the account area made before it
 * got a shell, and it was the first thing the client said about this one.
 *
 * Nobody outside the team sees any of it: the branch below renders children
 * untouched, so a member opening the roster gets exactly the page they got
 * before this existed.
 *
 * No Container and no `main` here on purpose. Every page underneath brings its
 * own, sized to what it holds, and two nested `main` elements is not valid.
 */
export default async function ConsoleLayout({
  children, params,
}: LayoutProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  const access = await getClubAccess(club.id, viewer);

  // Not on the team, so this is an ordinary page about a club they may or may
  // not belong to. Each page decides for itself what a visitor may read.
  if (!access.role) return <>{children}</>;

  const { faction, monogram } = clubIdentity(club.slug, club.name);
  const counts = await getConsoleCounts(club.id, access);

  return (
    <>
      {/* An app shell has no page scroll to put a footer at the end of, so the
          site's own is hidden and its links live in the rail instead. */}
      <GlobalStyles styles={{
        "body footer": { display: "none" },
        "@media (min-width: 900px)": {
          "html, body": { height: "100%", overflow: "hidden" },
        },
      }} />

      <Box sx={{ maxWidth: 1536, mx: "auto", px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: "grid", gap: { xs: 2, md: 4 },
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" },
                   alignItems: { xs: "start", md: "stretch" },
                   height: { md: `calc(100dvh - ${headerHeight.md}px)` } }}>
          <Box sx={{ minWidth: 0, minHeight: 0,
                     overflowY: { xs: "visible", md: "auto" },
                     py: { xs: 1.5, md: 3 },
                     borderRight: { md: `1px solid ${tokens.rule}` },
                     pr: { md: 2 } }}>
            <ConsoleSidebar
              slug={club.slug}
              name={club.name}
              monogram={monogram}
              colour={faction.base}
              role={access.role}
              counts={counts}
            />
          </Box>

          {/* The only thing that moves. Each page's own Container sits in here
              and centres itself, so a narrow page stays narrow. */}
          <Box sx={{ minWidth: 0, minHeight: 0, overflowY: { md: "auto" },
                     overflowX: "hidden", pr: { md: 1.5 },
                     // Every page under here carries its own Container, sized
                     // for the full-width case: the board is md because a
                     // thread is a reading column, the roster is lg because it
                     // is a grid. Beside the rail that second limit indents and
                     // shortens half the console at random, so the column takes
                     // over as the frame and they all line up.
                     "& > .MuiContainer-root": {
                       maxWidth: "none",
                       py: { xs: 1, md: 2.5 },
                       px: { xs: 0, sm: 1 },
                     } }}>
            {children}
          </Box>
        </Box>
      </Box>
    </>
  );
}
