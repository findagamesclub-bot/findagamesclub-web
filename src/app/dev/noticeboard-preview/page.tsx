import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EventNoticeboard from "@/components/events/EventNoticeboard";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

/**
 * Local-only view of the event noticeboard.
 *
 * It only renders for somebody holding a ticket, which makes it one of the
 * hardest blocks on the site to look at, and it has three shapes: both halves,
 * notices with no info board, and an info board with no notices.
 */
export default function NoticeboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");

  const notices = [
    { id: 4, createdAt: "2026-09-14T09:00:00Z",
      message: "Sunday now starts at 09:00, not 09:30. Round five should finish by 16:30." },
    { id: 3, createdAt: "2026-09-02T09:00:00Z",
      message: "The Civic Hall car park is being resurfaced that weekend. Use the Orchard Centre multi-storey instead, five minutes on foot and free after 10am." },
    { id: 1, createdAt: "2026-08-04T09:00:00Z",
      message: "Entries are open. 32 places, and last year sold out three weeks before the day." },
  ];

  const board = "Doors 08:45, first dice 09:30 sharp.\n\nBring three printed copies of your list, your own dice, tape measure and tokens.";

  return (
    <Container maxWidth="md" component="main" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Stack spacing={0.5}>
          <Typography variant="h1" sx={{ fontSize: "1.8rem" }}>Noticeboard preview</Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Local only. On a real event this is hidden until somebody holds a ticket.
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary">Both halves</Typography>
          <EventNoticeboard text={board} notices={notices} faction={faction} />
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary">Notices, no info board</Typography>
          <EventNoticeboard text="" notices={notices} faction={faction} />
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary">Info board, no notices</Typography>
          <EventNoticeboard text={board} faction={faction} />
        </Stack>
      </Stack>
    </Container>
  );
}
