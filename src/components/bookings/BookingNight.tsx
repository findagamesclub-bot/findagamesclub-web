import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TablePips from "./TablePips";
import BookingActions from "./BookingActions";
import LookingForGames from "./LookingForGames";
import ManageNight from "./ManageNight";
import { tokens, type Faction } from "@/lib/tokens";
import { nightLabel } from "@/utils/dates";
import type { CalendarSession } from "@/types/booking";
import type { QueueEntry } from "@/services/waitlist.service";
import type { LookingForGame } from "@/services/lookingForGames.service";

/**
 * One club night, as a fixture rather than a card.
 *
 * A club that meets weekly produces thirteen near-identical nights in a
 * quarter, and the time, the label, the price and the capacity are the same on
 * every one — those are club facts, said once in the header. What varies is the
 * date, how full it is, and whether you are on it, so the row carries only
 * those and its height follows its content: an empty night is a single line, a
 * busy one earns its space.
 */
export default function BookingNight({
  session, clubId, faction, slug, price, waitlistEnabled, queue, posts, lfgEnabled,
  showTime, canManage,
}: {
  session: CalendarSession;
  clubId: number;
  faction: Faction;
  slug: string;
  price: string | null;
  waitlistEnabled: boolean;
  queue: QueueEntry[];
  posts: LookingForGame[];
  lfgEnabled: boolean;
  /** Only when the club runs more than one kind of night. */
  showTime: boolean;
  canManage: boolean;
}) {
  const mine = session.bookings.find((b) => b.isMine) ?? null;
  const myQueueEntry = queue.find((q) => q.isMine) ?? null;

  // A hall with forty tables would otherwise put forty names on every row. The
  // club reaches the rest through Manage night; a member does not need them.
  const VISIBLE = 8;
  const shown = session.bookings.slice(0, VISIBLE);
  const hidden = session.bookings.length - shown.length;
  const [dayName, dayNum, monthName] = nightLabel(session.date).split(" ");

  return (
    <Stack
      spacing={1.25}
      sx={{
        px: { xs: 1.75, md: 2.25 },
        py: 1.75,
        borderRadius: 2,
        bgcolor: mine ? faction.soft : tokens.paper,
        border: `1px solid ${mine ? faction.base : tokens.rule}`,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 1.25, md: 2.5 }}
        sx={{ alignItems: { md: "center" } }}
      >
        {/* The date column. Tabular figures so the day numbers line up down
            the page and the eye can run the season without reading. */}
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: { md: 132 } }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                            color: tokens.inkMuted, letterSpacing: "0.06em" }}>
            {dayName?.toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 600,
                            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {dayNum}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                            color: tokens.inkMuted, letterSpacing: "0.06em" }}>
            {monthName?.toUpperCase()}
          </Typography>
          {showTime ? (
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                              color: tokens.inkMuted }}>
              {session.time}
            </Typography>
          ) : null}
        </Stack>

        {/* Never squeezed: a long "you are at your booking limit" message next
            to it was wrapping "10 of 10 free" onto three lines. */}
        <Box sx={{ flexShrink: 0 }}>
          <TablePips capacity={session.capacity} taken={session.bookings.length} faction={faction} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }} />

        {canManage ? <ManageNight session={session} queue={queue} slug={slug} /> : null}

        <BookingActions
          session={session}
          clubId={clubId}
          slug={slug}
          price={price}
          faction={faction}
          waitlistEnabled={waitlistEnabled}
          myBookingId={mine?.id ?? null}
          canCancelMine={mine?.canCancel ?? false}
          myQueueEntryId={myQueueEntry?.id ?? null}
          queueLength={queue.length}
          lfgEnabled={lfgEnabled}
          hasOpenPost={posts.some((p) => p.isMine)}
        />
      </Stack>

      {/* Who is playing, wrapped inline. Ten bookings cost two lines here
          instead of ten, and the table number stays with the name. */}
      {session.bookings.length ? (
        <Stack direction="row" spacing={1} useFlexGap
          sx={{ flexWrap: "wrap", borderTop: `1px solid ${tokens.rule}`, pt: 1.25 }}>
          {shown.map((b) => (
            <Stack key={b.id} direction="row" spacing={0.75}
              sx={{ alignItems: "baseline", pr: 1 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                color: tokens.inkMuted }}>
                {String(b.tableIndex + 1).padStart(2, "0")}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: b.isMine ? 700 : 400 }}>
                {/* Each seat says "You" only if that seat is you. */}
                {b.booker.isViewer ? "You" : b.booker.name}
                {(() => {
                  const other = b.opponent ?? b.acceptor;
                  if (!other) return "";
                  return ` v ${other.isViewer ? "You" : other.name}`;
                })()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                {b.gameTitle}
              </Typography>
            </Stack>
          ))}
          {hidden > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
              and {hidden} more
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {queue.length ? (
        <Stack direction="row" spacing={1.25} useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "baseline",
                borderTop: `1px solid ${tokens.rule}`, pt: 1.25 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            WAITING
          </Typography>
          {queue.map((q) => (
            <Stack key={q.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: q.isMine ? 700 : 400 }}>
                {q.position}. {q.isMine ? "You" : q.name}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}

      <LookingForGames
        posts={posts}
        slug={slug}
        faction={faction}
        canPlay={!session.isFull && !session.viewerBookedThisDate}
      />
    </Stack>
  );
}
