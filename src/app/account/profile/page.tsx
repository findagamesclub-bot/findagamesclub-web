import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import Panel from "@/components/members/Panel";
import MemberBadges from "@/components/members/MemberBadges";
import LinkButton from "@/components/ui/LinkButton";
import ProfileForm from "@/components/members/ProfileForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnDraft } from "@/services/profiles.service";
import { getHeldBadges } from "@/services/memberBadges.service";
import { getMemberRecords } from "@/services/memberRecords.service";
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

  // One wave. Neither read needs the other, and both are small.
  const [held, records] = await Promise.all([
    getHeldBadges(viewer.id).catch(() => []),
    getMemberRecords(viewer.id)
      .catch(() => ({ competitions: [], podiums: [], badges: [] })),
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
                Clubs give some of these out. The rest you earn by turning up
                and by how you do in their leagues and campaigns.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              None yet. Clubs hand badges out for things like winning a
              tournament, and you earn others for how long you have been a
              member and how you do in their leagues.
            </Typography>
          )}

          {/* The way to see yourself as everybody else does, which nothing on
              the site offered before. */}
          <Box sx={{ mt: 2 }}>
            <LinkButton variant="outlined" size="small" href={`/members/${viewer.id}`}>
              See your profile as others do
            </LinkButton>
          </Box>
        </Panel>

        <ProfileForm draft={draft} />
      </Stack>
    </>
  );
}
