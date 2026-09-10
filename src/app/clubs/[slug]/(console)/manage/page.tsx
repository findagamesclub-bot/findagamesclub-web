import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import StatStrip from "@/components/ui/StatStrip";
import MonoLabel from "@/components/ui/MonoLabel";
import TaskList from "@/components/console/TaskList";
import ClubPulse from "@/components/console/ClubPulse";
import SectionWidgets from "@/components/console/SectionWidgets";
import { getSectionWidgets } from "@/services/consoleWidgets.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getConsoleTasks, getUpcomingTables } from "@/services/console.service";
import { getClubPulse } from "@/services/clubPulse.service";
import { clubIdentity } from "@/utils/club-identity";
import { getJoinedCount } from "@/services/memberships.service";
import { ROLE_LABEL } from "@/utils/club-access";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/manage">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Manage ${club.name}` : "Manage club" };
}

export default async function ConsoleOverviewPage({
  params,
}: PageProps<"/clubs/[slug]/manage">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  // The layout has already refused anybody without a role, so this only asks
  // which one, to decide what the page offers.
  const viewer = await getCurrentProfile();
  const access = await getClubAccess(club.id, viewer);
  if (!access.role) notFound();

  const { faction } = clubIdentity(club.slug, club.name);

  const [tasks, upcomingTables, members, pulse, widgets] = await Promise.all([
    getConsoleTasks(club.id, club.slug, access, club.membershipTiers),
    getUpcomingTables(club.id),
    getJoinedCount(club.id).catch(() => 0),
    getClubPulse(club.id, club.membershipTiers),
    getSectionWidgets(club.id, club.slug, access, club.membershipTiers, faction.base)
      .catch(() => []),
  ]);

  const waiting = tasks.reduce((n, t) => n + t.count, 0);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <PageHead
        title={club.name}
        lede={waiting
          ? `${waiting === 1 ? "One thing is" : `${waiting} things are`} waiting on you.`
          : `You are here as a ${ROLE_LABEL[access.role].toLowerCase()}. Nothing is waiting on you.`}
      />

      <StatStrip
        stats={[
          { label: "Members", value: members ?? 0 },
          { label: "Tables ahead", value: upcomingTables },
          { label: "Waiting", value: waiting, emphasis: waiting > 0 },
        ]}
      />

      <Box sx={{ mt: 3 }}>
        <MonoLabel>Waiting on you</MonoLabel>
        <TaskList tasks={tasks} />
      </Box>

      {/* One card per section of the rail, in the rail's own order. What sat
          here before listed the same twelve destinations and said nothing
          about any of them. */}
      <Box sx={{ mt: 4 }}>
        <SectionWidgets widgets={widgets} colour={faction.base} />
      </Box>

      {/* The club as a whole, rather than section by section. */}
      <Box sx={{ mt: 4 }}>
        <MonoLabel>How the club is doing</MonoLabel>
        <ClubPulse pulse={pulse} colour={faction.base} />
      </Box>
    </Container>
  );
}
