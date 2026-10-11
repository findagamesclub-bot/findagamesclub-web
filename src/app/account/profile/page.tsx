import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import Panel from "@/components/members/Panel";
import MemberBadges from "@/components/members/MemberBadges";
import MemberCodePanel from "@/components/members/MemberCodePanel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LinkButton from "@/components/ui/LinkButton";
import ProfileForm from "@/components/members/ProfileForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnDraft } from "@/services/profiles.service";
import { getHeldBadges } from "@/services/memberBadges.service";
import { getMemberRecords } from "@/services/memberRecords.service";
import { getMyMemberCode } from "@/services/memberCodes.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Your profile" };

/**
 * What somebody tells other members about themselves.
 *
 * The badges are here because there was nowhere else. A club can hand one out
 * and the member had no way to see it: the only page that rendered badges was
 * somebody else's profile, and nothing on the site linked you to your own. A
 * badge nobody can find is a badge nobody earns twice.
 */
export default async function EditProfilePage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=%2Faccount%2Fprofile");

  const draft = await getOwnDraft(viewer.id);
  if (!draft) redirect("/auth/sign-in");

  // One wave. None of them needs the others, and all three are small.
  const [held, records, memberCode] = await Promise.all([
    getHeldBadges(viewer.id).catch(() => []),
    getMemberRecords(viewer.id)
      .catch(() => ({ competitions: [], podiums: [], badges: [] })),
    getMyMemberCode(),
  ]);
  const badges = [...held, ...records.badges];

  return (
    <>
      <PageHead
        title="Tell people what you play"
        lede="Other members see this when you post or ask for a game. Everything is optional except your name."
      />

      <Stack spacing={2.5}>
        <Panel title="Your badges">
          {badges.length ? (
            <Stack spacing={2}>
              <MemberBadges badges={badges} />
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Your clubs give these out. Some arrive on their own: first,
                second or third when a club puts you on a podium, and one for
                how long you have been a member.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              None yet. First, second and third arrive on their own when a
              club puts you on a podium at an event or a league, one comes a
              year after you join, and clubs hand out their own for things
              like painting the terrain.
            </Typography>
          )}

          {/* The way to see yourself as everybody else does, which nothing on
              the site offered before. */}
          <Box sx={{ mt: 2 }}>
            <LinkButton variant="contained" href={`/members/${viewer.id}`}
              startIcon={<VisibilityIcon />}
              sx={{ width: { xs: "100%", sm: "auto" } }}>
              See your profile as others do
            </LinkButton>
          </Box>
        </Panel>

        <MemberCodePanel code={memberCode} />

        <ProfileForm draft={draft} />
      </Stack>
    </>
  );
}
