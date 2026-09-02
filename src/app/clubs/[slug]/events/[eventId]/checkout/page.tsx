import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckoutPanels from "@/components/tickets/CheckoutPanels";
import EventWhen from "@/components/events/EventWhen";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets, getTicketStanding } from "@/services/tickets.service";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: PageProps<"/clubs/[slug]/events/[eventId]/checkout">) {
  const { slug, eventId } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/events/${eventId}/checkout`);

  const event = await getEventDetail(slug, eventId, viewer);
  if (!event) notFound();

  const membership = await getMyMembership(event.clubId, viewer.id);
  const { cart } = await getBuyableTickets({
    eventId: event.id,
    ticketTypes: event.ticketTypes,
    tiers: event.tiers,
    viewerId: viewer.id,
    canManageClub: event.canManageClub,
    isApprovedMember: membership.status === "approved",
    viewerTierKey: membership.tierKey,
  });

  // Nothing to check out is not an error state worth a page of its own — the
  // event page is where they would go to fix it.
  if (!cart || !cart.lines.length) redirect(`/clubs/${slug}/events/${eventId}`);

  const { faction } = clubIdentity(event.clubSlug, event.clubName);

  // What they may pay with. Zeroes for anyone who is not an approved member
  // here, which is how the points field stays out of their way entirely.
  const standing = await getTicketStanding({
    clubId: event.clubId,
    profileId: viewer.id,
    subtotal: cart.subtotal,
    currency: cart.currency,
    discountPercent: cart.discountPercent,
    tierLabel: cart.tierLabel ?? null,
  });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={`/clubs/${slug}/events/${eventId}`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>Back to the event</Typography>
        </Stack>
      </NextLink>

      <Stack spacing={1.25} sx={{ mb: 3, alignItems: "flex-start" }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>{event.clubName}</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" }, lineHeight: 1.15 }}>
          {event.title}
        </Typography>
        {/* The same block the event page and the map tile use. Somebody about
            to pay is the last person who should have to guess whether the
            thing they are booking runs into a second day. */}
        <EventWhen event={event} faction={faction} dense />
      </Stack>

      <CheckoutPanels
        cart={cart}
        standing={standing}
        slug={slug}
        eventKey={eventId}
        eventId={event.id}
        fullName={viewer.full_name ?? ""}
        email={viewer.email ?? ""}
        faction={faction}
      />
    </Container>
  );
}
