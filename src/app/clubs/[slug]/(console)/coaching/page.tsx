import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import CoachingCalendar from "@/components/coaching/CoachingCalendar";
import EmptyState from "@/components/ui/EmptyState";
import SplitBar from "@/components/ui/SplitBar";
import MonoLabel from "@/components/ui/MonoLabel";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getMyMembership } from "@/services/memberships.service";
import { getCoaching } from "@/services/clubExtras.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/coaching">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Coaching · ${club.name}` : "Club not found" };
}

export default async function CoachingPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/coaching">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/coaching`);

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const access = await getClubAccess(club.id, viewer);
  const canManage = access.can("coaching.manage");
  const membership = await getMyMembership(club.id, viewer.id);
  const isMember = canManage || membership.status === "approved";

  const today = londonToday();
  // Every session, not only the ones still to come. The club's own console has
  // always read the whole history and this page asked for `today` onwards, so
  // the two screens disagreed about how much coaching a club had ever done and
  // the client asked which was right. Neither was wrong; the member simply had
  // no way back to a session they had been on, which is where the receipt and
  // the "still to pay" marker live. The tabs are what make it bearable: this
  // opens on Active, and Past is a press away.
  const coaching = await getCoaching(club.id, viewer.id, null);
  // A visitor to a club that has not switched coaching on has no page here.
  // The club itself does: the console lists Coaching for everybody who can run
  // it, and 404ing the people it is listed for turns their own rail into a
  // dead end that leaves the console entirely.
  if (!coaching.enabled && !canManage) notFound();

  if (!coaching.enabled) {
    return (
      <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
        <ClubSectionHeader back={back} title="Coaching" clubName={club.name}
          clubSlug={club.slug} faction={faction} stats={[]} />
        <EmptyState
          title="Coaching is not switched on"
          description={`Members see nothing here until it is. Sessions you put up for ${club.name} become bookable on this page.`}
        />
      </Container>
    );
  }

  // The header answers "what can I still do", so it counts forward. A club a
  // year in would otherwise lead with a figure that is almost all history.
  const ahead = coaching.slots.filter((s) => s.date >= today);
  const behind = coaching.slots.length - ahead.length;
  const open = ahead.filter((s) => s.status === "open" && s.spacesLeft > 0).length;

  // Seats rather than slots. A club running one slot of ten and one of one has
  // "two slots", which says nothing about whether anybody is coming. Only the
  // sessions still to come: last season's empty seats are not something
  // anybody can fill.
  const live = ahead.filter((s) => s.status === "open");
  const seats = {
    taken: live.reduce((n, s) => n + s.taken, 0),
    free: live.reduce((n, s) => n + s.spacesLeft, 0),
    closed: ahead
      .filter((s) => s.status !== "open")
      .reduce((n, s) => n + s.capacity, 0),
    get total() { return this.taken + this.free + this.closed; },
  };

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back} title="Coaching" clubName={club.name} clubSlug={club.slug}
        faction={faction}
        stats={isMember ? [
          { label: "coming up", value: String(ahead.length) },
          ...(open ? [{ label: "with places", value: String(open), emphasis: true }] : []),
          ...(behind ? [{ label: "already run", value: String(behind) }] : []),
        ] : []} />

      {coaching.intro ? (
        <Typography variant="body1" sx={{ mb: 3, maxWidth: 620 }}>{coaching.intro}</Typography>
      ) : null}

      {isMember ? (
        <>
          {/* Whether the seats the club put out are being taken. A calendar
              of slots cannot answer that; it takes counting down it. */}
          {canManage && seats.total ? (
            <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                       backgroundColor: tokens.paper }}>
              <MonoLabel>How the seats are going</MonoLabel>
              <SplitBar parts={[
                { key: "taken", label: "Booked", value: seats.taken, color: tokens.positive },
                { key: "free", label: "Still free", value: seats.free, color: tokens.rule },
                { key: "closed", label: "Closed or cancelled", value: seats.closed,
                  color: tokens.inkMuted },
              ]} />
            </Box>
          ) : null}

          <CoachingCalendar slots={coaching.slots} slug={slug} clubId={club.id}
            faction={faction} canManage={canManage} isMember={isMember}
            today={today} standing={coaching.standing}
            // What a member came here to do. Everything that has run is one
            // press away on Past, which is the point of carrying it at all.
            startOn="active" />

          {coaching.policy ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 3 }}>
              {coaching.policy}
            </Typography>
          ) : null}
        </>
      ) : (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 4,
                   textAlign: "center" }}>
          <LockIcon sx={{ fontSize: 30, color: tokens.inkMuted, mb: 1 }} />
          <Typography variant="h3" sx={{ fontSize: "1.2rem", mb: 0.75 }}>
            Coaching is for members
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 420, mx: "auto" }}>
            {membership.status === "pending"
              ? `Your request to join ${club.name} is with the owner.`
              : `Join ${club.name} and you can book coaching slots here.`}
          </Typography>
        </Box>
      )}
    </Container>
  );
}
