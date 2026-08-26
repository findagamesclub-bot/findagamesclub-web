import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BookingNight from "@/components/bookings/BookingNight";
import { clubIdentity } from "@/utils/club-identity";
import { addDays, bookableSessions } from "@/utils/booking-sessions";
import { monthYear } from "@/utils/dates";
import { londonToday } from "@/services/bookingCalendar.service";
import { tokens } from "@/lib/tokens";
import type { Booking, CalendarSession } from "@/types/booking";

/** Local-only view of the booking list with a populated calendar. */
export default function BookingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");
  const today = londonToday();

  const booking = (
    id: number, table: number, name: string, game: string,
    opponent: string | null, mine = false,
  ): Booking => ({
    id, clubSessionId: 137, date: today, tableIndex: table, gameTitle: game, notes: "",
    booker: { profileId: String(id), name, isViewer: mine },
    opponent: opponent ? { profileId: null, name: opponent, isViewer: false } : null,
    acceptor: null, source: "member", price: "£5.00", isMine: mine, canCancel: mine,
  });

  const NAMES = [
    "Priya Raman", "Tom Whitfield", "Aisha Bello", "Dan Okafor", "Ellie Nash",
    "Marcus Bell", "Joe Matthews", "Sam Okonkwo", "Ruth Kelly", "Ade Lawal",
    "Niamh Doyle", "Chris Whelan", "Fay Osei", "Greg Mensah", "Hana Suzuki",
    "Ian Pritchard", "Jas Sandhu", "Kate Lindqvist", "Leo Marchetti", "Mo Farouk",
  ];
  const GAMES = ["Warhammer 40,000", "Kill Team", "Age of Sigmar", "Horus Heresy",
                 "Star Wars: Legion", "Shatterpoint"];

  const night = (
    date: string, taken: Booking[], blockedReason: string | null = null, capacity = 10,
  ): CalendarSession => ({
    clubSessionId: 137, date, day: "Thursday", time: "19:00 - 22:30",
    label: "Club session", legacyKey: `${date}__0`,
    capacity, bookings: taken, tablesLeft: capacity - taken.length,
    isFull: taken.length >= capacity, blockedReason,
    blockedBy: taken.length >= capacity ? ("full" as const) : null,
    viewerBookedThisDate: taken.some((b) => b.isMine),
  });

  const sampleQueue = [
    { id: 1, clubSessionId: 137, date: today, gameTitle: "Warhammer 40,000",
      name: "Nadia Rahman", position: 1, isMine: false, skipped: null },
    { id: 2, clubSessionId: 137, date: today, gameTitle: "Kill Team",
      name: "You", position: 2, isMine: true, skipped: null },
    { id: 3, clubSessionId: 137, date: today, gameTitle: "Age of Sigmar",
      name: "Owen Pryce", position: 3, isMine: false,
      skipped: "Passed over: already playing that night." },
    { id: 4, clubSessionId: 137, date: today, gameTitle: "Horus Heresy",
      name: "Sian Vaughan", position: 4, isMine: false, skipped: null },
    { id: 5, clubSessionId: 137, date: today, gameTitle: "Kill Team",
      name: "Ben Achterberg", position: 5, isMine: false, skipped: null },
    { id: 6, clubSessionId: 137, date: today, gameTitle: "Shatterpoint",
      name: "Lucia Ferreira", position: 6, isMine: false, skipped: null },
  ];

  const samplePosts = [
    { id: 1, clubSessionId: 137, date: today, gameTitle: "Kill Team",
      notes: "Happy to lend a team if you have not played.",
      authorName: "Priya Raman", authorId: "2", isMine: false },
    { id: 2, clubSessionId: 137, date: today, gameTitle: "Horus Heresy",
      notes: "", authorName: "You", authorId: "1", isMine: true },
  ];

  const nights: CalendarSession[] = Array.from({ length: 13 }, (_, i) => {
    const date = addDays(today, 6 + i * 7);
    if (i === 0) return night(date, [
      booking(1, 0, "Gulnabi Afridi", "Warhammer 40,000", "Joe Matthews", true),
      booking(2, 1, "Priya Raman", "Horus Heresy", null),
      booking(3, 2, "Tom Whitfield", "Star Wars: Legion", "Dan Okafor"),
    ]);
    // A twenty-table hall, every table taken. The case that broke the old
    // inline list: twenty names and twenty controls on a single row.
    if (i === 2) return night(date,
      Array.from({ length: 20 }, (_, k) =>
        booking(100 + k, k, NAMES[k]!, GAMES[k % GAMES.length]!,
                k % 3 === 0 ? NAMES[(k + 7) % NAMES.length]! : null)),
      "No tables are left for that session.", 20);
    if (i === 3) return night(date, [booking(50, 0, "Aisha Bello", "Shatterpoint", null)]);
    return night(date, []);
  });

  return (
    <Container maxWidth="md" component="main" sx={{ py: 5 }}>
      <Typography variant="h1" sx={{ fontSize: "2.75rem", lineHeight: 1.1 }}>Book a table</Typography>
      <Box sx={{ width: 76, height: 4, bgcolor: faction.base, borderRadius: 2, mt: 1.75, mb: 2 }} />

      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem",
                        color: tokens.inkMuted, mb: 3.5, lineHeight: 1.7 }}>
        Thursdays  ·  19:00 - 22:30  ·  £5.00 a table  ·  10 tables  ·  you can hold 2
      </Typography>

      <Stack spacing={1}>
        {bookableSessions(nights, 4).map((s, i) => {
          const month = s.date.slice(0, 7);
          const shown = bookableSessions(nights, 4);
          const newMonth = i === 0 || shown[i - 1]!.date.slice(0, 7) !== month;
          return (
            <Box key={s.date}>
              {newMonth ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                  letterSpacing: "0.14em", color: tokens.inkMuted,
                                  mt: i === 0 ? 0 : 2.5, mb: 1 }}>
                  {monthYear(s.date)?.toUpperCase()}
                </Typography>
              ) : null}
              <BookingNight session={s} clubId={9} slug="didcot-wargames-didcot"
                faction={faction} price="£5.00" waitlistEnabled
                queue={s.isFull ? sampleQueue : []}
                posts={i === 1 ? samplePosts : []}
                lfgEnabled showTime={false} canManage />
            </Box>
          );
        })}
        <Box sx={{ pt: 1.5 }}>
          <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
            Show 9 more nights, to Thu 19 Nov
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
