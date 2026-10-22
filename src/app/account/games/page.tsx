import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import CrossLink from "@/components/account/CrossLink";
import PageHead from "@/components/ui/PageHead";
import GameBrowser from "@/components/account/GameBrowser";
import RivalTable from "@/components/account/RivalTable";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyGames, getRecord, WHOLE_HISTORY } from "@/services/games.service";
import { getMyRivalIds } from "@/services/clubExtras.service";
import { getMyLists } from "@/services/armyLists.service";
import { listsByClubSlug } from "@/utils/member-lists";
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

  // Their whole history, not the newest twenty-five. A month filter over a
  // window answers about the window, which is why the client could not use
  // one: this is a member's own handful, and the house rule is that a list
  // that size comes back whole and is sifted in the browser.
  //
  // The record is still one grouped query in the database rather than counted
  // from the games: it is every game they have ever played, including the ones
  // past even this ceiling.
  // Their own lists ride in the same wave: it needs nothing the games read
  // produces, so saying which list you brought costs no extra round trip. A
  // failure costs the picker and not the page, which is the state this screen
  // was in before today.
  const [games, record, rivals, lists] = await Promise.all([
    getMyGames(viewer.id, 1, WHOLE_HISTORY).catch(() => []),
    getRecord().catch(() => []),
    getMyRivalIds(viewer.id).catch(() => new Set<string>()),
    getMyLists(viewer.id).catch(() => []),
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
            <GameBrowser games={games} initialQuery={opponent}
              listsByClub={listsByClubSlug(lists)} />
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
