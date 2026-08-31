import { notFound, redirect } from "next/navigation";
import MemberProfileView from "@/components/members/MemberProfileView";
import { getProfile } from "@/services/profiles.service";
import { getMemberContext } from "@/services/memberContext.service";
import { getMemberRecords } from "@/services/memberRecords.service";
import { getCurrentProfile } from "@/services/auth.service";

export async function generateMetadata({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile ? profile.fullName : "Member not found" };
}

export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;

  // Profiles are readable by signed-in people only, matching the RLS policy in
  // migration 0001. Sending a signed-out visitor to an empty page would look
  // like the member does not exist.
  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(`/members/${id}`)}`);

  const profile = await getProfile(id);
  if (!profile) notFound();

  // Where they play, and how the reader has done against them. Both are
  // limited by policy to what the reader may already see.
  const [context, records] = await Promise.all([
    getMemberContext(viewer.id, profile.id)
      .catch(() => ({ clubs: [], events: [], meetings: [],
                      record: { played: 0, won: 0, drawn: 0, lost: 0 } })),
    getMemberRecords(profile.id)
      .catch(() => ({ competitions: [], podiums: [], badges: [] })),
  ]);

  return (
    <MemberProfileView
      profile={profile}
      isSelf={viewer.id === profile.id}
      context={context}
      records={records}
    />
  );
}
