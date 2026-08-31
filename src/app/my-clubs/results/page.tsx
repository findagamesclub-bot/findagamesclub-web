import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/account/PageHead";
import ScoreQueue from "@/components/owner/ScoreQueue";
import BackLink from "@/components/ui/BackLink";
import { getCurrentProfile } from "@/services/auth.service";
import { getScoreQueue } from "@/services/ownerBookings.service";

export const metadata = { title: "Score approvals" };

/**
 * Every game across every club this person owns.
 *
 * The club pages answer "what happened here". Somebody running four clubs
 * asking "what is waiting on me" had to open four pages to find out, which is
 * why legacy keeps this as a workspace section rather than only on the club.
 */
export default async function OwnerResultsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-clubs/results");

  const queue = await getScoreQueue(viewer.id);
  // Somebody who runs no clubs has nothing to approve, and no business here.
  if (!queue.clubs.length) redirect("/my-clubs");

  const open = queue.contested.length + queue.unscored.length;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href="/my-clubs" label="My clubs" />
      <PageHead
        title="Score approvals"
        lede={open
          ? `${open} ${open === 1 ? "game needs" : "games need"} something from you, across ${
              queue.clubs.length === 1 ? "your club" : `${queue.clubs.length} clubs`}.`
          : "Every game played at your clubs, and where each result stands."}
      />
      <ScoreQueue queue={queue} />
    </Container>
  );
}
