import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { getBooking } from "@/services/eventBookings.service";
import { getCurrentProfile } from "@/services/auth.service";
import TicketStub from "@/components/tickets/TicketStub";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Your tickets" };

export default async function BookingPage({ params }: PageProps<"/tickets/[reference]">) {
  const { reference } = await params;
  const viewer = await getCurrentProfile();
  const booking = await getBooking(reference);

  // RLS returns nothing rather than refusing, so a booking that is not yours
  // and a booking that does not exist look the same here. Both are 404.
  if (!booking) notFound();

  const { faction, monogram } = clubIdentity(booking.clubSlug, booking.clubName);
  const cancelled = booking.status === "cancelled";

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      {!cancelled ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 2.5 }}>
          <CheckCircleIcon sx={{ color: tokens.positive, fontSize: 26 }} />
          <Stack spacing={0}>
            <Typography variant="h2" sx={{ fontSize: "1.5rem", lineHeight: 1.2 }}>
              You are booked in
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              A confirmation is on its way to {booking.email}.
            </Typography>
          </Stack>
        </Stack>
      ) : null}

      <TicketStub booking={booking} faction={faction} monogram={monogram} />

      <Box sx={{ mt: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                 backgroundColor: tokens.surface }}>
        <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)", mb: 0.5 }}>
          Paying for the event
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {booking.clubName} takes payment either before the event or when you arrive.
          Bring your reference. Quoting it is enough, you do not need to print anything.
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
        {/* Wrapped, not `component={NextLink}`: this is a Server Component,
            and MUI's `component` prop cannot cross that boundary. */}
        <NextLink href={`/clubs/${booking.clubSlug}/events/${booking.legacyId}`}
          style={{ textDecoration: "none" }}>
          <Button variant="outlined">Back to the event</Button>
        </NextLink>
        {viewer ? (
          <NextLink href="/tickets" style={{ textDecoration: "none" }}>
            <Button variant="text">All my tickets</Button>
          </NextLink>
        ) : null}
      </Stack>
    </Container>
  );
}
