import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import SplitBar from "@/components/ui/SplitBar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import MonoLabel from "@/components/ui/MonoLabel";
import InviteDialog from "@/components/console/InviteDialog";
import TeamMemberRow from "@/components/console/TeamMemberRow";
import InviteRow from "@/components/console/InviteRow";
import TransferOwnership from "@/components/console/TransferOwnership";
import RecentChanges from "@/components/console/RecentChanges";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubTeam, getRecentChanges } from "@/services/clubTeam.service";
import { getTransferCandidates } from "@/services/teamWrites.service";
import { getRoster } from "@/services/memberships.service";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Team" };

const PER_PAGE = 20;

export default async function TeamPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/team">) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  const access = await getClubAccess(club.id, viewer);
  // The layout lets any team role in. This page is the owner's.
  if (!access.can("team.manage")) redirect(`/clubs/${slug}/manage`);

  const page = Math.max(1, Number(rawPage) || 1);
  const { faction } = clubIdentity(club.slug, club.name);

  const [team, changes, candidates, roster] = await Promise.all([
    getClubTeam(club.id),
    getRecentChanges(club.id, page, PER_PAGE),
    getTransferCandidates(club.id),
    getRoster(club.id).catch(() => []),
  ]);

  // Somebody already on the team cannot be invited onto it again.
  const onTeam = new Set([
    team.owner?.profileId,
    ...team.managers.map((m) => m.profileId),
    ...team.helpers.map((m) => m.profileId),
  ]);
  const invitable = roster
    .filter((m) => m.status === "approved" && !onTeam.has(m.profileId))
    .map((m) => ({ profileId: m.profileId, fullName: m.fullName }));

  const helping = team.managers.length + team.helpers.length;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <PageHead
        title="Team"
        lede={helping
          ? `${helping} ${helping === 1 ? "person helps" : "people help"} you run ${club.name}.`
          : `Nobody else can manage ${club.name} yet.`}
        action={<InviteDialog clubId={club.id} slug={club.slug} roster={invitable} />}
      />

      <Stack spacing={3}>
        {/* Who holds what, before the list of names. A club with nine helpers
            and no manager is a different club from one with two of each, and
            three lists cannot be compared by counting down them. */}
        {team.owner || helping ? (
          <Box sx={{ mb: 3, p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                     backgroundColor: tokens.paper }}>
            <MonoLabel>Who runs this club</MonoLabel>
            <SplitBar parts={[
              { key: "owner", label: "Owner", value: team.owner ? 1 : 0, color: tokens.brand },
              { key: "manager", label: "Managers", value: team.managers.length,
                color: tokens.brass },
              { key: "helper", label: "Helpers", value: team.helpers.length,
                color: tokens.inkMuted },
            ]} />
          </Box>
        ) : null}

        {team.owner ? (
          <Box>
            <MonoLabel>Owner</MonoLabel>
            <TeamMemberRow member={team.owner} clubId={club.id} slug={club.slug}
              colour={faction.base} canEdit={false} />
          </Box>
        ) : null}

        <Box>
          <MonoLabel>Managers</MonoLabel>
          {team.managers.length ? (
            <Stack spacing={1}>
              {team.managers.map((m) => (
                <TeamMemberRow key={m.profileId} member={m} clubId={club.id}
                  slug={club.slug} colour={faction.base} canEdit />
              ))}
            </Stack>
          ) : (
            <Empty text="A manager can edit the listing, run events and look after members." />
          )}
        </Box>

        <Box>
          <MonoLabel>Helpers</MonoLabel>
          {team.helpers.length ? (
            <Stack spacing={1}>
              {team.helpers.map((m) => (
                <TeamMemberRow key={m.profileId} member={m} clubId={club.id}
                  slug={club.slug} colour={faction.base} canEdit />
              ))}
            </Stack>
          ) : (
            <Empty text="A helper can run club nights, confirm scores and moderate the board." />
          )}
        </Box>

        {team.invites.length ? (
          <Box>
            <MonoLabel>Waiting to be answered</MonoLabel>
            <Stack spacing={1}>
              {team.invites.map((invite) => (
                <InviteRow key={invite.id} invite={invite} clubId={club.id} slug={club.slug} />
              ))}
            </Stack>
          </Box>
        ) : null}

        <Box>
          <MonoLabel>Recent changes</MonoLabel>
          <RecentChanges
            changes={changes.changes}
            page={changes.page}
            total={changes.total}
            perPage={changes.perPage}
            basePath={`/clubs/${club.slug}/manage/team`}
          />
        </Box>

        <TransferOwnership clubId={club.id} slug={club.slug} clubName={club.name}
          candidates={candidates} />
      </Stack>
    </Container>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Box sx={{ px: 2, py: 1.75, borderRadius: 1.5, border: `1px dashed ${tokens.rule}` }}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{text}</Typography>
    </Box>
  );
}
