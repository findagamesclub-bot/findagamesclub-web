import { notFound, redirect } from "next/navigation";
import MemberProfileView from "@/components/members/MemberProfileView";
import { getCurrentProfile } from "@/services/auth.service";
import { getProfile } from "@/services/profiles.service";
import { getMemberContext } from "@/services/memberContext.service";
import { getMemberRecords } from "@/services/memberRecords.service";
import { getGrudgeTracker } from "@/services/grudgeTracker.service";

export const metadata = { title: "Your profile" };

/**
 * The admin's own profile, inside the console.
 *
 * The same view everybody else sees at /members/[id], drawn in the console's
 * right-hand column. The rail is the only navigation an admin has once the
 * header is hidden, so a rail entry that opens the public site strands them.
 */
export default async function AdminProfilePage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/admin/profile");

  const profile = await getProfile(viewer.id);
  if (!profile) notFound();

  const [context, records] = await Promise.all([
    getMemberContext(viewer.id, profile.id)
      .catch(() => ({ clubs: [], events: [], meetings: [],
                      record: { played: 0, won: 0, drawn: 0, lost: 0 } })),
    getMemberRecords(profile.id).catch(() => ({ competitions: [], podiums: [], badges: [] })),
  ]);
  const trackers = await getGrudgeTracker(profile.id, context.clubs).catch(() => []);

  return (
    <MemberProfileView
      profile={profile}
      isSelf
      embedded
      editHref="/admin/profile/edit"
      context={context}
      records={records}
      trackers={trackers}
    />
  );
}
