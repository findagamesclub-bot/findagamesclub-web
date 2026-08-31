import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import Stack from "@mui/material/Stack";
import CoachingBrowser from "@/components/account/CoachingBrowser";
import OpenCoaching from "@/components/account/OpenCoaching";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyCoaching, getOpenCoaching } from "@/services/myActivity.service";
import { getMyMemberships } from "@/services/myMemberships.service";
import { countUnpaid } from "@/utils/coaching-filter";

export const metadata = { title: "Your coaching" };

/**
 * Every coaching session this member has booked, at any club.
 *
 * The two questions here are "when is my next one" and "have I paid", so the
 * lede answers the second and the default order answers the first. Payment is
 * taken by the club on the day, which is why an unpaid session is marked
 * rather than made payable.
 */
export default async function AccountCoachingPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/coaching");

  const [sessions, memberships] = await Promise.all([
    getMyCoaching(viewer.id),
    getMyMemberships(viewer.id),
  ]);

  // Only clubs that actually took them in: a pending application does not give
  // anybody a place on a coaching slot.
  const clubIds = memberships
    .filter((m) => m.status === "approved")
    .map((m) => m.club.id);

  const open = await getOpenCoaching(clubIds, viewer.id).catch(() => []);
  const owing = countUnpaid(sessions);

  return (
    <>
      <PageHead
        title="Coaching"
        lede={owing
          ? `${owing === 1 ? "One session is" : `${owing} sessions are`} still to pay for. Clubs take payment on the day.`
          : open.length
            ? `${open.length === 1 ? "One coaching slot has" : `${open.length} coaching slots have`} places left at your clubs.`
            : "Sessions you have booked with a coach at any of your clubs."}
      />

      <Stack spacing={3}>
        <OpenCoaching slots={open} />

        {sessions.length ? (
          <CoachingBrowser sessions={sessions} />
        ) : (
          <EmptyState
            title="No coaching booked"
            description="Some clubs run one-to-one and group coaching. Their club page has the calendar."
            action={{ label: "Your clubs", href: "/account/memberships" }}
          />
        )}
      </Stack>
    </>
  );
}
