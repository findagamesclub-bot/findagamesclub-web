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
        scoreOne: 78, scoreTwo: 61, position: 0 },
      { id: 2, tableLabel: "2", playerOne: "sara khan", playerOneId: null,
        playerTwo: "Gulnabi Afridi", playerTwoId: null,
        scoreOne: null, scoreTwo: null, position: 1 },
      { id: 3, tableLabel: "3", playerOne: "Ben Shah", playerOneId: null,
        playerTwo: "", playerTwoId: null, scoreOne: null, scoreTwo: null, position: 2 },
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
          <EventsList slug="didcot-wargames-didcot" events={events} today={today}
            faction={faction} />
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">Pairings</Typography>
          <PairingsBoard slug="didcot-wargames-didcot" eventId={1} rounds={rounds}
            roster={roster.map((row) => ({ profileId: null, name: row.fullName }))}
            roundCount={5} faction={faction} showing={1} />
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
              matches: r.matches.map((m) => ({
                table: m.tableLabel, playerOne: m.playerOne, playerTwo: m.playerTwo,
                score: m.scoreOne !== null && m.scoreTwo !== null
                  ? `${m.scoreOne} - ${m.scoreTwo}` : null,
              })),
            }))}
            faction={faction}
            viewerName="Gulnabi Afridi"
          />
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
          <Typography variant="overline" color="text.secondary">One event's roster</Typography>
          <RosterBoard slug="didcot-wargames-didcot" eventId={1} rows={roster}
            faction={faction} />
        </Stack>
      </Stack>
    </Container>
  );
}
