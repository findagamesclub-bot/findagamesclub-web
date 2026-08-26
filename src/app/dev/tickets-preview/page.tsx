import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EventTickets from "@/components/tickets/EventTickets";
import TicketStub from "@/components/tickets/TicketStub";
import AttendeeList from "@/components/tickets/AttendeeList";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { BuyableTicket, EventBooking, EventCart } from "@/types/ticket";

/** Local-only view of every ticket state, without needing an account. */
export default function TicketsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction, monogram } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");

  const tickets: BuyableTicket[] = [
    { id: 1, label: "Standard entry", price: "£30", unitAmount: 30, remaining: 37, sold: 3,
      soldOut: false, audienceLabel: "Open to everyone", blockedReason: null, inCart: 2 },
    { id: 2, label: "Club member", price: "£24", unitAmount: 24, remaining: 4, sold: 16,
      soldOut: false, audienceLabel: "Approved members of Didcot Wargames",
      blockedReason: null, inCart: 0 },
    { id: 3, label: "Premium ringside", price: "£45", unitAmount: 45, remaining: 6, sold: 0,
      soldOut: false, audienceLabel: "Premium Membership tier and above",
      blockedReason: "Premium Membership members only.", inCart: 0 },
    { id: 4, label: "Late entry", price: "£35", unitAmount: 35, remaining: 0, sold: 1,
      soldOut: true, audienceLabel: "One place left on the day", blockedReason: null, inCart: 0 },
  ];

  const cart: EventCart = {
    lines: [{ ticketTypeId: 1, label: "Standard entry", price: "£30", unitAmount: 30,
              quantity: 2, lineTotal: 60 }],
    subtotal: 60, discountPercent: 5, discountAmount: 3, total: 57,
    currency: "GBP", tierLabel: "Premium Membership",
  };

  const booking: EventBooking = {
    id: 1, reference: "FAGC-K7M2QP", eventId: 115, eventTitle: "Autumn Open",
    eventDate: "2026-09-26", clubSlug: "didcot-wargames-didcot", clubName: "Didcot Wargames",
    legacyId: "2026-09-26-autumn-open-test", fullName: "Ada Marchetti",
    email: "ada@example.com", status: "reserved", subtotal: 60, discountAmount: 3,
    total: 57, currency: "GBP", createdAt: "2026-08-22T10:00:00Z", lines: cart.lines,
  };

  const attendees = [
    { id: 1, reference: "FAGC-K7M2QP", fullName: "Ada Marchetti", email: "ada@example.com",
      total: 57, currency: "GBP", tickets: 2, summary: "2× Standard entry" },
    { id: 2, reference: "FAGC-B4XN9T", fullName: "Tom Okonkwo", email: "tom@example.com",
      total: 24, currency: "GBP", tickets: 1, summary: "1× Club member" },
    { id: 3, reference: "FAGC-R8HQ2D", fullName: "Priya Raman", email: "priya@example.com",
      total: 90, currency: "GBP", tickets: 3, summary: "2× Standard entry, 1× Club member" },
  ];

  return (
    <Container maxWidth="md" component="main" sx={{ py: 5 }}>
      <Stack spacing={4}>
        <Typography variant="h1" sx={{ fontSize: "2rem" }}>Tickets preview</Typography>

        <Section label="The desk, signed in as a Basic member with a cart">
          <EventTickets
            tickets={tickets} cart={cart} faction={faction}
            slug="didcot-wargames-didcot" eventKey="2026-09-26-autumn-open-test"
            eventId={115} signedIn hasEnded={false} myBookingReference={null}
          />
        </Section>

        <Section label="The confirmation">
          <TicketStub booking={booking} faction={faction} monogram={monogram} />
        </Section>

        <Section label="Cancelled">
          <TicketStub booking={{ ...booking, status: "cancelled" }} faction={faction}
            monogram={monogram} />
        </Section>

        <Section label="The door list, as the club sees it">
          <AttendeeList attendees={attendees} faction={faction} />
        </Section>
      </Stack>
    </Container>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Divider />
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                        letterSpacing: "0.12em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
      {children}
    </Stack>
  );
}
