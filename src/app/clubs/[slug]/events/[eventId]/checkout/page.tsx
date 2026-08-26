import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckoutForm from "@/components/tickets/CheckoutForm";
import { getEventDetail } from "@/services/eventDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBuyableTickets } from "@/services/tickets.service";
import { clubIdentity } from "@/utils/club-identity";
import { formatMoney } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
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

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={`/clubs/${slug}/events/${eventId}`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>Back to the event</Typography>
        </Stack>
      </NextLink>

      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>{event.clubName}</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" }, lineHeight: 1.15 }}>
          {event.title}
        </Typography>
        {event.startDate ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                            letterSpacing: "0.04em", color: tokens.inkMuted }}>
            {nightLabel(event.startDate).toUpperCase()}
            {event.startTime ? ` · ${event.startTime}` : ""}
          </Typography>
        ) : null}
      </Stack>

      <Box sx={{ display: "grid", gap: 4, alignItems: "start",
                 gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.2fr) minmax(320px,1fr)" } }}>
        <Box sx={{ border: `1px solid ${tokens.rule}`,
                   borderRadius: 1.5, backgroundColor: tokens.paper }}>
        <Stack sx={{ px: 2.5, pt: 2, pb: 1.5 }} spacing={1}>
          {cart.lines.map((line) => (
            <Stack key={line.ticketTypeId} direction="row" spacing={2}
              sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", minWidth: 0 }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                  fontSize: "0.85rem", color: faction.deep }}>
                  {line.quantity}&times;
                </Typography>
                <Typography variant="body2">{line.label}</Typography>
              </Stack>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {formatMoney(line.lineTotal, cart.currency)}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider />

        <Stack spacing={0.75} sx={{ px: 2.5, py: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>Subtotal</Typography>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
              {formatMoney(cart.subtotal, cart.currency)}
            </Typography>
          </Stack>

          {cart.discountAmount > 0 ? (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: tokens.positive }}>
                {cart.tierLabel ?? "Member"} discount · {cart.discountPercent}%
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: tokens.positive }}>
                − {formatMoney(cart.discountAmount, cart.currency)}
              </Typography>
            </Stack>
          ) : null}

          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline",
                                       pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
            <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Total</Typography>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem", fontWeight: 700 }}>
              {formatMoney(cart.total, cart.currency)}
            </Typography>
          </Stack>
        </Stack>
        </Box>

        {/* Sticky, so a long order never pushes the one action off screen. */}
        <Box sx={{ position: { md: "sticky" }, top: { md: 96 } }}>
      <CheckoutForm
        slug={slug}
        eventKey={eventId}
        eventId={event.id}
        fullName={viewer.full_name ?? ""}
        email={viewer.email ?? ""}
        total={cart.total}
        currency={cart.currency}
        faction={faction}
      />
        </Box>
      </Box>
    </Container>
  );
}
