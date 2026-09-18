import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import RosterBoard from "./RosterBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { getDoorList } from "@/services/eventRoster.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { clubIdentity } from "@/utils/club-identity";
import { consoleBackTarget } from "@/utils/back-link";

export const metadata = { title: "Who is coming" };

/**
 * Who is coming to one event, what they owe, and who has walked in.
 *
 * Called "Who is coming" and not "Roster", because a roster in this console is
 * already the club's list of members. Two lists of people a click apart, both
 * called the same thing, is a word doing two jobs badly. The address keeps
 * `/roster` since it is only a path, and legacy's own name for the page was
 * "Who is coming" anyway.
 */
export default async function RosterPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]/roster">) {
  const { slug, eventId } = await params;
  const { from } = await searchParams;

  // Independent of each other, so one round trip rather than two.
  const [viewer, club] = await Promise.all([
    getCurrentProfile(),
    getClubDetail(slug),
  ]);
  if (!viewer) {
    redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events/${eventId}/roster`);
  }
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  const event = await getEvent(club.id, Number(eventId));
  if (!event) notFound();

  const rows = await getDoorList(event.id);
  // Its last day, by the same London wall-clock rule the rest of the app uses.
  const lastDay = event.endDate || event.startDate;
  const over = Boolean(lastDay) && lastDay < londonToday();
  const { faction } = clubIdentity(club.slug, club.name);
  const back = consoleBackTarget(from, { slug, id: event.id, title: event.title });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      {/* Back to wherever they came from. Arriving from the bookings list and
          being sent to the event editor is the page losing their place. */}
      <BackLink href={back.href} label={`Back to ${back.label}`} />

      <PageHead
        // Past tense once it has happened, since "who is coming" to something
        // that finished in April is the page asking the wrong question.
        title={event.status === "cancelled" ? "Who had booked"
          : over ? "Who came" : "Who is coming"}
        lede="Everybody with a place. Mark who has paid, check people in as they arrive on the day, and take a place back when somebody cannot make it."
      />

      <RosterBoard slug={slug} eventId={event.id} rows={rows} faction={faction} />
    </Container>
  );
}
