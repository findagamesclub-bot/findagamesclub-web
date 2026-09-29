import { notFound, redirect } from "next/navigation";
import NextLink from "next/link";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MemberArmyInsights from "@/components/members/MemberArmyInsights";
import { getProfile } from "@/services/profiles.service";
import { getMemberMeta } from "@/services/meta.service";
import { getCurrentProfile } from "@/services/auth.service";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/members/[id]/armies">) {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile ? `What ${profile.fullName} plays` : "Member not found" };
}

/**
 * Every faction one member has had a result confirmed with.
 *
 * The profile shows six and stops. Six is two rows, which is as much as a
 * panel can take on a page that already carries badges, the grudge tracker and
 * two columns of detail; somebody a few seasons into 40k can have twenty.
 *
 * Read through RLS, like the panel: `game_result_armies_select` admits the
 * person themselves, their clubmates and the club's team, so a reader who
 * shares no club with them gets nothing back and this 404s rather than
 * rendering a page about somebody they cannot see.
 */
export default async function MemberArmiesPage({ params }: PageProps<"/members/[id]/armies">) {
  const { id } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(`/members/${id}/armies`)}`);

  const profile = await getProfile(id);
  if (!profile) notFound();

  const armies = await getMemberMeta(profile.id).catch(() => []);
  if (!armies.length) notFound();

  const first = profile.fullName.trim().split(" ")[0] || profile.fullName;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <NextLink href={`/members/${id}`} style={{ textDecoration: "none" }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {profile.fullName}
              </Typography>
            </Stack>
          </NextLink>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>
            {viewer.id === profile.id ? "What you play" : `What ${first} plays`}
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.inkMuted }}>
            Every faction with a result their club has confirmed.
          </Typography>
        </Stack>

        <MemberArmyInsights armies={armies} name={first} />
      </Stack>
    </Container>
  );
}
