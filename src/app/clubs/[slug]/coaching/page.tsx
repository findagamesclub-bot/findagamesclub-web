import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import CoachingCalendar from "@/components/coaching/CoachingCalendar";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
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
  return { title: club ? `Coaching — ${club.name}` : "Club not found" };
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
  const canManage = club.ownerId === viewer.id || viewer.role === "admin";
  const membership = await getMyMembership(club.id, viewer.id);
  const isMember = canManage || membership.status === "approved";

  const coaching = await getCoaching(club.id, viewer.id, londonToday());
  // A club that has not switched coaching on has no page, rather than an empty one.
  if (!coaching.enabled) notFound();

  const open = coaching.slots.filter((s) => s.status === "open" && s.spacesLeft > 0).length;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back} title="Coaching" clubName={club.name} clubSlug={club.slug}
        faction={faction}
        stats={isMember ? [
          { label: coaching.slots.length === 1 ? "slot" : "slots", value: String(coaching.slots.length) },
          ...(open ? [{ label: "with places", value: String(open), emphasis: true }] : []),
        ] : []} />

      {coaching.intro ? (
        <Typography variant="body1" sx={{ mb: 3, maxWidth: 620 }}>{coaching.intro}</Typography>
      ) : null}

      {isMember ? (
        <>
          <CoachingCalendar slots={coaching.slots} slug={slug} clubId={club.id}
            faction={faction} canManage={canManage} isMember={isMember} />

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
