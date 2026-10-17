import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EventsList from "@/app/clubs/[slug]/(console)/manage/events/EventsList";
import PairingsBoard from
  "@/app/clubs/[slug]/(console)/manage/events/[eventId]/pairings/PairingsBoard";
import RosterBoard from
  "@/app/clubs/[slug]/(console)/manage/events/[eventId]/roster/RosterBoard";
import BookingsBoard from "@/app/clubs/[slug]/(console)/manage/events/BookingsBoard";
import EventPairings from "@/components/events/EventPairings";
import EventPlacings from "@/components/events/EventPlacings";
import { readFilters } from "@/services/clubBookings.service";
import { clubIdentity } from "@/utils/club-identity";
import type { ManageEvent } from "@/utils/event-manage-filter";
import type { DoorRow } from "@/utils/door-list";
import type { PairingRound } from "@/types/eventEditor";
import { tokens } from "@/lib/tokens";

/**
 * Local-only view of the three event screens.
 *
 * They are only reachable with a real event behind them, which makes them the
 * hardest part of the console to look at while it is being built, and the
 * states that matter most are the awkward ones: a draft with no date, a round
 * with a bye in it, somebody who walked in without paying.
 */
/**
 * Two armies with everything filled in, so the preview shows the longest line
 * a table of the draw can produce rather than the tidiest.
 */
const PREVIEW_ARMY_ONE = {
  factionLabel: "Chaos Knights",
  detachment: "Traitoris Lance",
  disposition: "Purge the Foe",
  mvpUnits: ["Knight Desecrator"],
  list: {
    id: 1, name: "Autumn League List", pointsLimit: "2000", totalPoints: 1985,
    units: [
      { name: "Knight Desecrator", quantity: 1, points: 450 },
      { name: "War Dog Brigand", quantity: 3, points: 375 },
      { name: "Knight Rampager", quantity: 1, points: 430 },
    ],
  },
};

const PREVIEW_ARMY_TWO = {
  factionLabel: "Adeptus Custodes",
  detachment: "Shield Host",
  disposition: "Priority Assets",
  mvpUnits: [],
  list: null,
};

/**
 * A field of eight, so the podium cards and the rest-of-the-field rows both
 * render. Fourth place carries a list and fifth carries nothing, which is the
 * pair the row has to tell apart.
 */
const PREVIEW_PLACINGS = [
  { id: 1, rank: 1, placement: "1st", name: "Gulnabi Afridi", isMember: true,
    profileId: null, army: PREVIEW_ARMY_ONE },
  { id: 2, rank: 2, placement: "2nd", name: "Tom Allen", isMember: false,
    profileId: null, army: PREVIEW_ARMY_TWO },
  { id: 3, rank: 3, placement: "3rd", name: "Joe Matthews", isMember: true,
    profileId: null, army: PREVIEW_ARMY_TWO },
  { id: 4, rank: 4, placement: "4th", name: "Peter Hill", isMember: true,
    profileId: null, army: PREVIEW_ARMY_ONE },
  { id: 5, rank: 5, placement: "5th", name: "Hugo S", isMember: false,
    profileId: null, army: null },
  { id: 6, rank: 6, placement: "6th", name: "David M", isMember: true,
    profileId: null, army: PREVIEW_ARMY_TWO },
  { id: 7, rank: 7, placement: "7th", name: "Pete H", isMember: false,
    profileId: null, army: PREVIEW_ARMY_ONE },
  { id: 8, rank: 8, placement: "8th", name: "Joe Gary", isMember: true,
    profileId: null, army: null },
];

export default async function EventsPreviewPage({
  searchParams,
}: PageProps<"/dev/events-preview">) {
  if (process.env.NODE_ENV === "production") notFound();

  // The filters come from the address here too, so the bar behaves the way it
  // does on the real page. With them hard-coded the search box could never be
  // cleared, because the committed value never changed.
  const filters = readFilters(await searchParams);

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");
  const today = "2026-09-12";

  const events: ManageEvent[] = [
    { id: 1, legacyId: "2026-09-26-autumn-open", title: "Autumn Open",
      status: "published", startDate: "2026-09-26", endDate: null,
      venueName: "Didcot Civic Hall", bookings: 8, ticketsAvailable: 40 },
    { id: 2, legacyId: "2026-10-31-doubles", title: "Halloween doubles",
      status: "published", startDate: "2026-10-31", endDate: "2026-11-01",
      venueName: null, bookings: 0, ticketsAvailable: null },
    { id: 3, legacyId: "2026-12-05-winter", title: "Winter league, not written yet",
      status: "draft", startDate: null, endDate: null,
      venueName: null, bookings: 0, ticketsAvailable: null },
    { id: 4, legacyId: "2026-06-01-summer", title: "Summer Open",
      status: "published", startDate: "2026-06-01", endDate: null,
      venueName: "Didcot Civic Hall", bookings: 22, ticketsAvailable: 24 },
    { id: 5, legacyId: "2026-10-01-called-off", title: "Painting day",
      status: "cancelled", startDate: "2026-10-01", endDate: null,
      venueName: "The Rec", bookings: 3, ticketsAvailable: 12 },
  ];

  const rounds: PairingRound[] = [
    { id: 1, round: 1, label: "Round 1", published: true, matches: [
      { id: 1, tableLabel: "1", playerOne: "Ada Marchetti", playerOneId: null,
        playerTwo: "Joe Matthews", playerTwoId: null,
        scoreOne: 78, scoreTwo: 61, pointsOne: null, pointsTwo: null, position: 0 },
      { id: 2, tableLabel: "2", playerOne: "sara khan", playerOneId: null,
        playerTwo: "Gulnabi Afridi", playerTwoId: null,
        scoreOne: null, scoreTwo: null, pointsOne: null, pointsTwo: null, position: 1 },
      { id: 3, tableLabel: "3", playerOne: "Ben Shah", playerOneId: null,
        playerTwo: "", playerTwoId: null, scoreOne: null, scoreTwo: null,
        pointsOne: null, pointsTwo: null, position: 2 },
    ] },
    { id: 2, round: 2, label: "Round 2", published: false, matches: [] },
  ];

  const roster: DoorRow[] = [
    { bookingId: 1, profileId: null, fullName: "Ada Marchetti", email: "ada@example.com",
      reference: "FAGC-K7M2QP", status: "reserved", paymentStatus: "paid_in_advance",
      paymentMethod: "Bank transfer", checkedInAt: "2026-09-26T09:02:00Z",
      refundStatus: "not_due", cancelReason: "", notes: "Vegetarian lunch",
      tickets: 2, total: 57, createdAt: "2026-08-22T10:00:00Z" },
    { bookingId: 2, profileId: null, fullName: "Joe Matthews", email: "joe@example.com",
      reference: "FAGC-P2LM99", status: "reserved", paymentStatus: "unpaid",
      paymentMethod: "", checkedInAt: null, refundStatus: "not_due", cancelReason: "",
      notes: "", tickets: 1, total: 30, createdAt: "2026-08-29T18:40:00Z" },
    // Walked in, played, still has not paid. Both things are true at once.
    { bookingId: 3, profileId: null, fullName: "Ben Shah", email: "ben@example.com",
      reference: "FAGC-3QX41A", status: "reserved", paymentStatus: "unpaid",
      paymentMethod: "", checkedInAt: "2026-09-26T09:20:00Z", refundStatus: "not_due",
      cancelReason: "", notes: "", tickets: 1, total: 30,
      createdAt: "2026-09-01T12:00:00Z" },
    { bookingId: 4, profileId: null, fullName: "Cat Moss", email: "cat@example.com",
      reference: "FAGC-88DDZ1", status: "cancelled", paymentStatus: "paid_in_advance",
      paymentMethod: "Card", checkedInAt: null, refundStatus: "due",
      cancelReason: "Rang to say she cannot make it", notes: "",
      tickets: 1, total: 30, createdAt: "2026-08-15T09:00:00Z" },
  ];

  const teams = [
    { id: 1, name: "Oxford Oathsworn", position: 0, finalRank: 1, finalScore: 17,
      placement: "Winners", captainProfileId: null,
      players: [
        { id: 11, profileId: null, name: "Ada Marchetti", position: 0 },
        { id: 12, profileId: null, name: "Joe Matthews", position: 1 },
      ] },
    { id: 2, name: "Didcot Dreadnoughts", position: 1, finalRank: 2, finalScore: null,
      placement: "Runners up", captainProfileId: null,
      players: [
        { id: 21, profileId: null, name: "Tom Allen", position: 0 },
        { id: 22, profileId: null, name: "Priya Raman", position: 1 },
      ] },
  ];

  const fixtures = [
    { id: 1, pairingId: 1, round: 1, tableLabel: "A",
      teamOne: 1, teamOneName: "Oxford Oathsworn",
      teamTwo: 2, teamTwoName: "Didcot Dreadnoughts",
      scoreOne: 125, scoreTwo: 115, gamesOne: 1, gamesTwo: 1, position: 0,
      // The client's own example: the players totalled 125 to 115 and the
      // club scores the fixture 5 to 4. Both are on the header, so the sweep
      // measures the longest that line gets.
      pointsOne: 5, pointsTwo: 4,
      published: true,
      tables: [
        { id: 101, tableLabel: "A1", playerOne: "Ada Marchetti", playerOneId: null,
          playerTwo: "Tom Allen", playerTwoId: null,
          scoreOne: 80, scoreTwo: 60, pointsOne: 3, pointsTwo: 1, position: 0 },
        { id: 102, tableLabel: "A2", playerOne: "Joe Matthews", playerOneId: null,
          playerTwo: "Priya Raman", playerTwoId: null,
          scoreOne: 45, scoreTwo: 55, pointsOne: null, pointsTwo: null, position: 1 },
      ] },
    { id: 2, pairingId: 1, round: 1, tableLabel: "B",
      teamOne: 1, teamOneName: "Abingdon Anvils",
      teamTwo: null, teamTwoName: "",
      scoreOne: null, scoreTwo: null, gamesOne: 0, gamesTwo: 0, position: 1,
      pointsOne: null, pointsTwo: null,
      published: true, tables: [] },
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: 4 }}>
      <Stack spacing={5}>
        <Stack spacing={0.5}>
          <Typography variant="h1" sx={{ fontSize: "1.8rem" }}>Events preview</Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Local only. Nothing here writes: the actions refuse without a real club behind them.
          </Typography>
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">The list</Typography>
          <EventsList slug="didcot-wargames-didcot" events={events} today={today} />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">Pairings</Typography>
          <PairingsBoard slug="didcot-wargames-didcot" eventId={1} rounds={rounds}
            roster={roster.map((row) => ({ profileId: null, name: row.fullName }))}
            roundCount={5} faction={faction} showing={1} drawPublic={false}
            builder={null} lists={[]} armies={{}} setup={{}}
            teamEvent={false} teams={[]} fixtures={[]} />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            The same round as a team event
          </Typography>
          {/* The one shape the overflow sweep could not otherwise reach: a
              fixture header and its tables are two levels of row inside one
              card, and at 360 that is where a team name and a score meet. */}
          <PairingsBoard slug="didcot-wargames-didcot" eventId={1} rounds={rounds}
            roster={roster.map((row) => ({ profileId: null, name: row.fullName }))}
            roundCount={5} faction={faction} showing={1} drawPublic={false}
            builder={null} lists={[]} armies={{}} setup={{}}
            teamEvent teams={teams} fixtures={fixtures} />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            The same draw as a member sees it
          </Typography>
          {/* The member's half of the same rounds, because the two have to
              word a bye the same way and only one of them is reachable
              without a ticket. The client found "Lone Walkin v" on a real
              event while the console next door read BYE. */}
          <EventPairings
            pairings={rounds.map((r) => ({
              id: r.id, round: r.round, label: r.label, published: r.published,
              matches: r.matches.map((m, i) => ({
                table: m.tableLabel, playerOne: m.playerOne, playerTwo: m.playerTwo,
                // Side one is linked to an account and side two is not, so one
                // screen shows a name that is a link to a profile beside a
                // typed name that is not. That pair is the whole of the rule,
                // and a fixture with only one of them measures half of it.
                playerOneId: i === 0 ? "00000000-0000-0000-0000-0000000000aa" : null,
                playerTwoId: null,
                score: m.scoreOne !== null && m.scoreTwo !== null
                  ? `${m.scoreOne} - ${m.scoreTwo}` : null,
                scoreOne: m.scoreOne, scoreTwo: m.scoreTwo,
                // The first table of every round carries armies and the rest
                // do not, so the sweep measures the long line, the list
                // control and the bare row on one screen.
                armyOne: i === 0 ? PREVIEW_ARMY_ONE : null,
                armyTwo: i === 0 ? PREVIEW_ARMY_TWO : null,
                // One table with a setup and the rest without, which is the
                // pair the setup line has to tell apart. A fixture that only
                // ever has one of the two states ships the other unmeasured.
                setup: i === 0
                  ? { mission: "Take and Hold", deployment: "dawn-of-war",
                      terrain: "UKTC" }
                  : null,
              })),
            }))}
            faction={faction}
            viewerName="Gulnabi Afridi"
          />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            A results table big enough to page
          </Typography>
          {/* Eight placings, because `EventPlacings` only draws `PlacingRow`
              past six: below that the whole field is podium cards, so the row
              could be changed and never seen. Didcot's real events have two
              and three placings, which is exactly how it stayed unmeasured. */}
          <EventPlacings placings={PREVIEW_PLACINGS} faction={faction}
            viewerName="Hugo S" />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            Every booking the club holds
          </Typography>
          <BookingsBoard slug="didcot-wargames-didcot" faction={faction} view={{
            rows: roster.map((row, index) => ({
              ...row,
              eventId: index % 2 ? 2 : 1,
              eventTitle: index % 2 ? "Halloween doubles" : "Autumn Open",
              eventLegacyId: index % 2 ? "2026-10-31-doubles" : "2026-09-26-autumn-open",
              eventStartDate: index % 2 ? "2026-10-31" : "2026-09-26",
            })),
            // Counts that do not match the four rows on purpose: this is what a
            // club a few seasons in looks like, and it is the case the whole
            // server-side filter exists for.
            total: 1042,
            eventCount: 4,
            counts: { all: 1042, reserved: 217, paid: 781, checkedin: 394, cancelled: 44 },
            events: [
              { id: 1, title: "Autumn Open", bookings: 612 },
              { id: 2, title: "Halloween doubles", bookings: 430 },
            ],
            owed: { people: 2, amount: 60 },
            filters,
          }} />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">The roster for one event</Typography>
          {/* Two ticket types, one capped and one not, so the dialog's "N of
              X left" line and its "no limit" line are both measurable on one
              screen. One member, so the optional link has something in it. */}
          <RosterBoard accountNames={{}} slug="didcot-wargames-didcot" eventId={1} rows={roster}
            faction={faction} canAdd
            members={[{ id: "00000000-0000-0000-0000-0000000000aa",
                        name: "Gulnabi Afridi" }]}
            tickets={[
              { id: 1, label: "Standard", price: "GBP 20", quantityAvailable: 40,
                audience: "all", audienceLabel: "Open to all", minimumTierKey: "",
                position: 1, taken: 17 },
              { id: 2, label: "VIP", price: "GBP 50", quantityAvailable: null,
                audience: "members", audienceLabel: "Members only",
                minimumTierKey: "", position: 2, taken: 3 },
            ]} />
        </Stack>
      </Stack>
    </Container>
  );
}
