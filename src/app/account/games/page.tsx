import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import CrossLink from "@/components/account/CrossLink";
import PageHead from "@/components/account/PageHead";
import GameBrowser from "@/components/account/GameBrowser";
import RivalTable from "@/components/account/RivalTable";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyGames, getRecord } from "@/services/games.service";
import { getMyRivalIds } from "@/services/clubExtras.service";
import { countUnrecorded } from "@/utils/game-filter";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Your games" };

/**
 * Every game this member has played, and how they do against each opponent.
 *
 * The history is automatic — every table booking is a game. Rivals are the
 * shortlist somebody pins on top of it, which is why they are a heading here
 * rather than a page of their own.
 */
export default async function AccountGamesPage({
  searchParams,
}: PageProps<"/account/games">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/games");

  const query = await searchParams;
  const opponent = String(query.q ?? "");

  // The record is one grouped query in the database, not counted from the
  // games above: the page shows a window of history, the record is all of it.
  const [games, record, rivals] = await Promise.all([
    getMyGames(viewer.id).catch(() => []),
    getRecord().catch(() => []),
    getMyRivalIds(viewer.id).catch(() => new Set<string>()),
  ]);

  const owing = countUnrecorded(games);

  return (
    <>
      <PageHead
        title="Your games"
        lede={owing
          ? `${owing === 1 ? "One game has" : `${owing} games have`} no result yet. Either player can add one.`
          : "Every table you have booked, and how each game went."}
      />

      {games.length || record.length ? (
        <Stack spacing={4}>
          {record.length ? (
            <Box component="section">
              <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                                letterSpacing: "0.12em", color: tokens.inkMuted,
                                pb: 1, mb: 2, borderBottom: `1px solid ${tokens.rule}` }}>
                WHO YOU PLAY
              </Typography>
              <RivalTable records={record} pinned={rivals} />
            </Box>
          ) : null}

          <Box component="section">
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.12em", color: tokens.inkMuted,
                              pb: 1, mb: 2, borderBottom: `1px solid ${tokens.rule}` }}>
              EVERY GAME
            </Typography>
            <GameBrowser games={games} initialQuery={opponent} />
          </Box>
        </Stack>
      ) : (
        <EmptyState
          title="No games yet"
          description="Book a table at one of your clubs and it appears here. Add the score afterwards and the app keeps your record."
          action={{ label: "Your clubs", href: "/account/memberships" }}
        />
      )}

      {/* The other half: a game starts life as a booked table, and cancelling
          one still happens over there. */}
      <CrossLink
        href="/account/bookings"
        title="Tables you have booked"
        body="Nights still to come, and where to cancel one."
      />
    </>
  );
}
