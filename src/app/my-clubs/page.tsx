import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import OwnerClubCard from "@/components/owner/OwnerClubCard";
import WorkspaceLink from "@/components/owner/WorkspaceLink";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnerInbox } from "@/services/ownerInbox.service";
import { getOwnedOrders, getScoreQueue } from "@/services/ownerBookings.service";
import { countUnanswered } from "@/utils/club-order-filter";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "My clubs" };

export default async function MyClubsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-clubs");

  const clubs = await getOwnerInbox(viewer.id);
  const tasks = clubs.flatMap((c) => c.tasks);

  // Disputed and unscored games across every club. Counted here so the link can
  // carry the number, the way legacy shows "Score Approvals (3)".
  const queue = await getScoreQueue(viewer.id);
  const openResults = queue.contested.length + queue.unscored.length;

  // Orders nobody has answered yet, across every club.
  const ordersWaiting = countUnanswered(await getOwnedOrders(viewer.id));
  const clear = clubs.filter((c) => c.tasks.length === 0).length;

  // Clubs with something outstanding come first: the point of the page is what
  // needs doing, not an alphabetical list of what you own.
  const ordered = [...clubs].sort((a, b) => b.tasks.length - a.tasks.length);

  const counts = [
    { label: tasks.length === 1 ? "thing waiting" : "things waiting",
      value: tasks.length, emphasis: true },
    { label: "joins", value: tasks.filter((t) => t.kind === "join").length },
    { label: "tier requests", value: tasks.filter((t) => t.kind === "tier").length },
    { label: "orders", value: tasks.filter((t) => t.kind === "order").length },
    { label: "coaching", value: tasks.filter((t) => t.kind === "coaching").length },
  ].filter((c) => c.emphasis || c.value > 0);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>Your account</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>My clubs</Typography>
      </Stack>

      {clubs.length ? (
        <>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 4 }} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "baseline", mb: 1 }}>
            {counts.map((c) => (
              <Stack key={c.label} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.45rem",
                                  fontWeight: 700, lineHeight: 1,
                                  color: c.emphasis && c.value ? tokens.brass : tokens.ink }}>
                  {c.value}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted }}>
                  {c.label.toUpperCase()}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 3 }}>
            {tasks.length === 0
              ? `All ${clubs.length === 1 ? "clear" : `${clubs.length} clear`}. Nothing is waiting on you.`
              : clear
                ? `${clear} of your ${clubs.length} clubs ${clear === 1 ? "is" : "are"} clear.`
                : "Every club has something outstanding."}
          </Typography>

          {/* Across every club, rather than per club. An owner with four clubs
              had to open four pages to answer "is anybody playing this week"
              or "what is waiting on me to settle". */}
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
            <WorkspaceLink href="/my-clubs/bookings" label="All table bookings" />
            <WorkspaceLink href="/my-clubs/results" label="Score approvals"
              count={openResults} />
            <WorkspaceLink href="/my-clubs/orders" label="Merchandise orders"
              count={ordersWaiting} />
          </Stack>

          <Box sx={{ display: "grid", gap: 2,
                     // Each card is its own height. Stretching them left a
                     // clear club with a column of empty paper under one line.
                     alignItems: "start",
                     gridTemplateColumns: {
                       xs: "1fr",
                       sm: "repeat(2, 1fr)",
                       lg: "repeat(3, 1fr)",
                     } }}>
            {ordered.map((club) => <OwnerClubCard key={club.id} club={club} />)}
          </Box>
        </>
      ) : (
        <Box sx={{ mt: 3 }}>
          <EmptyState
            title="You do not run a club"
            description="Clubs you own appear here, with anything waiting on you across all of them."
            action={{ label: "Browse the directory", href: "/clubs" }}
          />
        </Box>
      )}
    </Container>
  );
}
