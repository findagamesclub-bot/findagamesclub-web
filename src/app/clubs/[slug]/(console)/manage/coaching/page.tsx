import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import CoachingBookings from "@/components/coaching/CoachingBookings";
import CoachingCalendar from "@/components/coaching/CoachingCalendar";
import EmptyState from "@/components/ui/EmptyState";
import CoachingSettingsForm from "./CoachingSettingsForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getMyMembership } from "@/services/memberships.service";
import { getCoaching } from "@/services/clubExtras.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { findCoachingSettings } from "@/repositories/clubSettings.repository";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Coaching" };

/**
 * Coaching, in one view: whether it is on, what members read, and the sessions.
 *
 * The sessions were on the club's own page and nowhere else, so an owner who
 * opened Coaching in the console found a switch and two text boxes and no
 * coaching. They are the same cards the members see, because a session is a
 * thing to put up and a thing to fill, and splitting those into two screens
 * only made somebody look for the second one.
 */
export default async function ManageCoachingPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/coaching">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  // Sessions first: the settings are set once and the sessions are the weekly
  // job. A tab is a link, so the one you are on survives a reload and a share.
  const showing = tab === "settings" ? "settings"
    : tab === "bookings" ? "bookings"
    : "sessions";

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/coaching`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("coaching.manage")) notFound();

  const [settings, coaching, membership] = await Promise.all([
    findCoachingSettings(club.id).catch(() => null),
    getCoaching(club.id, viewer.id, londonToday()),
    getMyMembership(club.id, viewer.id),
  ]);
  const { faction } = clubIdentity(club.slug, club.name);

  const at = (name: string) => `/clubs/${slug}/manage/coaching?tab=${name}`;
  const booked = coaching.slots.reduce((n, slot) => n + slot.attendees.length, 0);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Coaching"
        lede="Your sessions, and what members read before they book."
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Coaching"
          value={showing}
          accent={faction.base}
          tabs={[
            { value: "sessions", label: "Sessions", href: at("sessions"),
              count: coaching.slots.length },
            { value: "bookings", label: "Bookings", href: at("bookings"),
              count: booked },
            { value: "settings", label: "Settings", href: at("settings") },
          ]}
        />
      </Box>

      {showing === "bookings" ? (
        <CoachingBookings slots={coaching.slots} slug={slug} />
      ) : showing === "settings" ? (
        <CoachingSettingsForm
          slug={slug}
          enabled={Boolean(settings?.enabled)}
          intro={settings?.intro_text ?? ""}
          policy={settings?.policy_text ?? ""}
        />
      ) : settings?.enabled ? (
        <CoachingCalendar slots={coaching.slots} slug={slug} clubId={club.id}
          faction={faction} canManage isMember={membership.status === "approved"} />
      ) : (
        <EmptyState
          title="Coaching is switched off"
          description="Turn it on in Settings and your sessions appear here, and on the club page for members to book."
          action={{ label: "Open settings", href: at("settings") }}
        />
      )}
    </Container>
  );
}
