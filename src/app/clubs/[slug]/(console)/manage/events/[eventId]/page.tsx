import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import SectionNav from "@/components/ui/SectionNav";
import EventDetailsForm from "./EventDetailsForm";
import TicketTypes from "./TicketTypes";
import EventNotices from "./EventNotices";
import PublishPanel from "./PublishPanel";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { clubIdentity } from "@/utils/club-identity";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]">) {
  const { slug, eventId } = await params;
  const club = await getClubDetail(slug);
  if (!club) return { title: "Club not found" };
  const event = await getEvent(club.id, Number(eventId)).catch(() => null);
  return { title: event ? `${event.title} · Events` : "Event not found" };
}

/** One event, all of it, on one page. */
export default async function EventEditorPage({
  params,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]">) {
  const { slug, eventId } = await params;

  // Independent of each other, so one round trip rather than two.
  const [viewer, club] = await Promise.all([
    getCurrentProfile(),
    getClubDetail(slug),
  ]);
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events/${eventId}`);

  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  const event = await getEvent(club.id, Number(eventId));
  if (!event) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const tiers = club.membershipTiers.map((tier) => ({ key: tier.key, label: tier.label }));

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <BackLink href={`/clubs/${slug}/manage/events`} label="Back to events" />

      <PageHead
        title={event.title}
        lede="Everything about this event. It saves section by section, so you can leave and come back."
      />

      <SectionNav />

      <Stack spacing={0}>
        <PublishPanel slug={slug} event={event} faction={faction} />
        <EventDetailsForm slug={slug} event={event} club={{
          venueName: club.venue.name ?? "", venueAddress: club.venue.address ?? "",
          venuePostcode: club.venue.postcode ?? "", clubId: club.id,
        }} />
        <TicketTypes slug={slug} event={event} tiers={tiers} />
        <EventNotices slug={slug} event={event} />
      </Stack>
    </Container>
  );
}
