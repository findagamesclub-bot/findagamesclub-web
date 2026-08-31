import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import PanelCard from "./PanelCard";
import ClubLogo from "@/components/clubs/ClubLogo";
import { nightLabel, shortDate } from "@/utils/dates";
import { countUnrecorded, tally } from "@/utils/game-filter";
import { mono, tokens } from "@/lib/tokens";
import type { Dashboard } from "@/services/dashboard.service";

const Empty = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{children}</Typography>
);

/** A row of the same shape in every panel, so the six read as one board. */
const Row = ({ lead, title, note, right }: {
  lead?: React.ReactNode; title: string; note?: string; right?: string;
}) => (
  <Stack direction="row" spacing={1.25}
    sx={{ alignItems: "center", py: 0.875,
          "&:not(:last-of-type)": { borderBottom: `1px solid ${tokens.rule}` } }}>
    {lead}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{title}</Typography>
      {note ? (
        <Typography sx={{ fontSize: "0.78rem", color: tokens.inkMuted }} noWrap>{note}</Typography>
      ) : null}
    </Box>
    {right ? (
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted,
                        flexShrink: 0 }}>
        {right}
      </Typography>
    ) : null}
  </Stack>
);

export default function DashboardPanels({
  data, pending,
}: {
  data: Dashboard;
  pending: number;
}) {
  const approved = data.memberships.filter((m) => m.status === "approved");
  const overdue = approved.filter((m) => m.standing.overdue);
  const tickets = data.tickets.filter((t) => t.status !== "cancelled");
  const points = data.loyalty.reduce((n, card) => n + card.available, 0);
  const record = tally(data.games);
  const unrecorded = countUnrecorded(data.games);
  // Scored games first, then whatever is next. A dashboard row with no result
  // in it says nothing.
  const recent = [...data.games]
    .sort((a, b) => Number(Boolean(b.outcome)) - Number(Boolean(a.outcome)))
    .slice(0, 4);

  return (
    <>
      <PanelCard title="Memberships" icon={CardMembershipIcon} figure={approved.length}
        href="/account/memberships" linkLabel="Manage memberships"
        caption={overdue.length
          ? `${overdue.length} needs a payment.`
          : pending
            ? `${pending} application still with the club.`
            : undefined}>
        {approved.length || pending ? (
          data.memberships.slice(0, 4).map((m) => (
            <Row key={m.membershipId}
              lead={<ClubLogo slug={m.club.slug} name={m.club.name}
                      logoUrl={m.club.logoUrl} size={30} ring={tokens.rule} />}
              title={m.club.name}
              note={m.tierLabel ?? m.club.city}
              right={m.status === "approved"
                ? (m.standing.overdue ? "OVERDUE" : "OK")
                : m.status.toUpperCase()} />
          ))
        ) : (
          <Empty>
            You have not joined a club yet.{" "}
            <NextLink href="/clubs" style={{ color: tokens.brand }}>Find one</NextLink>.
          </Empty>
        )}
      </PanelCard>

      {/* Sits second, above the bookings that produce it: what happened is
          more interesting than what is arranged. */}
      <PanelCard title="Your games" icon={SportsEsportsIcon} figure={record.played}
        href="/account/games" linkLabel="All your games"
        caption={unrecorded
          ? `${unrecorded} ${unrecorded === 1 ? "game has" : "games have"} no result yet.`
          : record.played
            ? `Won ${record.won}, drew ${record.drawn}, lost ${record.lost}.`
            : "Book a table and the game lands here."}>
        {recent.length ? (
          recent.map((game) => (
            <Row key={game.id}
              lead={<ClubLogo slug={game.club.slug} name={game.club.name}
                      logoUrl={game.club.logoUrl} size={30} ring={tokens.rule} />}
              title={game.opponentName}
              note={`${game.title} · ${game.club.name}`}
              right={game.outcome
                ? `${game.myScore}-${game.theirScore}`
                : game.played ? "NO RESULT" : nightLabel(game.date)} />
          ))
        ) : (
          <Empty>No games yet. Every table you book becomes one.</Empty>
        )}
      </PanelCard>

      <PanelCard title="Table bookings" icon={EventSeatIcon} figure={data.bookings.length}
        href="/account/bookings" linkLabel="All bookings"
        caption="Where you are playing next.">
        {data.bookings.length ? (
          data.bookings.slice(0, 4).map((booking) => (
            <Row key={booking.id}
              lead={<ClubLogo slug={booking.clubSlug} name={booking.clubName}
                      logoUrl={booking.logoUrl} size={30} ring={tokens.rule} />}
              title={booking.gameTitle || "Table booked"}
              note={`${booking.clubName}${booking.time ? ` · ${booking.time}` : ""}`}
              right={nightLabel(booking.date)} />
          ))
        ) : (
          <Empty>No table booked. Club pages have the nights and the free tables.</Empty>
        )}
      </PanelCard>

      <PanelCard title="Event tickets" icon={ConfirmationNumberIcon} figure={tickets.length}
        href="/account/tickets" linkLabel="All tickets"
        caption="Quote the reference on the door.">
        {tickets.length ? (
          tickets.slice(0, 4).map((ticket) => (
            <Row key={ticket.id} title={ticket.eventTitle}
              note={`${ticket.clubName}${ticket.eventDate ? ` · ${shortDate(ticket.eventDate)}` : ""}`}
              right={ticket.reference} />
          ))
        ) : (
          <Empty>
            No tickets yet.{" "}
            <NextLink href="/events" style={{ color: tokens.brand }}>Browse events</NextLink>.
          </Empty>
        )}
      </PanelCard>

      <PanelCard title="Loyalty" icon={LoyaltyIcon} figure={points}
        href="/account/loyalty" linkLabel="Your loyalty cards"
        caption="Points you have earned at clubs that run a programme.">
        {data.loyalty.length ? (
          <Stack spacing={1.5}>
            {data.loyalty.slice(0, 3).map((card) => (
              <Box key={card.clubSlug}>
                <Stack direction="row" spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {card.clubName}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", flexShrink: 0 }}>
                    {card.available} pts{card.tierLabel ? ` · ${card.tierLabel}` : ""}
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate"
                  value={Math.round(card.progress * 100)}
                  sx={{ height: 6, borderRadius: 3, backgroundColor: tokens.rule,
                        "& .MuiLinearProgress-bar": { backgroundColor: tokens.brass } }} />
                {card.toNext ? (
                  <Typography sx={{ fontSize: "0.75rem", color: tokens.inkMuted, mt: 0.375 }}>
                    {card.toNext} more to the next tier
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        ) : (
          <Empty>None of your clubs runs a loyalty programme yet.</Empty>
        )}
      </PanelCard>

      <PanelCard title="Messages" icon={ForumIcon} figure={data.unreadMessages}
        href="/account/messages" linkLabel="Open messages"
        caption={data.unreadMessages
          ? "Somebody is waiting on a reply."
          : "Nothing unread."}>
        <Empty>
          Conversations are per club, so the same person appears once for each
          club you both belong to.
        </Empty>
      </PanelCard>

      <PanelCard title="Event alerts" icon={NotificationsIcon} figure={data.alerts.length}
        href="/account/alerts" linkLabel="Manage alerts"
        caption="Searches you asked to be told about.">
        {data.alerts.length ? (
          data.alerts.slice(0, 4).map((alert) => (
            <Row key={alert.id} title={alert.label} />
          ))
        ) : (
          <Empty>No saved searches. Save one from the events page.</Empty>
        )}
      </PanelCard>
    </>
  );
}
